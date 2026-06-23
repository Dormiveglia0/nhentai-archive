from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from app.config import load_settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.export_job_service import EXPORT_SYNC_THRESHOLD, ExportJobService
from app.services.export_service import ExportService
from app.services.file_service import FileMaintenanceService
from app.services.import_service import ImportService
from app.services.job_service import JobActive, JobService
from app.services.library_service import LibraryService
from app.services.library_scan_service import LibraryScanService
from app.services.library_scan_job_service import LibraryScanJobService
from app.services.governance_service import GovernanceService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient
from app.services.reader_service import ReaderService
from app.services.settings_service import SettingsService
from app.services.translation_service import TranslationError, TranslationService
from app.services.workbench_service import WorkbenchService


class ReaderStatePatch(BaseModel):
    page_index: int
    completed: bool = False


class SettingsPatch(BaseModel):
    nhentai_api_key: str | None = None
    clear_nhentai_api_key: bool = False
    storage: dict | None = None
    export: dict | None = None
    privacy: dict | None = None
    reader: dict | None = None
    machine_translation: dict | None = None


class DictionaryApplyRequest(BaseModel):
    original_text: str
    zh_name: str
    tag_type: str = "tag"
    remote_tag_id: int | None = None
    aliases: list[str] = []
    scope: list[str] = []
    note: str | None = None
    status: str = "configured"
    confidence: int = 80
    locked: bool = False
    ignored: bool = False


class DictionaryBulkImportRequest(BaseModel):
    rows: list[dict]


class DictionaryTranslateRequest(BaseModel):
    text: str


class DictionarySuggestBatchRequest(BaseModel):
    limit: int = 20


class GovernanceMetadataPatch(BaseModel):
    field: str
    value: str | None = None
    source: str = "manual"


class GovernanceApplyRequest(BaseModel):
    metadata: list[GovernanceMetadataPatch] = []
    dictionary_apply: list[DictionaryApplyRequest] = []
    write_back: bool = False


class GovernanceBulkActions(BaseModel):
    fill_missing_metadata: bool = False
    write_back: bool = False


class GovernanceBulkRequest(BaseModel):
    work_ids: list[int] = []
    actions: GovernanceBulkActions = GovernanceBulkActions()


class GovernanceTranslateRequest(BaseModel):
    fields: list[str] | None = None


class ExportItemRequest(BaseModel):
    work_id: int | None = None
    output_name: str | None = None
    write_comicinfo: bool | None = None
    keep_json: bool | None = None
    compress: bool | None = None


class ExportBatchRequest(BaseModel):
    items: list[ExportItemRequest] = []
    write_comicinfo: bool = True
    keep_json: bool = True
    compress: bool = True


class ExportBulkJobRequest(BaseModel):
    work_ids: list[int] = []
    options: dict = {}


class FileTargetRequest(BaseModel):
    kind: str
    work_id: int | None = None
    path: str | None = None


class FileDeleteRequest(BaseModel):
    targets: list[FileTargetRequest] = []


class LibraryScanRequest(BaseModel):
    paths: list[str] | None = None


settings = load_settings()
db = Database(settings.database_path)
db.init_schema()
client = NhentaiClient(
    base_url=settings.nhentai_base_url,
    user_agent=settings.user_agent,
    api_key=settings.nhentai_api_key,
    timeout=settings.request_timeout,
)
jobs = JobService(db)
archive = ArchiveService(db, settings)
discover = DiscoverService(db, client)
reader = ReaderService(db)
library = LibraryService(db)
translation = TranslationService(db)
dictionary = DictionaryService(db, client, translation)
governance = GovernanceService(db, dictionary, settings)
exports = ExportService(db, settings)
files_service = FileMaintenanceService(db, settings)
imports = ImportService(settings, client, jobs, archive, discover, dictionary)
export_jobs = ExportJobService(settings, jobs, exports)
library_scan_service = LibraryScanService(settings, db)
library_scan_jobs = LibraryScanJobService(settings, jobs, archive, library_scan_service)
settings_service = SettingsService(db, settings, client, translation)
workbench = WorkbenchService(library, governance, jobs, files_service, exports)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    export_jobs.sweep_exports()
    yield


