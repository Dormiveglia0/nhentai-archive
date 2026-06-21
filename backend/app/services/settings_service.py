from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services.nhentai_client import NhentaiApiError, NhentaiClient


DEFAULT_EXPORT_PRESET = {
    "id": "default-v2",
    "name": "默认预设 v2",
    "naming_rule": "{title} ({circle})",
    "comicinfo_rule": "完整写入（覆盖缺失项）",
    "meta_rule": "保留原文件（不覆盖）",
    "compression": "ZIP - 最佳压缩",
}


class SettingsService:
    def __init__(self, db: Database, settings: Settings, client: NhentaiClient, translation: Any = None):
        self.db = db
        self.settings = settings
        self.client = client
        self.translation = translation
        self.apply_runtime_settings()

    def get(self) -> dict[str, Any]:
        effective_key, source = self._effective_api_key()
        privacy_default = self._get("ui.privacy_mode_default", "true") == "true"
        blur_default = self._get("ui.blur_covers_default", "true") == "true"
        reader_mode = self._get("reader.default_mode", "single")
        export_dir = self._storage_path("storage.export_dir", self.settings.export_dir)
        return {
            "nhentai": {
                "base_url": self.settings.nhentai_base_url,
                "user_agent": self.settings.user_agent,
                "request_timeout": self.settings.request_timeout,
                "api_key_configured": bool(effective_key),
                "api_key_source": source,
                "last_verify": self._get_json("nhentai.last_verify"),
            },
            "storage": {
                "data_dir": str(self.settings.data_dir),
                "library_dir": str(self.settings.library_dir),
                "covers_dir": str(self.settings.covers_dir),
                "page_cache_dir": str(self.settings.page_cache_dir),
                "export_dir": str(export_dir),
            },
            "privacy": {
                "privacy_mode_default": privacy_default,
                "blur_covers_default": blur_default,
            },
            "reader": {
                "default_mode": reader_mode,
            },
            "machine_translation": self.translation.public_config() if self.translation else None,
            "export": {**self._export_settings(), "default_options": self._export_default_options()},
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

        mt = payload.get("machine_translation") or {}
        if mt.get("clear_deepl_api_key"):
            self._delete("mt.deepl_api_key")
        deepl_key = mt.get("deepl_api_key")
        if isinstance(deepl_key, str) and deepl_key.strip():
            self._set("mt.deepl_api_key", deepl_key.strip())
        if mt.get("provider") in {"google_free", "deepl"}:
            self._set("mt.provider", mt["provider"])
        if mt.get("deepl_plan") in {"free", "pro"}:
            self._set("mt.deepl_plan", mt["deepl_plan"])
        if mt.get("target_lang") in {"zh-CN", "zh-TW"}:
            self._set("mt.target_lang", mt["target_lang"])
        batch_limit = mt.get("batch_limit")
        if isinstance(batch_limit, int) and 1 <= batch_limit <= 50:
            self._set("mt.batch_limit", str(batch_limit))

        storage = payload.get("storage") or {}
        export_dir = storage.get("export_dir")
        if isinstance(export_dir, str) and export_dir.strip():
            path = Path(export_dir.strip()).expanduser()
            path.mkdir(parents=True, exist_ok=True)
            self._set("storage.export_dir", str(path))

        export = payload.get("export") or {}
        if export:
            presets = export.get("presets")
            active_preset_id = export.get("active_preset_id")
            default_options = export.get("default_options")
            if isinstance(presets, list):
                cleaned = [preset for preset in presets if isinstance(preset, dict) and preset.get("id") and preset.get("name")]
                if cleaned:
                    self._set("export.presets", json.dumps(cleaned, ensure_ascii=False))
            if isinstance(active_preset_id, str) and active_preset_id.strip():
                self._set("export.active_preset_id", active_preset_id.strip())
            if isinstance(default_options, dict):
                current = self._export_default_options()
                merged = {key: bool(default_options.get(key, current[key])) for key in current}
                self._set("export.default_options", json.dumps(merged, ensure_ascii=False))

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

    def _get_json_list(self, key: str) -> list[dict[str, Any]] | None:
        value = self._get(key)
        if not value:
            return None
        try:
            parsed = json.loads(value)
            return [item for item in parsed if isinstance(item, dict)] if isinstance(parsed, list) else None
        except json.JSONDecodeError:
            return None

    def _storage_path(self, key: str, fallback: Any) -> Any:
        value = self._get(key)
        return Path(value).expanduser() if value else fallback

    def _export_default_options(self) -> dict[str, bool]:
        defaults = {"write_comicinfo": True, "keep_json": True, "compress": True}
        stored = self._get_json("export.default_options") or {}
        return {key: bool(stored.get(key, value)) for key, value in defaults.items()}

    def _export_settings(self) -> dict[str, Any]:
        presets = self._get_json_list("export.presets") or [dict(DEFAULT_EXPORT_PRESET)]
        presets = [
            {
                **DEFAULT_EXPORT_PRESET,
                **preset,
                "id": str(preset["id"]),
                "name": str(preset["name"]),
            }
            for preset in presets
            if preset.get("id") and preset.get("name")
        ] or [dict(DEFAULT_EXPORT_PRESET)]
        preset_ids = {str(preset.get("id")) for preset in presets}
        active = self._get("export.active_preset_id", DEFAULT_EXPORT_PRESET["id"])
        if active not in preset_ids:
            active = str(presets[0]["id"])
        return {"active_preset_id": active, "presets": presets}

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
