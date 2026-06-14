from __future__ import annotations

import json
from typing import Any

from app.config import Settings
from app.database import Database
from app.services.nhentai_client import NhentaiApiError, NhentaiClient


class SettingsService:
    def __init__(self, db: Database, settings: Settings, client: NhentaiClient):
        self.db = db
        self.settings = settings
        self.client = client
        self.apply_runtime_settings()

    def get(self) -> dict[str, Any]:
        effective_key, source = self._effective_api_key()
        privacy_default = self._get("ui.privacy_mode_default", "true") == "true"
        blur_default = self._get("ui.blur_covers_default", "true") == "true"
        reader_mode = self._get("reader.default_mode", "single")
        return {
            "nhentai": {
                "base_url": self.settings.nhentai_base_url,
                "api_key_configured": bool(effective_key),
                "api_key_source": source,
                "last_verify": self._get_json("nhentai.last_verify"),
            },
            "storage": {
                "data_dir": str(self.settings.data_dir),
                "library_dir": str(self.settings.library_dir),
                "covers_dir": str(self.settings.covers_dir),
                "page_cache_dir": str(self.settings.page_cache_dir),
                "export_dir": str(self.settings.export_dir),
            },
            "privacy": {
                "privacy_mode_default": privacy_default,
                "blur_covers_default": blur_default,
            },
            "reader": {
                "default_mode": reader_mode,
            },
        }

    def patch(self, payload: dict[str, Any]) -> dict[str, Any]:
        if payload.get("clear_nhentai_api_key"):
            self._delete("nhentai.api_key")
        api_key = payload.get("nhentai_api_key")
        if isinstance(api_key, str) and api_key.strip():
            self._set("nhentai.api_key", api_key.strip())

        privacy = payload.get("privacy") or {}
        if "privacy_mode_default" in privacy:
            self._set_bool("ui.privacy_mode_default", bool(privacy["privacy_mode_default"]))
        if "blur_covers_default" in privacy:
            self._set_bool("ui.blur_covers_default", bool(privacy["blur_covers_default"]))

        reader = payload.get("reader") or {}
        if reader.get("default_mode") in {"single", "scroll"}:
            self._set("reader.default_mode", reader["default_mode"])

        self.apply_runtime_settings()
        return self.get()

    def verify_nhentai(self) -> dict[str, Any]:
        key, source = self._effective_api_key()
        if not key:
            result = {
                "configured": False,
                "ok": False,
                "source": "none",
                "status_code": None,
                "message": "NH API Key 未配置",
            }
            self._set("nhentai.last_verify", json.dumps(result, ensure_ascii=False))
            return result

        self.apply_runtime_settings()
        try:
            self.client.user()
            result = {
                "configured": True,
                "ok": True,
                "source": source,
                "status_code": 200,
                "message": "连接验证通过",
            }
        except NhentaiApiError as exc:
            result = {
                "configured": True,
                "ok": False,
                "source": source,
                "status_code": exc.status_code,
                "message": exc.message,
            }
        except Exception as exc:
            result = {
                "configured": True,
                "ok": False,
                "source": source,
                "status_code": None,
                "message": str(exc),
            }
        self._set("nhentai.last_verify", json.dumps(result, ensure_ascii=False))
        return result

    def apply_runtime_settings(self) -> None:
        api_key, _source = self._effective_api_key()
        if self.client.api_key != api_key:
            self.client.api_key = api_key
            self.client.clear_runtime_cache()

    def _effective_api_key(self) -> tuple[str | None, str]:
        if self.settings.nhentai_api_key:
            return self.settings.nhentai_api_key, "env"
        stored = self._get("nhentai.api_key")
        if stored:
            return stored, "db"
        return None, "none"

    def _get(self, key: str, default: str | None = None) -> str | None:
        row = self.db.fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else default

    def _get_json(self, key: str) -> dict[str, Any] | None:
        value = self._get(key)
        if not value:
            return None
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    def _set(self, key: str, value: str) -> None:
        self.db.execute(
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = CURRENT_TIMESTAMP
            """,
            (key, value),
        )

    def _set_bool(self, key: str, value: bool) -> None:
        self._set(key, "true" if value else "false")

    def _delete(self, key: str) -> None:
        self.db.execute("DELETE FROM settings WHERE key = ?", (key,))
