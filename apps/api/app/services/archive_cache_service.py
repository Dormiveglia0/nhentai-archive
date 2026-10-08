from __future__ import annotations

import json
import multiprocessing
import os
import shutil
import stat
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services.archive_manifest import inspect_archive, open_archive, unpack_manifest
from app.services.job_service import ACTIVE_STATUSES, JobCancelled, JobService
from app.services.media_library_service import MediaLibraryService


CACHE_DEFAULTS = {"max_bytes": 10 * 1024**3, "ttl_hours": 168, "max_parallel": 2,
                  "min_free_bytes": 256 * 1024**2}
LEASE_SECONDS = 1800


def _version(row: dict[str, Any]) -> str:
    return json.dumps([row["size_bytes"], row["mtime_ns"], row["device"], row["inode"], row["fingerprint"]])


def _copy_source(connection, source: dict[str, Any], destination: str) -> None:
    """Keep potentially stuck FUSE calls outside application/request threads."""
    try:
        try:
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024**2, 512 * 1024**2))
        except ImportError:
            pass
        config = json.loads(source["config_json"])
        MediaLibraryService.validate_root(Path(source["root_path"]), source["root_boundaries"])
        path = MediaLibraryService.source_path(Path(source["root_path"]), source["relative_path"], config.get("follow_symlinks", False))
        expected = (source["size_bytes"], source["mtime_ns"], source["device"], source["inode"])
        # O_NONBLOCK makes a replaced FIFO/device fail instead of hanging on open.
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_NOFOLLOW", 0))
        target = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0), 0o600)
        with os.fdopen(fd, "rb") as origin, os.fdopen(target, "wb") as local:
            before = os.fstat(origin.fileno())
            actual = (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino)
            if not stat.S_ISREG(before.st_mode) or actual != expected:
                raise ValueError("源文件已变化，请重新扫描后重试")
            copied = 0
            while chunk := origin.read(4 * 1024**2):
                copied += len(chunk)
                if copied > source["size_bytes"]:
                    raise ValueError("源文件在下载期间增长，请重新扫描")
                local.write(chunk)
                connection.send(("progress", copied))
                connection.recv()  # Parent pauses/cancels between bounded chunks.
            local.flush()
            os.fsync(local.fileno())
            after = os.fstat(origin.fileno())
        current = path.stat()
        if copied != source["size_bytes"] or any(
            (s.st_size, s.st_mtime_ns, s.st_dev, s.st_ino) != expected for s in (after, current)
        ):
            raise ValueError("源文件在下载期间变化，请重新扫描")
        if inspect_archive(Path(destination))["fingerprint"] != source["fingerprint"]:
            raise ValueError("归档内容与扫描索引不一致，请重新扫描")
        with open_archive(Path(destination)) as cached:
            for info in cached.infolist():
                with cached.open(info) as member:
                    while member.read(4 * 1024**2):
                        connection.send(("verify", copied))
                        connection.recv()
        connection.send(("done", copied))
    except Exception as exc:
        try:
            connection.send(("error", str(exc)[:500] or type(exc).__name__))
        except (BrokenPipeError, EOFError):
            pass
    finally:
        connection.close()


