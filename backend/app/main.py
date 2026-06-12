from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import load_settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.discover_service import DiscoverService
from app.services.import_service import ImportService
from app.services.job_service import JobService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient
from app.services.reader_service import ReaderService


class ReaderStatePatch(BaseModel):
    page_index: int
    completed: bool = False


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
imports = ImportService(settings, client, jobs, archive, discover)

app = FastAPI(title="NH Archive", version="0.1.0")
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


@app.get("/api/discover/popular")
def discover_popular():
    return _remote(discover.popular)


@app.get("/api/discover/random")
def discover_random():
    return _remote(discover.random)


@app.get("/api/discover/search")
def discover_search(q: str, page: int = 1, per_page: int = 25):
    return _remote(lambda: discover.search(q, page, per_page))


@app.get("/api/discover/galleries/{gallery_id}")
def discover_gallery(gallery_id: int):
    return _remote(lambda: discover.gallery(gallery_id))


@app.post("/api/discover/galleries/{gallery_id}/import")
def import_gallery(gallery_id: int):
    return imports.enqueue_remote_import(gallery_id)


@app.get("/api/discover/tags/autocomplete")
def tag_autocomplete(q: str, limit: int = 20):
    return _remote(lambda: discover.tag_autocomplete(q, limit))


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


@app.get("/api/works/{work_id}/reader-state")
def get_reader_state(work_id: int):
    return reader.get_state(work_id)


@app.patch("/api/works/{work_id}/reader-state")
def patch_reader_state(work_id: int, patch: ReaderStatePatch):
    try:
        return reader.update_state(work_id, patch.page_index, patch.completed)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/jobs")
def list_jobs():
    return {"result": jobs.list()}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: int):
    try:
        return jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/jobs/{job_id}/retry")
def retry_job(job_id: int):
    try:
        return imports.retry_job(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _remote(call):
    try:
        return call()
    except NhentaiApiError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message, "retry_after": exc.retry_after},
        ) from exc
