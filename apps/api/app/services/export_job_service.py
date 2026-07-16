from __future__ import annotations

import threading
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.config import Settings
from app.services.export_service import ExportService
from app.services.job_service import JobCancelled, JobService

# Works at or below this count keep the existing synchronous streaming download
# (POST /api/exports/download); anything above is routed to a background job.
EXPORT_SYNC_THRESHOLD = 5

_TTL = timedelta(hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


class ExportJobService:
    """Long-running bulk export wired into the task center.

    Mirrors ``ImportService``'s daemon-thread worker model and reuses the generic
    ``JobService`` (export-specific fields live entirely in ``target_json``). The
    artifact is ephemeral: written incrementally to disk, deleted after download
    and swept on a 24h TTL so the server never keeps a long-lived second copy.
    """

    def __init__(self, settings: Settings, jobs: JobService, exports: ExportService):
        self.settings = settings
        self.jobs = jobs
        self.exports = exports
        self._worker_lock = threading.Lock()
        self._workers: dict[int, threading.Thread] = {}

    # ---- queue control (symmetric with ImportService) -------------------

    def enqueue_bulk_export(self, items: list[Any], options: dict[str, Any] | None) -> dict[str, Any]:
        export_items: list[dict[str, Any]] = []
        for item in items:
            if isinstance(item, dict):
                work_id = item.get("work_id")
                output_name = item.get("output_name")
            else:
                work_id = item
                output_name = None
            if work_id:
                export_items.append({"work_id": int(work_id), "output_name": output_name})
        ids = [item["work_id"] for item in export_items]
        target = {
            "items": export_items,
            "work_ids": ids,
            "options": options or {},
            "total": len(ids),
            "packaged": 0,
            "skipped": [],
            "artifact_path": None,
            "output_name": None,
            "expires_at": None,
            "downloaded": False,
        }
        job = self.jobs.create("bulk_export", target)
        self._start_worker(job["id"])
        return job

    def retry_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "failed" or existing["type"] != "bulk_export":
            raise ValueError("Only failed bulk export jobs can be retried")
        job = self.jobs.retry(job_id)
        self._start_worker(job_id)
        return job

    def resume_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "paused":
            return existing
        if existing["type"] != "bulk_export":
            raise ValueError("Only paused bulk export jobs can be resumed")
        job = self.jobs.resume(job_id)
        if not self._worker_alive(job_id):
            self._start_worker(job_id)
        return job

    def cancel_job(self, job_id: int) -> dict[str, Any]:
        job = self.jobs.cancel(job_id)
        if job["status"] == "cancelling" and not self._worker_alive(job_id):
            self._delete_artifact(self._artifact_path(job_id))
            self.jobs.mark_cancelled(job_id)
            return self.jobs.get(job_id)
        return job

    # ---- worker plumbing -------------------------------------------------

    def _worker_alive(self, job_id: int) -> bool:
        with self._worker_lock:
            thread = self._workers.get(job_id)
            return bool(thread and thread.is_alive())

    def _start_worker(self, job_id: int) -> None:
        thread = threading.Thread(target=self._run_bulk_export_worker, args=(job_id,), daemon=True)
        with self._worker_lock:
            self._workers[job_id] = thread
        thread.start()

    def _run_bulk_export_worker(self, job_id: int) -> None:
        try:
            self.run_bulk_export(job_id)
        finally:
            with self._worker_lock:
                if self._workers.get(job_id) is threading.current_thread():
                    self._workers.pop(job_id, None)

    def _exports_dir(self) -> Path:
        return self.settings.export_jobs_dir

    def _artifact_path(self, job_id: int) -> Path:
        return self._exports_dir() / f"job-{job_id}.zip"

    def download_path(self, job_id: int, value: Any) -> Path | None:
        if not value:
            return None
        expected = self._artifact_path(job_id).resolve()
        try:
            candidate = Path(str(value)).resolve()
        except OSError:
            return None
        return candidate if candidate == expected else None

    def _delete_artifact(self, path: Path | None) -> None:
        if path:
            Path(path).unlink(missing_ok=True)

    # ---- main worker -----------------------------------------------------

    def run_bulk_export(self, job_id: int) -> None:
        job = self.jobs.get(job_id)
        target = job["target"]
        items = target.get("items") or [{"work_id": wid} for wid in target.get("work_ids", [])]
        options = target.get("options") or {}
        total = len(items)
        artifact_path = self._artifact_path(job_id)
        self._exports_dir().mkdir(parents=True, exist_ok=True)

        skipped: list[dict[str, Any]] = []
        used_names: set[str] = set()
        packaged = 0
        try:
            self.jobs.mark_running(job_id, "packaging", 0, total)
            with zipfile.ZipFile(artifact_path, "w", compression=zipfile.ZIP_STORED) as bundle:
                for item in items:
                    work_id = int(item.get("work_id") or 0)
                    if not work_id:
                        continue
                    self.jobs.checkpoint(job_id)
                    try:
                        item_options = {**options, "output_name": item.get("output_name")}
                        name, data = self.exports.build_cbz(work_id, item_options)
                    except ValueError as exc:
                        skipped.append({"work_id": work_id, "reason": str(exc)})
                        continue
                    member = self.exports._unique_member_name(name, used_names)
                    bundle.writestr(member, data)
                    packaged += 1
                    self.jobs.update_progress(job_id, "running", "packaging", packaged, total)

            if packaged == 0:
                self._delete_artifact(artifact_path)
                self.jobs.fail(job_id, "没有可导出的作品（所选项均存在阻塞）。")
                return

            self.jobs.complete(
                job_id,
                {
                    "artifact_path": str(artifact_path),
                    "output_name": f"导出合集 ({packaged}).zip",
                    "expires_at": (_now() + _TTL).isoformat(),
                    "packaged": packaged,
                    "skipped": skipped,
                    "downloaded": False,
                },
            )
        except JobCancelled:
            self._delete_artifact(artifact_path)
            self.jobs.mark_cancelled(job_id)
            return
        except Exception as exc:  # noqa: BLE001 - surface any packaging failure to the job
            self._delete_artifact(artifact_path)
            self.jobs.fail(job_id, str(exc))

    # ---- download (one-shot) --------------------------------------------

    def mark_downloaded(self, job_id: int) -> None:
        """Background task hook: delete the artifact and flag it downloaded."""
        try:
            job = self.jobs.get(job_id)
        except ValueError:
            return
        path = self.download_path(job_id, job["target"].get("artifact_path"))
        if path:
            path.unlink(missing_ok=True)
        self.jobs.complete(job_id, {"downloaded": True})

    # ---- sweep (best-effort, idempotent) --------------------------------

    def sweep_exports(self) -> None:
        """Delete orphaned / downloaded / expired artifacts. Errors are swallowed."""
        try:
            directory = self._exports_dir()
            if not directory.exists():
                return
            by_job: dict[int, dict[str, Any]] = {}
            for job in self.jobs.list():
                if job["type"] == "bulk_export":
                    by_job[job["id"]] = job
            now = _now()
            for entry in directory.glob("job-*.zip"):
                try:
                    job_id = int(entry.stem.split("job-", 1)[1])
                except (ValueError, IndexError):
                    entry.unlink(missing_ok=True)
                    continue
                job = by_job.get(job_id)
                if job is None:
                    entry.unlink(missing_ok=True)
                    continue
                target = job["target"]
                if target.get("downloaded"):
                    entry.unlink(missing_ok=True)
                    continue
                expires_at = _parse_iso(target.get("expires_at"))
                if expires_at is not None and now >= expires_at:
                    entry.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001 - sweeping must never break callers
            pass
