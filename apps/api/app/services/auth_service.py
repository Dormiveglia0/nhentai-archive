from __future__ import annotations

from collections import defaultdict, deque
import base64
import hashlib
import hmac
import json
import math
import secrets
import threading
import time

from app.database import Database


SESSION_COOKIE = "nh_archive_session"
SESSION_MAX_AGE = 90 * 24 * 60 * 60
_PASSWORD_KEY = "auth.password"
_SESSION_PREFIX = "auth.session."
_MAX_FAILURES = 5
_FAILURE_WINDOW = 5 * 60


class AuthAlreadyConfigured(Exception):
    pass


class AuthNotConfigured(Exception):
    pass


class InvalidCredentials(Exception):
    pass


class InvalidPassword(Exception):
    pass


class AuthRateLimited(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after


class AuthService:
    def __init__(self, db: Database):
        self.db = db
        self._lock = threading.Lock()
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._valid_sessions: dict[str, int] = {}

    def configured(self) -> bool:
        return self.db.fetchone("SELECT 1 AS ok FROM settings WHERE key = ?", (_PASSWORD_KEY,)) is not None

    def status(self, token: str | None) -> dict[str, bool | int]:
        configured = self.configured()
        return {
            "configured": configured,
            "authenticated": configured and self.authenticate(token),
            "session_days": SESSION_MAX_AGE // 86400,
        }

    def setup(self, password: str) -> tuple[str, int]:
        record = json.dumps(_password_record(password), separators=(",", ":"))
        with self.db.connect() as conn:
            created = conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (_PASSWORD_KEY, record),
            ).rowcount
        if created != 1:
            raise AuthAlreadyConfigured
        return self._create_session()

    def login(self, password: str, client_key: str) -> tuple[str, int]:
        self._check_rate_limit(client_key)
        row = self.db.fetchone("SELECT value FROM settings WHERE key = ?", (_PASSWORD_KEY,))
        if not row:
            raise AuthNotConfigured
        if not _verify_password(password, row["value"]):
            self._record_failure(client_key)
            raise InvalidCredentials
        with self._lock:
            self._failures.pop(client_key, None)
        return self._create_session()

    def change_password(self, current_password: str, new_password: str, client_key: str) -> tuple[str, int]:
        self._check_rate_limit(client_key)
        row = self.db.fetchone("SELECT value FROM settings WHERE key = ?", (_PASSWORD_KEY,))
        if not row:
            raise AuthNotConfigured
        old_record = row["value"]
        if not _verify_password(current_password, old_record):
            self._record_failure(client_key)
            raise InvalidCredentials
        new_record = json.dumps(_password_record(new_password), separators=(",", ":"))
        with self.db.connect() as conn:
            changed = conn.execute(
                "UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND value = ?",
                (new_record, _PASSWORD_KEY, old_record),
            ).rowcount
            if changed != 1:
                raise InvalidCredentials
            conn.execute("DELETE FROM settings WHERE key LIKE ?", (f"{_SESSION_PREFIX}%",))
        with self._lock:
            self._failures.pop(client_key, None)
            self._valid_sessions.clear()
        return self._create_session()

    def authenticate(self, token: str | None) -> bool:
        if not token or len(token) > 256:
            return False
        key = _session_key(token)
        now = int(time.time())
        with self._lock:
            if self._valid_sessions.get(key, 0) > now:
                return True
        row = self.db.fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        try:
            expires_at = int(row["value"]) if row else 0
        except (TypeError, ValueError):
            expires_at = 0
        if expires_at <= now:
            if row:
                self.db.execute("DELETE FROM settings WHERE key = ?", (key,))
            return False
        with self._lock:
            self._valid_sessions[key] = expires_at
        return True

    def logout(self, token: str | None) -> None:
        if not token or len(token) > 256:
            return
        key = _session_key(token)
        with self._lock:
            self._valid_sessions.pop(key, None)
        self.db.execute("DELETE FROM settings WHERE key = ?", (key,))

    def _create_session(self) -> tuple[str, int]:
        now = int(time.time())
        expires_at = now + SESSION_MAX_AGE
        token = secrets.token_urlsafe(32)
        key = _session_key(token)
        self.db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            (key, str(expires_at)),
        )
        self.db.execute(
            "DELETE FROM settings WHERE key LIKE ? AND CAST(value AS INTEGER) <= ?",
            (f"{_SESSION_PREFIX}%", now),
        )
        with self._lock:
            self._valid_sessions[key] = expires_at
        return token, expires_at

    def _check_rate_limit(self, client_key: str) -> None:
        now = time.monotonic()
        with self._lock:
            failures = self._failures[client_key]
            while failures and now - failures[0] >= _FAILURE_WINDOW:
                failures.popleft()
            if len(failures) >= _MAX_FAILURES:
                raise AuthRateLimited(max(1, math.ceil(_FAILURE_WINDOW - (now - failures[0]))))

    def _record_failure(self, client_key: str) -> None:
        with self._lock:
            self._failures[client_key].append(time.monotonic())


def _password_record(password: str) -> dict[str, int | str]:
    if not password:
        raise InvalidPassword("密码不能为空")
    if len(password) > 256:
        raise InvalidPassword("密码不能超过256个字符")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return {
        "version": 1,
        "algorithm": "scrypt",
        "n": 2**14,
        "r": 8,
        "p": 1,
        "salt": base64.b64encode(salt).decode("ascii"),
        "hash": base64.b64encode(digest).decode("ascii"),
    }


def _verify_password(password: str, raw_record: str) -> bool:
    try:
        record = json.loads(raw_record)
        if record.get("version") != 1 or record.get("algorithm") != "scrypt":
            return False
        salt = base64.b64decode(record["salt"], validate=True)
        expected = base64.b64decode(record["hash"], validate=True)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(record["n"]),
            r=int(record["r"]),
            p=int(record["p"]),
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return False


def _session_key(token: str) -> str:
    return f"{_SESSION_PREFIX}{hashlib.sha256(token.encode('utf-8')).hexdigest()}"
