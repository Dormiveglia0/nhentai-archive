from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.container import services
from app.services.auth_service import (
    AuthAlreadyConfigured,
    AuthNotConfigured,
    AuthRateLimited,
    InvalidCredentials,
    InvalidPassword,
    SESSION_COOKIE,
    SESSION_MAX_AGE,
)


router = APIRouter(prefix="/auth")


class PasswordPayload(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordPayload(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


@router.get("/status")
def auth_status(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    if not getattr(request.app.state, "enforce_auth", True):
        return {"configured": True, "authenticated": True, "session_days": SESSION_MAX_AGE // 86400}
    return services.auth.status(request.cookies.get(SESSION_COOKIE))


@router.post("/setup")
def setup_auth(payload: PasswordPayload, request: Request, response: Response):
    try:
        token, _expires_at = services.auth.setup(payload.password)
    except InvalidPassword as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AuthAlreadyConfigured as exc:
        raise HTTPException(status_code=409, detail="访问密码已经创建") from exc
    _set_session_cookie(response, request, token)
    return services.auth.status(token)


@router.post("/login")
def login(payload: PasswordPayload, request: Request, response: Response):
    client_key = request.client.host if request.client else "unknown"
    try:
        token, _expires_at = services.auth.login(payload.password, client_key)
    except AuthNotConfigured as exc:
        raise HTTPException(status_code=409, detail="请先创建访问密码") from exc
    except InvalidCredentials as exc:
        raise HTTPException(status_code=401, detail="密码错误") from exc
    except AuthRateLimited as exc:
        raise HTTPException(
            status_code=429,
            detail="尝试次数过多，请稍后再试",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    _set_session_cookie(response, request, token)
    return services.auth.status(token)


@router.post("/change")
def change_password(payload: ChangePasswordPayload, request: Request, response: Response):
    client_key = request.client.host if request.client else "unknown"
    try:
        token, _expires_at = services.auth.change_password(payload.current_password, payload.new_password, client_key)
    except AuthNotConfigured as exc:
        raise HTTPException(status_code=409, detail="请先创建访问密码") from exc
    except InvalidCredentials as exc:
        raise HTTPException(status_code=403, detail="当前密码错误") from exc
    except InvalidPassword as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AuthRateLimited as exc:
        raise HTTPException(
            status_code=429,
            detail="尝试次数过多，请稍后再试",
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    _set_session_cookie(response, request, token)
    return services.auth.status(token)


@router.post("/logout")
def logout(request: Request, response: Response):
    services.auth.logout(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="strict")
    response.headers["Cache-Control"] = "no-store"
    return {"ok": True}


def _set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        path="/",
    )
