from fastapi import APIRouter

from app.api.shared import remote
from app.container import services


router = APIRouter(prefix="/discover")


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


@router.get("/tags/autocomplete")
def tag_autocomplete(q: str, limit: int = 20):
    return remote(lambda: services.discover.tag_autocomplete(q, limit))


@router.get("/tags/cached")
def cached_tags(limit: int = 60):
    return services.discover.cached_tags(limit)
