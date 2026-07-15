from fastapi import HTTPException

from app.services.nhentai_client import NhentaiApiError


def remote(call):
    try:
        return call()
    except NhentaiApiError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message, "retry_after": exc.retry_after},
        ) from exc
