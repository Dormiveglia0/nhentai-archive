from fastapi import APIRouter

from app.api.schemas import SettingsPatch
from app.container import services


router = APIRouter(prefix="/settings")


@router.get("")
def get_settings():
    return services.settings_service.get()


@router.patch("")
def patch_settings(patch: SettingsPatch):
    return services.settings_service.patch(patch.model_dump(exclude_none=True))


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