app = FastAPI(title="NH Archive", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/discover/latest")
def discover_latest(page: int = 1, per_page: int = 25):
    return _remote(lambda: discover.latest(page, per_page))


@app.get("/api/discover/feed")
def discover_feed(
    page: int = 1,
    per_page: int = 25,
    q: str = "",
    sort: str = "date",
    language: str = "all",
    type: str = "all",
    tag_id: int | None = None,
    tag_names: str = "",
    unimported_only: bool = False,
):
    return _remote(lambda: discover.feed(page, per_page, q, sort, language, type, tag_id, tag_names, unimported_only))


@app.get("/api/discover/popular")
def discover_popular():
    return _remote(discover.popular)


@app.get("/api/discover/tagged")
def discover_tagged(tag_id: int, page: int = 1, per_page: int = 25, sort: str = "date", unimported_only: bool = False):
    return _remote(lambda: discover.tagged(tag_id, page, per_page, sort, unimported_only))


@app.get("/api/discover/random")
def discover_random():
    return _remote(discover.random)


@app.get("/api/discover/search")
def discover_search(
    q: str = "",
    page: int = 1,
    per_page: int = 25,
    sort: str = "date",
    language: str = "all",
    type: str = "all",
    unimported_only: bool = False,
):
    return _remote(lambda: discover.search(q, page, per_page, sort, language, type, unimported_only))


@app.get("/api/discover/galleries/{gallery_id}")
def discover_gallery(gallery_id: int):
    return _remote(lambda: discover.gallery(gallery_id))


@app.post("/api/discover/galleries/{gallery_id}/import")
def import_gallery(gallery_id: int):
    return imports.enqueue_remote_import(gallery_id)


@app.get("/api/discover/tags/autocomplete")
def tag_autocomplete(q: str, limit: int = 20):
    return _remote(lambda: discover.tag_autocomplete(q, limit))


@app.get("/api/discover/tags/cached")
def cached_tags(limit: int = 60):
    return discover.cached_tags(limit)


@app.get("/api/dictionary/candidates")
def dictionary_candidates(q: str = "", type: str = "all", status: str = "all", limit: int = 50, offset: int = 0):
    return dictionary.candidates(q, status, limit, offset, type)


@app.get("/api/dictionary/summary")
def dictionary_summary():
    return dictionary.summary()


@app.get("/api/dictionary/evidence")
def dictionary_evidence(remote_tag_id: int | None = None, dictionary_id: int | None = None):
    return dictionary.evidence(remote_tag_id, dictionary_id)


@app.get("/api/dictionary/autocomplete")
def dictionary_autocomplete(q: str, limit: int = 20):
    return _remote(lambda: dictionary.autocomplete(q, limit))


@app.post("/api/dictionary/preview-apply")
def dictionary_preview_apply(payload: DictionaryApplyRequest):
    try:
        return dictionary.preview_apply(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/dictionary/apply")
def dictionary_apply(payload: DictionaryApplyRequest):
    try:
        return dictionary.apply(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/dictionary/translate")
def dictionary_translate(payload: DictionaryTranslateRequest):
    try:
        return dictionary.translate_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@app.post("/api/dictionary/suggest-batch")
def dictionary_suggest_batch(payload: DictionarySuggestBatchRequest):
    try:
        return dictionary.generate_suggestions(payload.limit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@app.post("/api/dictionary/preview-bulk-import")
def dictionary_preview_bulk_import(payload: DictionaryBulkImportRequest):
    return dictionary.preview_bulk_import(payload.rows)


@app.post("/api/dictionary/bulk-import")
def dictionary_bulk_import(payload: DictionaryBulkImportRequest):
    return dictionary.bulk_import(payload.rows)


@app.post("/api/dictionary/{dictionary_id}/ignore")
def dictionary_ignore(dictionary_id: int):
    try:
        return dictionary.ignore(dictionary_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/dictionary/{dictionary_id}/review")
def dictionary_review(dictionary_id: int):
    try:
        return dictionary.mark_review(dictionary_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/dictionary/{dictionary_id}")
def dictionary_delete(dictionary_id: int):
    try:
        return dictionary.delete(dictionary_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/library/summary")
def library_summary():
    return library.summary()


@app.get("/api/library/search")
def library_search(
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
    return library.search(q, page, per_page, sort, read_status, source, language, ids)


@app.get("/api/library/recent-added")
def library_recent_added(limit: int = 12):
    return library.recent_added(limit)


@app.get("/api/library/recent-read")
def library_recent_read(limit: int = 12):
    return library.recent_read(limit)


@app.get("/api/library/continue-reading")
def library_continue_reading(limit: int = 12):
    return library.continue_reading(limit)


@app.get("/api/library/tag-filters")
def library_tag_filters(q: str = "", limit: int = 40):
    return library.tag_filters(q, limit)


@app.get("/api/library/reading-history")
def library_reading_history(page: int = 1, per_page: int = 30):
    return library.reading_history(page, per_page)


@app.get("/api/governance/queue")
def governance_queue():
    return governance.queue()


@app.get("/api/works/{work_id}/governance")
def work_governance(work_id: int):
    try:
        return governance.work_governance(work_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/works/{work_id}/governance/apply")
def apply_work_governance(work_id: int, payload: GovernanceApplyRequest):
    try:
        return governance.apply(work_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/works/{work_id}/governance/translate")
def translate_work_governance(work_id: int, payload: GovernanceTranslateRequest):
    try:
        return governance.translate_metadata(work_id, payload.fields)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@app.post("/api/governance/bulk/preview")
def governance_bulk_preview(payload: GovernanceBulkRequest):
    try:
        return governance.bulk_preview(payload.work_ids, payload.actions.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/governance/bulk/apply")
def governance_bulk_apply(payload: GovernanceBulkRequest):
    try:
        return governance.bulk_apply(payload.work_ids, payload.actions.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/exports/queue")
def export_queue():
    return exports.queue()


@app.get("/api/exports/summary")
def export_summary():
    return exports.summary()


@app.get("/api/works/{work_id}/export-preview")
def export_preview(work_id: int):
    try:
        return exports.preview(work_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/works/{work_id}/export-preview")
def export_preview_with_options(work_id: int, payload: ExportItemRequest):
    try:
        return exports.preview(work_id, payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _download_response(filename: str, data: bytes, media_type: str) -> Response:
    ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "download"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
    return Response(content=data, media_type=media_type, headers={"Content-Disposition": disposition})


@app.get("/api/works/{work_id}/export/download")
def export_download(
    work_id: int,
    output_name: str | None = None,
    write_comicinfo: bool = True,
    keep_json: bool = True,
    compress: bool = True,
):
    options = {
        "output_name": output_name,
        "write_comicinfo": write_comicinfo,
        "keep_json": keep_json,
        "compress": compress,
    }
    try:
        filename, data = exports.build_cbz(work_id, options)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _download_response(filename, data, "application/vnd.comicbook+zip")


@app.post("/api/exports/download")
def export_download_bundle(payload: ExportBatchRequest):
    items = [item.model_dump(exclude_none=True) for item in payload.items if item.work_id]
    options = {
        "write_comicinfo": payload.write_comicinfo,
        "keep_json": payload.keep_json,
        "compress": payload.compress,
    }
    try:
        filename, data = exports.build_bundle(items, options)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _download_response(filename, data, "application/zip")


@app.post("/api/exports/bulk-jobs")
def enqueue_bulk_export(payload: ExportBulkJobRequest):
    if not payload.work_ids:
        raise HTTPException(status_code=422, detail="未选择任何作品。")
    return export_jobs.enqueue_bulk_export(payload.work_ids, payload.options)


@app.post("/api/library/scan/preview")
def library_scan_preview():
    return library_scan_service.preview()


@app.post("/api/library/scan")
def library_scan(payload: LibraryScanRequest):
    paths = payload.paths
    if paths is None:
        preview = library_scan_service.preview()
        paths = [p["path"] for p in preview["new_linked"] + preview["new_local"]]
    return library_scan_jobs.enqueue_scan(paths)


@app.get("/api/jobs/{job_id}/export/download")
def download_bulk_export(job_id: int):
    try:
        job = jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if job["type"] != "bulk_export":
        raise HTTPException(status_code=404, detail="该任务没有可下载的导出产物。")
    target = job["target"]
    if target.get("downloaded"):
        raise HTTPException(status_code=410, detail="导出产物已下载并清除。")
    if job["status"] != "completed":
        raise HTTPException(status_code=404, detail="导出产物尚未就绪。")
    if _export_artifact_expired(target):
        raise HTTPException(status_code=410, detail="导出产物已过期。")
    path = target.get("artifact_path")
    if not path or not Path(path).exists():
        raise HTTPException(status_code=404, detail="导出产物不存在。")
    output_name = target.get("output_name") or f"job-{job_id}.zip"
    ascii_name = output_name.encode("ascii", "ignore").decode("ascii") or "export.zip"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(output_name)}"
    return FileResponse(
        path,
        media_type="application/zip",
        filename=output_name,
        headers={"Content-Disposition": disposition},
        background=BackgroundTask(export_jobs.mark_downloaded, job_id),
    )


def _export_artifact_expired(target: dict) -> bool:
    from app.services.export_job_service import _now, _parse_iso

    expires_at = _parse_iso(target.get("expires_at"))
    return expires_at is not None and _now() >= expires_at


@app.get("/api/workbench/overview")
def workbench_overview():
    return workbench.overview()


@app.get("/api/files/overview")
def files_overview():
    return files_service.overview()


@app.get("/api/files/inventory")
def files_inventory(
    category: str = "all",
    q: str | None = None,
    status: str | None = None,
    sort: str = "default",
    page: int = 1,
    per_page: int = 50,
):
    return files_service.inventory(
        category=category, q=q, status=status, sort=sort, page=page, per_page=per_page
    )


@app.get("/api/files/duplicates")
def files_duplicates():
    return files_service.duplicates()


@app.post("/api/files/preview-delete")
def files_preview_delete(payload: FileDeleteRequest):
    return files_service.preview_delete([t.model_dump(exclude_none=True) for t in payload.targets])


@app.post("/api/files/delete")
def files_delete(payload: FileDeleteRequest):
    return files_service.delete([t.model_dump(exclude_none=True) for t in payload.targets])


@app.get("/api/works")
def list_works():
    return {"result": archive.list_works()}


@app.get("/api/works/{work_id}")
def get_work(work_id: int):
    work = archive.get_work(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Work not found")
    return work


@app.get("/api/works/{work_id}/cover")
def get_cover(work_id: int):
    work = archive.get_work(work_id)
    if not work or not work.get("cover_path"):
        raise HTTPException(status_code=404, detail="Cover not found")
    path = Path(work["cover_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Cover file missing")
    return FileResponse(path)


@app.get("/api/works/{work_id}/pages")
def list_pages(work_id: int):
    return {"result": archive.list_pages(work_id)}


@app.get("/api/works/{work_id}/pages/{page_index}")
def get_page(work_id: int, page_index: int):
    try:
        body, media_type = archive.read_page(work_id, page_index)
        return Response(content=body, media_type=media_type)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/works/{work_id}/pages/{page_index}/thumb")
def get_page_thumbnail(work_id: int, page_index: int, w: int = 320):
    try:
        body, media_type = archive.read_page_thumbnail(work_id, page_index, w)
        return Response(content=body, media_type=media_type, headers={"Cache-Control": "max-age=86400"})
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/works/{work_id}/reader-state")
def get_reader_state(work_id: int):
    return reader.get_state(work_id)


@app.patch("/api/works/{work_id}/reader-state")
def patch_reader_state(work_id: int, patch: ReaderStatePatch):
    try:
        return reader.update_state(work_id, patch.page_index, patch.completed)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _job_dispatch(job_id: int):
    """Route a job control action to the service that owns its type."""
    job_type = jobs.get(job_id)["type"]
    if job_type == "bulk_export":
        return export_jobs
    if job_type == "library_scan":
        return library_scan_jobs
    return imports


@app.get("/api/jobs")
def list_jobs():
    export_jobs.sweep_exports()
    return {"result": jobs.list()}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    try:
        return jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/jobs/{job_id}/logs")
def get_job_logs(job_id: int):
    try:
        return jobs.logs(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/jobs/{job_id}/pause")
def pause_job(job_id: int):
    try:
        return jobs.pause(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/jobs/{job_id}/resume")
def resume_job(job_id: int):
    try:
        return _job_dispatch(job_id).resume_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: int):
    try:
        return _job_dispatch(job_id).cancel_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/jobs/{job_id}/retry")
def retry_job(job_id: int):
    try:
        return _job_dispatch(job_id).retry_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/jobs/clear")
def clear_jobs():
    return jobs.clear_finished()


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int):
    try:
        return jobs.delete(job_id)
    except JobActive as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/settings")
def get_settings():
    return settings_service.get()


@app.patch("/api/settings")
def patch_settings(patch: SettingsPatch):
    return settings_service.patch(patch.model_dump(exclude_none=True))


@app.post("/api/settings/nhentai/verify")
def verify_nhentai_settings():
    return settings_service.verify_nhentai()


@app.post("/api/settings/translation/verify")
def verify_translation_settings():
    return translation.verify()


@app.post("/api/settings/nhentai/clear-cache")
def clear_nhentai_cache():
    client.clear_runtime_cache()
    return {"ok": True, "message": "远端缓存已清除"}


@app.get("/api/settings/nhentai/runtime")
def nhentai_runtime_stats():
    return client.runtime_stats()


def _remote(call):
    try:
        return call()
    except NhentaiApiError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message, "retry_after": exc.retry_after},
        ) from exc
