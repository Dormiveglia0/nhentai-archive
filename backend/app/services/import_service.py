from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from app.config import Settings
from app.services.archive_service import ArchiveService
from app.services.discover_service import DiscoverService
from app.services.dictionary_service import DictionaryService
from app.services.job_service import JobCancelled, JobService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient


class ImportService:
    def __init__(
        self,
        settings: Settings,
        client: NhentaiClient,
        jobs: JobService,
        archive: ArchiveService,
        discover: DiscoverService,
        dictionary: DictionaryService | None = None,
    ):
        self.settings = settings
        self.client = client
        self.jobs = jobs
        self.archive = archive
        self.discover = discover
        self.dictionary = dictionary
        self._worker_lock = threading.Lock()
        self._workers: dict[int, threading.Thread] = {}

    def enqueue_remote_import(self, gallery_id: int) -> dict[str, Any]:
        existing = self.archive.db.fetchone("SELECT id FROM works WHERE remote_gallery_id = ?", (gallery_id,))
        if existing:
            return self.jobs.create("remote_import", {"gallery_id": gallery_id, "work_id": existing["id"], "already_imported": True})
        job = self.jobs.create("remote_import", {"gallery_id": gallery_id})
        self._start_remote_import(job["id"], gallery_id)
        return job

    def retry_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        gallery_id = existing["target"].get("gallery_id")
        if existing["status"] != "failed" or existing["type"] != "remote_import" or not gallery_id:
            raise ValueError("Only failed remote import jobs with a gallery_id can be retried")
        job = self.jobs.retry(job_id)
        self._start_remote_import(job_id, int(gallery_id))
        return job

    def resume_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        gallery_id = existing["target"].get("gallery_id")
        if existing["status"] != "paused":
            return existing
        if existing["type"] != "remote_import" or not gallery_id:
            raise ValueError("Only paused remote import jobs with a gallery_id can be resumed")
        job = self.jobs.resume(job_id)
        if not self._worker_alive(job_id):
            self._start_remote_import(job_id, int(gallery_id))
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

    def _start_remote_import(self, job_id: int, gallery_id: int) -> None:
        thread = threading.Thread(target=self._run_remote_import_worker, args=(job_id, gallery_id), daemon=True)
        with self._worker_lock:
            self._workers[job_id] = thread
        thread.start()

    def _run_remote_import_worker(self, job_id: int, gallery_id: int) -> None:
        try:
            self.run_remote_import(job_id, gallery_id)
        finally:
            with self._worker_lock:
                if self._workers.get(job_id) is threading.current_thread():
                    self._workers.pop(job_id, None)

    def run_remote_import(self, job_id: int, gallery_id: int) -> None:
        tmp_path: Path | None = None
        try:
            self.jobs.checkpoint(job_id)
            self.jobs.mark_running(job_id, "fetching_gallery", 1, 5)
            gallery = self.client.gallery(gallery_id, include="related")
            self.discover.cache_gallery(gallery)
            self.discover.cache_tags(gallery.get("tags", []))

            self.jobs.checkpoint(job_id)
            self.jobs.update_progress(job_id, "running", "requesting_download_url", 2, 5)
            download = self.client.download_url(gallery_id)

            self.jobs.checkpoint(job_id)
            self.jobs.update_progress(job_id, "running", "downloading_cbz", 3, 5)
            tmp_path = self.settings.tmp_dir / f"nhentai-{gallery_id}.cbz"
            self.client.download_file(download["url"], tmp_path)

            self.jobs.checkpoint(job_id)
            self.jobs.update_progress(job_id, "running", "indexing_archive", 4, 5)
            title = gallery.get("title", {}).get("english") or gallery.get("title", {}).get("pretty") or str(gallery_id)
            work_id = self.archive.ingest_cbz(
                Path(tmp_path),
                source="remote",
                title=title,
                remote_gallery_id=gallery_id,
                metadata={
                    "remote": "nhentai",
                    "media_id": gallery.get("media_id"),
                    "title_japanese": gallery.get("title", {}).get("japanese"),
                    "pretty_title": gallery.get("title", {}).get("pretty"),
                },
            )
            if self.dictionary:
                self.dictionary.link_work_tags(work_id, gallery.get("tags", []))
            tmp_path.unlink(missing_ok=True)
            self.jobs.complete(job_id, {"work_id": work_id})
        except JobCancelled:
            if tmp_path:
                tmp_path.unlink(missing_ok=True)
            self.jobs.mark_cancelled(job_id)
            return
        except NhentaiApiError as exc:
            self.jobs.fail(job_id, exc.message, exc.retry_after)
        except Exception as exc:
            self.jobs.fail(job_id, str(exc))
