from fastapi import APIRouter

from app.api.schemas import LibraryScanRequest
from app.container import services


router = APIRouter(prefix="/library")


@router.get("/summary")
def summary():
    return services.library.summary()


@router.get("/search")
def search(
    q: str = "",
    page: int = 1,
    per_page: int = 24,
    sort: str = "recent_updated",
    read_status: str = "all",
    source: str = "all",
    language: str = "all",
    tag_ids: str = "",
):
    ids = [int(value) for value in tag_ids.split(",") if value.strip().isdigit()]
    return services.library.search(
        q, page, per_page, sort, read_status, source, language, ids
    )


@router.get("/recent-added")
def recent_added(limit: int = 12):
    return services.library.recent_added(limit)


@router.get("/recent-read")
def recent_read(limit: int = 12):
    return services.library.recent_read(limit)


@router.get("/continue-reading")
def continue_reading(limit: int = 12):
    return services.library.continue_reading(limit)


@router.get("/tag-filters")
def tag_filters(q: str = "", limit: int = 40):
    return services.library.tag_filters(q, limit)


@router.get("/reading-history")
def reading_history(page: int = 1, per_page: int = 30):
    return services.library.reading_history(page, per_page)


@router.post("/scan/preview")
def scan_preview():
    return services.library_scan.preview()


@router.post("/scan")
def scan(payload: LibraryScanRequest):
    paths = payload.paths
    if paths is None:
        preview = services.library_scan.preview()
        paths = [p["path"] for p in preview["new_linked"] + preview["new_local"]]
    return services.library_scan_jobs.enqueue_scan(paths)