class ArchiveCacheService:
    def __init__(self, db: Database, settings: Settings, libraries: MediaLibraryService):
        self.db, self.settings, self.libraries = db, settings, libraries
        self.jobs = JobService(db)
        self._lock = threading.RLock()
        self._workers: dict[int, threading.Thread] = {}
        self._processes: dict[int, Any] = {}
        self._closing = threading.Event()
        self._maintenance = None

    def config(self) -> dict[str, int]:
        row = self.db.fetchone("SELECT value FROM settings WHERE key = 'reader.archive_cache'")
        return {**CACHE_DEFAULTS, **(json.loads(row["value"]) if row else {})}

    def configure(self, payload: dict[str, Any]) -> dict[str, Any]:
        if set(payload) - set(CACHE_DEFAULTS):
            raise ValueError("阅读缓存配置包含未知选项")
        config = {**self.config(), **payload}
        for key, lower, upper in (("max_bytes", 64 * 1024**2, 1024**4), ("ttl_hours", 1, 8760),
                                   ("max_parallel", 1, 4), ("min_free_bytes", 0, 1024**4)):
            if isinstance(config[key], bool) or not isinstance(config[key], int) or not lower <= config[key] <= upper:
                raise ValueError(f"{key}必须在{lower}至{upper}之间")
        with self._lock:
            self.db.execute("INSERT INTO settings(key, value) VALUES ('reader.archive_cache', ?) "
                            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
                            (json.dumps(config),))
            self._sweep()
        return self.summary()

    @staticmethod
    def required(source: dict[str, Any] | None) -> bool:
        if not source or not source["library_item_id"]:
            return False
        mode = json.loads(source["config_json"]).get("cache_mode", "auto")
        return mode == "always" or (mode == "auto" and source["library_kind"] == "mounted")

    def _path(self, cache_id: int, partial: bool = False) -> Path:
        return self.settings.archive_cache_dir / f"{cache_id}.{ 'part' if partial else 'cbz' }"

    def summary(self) -> dict[str, Any]:
        row = self.db.fetchone("""SELECT COALESCE(SUM(CASE WHEN status = 'ready' THEN size_bytes ELSE 0 END), 0) AS ready_bytes,
          COALESCE(SUM(CASE WHEN status IN ('queued', 'downloading', 'blocked') THEN size_bytes ELSE 0 END), 0) AS reserved_bytes,
          COUNT(CASE WHEN status = 'ready' THEN 1 END) AS ready_count FROM archive_cache""")
        active = self.db.fetchone("SELECT COUNT(DISTINCT cache_id) AS n FROM archive_cache_leases WHERE expires_at > ?", (time.time(),))
        return {"config": self.config(), **row, "active_count": active["n"], "path": str(self.settings.archive_cache_dir)}

    def prepare(self, work_id: int) -> dict[str, Any]:
        with self._lock:
            return self._prepare(work_id)

    def _prepare(self, work_id: int) -> dict[str, Any]:
        source = self.libraries.source_file(work_id) or self.libraries.source_file(work_id, available=False)
        if not source:
            raise FileNotFoundError("作品源文件不可用或源库已移除")
        if not self.required(source):
            return {"status": "direct", "cache_id": None, "lease": None}
        if not source.get("manifest") or not source.get("fingerprint"):
            raise ValueError("作品尚未完成扫描")
        with self._lock:
            self._reap()
            row = self.db.fetchone("SELECT * FROM archive_cache WHERE library_item_id = ? AND version = ?",
                                   (source["library_item_id"], _version(source)))
            if row and row["status"] == "ready":
                if self._path(row["id"]).is_file():
                    token = uuid.uuid4().hex
                    self.db.execute("INSERT INTO archive_cache_leases VALUES (?, ?, ?)", (token, row["id"], time.time() + LEASE_SECONDS))
                    self.db.execute("UPDATE archive_cache SET accessed_at = ? WHERE id = ?", (time.time(), row["id"]))
                    return {"status": "ready", "cache_id": row["id"], "lease": token,
                            "pages": [{**p, "work_id": work_id} for p in unpack_manifest(row["manifest"])]}
                self.db.execute("UPDATE archive_cache SET status = 'failed', last_error = '本地缓存已丢失' WHERE id = ?", (row["id"],))
                if row["job_id"]:
                    self.jobs.fail(row["job_id"], "本地缓存已丢失，可重试阅读准备")
                row = self.db.fetchone("SELECT * FROM archive_cache WHERE id = ?", (row["id"],))
            if row and (row["job_id"] or row["status"] in {"queued", "downloading", "blocked"}):
                return self._public(row)
            if row:
                self.db.execute("DELETE FROM archive_cache WHERE id = ?", (row["id"],))
            if len(self._workers) >= 32:
                raise ValueError("阅读准备队列已满，请稍后再试")
            self._sweep(source["size_bytes"])
            job = self.jobs.create("archive_cache", {"work_id": work_id, "library_id": source["library_id"]})
            now = time.time()
            cursor = self.db.execute("""INSERT INTO archive_cache(work_id, library_item_id, version, manifest, size_bytes,
              job_id, created_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
              (work_id, source["library_item_id"], _version(source), source["manifest"], source["size_bytes"], job["id"], now, now))
            row = self.db.fetchone("SELECT * FROM archive_cache WHERE id = ?", (cursor.lastrowid,))
            self._start(row["id"], job["id"])
            return self._public(row)

    def _public(self, row: dict[str, Any]) -> dict[str, Any]:
        job = self.jobs.get(row["job_id"]) if row["job_id"] else None
        return {"status": job["status"] if job and (row["status"] in {"queued", "downloading", "blocked"} or job["status"] == "paused")
                else "failed" if row["status"] == "blocked" else row["status"],
                "cache_id": row["id"], "lease": None, "job": job, "error": row["last_error"]}

    def _start(self, cache_id: int, job_id: int) -> None:
        if job_id in self._workers:
            return
        # ponytail: at most 32 queued threads and four IO processes; use a shared dispatcher if demand grows.
        thread = threading.Thread(target=self._run, args=(cache_id, job_id), daemon=True)
        self._workers[job_id] = thread
        thread.start()

    def _checkpoint(self, job_id: int) -> None:
        while self.jobs.get(job_id)["status"] == "paused":
            if self._closing.wait(0.2):
                raise JobCancelled()
        if self._closing.is_set():
            raise JobCancelled()
        self.jobs.checkpoint(job_id)

    @staticmethod
    def _stop(process) -> bool:
        if process is None or process.pid is None:
            return True
        if process.is_alive():
            process.terminate()
        process.join(1)
        if process.is_alive():
            process.kill()
            process.join(1)
        return not process.is_alive()

    def _run(self, cache_id: int, job_id: int) -> None:
        process, connection = None, None
        try:
            while True:
                self._checkpoint(job_id)
                with self._lock:
                    self._reap()
                    if len(self._processes) < self.config()["max_parallel"]:
                        self._processes[cache_id] = None
                        break
                self._closing.wait(0.2)
            row = self.db.fetchone("SELECT * FROM archive_cache WHERE id = ?", (cache_id,))
            source = self.libraries.source_file(row["work_id"], available=False, item_id=row["library_item_id"])
            if not source or source["library_item_id"] != row["library_item_id"] or _version(source) != row["version"]:
                raise ValueError("作品源版本已变化，请重新打开作品")
            source["root_boundaries"] = self.libraries.root_boundaries(source["library_id"])
            self._checkpoint(job_id)
            self.db.execute("UPDATE archive_cache SET status = 'downloading', last_error = NULL WHERE id = ?", (cache_id,))
            self.jobs.mark_running(job_id, "caching_archive", 0, row["size_bytes"])
            context = multiprocessing.get_context("spawn")
            connection, child = context.Pipe()
            process = context.Process(target=_copy_source, args=(child, source, str(self._path(cache_id, True))), daemon=True)
            process.start()
            child.close()
            with self._lock:
                self._processes[cache_id] = process
            timeout = json.loads(source["config_json"]).get("io_timeout_seconds", 30)
            deadline, last_progress, last_stage = time.monotonic() + timeout, 0.0, "caching_archive"
            while True:
                before = time.monotonic()
                self._checkpoint(job_id)
                deadline += time.monotonic() - before
                if connection.poll(0.2):
                    kind, value = connection.recv()
                    if kind == "error":
                        raise OSError(value)
                    if kind == "done":
                        break
                    now = time.monotonic()
                    stage = "verifying_archive" if kind == "verify" else "caching_archive"
                    if now - last_progress >= 0.5 or stage != last_stage:
                        self.jobs.update_progress(job_id, "running", stage, value, row["size_bytes"])
                        last_progress, last_stage = now, stage
                    self._checkpoint(job_id)
                    connection.send(True)
                    deadline = time.monotonic() + timeout
                elif time.monotonic() > deadline:
                    raise TimeoutError(f"源归档读取超过{timeout}秒，可重试")
            self._checkpoint(job_id)
            with self._lock:
                self._path(cache_id, True).replace(self._path(cache_id))
            self.jobs.complete(job_id, {"cache_id": cache_id})
            with self._lock:
                self.db.execute("UPDATE archive_cache SET status = 'ready', accessed_at = ? WHERE id = ?", (time.time(), cache_id))
        except JobCancelled:
            if not self._closing.is_set():
                self.jobs.mark_cancelled(job_id)
                self.db.execute("UPDATE archive_cache SET status = 'cancelled', last_error = NULL WHERE id = ?", (cache_id,))
        except Exception as exc:
            self.jobs.fail(job_id, str(exc)[:500])
            self.db.execute("UPDATE archive_cache SET status = 'failed', last_error = ? WHERE id = ?", (str(exc)[:500], cache_id))
        finally:
            if connection is not None:
                connection.close()
            stopped = self._stop(process)
            with self._lock:
                if stopped:
                    self._processes.pop(cache_id, None)
                    self._path(cache_id, True).unlink(missing_ok=True)
                    row = self.db.fetchone("SELECT status FROM archive_cache WHERE id = ?", (cache_id,))
                    if not row or row["status"] != "ready":
                        self._path(cache_id).unlink(missing_ok=True)
                else:
                    self.db.execute("UPDATE archive_cache SET status = 'blocked', last_error = '挂载读取仍被系统阻塞，恢复后可重试' WHERE id = ?", (cache_id,))
                # A kernel-blocked worker retains its slot; never start unbounded replacement processes.
                self._workers.pop(job_id, None)

    def _job_row(self, job_id: int) -> dict[str, Any]:
        row = self.db.fetchone("SELECT * FROM archive_cache WHERE job_id = ?", (job_id,))
        if not row:
            raise ValueError("阅读缓存任务不存在或已清理")
        return row

    def retry_job(self, job_id: int) -> dict[str, Any]:
        with self._lock:
            self._reap()
            row = self._job_row(job_id)
            if self.jobs.get(job_id)["status"] not in {"failed", "cancelled"}:
                raise ValueError("仅失败或取消的缓存任务可以重试")
            if job_id in self._workers or row["id"] in self._processes:
                raise ValueError("上一次读取尚未结束，请稍后重试")
            self._sweep(row["size_bytes"], keep_id=row["id"])
            job = self.jobs.retry(job_id)
            self.db.execute("UPDATE archive_cache SET status = 'queued', last_error = NULL WHERE id = ?", (row["id"],))
            self._start(row["id"], job_id)
            return job

    def resume_job(self, job_id: int) -> dict[str, Any]:
        with self._lock:
            row = self._job_row(job_id)
            if self.jobs.get(job_id)["status"] == "paused" and job_id not in self._workers:
                self._sweep(row["size_bytes"], keep_id=row["id"])
                self.db.execute("UPDATE archive_cache SET status = 'queued' WHERE id = ?", (row["id"],))
            job = self.jobs.resume(job_id)
            if job["status"] in ACTIVE_STATUSES and job_id not in self._workers:
                self._start(row["id"], job_id)
            return job

    def cancel_job(self, job_id: int) -> dict[str, Any]:
        with self._lock:
            row = self._job_row(job_id)
            job = self.jobs.cancel(job_id)
            if job["status"] not in {"cancelling", "cancelled"}:
                return job
            if job_id not in self._workers:
                self.jobs.mark_cancelled(job_id)
                self.db.execute("UPDATE archive_cache SET status = 'cancelled' WHERE id = ?", (row["id"],))
            return self.jobs.get(job_id)

    def touch_lease(self, work_id: int, token: str) -> dict[str, Any]:
        with self._lock:
            row = self.db.fetchone("""SELECT c.* FROM archive_cache c JOIN archive_cache_leases l ON l.cache_id = c.id
              WHERE c.work_id = ? AND l.token = ? AND c.status = 'ready'""", (work_id, token))
            if not row or not self._path(row["id"]).is_file():
                raise ValueError("阅读缓存已失效，请重新打开作品")
            now = time.time()
            self.db.execute("UPDATE archive_cache_leases SET expires_at = ? WHERE token = ?", (now + LEASE_SECONDS, token))
            self.db.execute("UPDATE archive_cache SET accessed_at = ? WHERE id = ?", (now, row["id"]))
            return row

    def is_current(self, row: dict[str, Any]) -> bool:
        source = self.libraries.source_file(row["work_id"]) or self.libraries.source_file(row["work_id"], available=False)
        return bool(source and source["library_item_id"] == row["library_item_id"]
                    and source["fingerprint"] == json.loads(row["version"])[4])

    def release(self, work_id: int, token: str) -> None:
        self.db.execute("DELETE FROM archive_cache_leases WHERE token = ? AND cache_id IN "
                        "(SELECT id FROM archive_cache WHERE work_id = ?)", (token, work_id))

    @contextmanager
    def source(self, work_id: int, token: str | None = None):
        temporary = token is None
        operation = None
        if temporary:
            with self._lock:
                origin = self.libraries.source_file(work_id) or self.libraries.source_file(work_id, available=False)
                ready = self.db.fetchone("SELECT id FROM archive_cache WHERE library_item_id = ? AND version = ? AND status = 'ready'",
                                        (origin["library_item_id"], _version(origin))) if origin else None
                if not ready or not self._path(ready["id"]).is_file():
                    raise FileNotFoundError("请先完成阅读缓存准备")
                token = uuid.uuid4().hex
                self.db.execute("INSERT INTO archive_cache_leases VALUES (?, ?, ?)", (token, ready["id"], time.time() + LEASE_SECONDS))
        try:
            with self._lock:
                row = self.touch_lease(work_id, token)
                if not temporary:
                    operation = uuid.uuid4().hex
                    self.db.execute("INSERT INTO archive_cache_leases VALUES (?, ?, ?)", (operation, row["id"], time.time() + LEASE_SECONDS))
            yield self._path(row["id"]), unpack_manifest(row["manifest"]), row["id"]
        finally:
            if operation:
                self.release(work_id, operation)
            if temporary and token:
                self.release(work_id, token)

    def _sweep(self, reserve: int = 0, clear: bool = False, keep_id: int | None = None) -> dict[str, int]:
        self._reap()
        config, now = self.config(), time.time()
        if reserve > config["max_bytes"]:
            raise ValueError("该作品超过阅读缓存容量，请增大配额")
        self.db.execute("DELETE FROM archive_cache_leases WHERE expires_at <= ?", (now,))
        rows = self.db.fetchall("SELECT id, work_id, status, size_bytes, job_id, accessed_at FROM archive_cache ORDER BY accessed_at, id")
        pinned = {r["cache_id"] for r in self.db.fetchall("SELECT DISTINCT cache_id FROM archive_cache_leases")}
        used = sum(r["size_bytes"] for r in rows if r["status"] in {"ready", "queued", "downloading", "blocked"})
        pending_bytes = sum(r["size_bytes"] for r in rows if r["status"] in {"queued", "downloading", "blocked"})
        free = shutil.disk_usage(self.settings.archive_cache_dir).free
        deleted, freed = 0, 0
        for row in rows:
            if row["id"] in pinned or row["id"] == keep_id or row["status"] in {"queued", "downloading", "blocked"} or row["id"] in self._processes:
                continue
            expired = row["accessed_at"] < now - config["ttl_hours"] * 3600
            need_space = used + reserve > config["max_bytes"] or free < pending_bytes + reserve + config["min_free_bytes"]
            if clear or expired or (need_space and row["status"] == "ready"):
                path = self._path(row["id"])
                actual = path.stat().st_size if path.exists() else 0
                path.unlink(missing_ok=True)
                self._path(row["id"], True).unlink(missing_ok=True)
                for thumb in self.settings.thumbs_dir.glob(f"{row['work_id']}-c{row['id']}-*.jpg"):
                    thumb.unlink(missing_ok=True)
                self.db.execute("DELETE FROM archive_cache WHERE id = ?", (row["id"],))
                if row["status"] == "ready":
                    used -= row["size_bytes"]
                free += actual
                freed += actual
                deleted += 1
        if reserve and (used + reserve > config["max_bytes"] or free < pending_bytes + reserve + config["min_free_bytes"]):
            raise ValueError("阅读缓存或磁盘空间不足；在用作品受保护，请稍后重试或调整配额")
        return {"deleted": deleted, "freed_bytes": freed}

    def sweep(self, clear: bool = False) -> dict[str, int]:
        with self._lock:
            return self._sweep(clear=clear)

    def _reap(self) -> None:
        for cache_id, child in list(self._processes.items()):
            if child is not None and not child.is_alive():
                child.join()
                self._processes.pop(cache_id)
                blocked = self.db.fetchone("SELECT id FROM archive_cache WHERE id = ? AND status = 'blocked'", (cache_id,))
                if blocked:
                    self._path(cache_id, True).unlink(missing_ok=True)
                    self._path(cache_id).unlink(missing_ok=True)
                    self.db.execute("UPDATE archive_cache SET status = 'failed' WHERE id = ?", (cache_id,))

    def recover_interrupted(self) -> None:
        with self._lock:
            # ponytail: restart interrupted copies from zero; resumable FUSE copies need verified source snapshots.
            self.db.execute("UPDATE archive_cache SET status = 'failed', last_error = '应用重启，可重试阅读准备' "
                            "WHERE status IN ('queued', 'downloading', 'blocked')")
            ready = {r["id"] for r in self.db.fetchall("SELECT id FROM archive_cache WHERE status = 'ready'")}
            for path in self.settings.archive_cache_dir.iterdir():
                if path.stem.isascii() and path.stem.isdigit() and path.suffix in {".cbz", ".part"}:
                    if path.suffix == ".part" or int(path.stem) not in ready:
                        path.unlink(missing_ok=True)
            self._sweep()

    def close(self) -> None:
        self._closing.set()
        for process in list(self._processes.values()):
            self._stop(process)
        if self._maintenance is not None:
            self._maintenance.join(1)

    def start(self) -> None:
        if self._maintenance is not None and self._maintenance.is_alive():
            return
        self._closing.clear()
        def maintain():
            import logging
            while not self._closing.wait(60):
                try:
                    self.sweep()
                except OSError:
                    logging.getLogger(__name__).exception("阅读缓存清理失败")
        self._maintenance = threading.Thread(target=maintain, daemon=True)
        self._maintenance.start()
