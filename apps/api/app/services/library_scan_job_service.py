from __future__ import annotations

import os
import json
import threading
import time
from pathlib import Path
from typing import Any

from app.config import Settings
from app.services.job_service import JobCancelled, JobService
from app.services.library_index_service import LibraryIndexService
from app.services.media_library_service import MediaLibraryService


class LibraryScanJobService:
    def __init__(self, settings: Settings, jobs: JobService, index: LibraryIndexService, libraries: MediaLibraryService):
        self.settings, self.jobs, self.index, self.libraries = settings, jobs, index, libraries
        self._worker_lock = threading.Lock()
        self._workers: dict[int, threading.Thread] = {}
        self._closing = threading.Event()
        self.migration = None
        self.bridge = None

    def enqueue_scan(self, paths: list[str] | None = None, library_id: int | None = None) -> dict[str, Any]:
        if library_id is None:
            library_id = self.jobs.db.fetchone("SELECT id FROM media_libraries WHERE kind = 'managed'")["id"]
        library = self.libraries.get(library_id)
        if not library["enabled"]:
            raise ValueError("请先启用该目录库")
        if self.jobs.db.fetchone("""SELECT 1 FROM jobs j, json_each(j.target_json, '$.plan') p
            WHERE j.type='library_migration' AND j.status IN ('queued','running','paused','cancelling')
            AND (json_extract(j.target_json, '$.library_id')=? OR json_extract(p.value, '$.source_library_id')=?) LIMIT 1""", (library_id, library_id)):
            raise ValueError("媒体库正在迁移，请完成迁移后再扫描")
        target = {"library_id": library_id, "title": library["name"], "ingested": 0, "skipped": []}
        if paths is not None:
            if len(paths) > 5000:
                raise ValueError("单次选取不能超过5000个文件，请使用完整库扫描")
            root = Path(library["root_path"])
            clean = []
            for value in paths:
                if not value or "\x00" in value:
                    continue
                path = Path(os.path.abspath(root / value))
                try:
                    relative = path.relative_to(root).as_posix()
                except ValueError:
                    continue
                if relative != ".":
                    clean.append(relative)
            target["paths"] = list(dict.fromkeys(clean))
        with self._worker_lock:
            active = self.jobs.db.fetchone(
                """SELECT id FROM jobs WHERE type = 'library_scan' AND status IN ('queued', 'running', 'paused', 'cancelling')
                AND json_extract(target_json, '$.library_id') = ? ORDER BY id DESC LIMIT 1""", (library_id,),
            )
            if active:
                return self.jobs.get(active["id"])
            job = self.jobs.create("library_scan", target)
        self._start_worker(job["id"])
        return job

    def retry_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "failed" or existing["type"] not in {"library_scan", "library_migration", "reader_verify"}:
            raise ValueError("仅失败的扫描或迁移任务可以重试")
        library_id = existing["target"].get("library_id")
        if library_id is not None:
            self.libraries.get(library_id)
        job = self.jobs.retry(job_id)
        self._start_worker(job_id)
        return job

    def resume_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "paused":
            return existing
        if existing["type"] not in {"library_scan", "library_migration", "reader_verify"}:
            raise ValueError("仅暂停的扫描或迁移任务可以继续")
        job = self.jobs.resume(job_id)
        if not self._worker_alive(job_id):
            self._start_worker(job_id)
        return job

    def cancel_job(self, job_id: int) -> dict[str, Any]:
        job = self.jobs.cancel(job_id)
        if job["status"] == "cancelling" and not self._worker_alive(job_id):
            self.jobs.mark_cancelled(job_id)
            return self.jobs.get(job_id)
        return job

    def _worker_alive(self, job_id: int) -> bool:
        with self._worker_lock:
            thread = self._workers.get(job_id)
            return bool(thread and thread.is_alive())

    def _start_worker(self, job_id: int) -> None:
        thread = threading.Thread(target=self._run_worker, args=(job_id,), daemon=True)
        with self._worker_lock:
            if job_id in self._workers:
                return
            self._workers[job_id] = thread
        thread.start()

    def _run_worker(self, job_id: int) -> None:
        try:
            if self.jobs.get(job_id)["type"] == "library_migration":
                self.migration.run(job_id, lambda: self._checkpoint(job_id))
            elif self.jobs.get(job_id)["type"] == "reader_verify":
                self.bridge.run(job_id, lambda: self._checkpoint(job_id))
            else:
                self.run_scan(job_id)
        except JobCancelled:
            if not self._closing.is_set():
                self.jobs.mark_cancelled(job_id)
        finally:
            with self._worker_lock:
                if self._workers.get(job_id) is threading.current_thread():
                    self._workers.pop(job_id, None)

    def _checkpoint(self, job_id: int) -> None:
        while True:
            job = self.jobs.get(job_id)
            if self._closing.is_set() or job["status"] in {"cancelled", "cancelling"}:
                raise JobCancelled()
            if job["status"] != "paused":
                return
            self._closing.wait(.2)

    def enqueue_migration(self, work_ids, library_id, move=False, conflict="rename"):
        with self._worker_lock:
            target = self.migration.preview(work_ids, library_id, move, conflict)
            if not target["ready"] or target["blocked"]:
                raise ValueError("选择中含无法迁移的作品，请重新预览")
            with self.jobs.db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                if conn.execute("SELECT 1 FROM jobs WHERE type='library_migration' AND status IN ('queued','running','paused','cancelling')").fetchone():
                    raise ValueError("请先完成或取消当前迁移任务")
                self.libraries._require_idle(library_id)
                job_id = conn.execute("INSERT INTO jobs(type, status, stage, target_json) VALUES ('library_migration','queued','queued',?) RETURNING id",
                                      (json.dumps(target, ensure_ascii=False),)).fetchone()["id"]
        self._start_worker(job_id)
        return self.jobs.get(job_id)

    def enqueue_verification(self, work_id):
        snapshot = self.bridge._snapshot(work_id)
        target = {"work_id": work_id, "gallery_id": snapshot["gallery_id"], "version": snapshot["version"],
                  "source_library_id": snapshot["source"]["library_id"] or self.jobs.db.fetchone("SELECT id FROM media_libraries WHERE kind='managed'")["id"]}
        with self._worker_lock:
            with self.jobs.db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                active = conn.execute("SELECT id FROM jobs WHERE type='reader_verify' AND status IN ('queued','running','paused','cancelling') LIMIT 1").fetchone()
                if active:
                    raise ValueError("请先完成或取消当前逐页核验任务")
                job_id = conn.execute("INSERT INTO jobs(type,status,stage,target_json) VALUES ('reader_verify','queued','queued',?) RETURNING id",
                                      (json.dumps(target),)).fetchone()["id"]
                conn.execute("""INSERT INTO reader_bridges(work_id,remote_gallery_id,version,status,job_id) VALUES (?,?,?,'verifying',?)
                    ON CONFLICT(work_id) DO UPDATE SET remote_gallery_id=excluded.remote_gallery_id,version=excluded.version,
                    status='verifying',error=NULL,catalog_json='[]',job_id=excluded.job_id""", (work_id, snapshot["gallery_id"], snapshot["version"], job_id))
        self._start_worker(job_id)
        return self.jobs.get(job_id)

    def run_scan(self, job_id: int) -> None:
        job = self.jobs.get(job_id)
        target = job["target"]
        library_id = target.get("library_id")
        # Interrupted tasks from the previous release still contain absolute managed paths.
        if library_id is None:
            library_id = self.jobs.db.fetchone("SELECT id FROM media_libraries WHERE kind = 'managed'")["id"]
        reported_at = 0.0

        def checkpoint():
            self._checkpoint(job_id)

        def progress(counts):
            nonlocal reported_at
            if time.monotonic() - reported_at >= 0.5:
                self.jobs.update_progress(job_id, "running", "scanning", counts["files"], 0)
                reported_at = time.monotonic()

        try:
            self.jobs.mark_running(job_id, "scanning")
            library = self.libraries.get(library_id)
            paths = target.get("paths")
            if paths is not None:
                root = Path(library["root_path"])
                paths = [Path(path).relative_to(root).as_posix() if Path(path).is_absolute() else path for path in paths]
            result = self.index.scan(library_id, checkpoint, progress, job_id, paths)
            if result["counts"]["pending"]:
                deadline = time.monotonic() + library["config"]["stable_seconds"]
                while time.monotonic() < deadline:
                    checkpoint()
                    time.sleep(0.1)
                rows = self.jobs.db.fetchall(
                    "SELECT relative_path FROM library_items WHERE library_id = ? AND status = 'pending' AND last_seen_run_id = ? LIMIT 5001",
                    (library_id, result["run_id"]),
                )
                pending = [row["relative_path"] for row in rows]
                second = self.index.scan(library_id, checkpoint, progress, job_id, pending if len(pending) <= 5000 else None)
                result["counts"]["pending"] = second["counts"]["pending"]
                for key in ("indexed", "errors"):
                    result["counts"][key] += second["counts"][key]
                result["errors"] = (result["errors"] + second["errors"])[:30]
                result["stability_run_id"] = second["run_id"]
            with self.jobs.db.connect() as conn:
                for error in result["errors"]:
                    self.jobs._log_with_conn(conn, job_id, "warning", f"{error['path']}: {error['reason']}")
            self.jobs.complete(job_id, {**result, "library_id": library_id, "ingested": result["counts"]["indexed"], "skipped": result["errors"]})
        except JobCancelled:
            if not self._closing.is_set():
                self.jobs.mark_cancelled(job_id)
        except Exception as exc:
            self.jobs.fail(job_id, str(exc)[:1000])

    def start(self) -> None:
        self._closing.clear()

    def close(self) -> None:
        self._closing.set()
        deadline = time.monotonic() + 2
        for thread in list(self._workers.values()):
            thread.join(max(0, deadline - time.monotonic()))
