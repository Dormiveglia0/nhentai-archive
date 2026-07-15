from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    GovernanceApplyRequest,
    GovernanceBulkRequest,
    GovernanceReviewRequest,
    GovernanceTranslateRequest,
)
from app.container import services
from app.services.translation_service import TranslationError


router = APIRouter()


@router.get("/governance/queue")
def queue():
    return services.governance.queue()


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
