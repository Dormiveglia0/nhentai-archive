from fastapi import APIRouter

from app.api.schemas import FileDeleteRequest
from app.container import services


router = APIRouter(prefix="/files")


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
