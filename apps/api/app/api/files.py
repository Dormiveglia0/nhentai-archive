from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.schemas import FileDeleteRequest
from app.container import services


router = APIRouter(prefix="/files")


class MetadataTarget(BaseModel):
    kind: Literal["work", "item", "source"]
    id: int = Field(gt=0)


@router.get("/metadata")
def metadata_inventory(q: str = "", status: str = "all", library_id: int | None = None,
                       page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=100), work_id: int | None = None):
    return services.local_metadata.inventory(q, status, library_id, page, per_page, work_id)


@router.get("/metadata/{kind}/{record_id}")
def metadata_detail(kind: Literal["work", "item"], record_id: int):
    try:
        return services.local_metadata.detail(kind, record_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post("/metadata/preview-delete")
def metadata_delete_preview(payload: MetadataTarget):
    return services.local_metadata.preview_delete(payload.kind, payload.id)


@router.post("/metadata/delete")
def metadata_delete(payload: MetadataTarget):
    try:
        return services.local_metadata.delete(payload.kind, payload.id)
    except (ValueError, OSError) as exc:
        raise HTTPException(409, str(exc)) from exc


@router.get("/derived")
def derived_inventory(category: str = "all", q: str = "", status: str = "all",
                      page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=500), work_id: int | None = None):
    return services.files.derived_inventory(category, q, status, page, per_page, work_id)


@router.get("/derived/content")
def derived_content(path: str, download: bool = False):
    try:
        file = services.files.derived_file(path)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(404, str(exc)) from exc
    image_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                  ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif"}.get(file.suffix.lower())
    return FileResponse(file, media_type=image_type or "application/octet-stream", filename=file.name,
                        content_disposition_type="inline" if image_type and not download else "attachment",
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})


@router.get("/overview")
def overview():
    return services.files.overview()


@router.get("/inventory")
def inventory(
    category: str = "all",
    q: str | None = None,
    status: str | None = None,
    sort: str = "default",
    page: int = 1,
    per_page: int = 50,
):
    return services.files.inventory(
        category=category,
        q=q,
        status=status,
        sort=sort,
        page=page,
        per_page=per_page,
    )


@router.get("/duplicates")
def duplicates():
    return services.files.duplicates()


@router.post("/preview-delete")
def preview_delete(payload: FileDeleteRequest):
    return services.files.preview_delete(
        [target.model_dump(exclude_none=True) for target in payload.targets]
    )


@router.post("/delete")
def delete(payload: FileDeleteRequest):
    return services.files.delete(
        [target.model_dump(exclude_none=True) for target in payload.targets]
    )
