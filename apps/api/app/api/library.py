from fastapi import APIRouter, HTTPException, Query, Request

from app.api.schemas import LibraryScanRequest, LibraryMigrationRequest, MediaLibraryCreate, MediaLibraryPatch
from app.container import services
from app.services.directory_browser import browse_directories
import zipfile


router = APIRouter(prefix="/library")


@router.post("/upload", status_code=201)
async def upload(request: Request, filename: str = Query(min_length=1, max_length=255), library_id: int | None = Query(default=None, gt=0)):
    try:
        return await services.uploads.upload(request.stream(), filename, library_id)
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/migration/candidates")
def migration_candidates(page: int = 1, q: str = ""):
    return services.library_scan_jobs.migration.candidates(page, q)


@router.post("/migration/preview")
def migration_preview(payload: LibraryMigrationRequest):
    try:
        return services.library_scan_jobs.migration.preview(payload.work_ids, payload.library_id, payload.move, payload.conflict)
    except (OSError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/migration")
def migration_start(payload: LibraryMigrationRequest):
    try:
        return services.library_scan_jobs.enqueue_migration(payload.work_ids, payload.library_id, payload.move, payload.conflict)
    except (OSError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/cache")
def reading_cache():
    return services.archive.cache.summary()


@router.patch("/cache")
def configure_reading_cache(payload: dict):
    try:
        return services.archive.cache.configure(payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/cache/clear")
def clear_reading_cache():
    return services.archive.cache.sweep(clear=True)


@router.get("/summary")
def summary():
    return services.library.summary()


@router.get("/revision")
def revision():
    return {"revision": services.library.revision()}


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
    favorite_only: bool = False,
    tag_keys: list[str] = Query(default=[]),
    library_id: int | None = None,
):
    ids = [int(value) for value in tag_ids.split(",") if value.strip().isdigit()]
    try:
        return services.library.search(q, page, per_page, sort, read_status, source, language, ids, favorite_only, tag_keys, library_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


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
def reading_history(page: int = 1, per_page: int = 30, timezone_offset_minutes: int = 0):
    return services.library.reading_history(page, per_page, timezone_offset_minutes)


@router.get("/statistics")
def statistics(days: int = 30, timezone_offset_minutes: int = 0):
    return services.library.statistics(days, timezone_offset_minutes)


@router.post("/scan/preview")
def scan_preview():
    return services.library_scan.preview()


@router.post("/scan")
def scan(payload: LibraryScanRequest):
    try:
        return services.library_scan_jobs.enqueue_scan(payload.paths, payload.library_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/directories")
def directories(include_removed: bool = False):
    return services.media_libraries.list(include_removed)


@router.get("/browse")
def browse_directory(path: str = "/"):
    try:
        return browse_directories(path)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/directories", status_code=201)
def add_directory(payload: MediaLibraryCreate):
    try:
        return services.media_libraries.create(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.patch("/directories/{library_id}")
def update_directory(library_id: int, payload: MediaLibraryPatch):
    try:
        return services.media_libraries.update(library_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.delete("/directories/{library_id}")
def remove_directory(library_id: int, purge: bool = False):
    try:
        return services.files.remove_library(library_id, purge)
    except (ValueError, OSError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/directories/{library_id}/remove-preview")
def directory_removal_preview(library_id: int):
    try:
        return services.files.library_removal_preview(library_id)
    except (ValueError, OSError) as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/directories/{library_id}/items")
def directory_items(library_id: int, status: str = "all", page: int = 1, per_page: int = 50):
    try:
        return services.media_libraries.items(library_id, status, page, per_page)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.delete("/directories/{library_id}/items/{item_id}")
def forget_directory_item(library_id: int, item_id: int):
    try:
        return services.media_libraries.forget_missing_item(library_id, item_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/directories/{library_id}/runs")
def directory_runs(library_id: int, limit: int = 20):
    try:
        return services.media_libraries.runs(library_id, limit)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
