from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from app.config import Settings
from app.services.archive_service import ArchiveService
from app.services.discover_service import DiscoverService
from app.services.job_service import JobService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient


class ImportService:
    def __init__(
        self,
        settings: Settings,
        client: NhentaiClient,
        jobs: JobService,
        archive: ArchiveService,
        discover: DiscoverService,
    ):
        self.settings = settings
        self.client = client
        self.jobs = jobs
        self.archive = archive
        self.discover = discover

    def enqueue_remote_import(self, gallery_id: int) -> dict[str, Any]:
        existing = self.archive.db.fetchone("SELECT id FROM works WHERE remote_gallery_id = ?", (gallery_id,))
        if existing:
            return self.jobs.create("remote_import", {"gallery_id": gallery_id, "work_id": existing["id"], "already_imported": True})
        job = self.jobs.create("remote_import", {"gallery_id": gallery_id})
        thread = threading.Thread(target=self.run_remote_import, args=(job["id"], gallery_id), daemon=True)
        thread.start()
        return job

    def retry_job(self, job_id: int) -> dict[str, Any]:
        job = self.jobs.retry(job_id)
        if job["type"] == "remote_import" and job["target"].get("gallery_id"):
            thread = threading.Thread(
                target=self.run_remote_import,
                args=(job_id, int(job["target"]["gallery_id"])),
                daemon=True,
            )
            thread.start()
        return job

    def run_remote_import(self, job_id: int, gallery_id: int) -> None:
        try:
            self.jobs.mark_running(job_id, "fetching_gallery", 1, 5)
            gallery = self.client.gallery(gallery_id, include="related")
            self.discover.cache_gallery(gallery)
            self.discover.cache_tags(gallery.get("tags", []))

            self.jobs.update_progress(job_id, "running", "requesting_download_url", 2, 5)
            download = self.client.download_url(gallery_id)

            self.jobs.update_progress(job_id, "running", "downloading_cbz", 3, 5)
            tmp_path = self.settings.tmp_dir / f"nhentai-{gallery_id}.cbz"
            self.client.download_file(download["url"], tmp_path)

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
            tmp_path.unlink(missing_ok=True)
            self.jobs.complete(job_id, {"work_id": work_id})
        except NhentaiApiError as exc:
            self.jobs.fail(job_id, exc.message, exc.retry_after)
        except Exception as exc:
            self.jobs.fail(job_id, str(exc))
