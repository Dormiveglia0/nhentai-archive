from fastapi import APIRouter, HTTPException

from app.api.schemas import (
    DictionaryApplyRequest,
    DictionaryBulkImportRequest,
    DictionarySuggestBatchRequest,
    DictionaryTranslateRequest,
)
from app.api.shared import remote
from app.container import services
from app.services.translation_service import TranslationError


router = APIRouter(prefix="/dictionary")


@router.get("/candidates")
def candidates(
    q: str = "",
    type: str = "all",
    status: str = "all",
    limit: int = 50,
    offset: int = 0,
):
    return services.dictionary.candidates(q, status, limit, offset, type)


@router.get("/summary")
def summary():
    return services.dictionary.summary()


@router.get("/evidence")
def evidence(remote_tag_id: int | None = None, dictionary_id: int | None = None):
    return services.dictionary.evidence(remote_tag_id, dictionary_id)


@router.get("/autocomplete")
def autocomplete(q: str, limit: int = 20):
    return remote(lambda: services.dictionary.autocomplete(q, limit))


@router.post("/preview-apply")
def preview_apply(payload: DictionaryApplyRequest):
    try:
        return services.dictionary.preview_apply(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/apply")
def apply(payload: DictionaryApplyRequest):
    try:
        return services.dictionary.apply(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/translate")
def translate(payload: DictionaryTranslateRequest):
    try:
        return services.dictionary.translate_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.post("/suggest-batch")
def suggest_batch(payload: DictionarySuggestBatchRequest):
    try:
        return services.dictionary.generate_suggestions(payload.limit, payload.remote_tag_ids)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.post("/preview-bulk-import")
def preview_bulk_import(payload: DictionaryBulkImportRequest):
    return services.dictionary.preview_bulk_import(payload.rows)


@router.post("/bulk-import")
def bulk_import(payload: DictionaryBulkImportRequest):
    return services.dictionary.bulk_import(payload.rows)


@router.post("/{dictionary_id}/ignore")
def ignore(dictionary_id: int):
    try:
        return services.dictionary.ignore(dictionary_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{dictionary_id}/review")
def review(dictionary_id: int):
    try:
        return services.dictionary.mark_review(dictionary_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{dictionary_id}")
def delete(dictionary_id: int):
    try:
        return services.dictionary.delete(dictionary_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
