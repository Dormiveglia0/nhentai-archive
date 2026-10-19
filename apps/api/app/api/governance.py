from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import (
    GovernanceApplyRequest,
    GovernanceBulkRequest,
    GovernanceReviewRequest,
    GovernanceTranslateRequest,
    MetadataRefreshApplyRequest,
    MetadataRefreshPreviewRequest,
    SourceRenameRequest,
)
from app.container import services
from app.services.translation_service import TranslationError


router = APIRouter()


@router.post("/works/{work_id}/source-rename")
def rename_source(work_id: int, payload: SourceRenameRequest):
    try:
        return services.source_renames.rename(work_id, payload.file_id, payload.filename, payload.expected_path)
    except (OSError, ValueError) as exc:
        raise HTTPException(409, str(exc)) from exc


@router.get("/governance/queue")
def queue(q: str = Query("", max_length=240), status: Literal["all", "review", "metadata", "dictionary", "files", "approved"] = "all",
          page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100)):
    return services.governance.queue(q, status, page, per_page)


@router.get("/works/{work_id}/governance")
def work(work_id: int):
    try:
        return services.governance.work_governance(work_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/works/{work_id}/governance/apply")
def apply(work_id: int, payload: GovernanceApplyRequest):
    try:
        return services.governance.apply(work_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/works/{work_id}/governance/translate")
def translate(work_id: int, payload: GovernanceTranslateRequest):
    try:
        return services.governance.translate_metadata(work_id, payload.fields)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.post("/works/{work_id}/governance/review")
def review(work_id: int, payload: GovernanceReviewRequest):
    try:
        return services.governance.review(work_id, payload.action, payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/governance/bulk/preview")
def bulk_preview(payload: GovernanceBulkRequest):
    try:
        return services.governance.bulk_preview(
            payload.work_ids, payload.actions.model_dump()
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/governance/bulk/apply")
def bulk_apply(payload: GovernanceBulkRequest):
    try:
        return services.governance.bulk_apply(
            payload.work_ids, payload.actions.model_dump()
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/governance/metadata-refresh/preview")
def metadata_refresh_preview(payload: MetadataRefreshPreviewRequest):
    try:
        return services.metadata_refresh.preview(payload.work_ids, payload.gallery_ids, payload.queries, payload.bind, payload.item_ids, payload.image_search)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/governance/metadata-refresh/apply")
def metadata_refresh_apply(payload: MetadataRefreshApplyRequest):
    try:
        return services.metadata_refresh.apply([match.model_dump() for match in payload.matches])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
