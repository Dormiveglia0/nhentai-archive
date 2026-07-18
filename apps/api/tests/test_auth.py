from types import SimpleNamespace

from fastapi import HTTPException, Request, Response
import pytest

from app.api import auth as auth_api
from app.api.shared import require_authentication
from app.database import Database
from app.services.auth_service import AuthAlreadyConfigured, AuthRateLimited, AuthService, InvalidCredentials


def _auth(tmp_path) -> AuthService:
    db = Database(tmp_path / "auth.db")
    db.init_schema()
    return AuthService(db)


def test_password_and_session_persist_locally(tmp_path):
    auth = _auth(tmp_path)
    token, _expires_at = auth.setup("correct-horse")
    assert auth.authenticate(token)
    stored = auth.db.fetchall("SELECT key, value FROM settings ORDER BY key")
    serialized = repr([dict(row) for row in stored])
    assert "correct-horse" not in serialized
    assert token not in serialized
    with pytest.raises(AuthAlreadyConfigured):
        auth.setup("another-password")
    with pytest.raises(InvalidCredentials):
        auth.login("wrong-password", "local")

    restarted = AuthService(auth.db)
    assert restarted.authenticate(token)
    next_token, _expires_at = restarted.login("correct-horse", "local")
    assert restarted.authenticate(next_token)
    restarted.logout(next_token)
    assert not restarted.authenticate(next_token)


def test_repeated_wrong_password_is_rate_limited(tmp_path):
    auth = _auth(tmp_path)
    auth.setup("correct-horse")
    for _ in range(5):
        with pytest.raises(InvalidCredentials):
            auth.login("wrong-password", "local")
    with pytest.raises(AuthRateLimited) as limited:
        auth.login("correct-horse", "local")
    assert limited.value.retry_after > 0


def test_single_character_password_can_be_changed_and_revokes_old_sessions(tmp_path):
    auth = _auth(tmp_path)
    first_token, _expires_at = auth.setup("1")
    second_token, _expires_at = auth.login("1", "local")

    next_token, _expires_at = auth.change_password("1", "新", "local")

    assert not auth.authenticate(first_token)
    assert not auth.authenticate(second_token)
    assert auth.authenticate(next_token)
    with pytest.raises(InvalidCredentials):
        auth.login("1", "local")
    assert auth.authenticate(auth.login("新", "local")[0])


def _request(path: str, *, cookie: str | None = None) -> Request:
    headers = [(b"cookie", f"nh_archive_session={cookie}".encode())] if cookie else []
    return Request({
        "type": "http",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers,
        "client": ("local", 1234),
        "server": ("test", 80),
        "root_path": "",
        "app": SimpleNamespace(state=SimpleNamespace(enforce_auth=True)),
    })


def test_http_gate_setup_cookie_and_logout(tmp_path, monkeypatch):
    auth = _auth(tmp_path)
    monkeypatch.setattr(auth_api.services, "auth", auth)

    require_authentication(_request("/api/health"))
    require_authentication(_request("/api/auth/status"))
    with pytest.raises(HTTPException) as blocked:
        require_authentication(_request("/api/settings"))
    assert blocked.value.status_code == 401
    with pytest.raises(HTTPException) as blocked_change:
        require_authentication(_request("/api/auth/change"))
    assert blocked_change.value.status_code == 401

    response = Response()
    status = auth_api.setup_auth(auth_api.PasswordPayload(password="correct-horse"), _request("/api/auth/setup"), response)
    assert status["authenticated"] is True
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "SameSite=strict" in cookie
    token = cookie.split("nh_archive_session=", 1)[1].split(";", 1)[0]
    require_authentication(_request("/api/settings", cookie=token))

    change_response = Response()
    changed = auth_api.change_password(
        auth_api.ChangePasswordPayload(current_password="correct-horse", new_password="x"),
        _request("/api/auth/change", cookie=token),
        change_response,
    )
    assert changed["authenticated"] is True
    assert not auth.authenticate(token)
    token = change_response.headers["set-cookie"].split("nh_archive_session=", 1)[1].split(";", 1)[0]
    require_authentication(_request("/api/settings", cookie=token))

    logout_response = Response()
    assert auth_api.logout(_request("/api/auth/logout", cookie=token), logout_response) == {"ok": True}
    assert not auth.authenticate(token)
