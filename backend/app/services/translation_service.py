from __future__ import annotations

from typing import Any

import httpx

from ..config import settings
from ..db import Database


class TranslationService:
    def __init__(self, db: Database):
        self.db = db

    def settings(self) -> dict[str, Any]:
        rows = self.db.query_all("SELECT key, value FROM settings")
        values = {row["key"]: row["value"] for row in rows}
        return {
            "translate_tags": values.get("translate_tags", "true") == "true",
            "translate_titles": values.get("translate_titles", "false") == "true",
            "translation_provider": values.get("translation_provider", settings.translation_provider),
        }

    def update_settings(self, values: dict[str, Any]) -> dict[str, Any]:
        for key, value in values.items():
            if value is None:
                continue
            stored = str(value).lower() if isinstance(value, bool) else str(value)
            self.db.execute(
                "INSERT INTO settings(key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, stored),
            )
        return self.settings()

    def dictionary(self) -> list[dict[str, Any]]:
        rows = self.db.query_all("SELECT * FROM tag_dictionary ORDER BY source_type, source_text")
        for row in rows:
            row["enabled"] = bool(row["enabled"])
        return rows

    def upsert_dictionary(self, item: dict[str, Any]) -> dict[str, Any]:
        self.db.execute(
            """
            INSERT INTO tag_dictionary(source_type, source_text, translated_text, enabled)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(source_type, source_text) DO UPDATE SET
                translated_text=excluded.translated_text,
                enabled=excluded.enabled,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                item["source_type"],
                item["source_text"].strip(),
                item["translated_text"].strip(),
                1 if item.get("enabled", True) else 0,
            ),
        )
        row = self.db.query_one(
            "SELECT * FROM tag_dictionary WHERE source_type=? AND source_text=?",
            (item["source_type"], item["source_text"].strip()),
        )
        assert row is not None
        row["enabled"] = bool(row["enabled"])
        return row

    def delete_dictionary(self, entry_id: int) -> None:
        self.db.execute("DELETE FROM tag_dictionary WHERE id=?", (entry_id,))

    def translation_map(self) -> dict[tuple[str, str], str]:
        rows = self.db.query_all(
            "SELECT source_type, source_text, translated_text FROM tag_dictionary WHERE enabled=1"
        )
        return {(row["source_type"], row["source_text"]): row["translated_text"] for row in rows}

    def translate_tag(self, source_type: str, source_text: str) -> str:
        return self.translation_map().get((source_type, source_text), source_text)

    async def suggest(self, items: list[dict[str, str]], provider: str | None = None) -> list[dict[str, Any]]:
        provider_name = provider or self.settings()["translation_provider"]
        if provider_name == "none":
            raise ValueError("Translation provider is not configured")
        texts = [item["source_text"] for item in items]
        translated = await self._machine_translate(texts, provider_name)
        suggestions: list[dict[str, Any]] = []
        for item, suggested_text in zip(items, translated):
            self.db.execute(
                """
                INSERT INTO translation_suggestions(source_type, source_text, suggested_text, provider)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(source_type, source_text, provider) DO UPDATE SET
                    suggested_text=excluded.suggested_text,
                    status='pending',
                    created_at=CURRENT_TIMESTAMP
                """,
                (item["source_type"], item["source_text"], suggested_text, provider_name),
            )
            row = self.db.query_one(
                "SELECT * FROM translation_suggestions WHERE source_type=? AND source_text=? AND provider=?",
                (item["source_type"], item["source_text"], provider_name),
            )
            if row:
                suggestions.append(row)
        return suggestions

    def suggestions(self) -> list[dict[str, Any]]:
        return self.db.query_all("SELECT * FROM translation_suggestions ORDER BY created_at DESC")

    def accept_suggestion(self, suggestion_id: int) -> dict[str, Any]:
        suggestion = self.db.query_one("SELECT * FROM translation_suggestions WHERE id=?", (suggestion_id,))
        if not suggestion:
            raise KeyError("Suggestion not found")
        entry = self.upsert_dictionary(
            {
                "source_type": suggestion["source_type"],
                "source_text": suggestion["source_text"],
                "translated_text": suggestion["suggested_text"],
                "enabled": True,
            }
        )
        self.db.execute("UPDATE translation_suggestions SET status='accepted' WHERE id=?", (suggestion_id,))
        return entry

    async def _machine_translate(self, texts: list[str], provider: str) -> list[str]:
        if provider == "deepl":
            if not settings.deepl_api_key:
                raise ValueError("DEEPL_API_KEY is not configured")
            data: list[tuple[str, str]] = [("auth_key", settings.deepl_api_key), ("target_lang", settings.target_language)]
            data.extend(("text", text) for text in texts)
            async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                response = await client.post(settings.deepl_api_url, data=data)
            response.raise_for_status()
            body = response.json()
            return [item["text"] for item in body.get("translations", [])]
        if provider == "google":
            if not settings.google_translate_api_key:
                raise ValueError("GOOGLE_TRANSLATE_API_KEY is not configured")
            payload = {"q": texts, "target": settings.target_language.lower(), "format": "text"}
            async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
                response = await client.post(
                    "https://translation.googleapis.com/language/translate/v2",
                    params={"key": settings.google_translate_api_key},
                    json=payload,
                )
            response.raise_for_status()
            translations = response.json().get("data", {}).get("translations", [])
            return [item["translatedText"] for item in translations]
        raise ValueError(f"Unsupported translation provider: {provider}")
