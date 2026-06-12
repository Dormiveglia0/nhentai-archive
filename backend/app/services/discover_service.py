from __future__ import annotations

import json
from typing import Any

from app.database import Database
from app.services.nhentai_client import NhentaiClient, map_gallery_summary


class DiscoverService:
    def __init__(self, db: Database, client: NhentaiClient):
        self.db = db
        self.client = client

    def latest(self, page: int, per_page: int) -> dict[str, Any]:
        payload = self.client.latest(page, per_page)
        return self._map_page(payload)

    def popular(self) -> dict[str, Any]:
        payload = self.client.popular()
        return {"result": [self._with_import_state(item) for item in payload], "total": len(payload)}

    def random(self) -> dict[str, Any]:
        payload = self.client.random()
        if isinstance(payload, dict) and "id" in payload:
            return self.gallery(int(payload["id"]))
        return payload

    def search(self, query: str, page: int, per_page: int) -> dict[str, Any]:
        if len(query.strip()) < 3:
            return {"result": [], "total": 0, "num_pages": 0, "per_page": per_page, "reason": "min_query_length"}
        return self._map_page(self.client.search(query, page, per_page))

    def gallery(self, gallery_id: int) -> dict[str, Any]:
        payload = self.client.gallery(gallery_id, include="related")
        self.cache_gallery(payload)
        work = self.db.fetchone("SELECT id FROM works WHERE remote_gallery_id = ?", (gallery_id,))
        cover = payload.get("cover") or {}
        thumbnail = payload.get("thumbnail") or {}
        if isinstance(cover, dict):
            cover = {**cover, "url": self.client.media_url(cover.get("path"))}
        if isinstance(thumbnail, dict):
            thumbnail = {**thumbnail, "url": self.client.media_url(thumbnail.get("path"), thumbnail=True)}
        related = []
        for item in payload.get("related", []):
            summary = map_gallery_summary(item)
            summary["thumbnail"]["url"] = self.client.media_url(summary["thumbnail"].get("path"), thumbnail=True)
            related.append(summary)
        return {
            "remote": "nhentai",
            "gallery_id": payload["id"],
            "media_id": payload.get("media_id"),
            "title": payload.get("title", {}),
            "cover": cover,
            "thumbnail": thumbnail,
            "scanlator": payload.get("scanlator"),
            "upload_date": payload.get("upload_date"),
            "tags": payload.get("tags", []),
            "page_count": payload.get("num_pages", 0),
            "favorites": payload.get("num_favorites", 0),
            "related": related,
            "imported": work is not None,
            "work_id": work["id"] if work else None,
        }

    def tag_autocomplete(self, query: str, limit: int = 20) -> dict[str, Any]:
        payload = self.client.tag_search(query, limit)
        result = payload.get("result", payload if isinstance(payload, list) else [])
        for tag in result:
            self.cache_tag(tag)
        return {"result": result}

    def cache_gallery(self, payload: dict[str, Any]) -> None:
        gallery_id = int(payload["id"])
        self.db.execute(
            """
            INSERT INTO remote_galleries (gallery_id, media_id, payload_json, cached_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(gallery_id) DO UPDATE SET
              media_id = excluded.media_id,
              payload_json = excluded.payload_json,
              cached_at = CURRENT_TIMESTAMP
            """,
            (gallery_id, payload.get("media_id"), json.dumps(payload, ensure_ascii=False)),
        )

    def cache_tag(self, payload: dict[str, Any]) -> None:
        remote_id = payload.get("id")
        if remote_id is None:
            return
        self.db.execute(
            """
            INSERT INTO remote_tags (remote_id, type, name, slug, payload_json, cached_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(remote_id) DO UPDATE SET
              type = excluded.type,
              name = excluded.name,
              slug = excluded.slug,
              payload_json = excluded.payload_json,
              cached_at = CURRENT_TIMESTAMP
            """,
            (
                remote_id,
                payload.get("type"),
                payload.get("name"),
                payload.get("slug"),
                json.dumps(payload, ensure_ascii=False),
            ),
        )

    def _map_page(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "result": [self._with_import_state(item) for item in payload.get("result", [])],
            "num_pages": payload.get("num_pages", 0),
            "per_page": payload.get("per_page", 0),
            "total": payload.get("total", 0),
        }

    def _with_import_state(self, item: dict[str, Any]) -> dict[str, Any]:
        summary = map_gallery_summary(item)
        summary["thumbnail"]["url"] = self.client.media_url(summary["thumbnail"].get("path"), thumbnail=True)
        work = self.db.fetchone("SELECT id FROM works WHERE remote_gallery_id = ?", (summary["gallery_id"],))
        summary["imported"] = work is not None
        summary["work_id"] = work["id"] if work else None
        return summary
