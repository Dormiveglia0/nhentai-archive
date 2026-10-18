from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import time
from pathlib import Path
from typing import Any

from app.services.file_identity import sqlite_file_id
from app.services.archive_manifest import inspect_archive, open_archive
from app.services.job_service import JobCancelled


class LibraryMigrationService:
    """Move owned imports into a directory without re-importing their records."""
    def __init__(self, settings, db, libraries, index, files, jobs):
        self.settings, self.db, self.libraries = settings, db, libraries
        self.index, self.files, self.jobs = index, files, jobs

    def candidates(self, page=1, q=""):
        where = """f.kind = 'source_cbz' AND (f.library_item_id IS NULL OR
                   (l.kind = 'managed' AND l.removed_at IS NULL AND i.status = 'ready'))"""
        params = []
        if q.strip():
            where += " AND (w.title LIKE ? OR w.pretty_title LIKE ?)"
            params = [f"%{q.strip()[:240]}%"] * 2
        joins = """FROM work_files f JOIN works w ON w.id = f.work_id
                   LEFT JOIN library_items i ON i.id = f.library_item_id
                   LEFT JOIN media_libraries l ON l.id = i.library_id"""
        total = self.db.fetchone(f"SELECT COUNT(DISTINCT w.id) AS n {joins} WHERE {where}", params)["n"]
        page = max(1, page)
        rows = self.db.fetchall(f"""SELECT w.id, w.title, w.pretty_title, w.page_count,
            MAX(f.size_bytes) AS size_bytes {joins} WHERE {where}
            GROUP BY w.id ORDER BY w.id DESC LIMIT 50 OFFSET ?""", [*params, (page - 1) * 50])
        return {"result": rows, "total": total, "page": page, "per_page": 50}

    def _target(self, library_id):
        library = self.libraries.get(library_id)
        if library["kind"] != "local" or library["read_only"] or not library["enabled"]:
            raise ValueError("迁移目标必须是已启用、可写的本地目录库")
        root = self.libraries.validate_root(Path(library["root_path"]), self.libraries.root_boundaries(library_id))
        info = root.stat()
        if library["resolved_root_path"] and str(root) != library["resolved_root_path"]:
            raise ValueError("目标根目录已变化，请先扫描")
        if library["root_device"] is not None and (sqlite_file_id(info.st_dev), sqlite_file_id(info.st_ino)) != (library["root_device"], library["root_inode"]):
            raise ValueError("目标根目录版本已变化，请先扫描")
        return library, root

    def _source(self, work_id):
        rows = self.libraries.files(work_id)
        source = next((r for r in rows if r["kind"] == "source_cbz" and not r["removed_at"]
                       and (r["library_item_id"] is None or (r["library_kind"] == "managed" and r["source_status"] == "ready"))), None)
        if not source:
            raise ValueError("没有可迁移的本地导入源文件")
        path = self.libraries.resolve_file(source)
        managed_id = self.db.fetchone("SELECT id FROM media_libraries WHERE kind='managed'")["id"]
        managed = self.libraries.validate_root(self.settings.library_dir, self.libraries.root_boundaries(managed_id))
        if managed not in path.parents or path.is_symlink():
            raise ValueError("只能迁移应用导入目录中的普通文件")
        info = path.stat()
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("源归档不是普通文件")
        return source, path, info

    @staticmethod
    def _stamp(info):
        return [info.st_size, info.st_mtime_ns, sqlite_file_id(info.st_dev), sqlite_file_id(info.st_ino)]

    def preview(self, work_ids, library_id, move=False, conflict="rename"):
        ids = list(dict.fromkeys(work_ids))
        if not 1 <= len(ids) <= 500 or any(isinstance(i, bool) or not isinstance(i, int) or i < 1 for i in ids):
            raise ValueError("请选择1至500部作品")
        if conflict not in {"rename", "skip"}:
            raise ValueError("冲突策略无效")
        library, root = self._target(library_id)
        self.libraries._require_idle(library_id)
        plan, total, names = [], 0, set()
        for work_id in ids:
            work = self.db.fetchone("SELECT id, title, pretty_title FROM works WHERE id = ?", (work_id,))
            if not work:
                raise ValueError("作品已被移除，请刷新")
            entry = {"work_id": work_id, "title": work["pretty_title"] or work["title"], "status": "ready"}
            try:
                source, path, info = self._source(work_id)
                if move:
                    self._move_allowed(work_id, source, path)
                name = path.name
                collision = (root / name).exists() or (root / name).is_symlink() or name in names
                if collision and conflict == "skip":
                    entry.update(status="skipped", reason="目标已有同名文件")
                else:
                    if collision:
                        stem = path.stem.encode()[:160].decode(errors="ignore")
                        name = f"{work_id}-{stem}{path.suffix.lower()}"
                        n = 1
                        while (root / name).exists() or (root / name).is_symlink() or name in names:
                            name = f"{work_id}-{stem}-{n}{path.suffix.lower()}"
                            n += 1
                    names.add(name)
                    entry.update(source_id=source["id"], source_path=str(path), source_item_id=source["library_item_id"], stamp=self._stamp(info), size_bytes=info.st_size, name=name,
                                 source_library_id=source["library_id"] or self.db.fetchone("SELECT id FROM media_libraries WHERE kind='managed'")["id"])
                    total += info.st_size
            except (OSError, ValueError) as exc:
                entry.update(status="blocked", reason=str(exc))
            plan.append(entry)
        free = shutil.disk_usage(root).free
        if total > free - min(256 * 1024**2, free // 10):
            raise ValueError("目标磁盘空间不足，需同时保留源文件和已验证副本")
        return {"library_id": library_id, "library_name": library["name"], "root_path": str(root),
                "root_stamp": self._stamp(root.stat()), "move": bool(move), "conflict": conflict,
                "plan": plan, "total_bytes": total, "free_bytes": free,
                "ready": sum(e["status"] == "ready" for e in plan), "blocked": sum(e["status"] == "blocked" for e in plan)}

    def _move_allowed(self, work_id, source, path, job_id=None):
        self.files._work_files(work_id, keep_sources=True, except_job_id=job_id)
        self.libraries.resolve_file(source, for_write=True, action="delete")
        if self.db.fetchone("SELECT 1 FROM work_files WHERE kind='source_cbz' AND work_id <> ? AND path IN (?, ?)",
                            (work_id, str(path), self.db.managed_path(path))):
            raise ValueError("源文件被其他作品引用，不能移动")

    def _save(self, job_id, target):
        self.db.execute("UPDATE jobs SET target_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (json.dumps(target, ensure_ascii=False), job_id))

    @staticmethod
    def _digest(path, checkpoint):
        digest = hashlib.sha256()
        fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as handle:
            if not stat.S_ISREG(os.fstat(handle.fileno()).st_mode):
                raise ValueError("迁移文件不是普通文件")
            while chunk := handle.read(1024 * 1024):
                checkpoint()
                digest.update(chunk)
        return digest.hexdigest()

    def _register(self, entry, library, destination, data, digest):
        info = destination.stat()
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            item = conn.execute("SELECT id, work_id FROM library_items WHERE library_id=? AND relative_path=?", (library["id"], entry["name"])).fetchone()
            if item and item["work_id"] not in {None, entry["work_id"]}:
                raise ValueError("目标文件已关联其他作品，保留现有文件")
            if not conn.execute("SELECT id FROM works WHERE id=?", (entry["work_id"],)).fetchone():
                raise ValueError("原作品记录已移除")
            item_id = conn.execute("""INSERT INTO library_items(library_id, relative_path, work_id, size_bytes,
                mtime_ns, device, inode, stable_since, status, fingerprint, manifest, metadata_json, archive_info_json, indexed_at, scrape_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, CURRENT_TIMESTAMP, 'done')
                ON CONFLICT(library_id, relative_path) DO UPDATE SET work_id=excluded.work_id, size_bytes=excluded.size_bytes,
                mtime_ns=excluded.mtime_ns, device=excluded.device, inode=excluded.inode, status='ready', fingerprint=excluded.fingerprint,
                manifest=excluded.manifest, metadata_json=excluded.metadata_json, archive_info_json=excluded.archive_info_json,
                last_error=NULL, indexed_at=CURRENT_TIMESTAMP RETURNING id""",
                (library["id"], entry["name"], entry["work_id"], info.st_size, info.st_mtime_ns, sqlite_file_id(info.st_dev), sqlite_file_id(info.st_ino), time.time(),
                 data["fingerprint"], data["manifest"], json.dumps(data["metadata"], ensure_ascii=False), json.dumps(data["archive_info"], ensure_ascii=False))).fetchone()["id"]
            conn.execute("""INSERT INTO work_files(work_id, kind, path, size_bytes, sha256, library_item_id)
                VALUES (?, 'source_cbz', ?, ?, ?, ?) ON CONFLICT(library_item_id) WHERE library_item_id IS NOT NULL
                DO UPDATE SET size_bytes=excluded.size_bytes, sha256=excluded.sha256""",
                (entry["work_id"], str(destination), info.st_size, digest, item_id))
            conn.execute("UPDATE media_libraries SET health='online', root_device=?, root_inode=?, resolved_root_path=? WHERE id=?",
                         (sqlite_file_id(destination.parent.stat().st_dev), sqlite_file_id(destination.parent.stat().st_ino), str(destination.parent), library["id"]))
        # Work metadata, tags, cover, favorite, governance and progress are deliberately untouched.

    def run(self, job_id, checkpoint):
        target = self.jobs.get(job_id)["target"]
        try:
            self.jobs.mark_running(job_id, "migrating")
            library, root = self._target(target["library_id"])
            if self._stamp(root.stat())[2:] != target["root_stamp"][2:]:
                raise ValueError("目标目录已被替换，请重新预览")
            count = len([e for e in target["plan"] if e["status"] != "skipped"])
            finished = 0
            for entry in target["plan"]:
                checkpoint()
                if entry["status"] == "skipped":
                    continue
                if entry["status"] == "completed":
                    finished += 1
                    continue
                if entry["status"] == "blocked":
                    raise ValueError(entry["reason"])
                destination = self.libraries.source_path(root, entry["name"])
                temporary = root / f".nh-migrate-{job_id}-{entry['source_id']}.part"
                try:
                    # Recover the small unlink/transaction window after a process interruption.
                    if target["move"] and entry.get("registered") and not Path(entry["source_path"]).exists():
                        if self._digest(destination, checkpoint) != entry["sha256"]:
                            raise ValueError("已登记的目标文件校验失败，请恢复文件后重试")
                        with self.db.connect() as conn:
                            conn.execute("BEGIN IMMEDIATE")
                            current = conn.execute("SELECT path FROM work_files WHERE id=? AND work_id=?", (entry["source_id"], entry["work_id"])).fetchone()
                            if current and str(Path(current["path"]).resolve()) != entry["source_path"]:
                                raise ValueError("源文件路径已变化，请重新预览迁移")
                            conn.execute("DELETE FROM work_files WHERE id=? AND work_id=?", (entry["source_id"], entry["work_id"]))
                            if entry["source_item_id"]:
                                conn.execute("UPDATE library_items SET status='missing', work_id=NULL WHERE id=?", (entry["source_item_id"],))
                        entry["status"] = "completed"; finished += 1
                        target["migrated"] = finished; self._save(job_id, target)
                        continue
                    source, path, info = self._source(entry["work_id"])
                    if source["id"] != entry["source_id"] or self._stamp(info) != entry["stamp"]:
                        raise ValueError("源文件已变化，请重新预览迁移")
                    if target["move"]:
                        self._move_allowed(entry["work_id"], source, path, job_id)
                    registered = bool(entry.get("registered"))
                    if not registered:
                        digest = hashlib.sha256()
                        read_count, reported = 0, time.monotonic()
                        # A private, exclusive temporary cannot truncate existing files or follow symlinks.
                        temporary.unlink(missing_ok=True) if temporary.exists() and not temporary.is_symlink() else None
                        in_fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
                        with os.fdopen(in_fd, "rb") as input_file, temporary.open("xb") as output:
                            if self._stamp(os.fstat(input_file.fileno())) != entry["stamp"]:
                                raise ValueError("源文件已被替换")
                            while chunk := input_file.read(1024 * 1024):
                                checkpoint()
                                output.write(chunk); digest.update(chunk); read_count += len(chunk)
                                if time.monotonic() - reported >= .5:
                                    self.jobs.update_progress(job_id, "running", "migrating", read_count, info.st_size)
                                    reported = time.monotonic()
                            output.flush(); os.fsync(output.fileno())
                            if self._stamp(os.fstat(input_file.fileno())) != entry["stamp"] or self._stamp(path.stat()) != entry["stamp"]:
                                raise ValueError("复制过程中源文件变化，源文件已保留")
                        digest = digest.hexdigest()
                        self.jobs.update_progress(job_id, "running", "verifying_archive", 0, info.st_size)
                        if self._digest(temporary, checkpoint) != digest:
                            raise ValueError("目标副本校验失败")
                        with open_archive(temporary) as archive:
                            if sum(m.file_size for m in archive.infolist()) > 4 * 1024**3:
                                raise ValueError("归档解压总量超过4GB")
                            for member in archive.infolist():
                                if member.file_size > 256 * 1024**2:
                                    raise ValueError("归档单项超过256MB")
                                with archive.open(member) as part:
                                    while part.read(1024 * 1024):
                                        checkpoint()
                        data = inspect_archive(temporary)
                        checkpoint()
                        while not self.index._scan_lock.acquire(timeout=.2):
                            checkpoint()
                        try:
                            self._target(target["library_id"])
                            if self._stamp(path.stat()) != entry["stamp"]:
                                raise ValueError("源文件已变化")
                            prior_digest = entry.get("sha256")
                            entry["sha256"] = digest
                            self._save(job_id, target)
                            if destination.exists() or destination.is_symlink():
                                if prior_digest != digest or self._digest(destination, checkpoint) != digest:
                                    raise ValueError("目标文件发生冲突，未覆盖，请重新预览")
                            else:
                                os.link(temporary, destination)  # Same filesystem, atomic and never overwrites.
                                directory_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
                                try: os.fsync(directory_fd)
                                finally: os.close(directory_fd)
                            self._register(entry, library, destination, data, digest)
                            entry["registered"] = True
                            self._save(job_id, target)
                        finally:
                            self.index._scan_lock.release()
                    if target["move"]:
                        if self._digest(destination, checkpoint) != entry["sha256"]:
                            raise ValueError("目标文件变化，保留源文件")
                        dest_stamp = self._stamp(destination.stat())
                        with self.files.cache._lock:
                            self._move_allowed(entry["work_id"], source, path, job_id)
                            if self._stamp(destination.stat()) != dest_stamp or self._stamp(path.stat()) != entry["stamp"]:
                                raise ValueError("验证后文件变化，保留源文件")
                            with self.db.connect() as conn:
                                conn.execute("BEGIN IMMEDIATE")
                                if conn.execute("SELECT 1 FROM reading_sessions WHERE work_id=? AND ended_at IS NULL AND updated_at > datetime('now', '-2 minutes')", (entry["work_id"],)).fetchone():
                                    raise ValueError("作品正在阅读，保留源文件")
                                path.unlink()
                                conn.execute("DELETE FROM work_files WHERE id=?", (source["id"],))
                                if source["library_item_id"]:
                                    conn.execute("UPDATE library_items SET status='missing', work_id=NULL WHERE id=?", (source["library_item_id"],))
                    entry["status"] = "completed"
                    finished += 1
                    target["migrated"] = finished
                    self._save(job_id, target)
                    self.jobs.update_progress(job_id, "running", "migrating", finished, count)
                finally:
                    if temporary.is_file() and not temporary.is_symlink():
                        temporary.unlink(missing_ok=True)
            self.jobs.complete(job_id, {"migrated": finished})
        except JobCancelled:
            raise
        except Exception as exc:
            self.jobs.fail(job_id, str(exc)[:1000])
