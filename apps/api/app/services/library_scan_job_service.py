from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from app.config import Settings
from app.services.archive_service import ArchiveService
from app.services.job_service import JobCancelled, JobService
from app.services.library_scan_service import LibraryScanService


class LibraryScanJobService:
    """后台逐文件入库（library_scan 任务）。仿 ExportJobService 线程模型。"""

    def __init__(self, settings: Settings, jobs: JobService, archive: ArchiveService, scan: LibraryScanService):
        self.settings = settings
        self.jobs = jobs
        self.archive = archive
        self.scan = scan
        self._worker_lock = threading.Lock()
        self._workers: dict[int, threading.Thread] = {}

    @staticmethod
    def _contained(path: Path, root: Path) -> bool:
        return path == root or root in path.parents

    def enqueue_scan(self, paths: list[str]) -> dict[str, Any]:
        root = self.settings.library_dir.resolve()
        clean = [
            str(Path(p).resolve())
            for p in paths
            if p and self._contained(Path(p).resolve(), root)
        ]
        target = {"paths": clean, "total": len(clean), "ingested": 0, "skipped": []}
        job = self.jobs.create("library_scan", target)
        self._start_worker(job["id"])
        return job

    def retry_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "failed" or existing["type"] != "library_scan":
            raise ValueError("Only failed library scan jobs can be retried")
        job = self.jobs.retry(job_id)
        self._start_worker(job_id)
        return job

    def resume_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "paused":
            return existing
        if existing["type"] != "library_scan":
            raise ValueError("Only paused library scan jobs can be resumed")
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
            self._workers[job_id] = thread
        thread.start()

    def _run_worker(self, job_id: int) -> None:
        try:
            self.run_scan(job_id)
        finally:
            with self._worker_lock:
                if self._workers.get(job_id) is threading.current_thread():
                    self._workers.pop(job_id, None)

    def run_scan(self, job_id: int) -> None:
        job = self.jobs.get(job_id)
        paths = [Path(p) for p in job["target"].get("paths", [])]
        total = len(paths)
        skipped: list[dict[str, Any]] = []
        ingested = 0
        try:
            self.jobs.mark_running(job_id, "ingesting", 0, total)
            root = self.settings.library_dir.resolve()
            for path in paths:
                self.jobs.checkpoint(job_id)
                try:
                    gallery_id = self.scan._read_gallery_id(path)
                    if gallery_id is not None:
                        work_id = self.archive.ingest_cbz(
                            path, source="remote", title=path.stem,
                            remote_gallery_id=gallery_id, metadata={"remote": "nhentai"},
                        )
                    else:
                        work_id = self.archive.ingest_cbz(
                            path, source="local", title=path.stem,
                            remote_gallery_id=None, metadata={},
                        )
                    ingested += 1
                    # Delete the loose original when ingest produced a canonical copy elsewhere.
                    row = self.archive.db.fetchone(
                        "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'"
                        " ORDER BY created_at DESC, id DESC LIMIT 1",
                        (work_id,),
                    )
                    if row:
                        stored = Path(row["path"]).resolve()
                        loose = path.resolve()
                        if stored != loose and self._contained(loose, root):
                            loose.unlink(missing_ok=True)
                except Exception as exc:  # noqa: BLE001 - 单文件失败不中断整批
                    skipped.append({"path": str(path), "reason": str(exc)})
                self.jobs.update_progress(job_id, "running", "ingesting", ingested + len(skipped), total)
            self.jobs.complete(job_id, {"ingested": ingested, "skipped": skipped})
        except JobCancelled:
            self.jobs.mark_cancelled(job_id)
