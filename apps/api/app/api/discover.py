from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.api.schemas import ReadingSessionPatch, ReadingSessionStart
from app.api.shared import remote
from app.container import services


router = APIRouter(prefix="/discover")


def _stream_media(source):
    try:
        while chunk := source.read(256 * 1024):
            yield chunk
    finally:
        source.close()


@router.get("/latest")
def latest(page: int = 1, per_page: int = 25):
    return remote(lambda: services.discover.latest(page, per_page))


@router.get("/feed")
def feed(
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
    return remote(
        lambda: services.discover.feed(
            page, per_page, q, sort, language, type, tag_id, tag_names, unimported_only
        )
    )


@router.get("/popular")
def popular():
    return remote(services.discover.popular)


@router.get("/tagged")
def tagged(
    tag_id: int,
    page: int = 1,
    per_page: int = 25,
    sort: str = "date",
    unimported_only: bool = False,
):
    return remote(
        lambda: services.discover.tagged(tag_id, page, per_page, sort, unimported_only)
    )


@router.get("/random")
def random():
    return remote(services.discover.random)


@router.get("/media")
def media(path: str, thumbnail: bool = False):
    source = remote(lambda: services.discover.open_media(path, thumbnail))
    headers = {"Cache-Control": "private, max-age=86400"}
    if content_length := source.headers.get("Content-Length"):
        headers["Content-Length"] = content_length
    return StreamingResponse(
        _stream_media(source),
        media_type=source.headers.get_content_type(),
        headers=headers,
    )


@router.get("/search")
def search(
    q: str = "",
    page: int = 1,
    per_page: int = 25,
    sort: str = "date",
    language: str = "all",
    type: str = "all",
    unimported_only: bool = False,
):
    return remote(
        lambda: services.discover.search(
            q, page, per_page, sort, language, type, unimported_only
        )
    )


@router.get("/galleries/{gallery_id}")
def gallery(gallery_id: int):
    return remote(lambda: services.discover.gallery(gallery_id))


@router.post("/galleries/{gallery_id}/import")
def import_gallery(gallery_id: int):
    return services.imports.enqueue_remote_import(gallery_id)


@router.post("/galleries/{gallery_id}/reading-sessions")
def start_remote_reading_session(gallery_id: int, payload: ReadingSessionStart):
    try:
        return services.reader.start_remote_session(gallery_id, payload.session_key, payload.page_index)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/galleries/{gallery_id}/reading-sessions/{session_id}")
def patch_remote_reading_session(gallery_id: int, session_id: int, patch: ReadingSessionPatch):
    try:
        return services.reader.update_remote_session(
            gallery_id,
            session_id,
            patch.duration_seconds,
            patch.page_index,
            patch.finished,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/tags/autocomplete")
def tag_autocomplete(q: str, limit: int = 20):
    return remote(lambda: services.discover.tag_autocomplete(q, limit))


@router.get("/tags/cached")
def cached_tags(limit: int = 60):
    return services.discover.cached_tags(limit)
