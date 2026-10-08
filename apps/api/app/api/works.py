from pathlib import Path
import zipfile

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse

from app.api.schemas import FavoritePatch, ReaderStatePatch, ReadingSessionPatch, ReadingSessionStart
from app.container import services


router = APIRouter(prefix="/works")


@router.get("")
def list_works():
    return {"result": services.archive.list_works()}


@router.get("/{work_id}")
def get_work(work_id: int):
    work = services.library.work(work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Work not found")
    return work


@router.get("/{work_id}/cover")
def get_cover(work_id: int, w: int | None = Query(default=None, ge=64, le=1024)):
    if w is not None:
        try:
            body, media_type = services.archive.read_cover_thumbnail(work_id, w)
            return Response(content=body, media_type=media_type, headers={"Cache-Control": "private, max-age=86400"})
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    work = services.archive.get_work(work_id)
    if not work or not work.get("cover_path"):
        raise HTTPException(status_code=404, detail="Cover not found")
    path = Path(work["cover_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Cover file missing")
    return FileResponse(path)


@router.get("/{work_id}/pages")
def list_pages(work_id: int):
    return {"result": services.archive.list_pages(work_id)}


@router.post("/{work_id}/reading-source")
def prepare_reading_source(work_id: int):
    try:
        return services.archive.cache.prepare(work_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{work_id}/reading-source/{lease}")
def release_reading_source(work_id: int, lease: str):
    services.archive.cache.release(work_id, lease)
    return {"released": True}


@router.get("/{work_id}/pages/{page_index}")
def get_page(work_id: int, page_index: int, lease: str | None = Query(default=None, pattern=r"^[a-f0-9]{32}$")):
    try:
        body, media_type = services.archive.read_page(work_id, page_index, lease)
        return Response(content=body, media_type=media_type)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{work_id}/pages/{page_index}/thumb")
def get_page_thumbnail(work_id: int, page_index: int, w: int = Query(default=320, ge=64, le=1024),
                       lease: str | None = Query(default=None, pattern=r"^[a-f0-9]{32}$")):
    try:
        body, media_type = services.archive.read_page_thumbnail(work_id, page_index, w, lease)
        return Response(
            content=body,
            media_type=media_type,
            headers={"Cache-Control": "max-age=86400"},
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{work_id}/reader-state")
def get_reader_state(work_id: int):
    return services.reader.get_state(work_id)


@router.patch("/{work_id}/reader-state")
def patch_reader_state(work_id: int, patch: ReaderStatePatch):
    try:
        return services.reader.update_state(work_id, patch.page_index, patch.completed, patch.cache_lease)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{work_id}/favorite")
def patch_favorite(work_id: int, patch: FavoritePatch):
    try:
        return services.library.set_favorite(work_id, patch.favorite)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{work_id}/reading-sessions")
def start_reading_session(work_id: int, payload: ReadingSessionStart):
    try:
        return services.reader.start_session(work_id, payload.session_key, payload.page_index, payload.cache_lease)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{work_id}/reading-sessions/{session_id}")
def patch_reading_session(work_id: int, session_id: int, patch: ReadingSessionPatch):
    try:
        return services.reader.update_session(
            work_id,
            session_id,
            patch.duration_seconds,
            patch.page_index,
            patch.finished,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
