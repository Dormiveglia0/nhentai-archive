from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

security = HTTPBearer(auto_error=False)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def verify_password(username: str, password: str) -> bool:
    return hmac.compare_digest(username, settings.admin_username) and hmac.compare_digest(
        password, settings.admin_password
    )


def create_token(subject: str, ttl_seconds: int = 60 * 60 * 24) -> str:
    payload = {"sub": subject, "exp": int(time.time()) + ttl_seconds}
    payload_part = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(settings.secret_key.encode("utf-8"), payload_part.encode("ascii"), hashlib.sha256)
    return f"{payload_part}.{_b64(sig.digest())}"


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload_part, signature_part = token.split(".", 1)
        expected = hmac.new(
            settings.secret_key.encode("utf-8"), payload_part.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(_unb64(signature_part), expected):
            raise ValueError("bad signature")
        payload = json.loads(_unb64(payload_part))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expired")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_token(credentials.credentials)
    if payload.get("sub") != settings.admin_username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return settings.admin_username
