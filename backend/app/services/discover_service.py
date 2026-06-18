from __future__ import annotations

import json
from typing import Any

from app.database import Database
from app.services.nhentai_client import NhentaiApiError, NhentaiClient, map_gallery_summary


class DiscoverService:
    def __init__(self, db: Database, client: NhentaiClient):
        self.db = db
        self.client = client

    def latest(self, page: int, per_page: int) -> dict[str, Any]:
        payload = self.client.latest(page, per_page)
        return self._map_page(payload)

    def feed(
        self,
        page: int,
        per_page: int,
        query: str = "",
        sort: str = "date",
        language: str = "all",
        kind: str = "all",
        tag_id: int | None = None,
        tag_names: str = "",
        unimported_only: bool = False,
    ) -> dict[str, Any]:
        selected_tags = [value.strip() for value in tag_names.split(",") if value.strip()]
        can_use_tagged = tag_id and len(selected_tags) <= 1 and not query.strip() and language == "all" and kind == "all"
        if can_use_tagged:
            return self.tagged(tag_id, page, per_page, sort, unimported_only)

        remote_query = build_search_query(query, language, kind, selected_tags)
        if remote_query or sort != "date":
            return self.search(query, page, per_page, sort, language, kind, unimported_only, selected_tags)

        mapped = self.latest(page, per_page)
        if unimported_only:
            mapped["result"] = [item for item in mapped["result"] if not item.get("imported")]
            mapped["total"] = len(mapped["result"])
        mapped["query"] = ""
        mapped["source"] = "latest"
        return mapped

    def popular(self) -> dict[str, Any]:
        payload = self.client.popular()
        return self._map_items(payload, {"total": len(payload), "num_pages": 1, "per_page": len(payload)})

    def tagged(
        self,
        tag_id: int,
        page: int,
        per_page: int,
        sort: str = "date",
        unimported_only: bool = False,
    ) -> dict[str, Any]:
        payload = self.client.tagged(tag_id, page, per_page, sort)
        mapped = self._map_page(payload)
        if unimported_only:
            mapped["result"] = [item for item in mapped["result"] if not item.get("imported")]
            mapped["total"] = len(mapped["result"])
        mapped["query"] = f"tag_id:{tag_id}"
        mapped["source"] = "tagged"
        return mapped

    def random(self) -> dict[str, Any]:
        payload = self.client.random()
        if isinstance(payload, dict) and "id" in payload:
            return self.gallery(int(payload["id"]))
        return payload

    def search(
        self,
        query: str,
        page: int,
        per_page: int,
        sort: str = "date",
        language: str = "all",
        kind: str = "all",
        unimported_only: bool = False,
        tag_names: list[str] | None = None,
    ) -> dict[str, Any]:
        remote_query = build_search_query(query, language, kind, tag_names or [])
        if not remote_query and sort != "date":
            remote_query = "pages:>0"
        if len(remote_query.strip()) < 1:
            return {"result": [], "total": 0, "num_pages": 0, "per_page": per_page, "reason": "min_query_length"}
        payload = self.client.search(remote_query, page, per_page, sort)
        mapped = self._map_page(payload)
        if unimported_only:
            mapped["result"] = [item for item in mapped["result"] if not item.get("imported")]
            mapped["total"] = len(mapped["result"])
        mapped["query"] = remote_query
        mapped["source"] = "search"
        return mapped

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
        tags = payload.get("tags", [])
        self.cache_tags(tags)
        pages = []
        for index, page in enumerate(payload.get("pages", []), start=1):
            if isinstance(page, dict):
                path = page.get("path")
                pages.append({**page, "index": index, "url": self.client.media_url(path)})
            elif isinstance(page, str):
                pages.append({"index": index, "path": page, "url": self.client.media_url(page)})
        # Related items only carry tag_ids; resolve them to full tags (and import
        # state) via the same path the feed uses so related cards can show content
        # tags just like the discover cards.
        related_items = payload.get("related", [])
        related_tag_map = self._tags_for_items(related_items)
        related = [self._with_import_state(item, related_tag_map) for item in related_items]
        return {
            "remote": "nhentai",
            "gallery_id": payload["id"],
            "media_id": payload.get("media_id"),
            "title": payload.get("title", {}),
            "cover": cover,
            "thumbnail": thumbnail,
            "scanlator": payload.get("scanlator"),
            "upload_date": payload.get("upload_date"),
            "tags": self._with_dictionary_display(tags),
            "page_count": payload.get("num_pages", 0),
            "pages": pages,
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

    def cached_tags(self, limit: int = 60) -> dict[str, Any]:
        rows = self.db.fetchall(
            """
            SELECT r.remote_id, r.type, r.name, r.slug, d.zh_name
            FROM remote_tags r
            LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = r.remote_id AND d.ignored = 0
            WHERE r.name IS NOT NULL OR r.slug IS NOT NULL
            ORDER BY r.cached_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        return {
            "result": [
                {
                    "id": row["remote_id"],
                    "type": row["type"],
                    "name": row["name"],
                    "slug": row["slug"],
                    "display": row["zh_name"] or row["name"] or row["slug"],
                }
                for row in rows
            ]
        }

    def cache_tags(self, tags: list[dict[str, Any]]) -> None:
        for tag in tags:
            self.cache_tag(tag)

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
        return self._map_items(
            payload.get("result", []),
            {
                "num_pages": payload.get("num_pages", 0),
                "per_page": payload.get("per_page", 0),
                "total": payload.get("total", 0),
            },
        )

    def _map_items(self, items: list[dict[str, Any]], meta: dict[str, Any]) -> dict[str, Any]:
        tag_map = self._tags_for_items(items)
        return {
            "result": [self._with_import_state(item, tag_map) for item in items],
        } | meta

    def _with_import_state(self, item: dict[str, Any], tag_map: dict[int, dict[str, Any]] | None = None) -> dict[str, Any]:
        summary = map_gallery_summary(item)
        summary["thumbnail"]["url"] = self.client.media_url(summary["thumbnail"].get("path"), thumbnail=True)
        work = self.db.fetchone("SELECT id FROM works WHERE remote_gallery_id = ?", (summary["gallery_id"],))
        summary["imported"] = work is not None
        summary["work_id"] = work["id"] if work else None
        summary["tags"] = [tag_map[tag_id] for tag_id in summary.get("tag_ids", []) if tag_map and tag_id in tag_map]
        return summary

    def _tags_for_items(self, items: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
        ids: list[int] = []
        for item in items:
            ids.extend(int(tag_id) for tag_id in item.get("tag_ids", []) if isinstance(tag_id, int))
        if not ids:
            return {}
        unique_ids = list(dict.fromkeys(ids))
        cached_rows = self.db.fetchall(
            f"""
            SELECT r.remote_id, r.type, r.name, r.slug, d.zh_name
            FROM remote_tags r
            LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = r.remote_id AND d.ignored = 0
            WHERE r.remote_id IN ({','.join('?' for _ in unique_ids)})
            """,
            tuple(unique_ids),
        )
        tag_map = {
            int(row["remote_id"]): {
                "id": row["remote_id"],
                "type": row["type"],
                "name": row["name"],
                "slug": row["slug"],
                "display": row["zh_name"] or row["name"] or row["slug"],
            }
            for row in cached_rows
        }
        missing = [tag_id for tag_id in dict.fromkeys(ids) if tag_id not in tag_map][:100]
        if missing:
            try:
                tags = self.client.tags_by_ids(missing)
            except NhentaiApiError:
                return tag_map
            self.cache_tags(tags)
            for tag in tags:
                if tag.get("id") is not None:
                    tag_map[int(tag["id"])] = {
                        "id": tag["id"],
                        "type": tag.get("type"),
                        "name": tag.get("name"),
                        "slug": tag.get("slug"),
            }
        return tag_map

    def _with_dictionary_display(self, tags: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ids = [int(tag["id"]) for tag in tags if isinstance(tag.get("id"), int)]
        if not ids:
            return tags
        rows = self.db.fetchall(
            f"""
            SELECT r.remote_id, d.zh_name
            FROM remote_tags r
            LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = r.remote_id AND d.ignored = 0
            WHERE r.remote_id IN ({','.join('?' for _ in ids)})
            """,
            tuple(dict.fromkeys(ids)),
        )
        display_by_id = {int(row["remote_id"]): row["zh_name"] for row in rows if row.get("zh_name")}
        return [
            {
                **tag,
                "display": display_by_id.get(int(tag["id"]), tag.get("name") or tag.get("slug") or str(tag["id"])),
            }
            if isinstance(tag.get("id"), int)
            else tag
            for tag in tags
        ]


def build_search_query(query: str, language: str = "all", kind: str = "all", tag_names: list[str] | None = None) -> str:
    parts = [query.strip()] if query.strip() else []
    language_map = {"japanese": "japanese", "english": "english", "chinese": "chinese"}
    kind_map = {
        "doujinshi": "doujinshi",
        "manga": "manga",
    }
    if language in language_map:
        parts.append(f"language:{language_map[language]}")
    if kind in kind_map:
        parts.append(f'tag:"{kind_map[kind]}"')
    for tag in tag_names or []:
        safe_tag = tag.replace('"', "").strip()
        if safe_tag:
            parts.append(f'tag:"{safe_tag}"')
    return " ".join(parts).strip()
