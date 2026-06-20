from __future__ import annotations

from typing import Any

_JOB_STATUSES = ("running", "queued", "paused", "failed", "completed", "cancelled")
_FAILED_RECENT_LIMIT = 5
_SHELF_LIMIT = 8


class WorkbenchService:
    """Read-only aggregator over existing module services. No new data source,
    no remote calls. Every value is a projection of a real module summary."""

    def __init__(self, library, governance, jobs, files, exports) -> None:
        self.library = library
        self.governance = governance
        self.jobs = jobs
        self.files = files
        self.exports = exports

    def overview(self) -> dict[str, Any]:
        lib = self.library.summary()
        gov = self.governance.queue()["summary"]
        files = self.files.overview()
        exports = self.exports.summary()
        return {
            "library": {
                "total": lib["total"],
                "reading": lib["reading"],
                "completed": lib["completed"],
                "unread": lib["unread"],
                "untagged": lib["untagged"],
                "total_pages": lib["total_pages"],
                "total_size_bytes": lib["total_size_bytes"],
            },
            "governance": {
                "total": gov["total"],
                "missing_metadata": gov["missing_metadata"],
                "untagged": gov["untagged"],
                "dictionary_review": gov["dictionary_review"],
                "dictionary_conflict": gov["dictionary_conflict"],
                "missing_comicinfo": gov["missing_comicinfo"],
                "missing_cover": gov["missing_cover"],
            },
            "files": {
                "work_count": files["work_count"],
                "source_bytes": files["source_bytes"],
                "cover_ok": files["cover_ok"],
                "missing_source": files["missing_source"],
                "missing_cover": files["missing_cover"],
                "orphan_count": files["orphan_count"],
                "stale_count": files["stale_count"],
                "reclaimable_bytes": files["reclaimable_bytes"],
            },
            "exports": {
                "total": exports["total"],
                "ready": exports["ready"],
                "blocked": exports["blocked"],
                "warnings": exports["warnings"],
            },
            "jobs": self._jobs_summary(),
            "continue_reading": self.library.continue_reading(limit=_SHELF_LIMIT)["result"],
            "recent_added": self.library.recent_added(limit=_SHELF_LIMIT)["result"],
        }

    def _jobs_summary(self) -> dict[str, Any]:
        jobs = self.jobs.list()
        counts = {status: 0 for status in _JOB_STATUSES}
        for job in jobs:
            status = job["status"]
            if status in counts:
                counts[status] += 1
        failed_recent = [
            {
                "id": job["id"],
                "type": job["type"],
                "target": job["target"],
                "error": job["error"],
                "updated_at": job["updated_at"],
            }
            for job in jobs
            if job["status"] == "failed"
        ][:_FAILED_RECENT_LIMIT]
        return {**counts, "failed_recent": failed_recent}
