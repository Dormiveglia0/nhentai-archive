from fastapi import HTTPException, Request

from app.container import services
from app.services.auth_service import SESSION_COOKIE
from app.services.nhentai_client import NhentaiApiError


def require_authentication(request: Request) -> None:
    if not getattr(request.app.state, "enforce_auth", True):
        return
    path = request.url.path
    if path == "/api/health" or path in {"/api/auth/status", "/api/auth/setup", "/api/auth/login", "/api/auth/logout"}:
        return
    if services.auth.authenticate(request.cookies.get(SESSION_COOKIE)):
        return
    detail = "请先创建访问密码" if not services.auth.configured() else "需要登录"
    raise HTTPException(status_code=401, detail=detail)


def remote(call):
    try:
        return call()
    except NhentaiApiError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message, "retry_after": exc.retry_after},
        ) from exc
