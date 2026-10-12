from fastapi import APIRouter, HTTPException

from app.api.schemas import SettingsPatch
from app.container import services


router = APIRouter(prefix="/settings")


@router.get("/smtp")
def smtp_settings():
    return services.notifications.public_config()


@router.patch("/smtp")
def configure_smtp(payload: dict):
    try:
        return services.notifications.configure(payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/smtp/test")
def test_smtp():
    return services.notifications.test()


@router.get("/smtp/preview")
def preview_smtp():
    try:
        return services.notifications.preview()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/smtp/outbox")
def mail_outbox():
    return services.notifications.outbox()


@router.post("/smtp/outbox/{mail_id}/retry")
def retry_mail(mail_id: int):
    try:
        return services.notifications.retry(mail_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("")
def get_settings():
    return services.settings_service.get()


@router.patch("")
def patch_settings(patch: SettingsPatch):
    try:
        return services.settings_service.patch(patch.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/nhentai/verify")
def verify_nhentai():
    return services.settings_service.verify_nhentai()


@router.post("/translation/verify")
def verify_translation():
    return services.translation.verify()


@router.post("/nhentai/clear-cache")
def clear_nhentai_cache():
    services.client.clear_runtime_cache()
    return {"ok": True, "message": "远端缓存已清除"}


@router.get("/nhentai/runtime")
def nhentai_runtime_stats():
    return services.client.runtime_stats()
