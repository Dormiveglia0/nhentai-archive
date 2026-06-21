from __future__ import annotations

import json
import re
from typing import Any

from app.database import Database


def normalize_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().casefold())


class DictionaryService:
    def __init__(self, db: Database, client: Any, translation: Any = None):
        self.db = db
        self.client = client
        self.translation = translation

    def translate_text(self, text: str) -> dict[str, Any]:
        """On-demand machine translation for a single original term."""
        if not self.translation:
            raise ValueError("translation service not configured")
        clean = (text or "").strip()
        if not clean:
            raise ValueError("text is required")
        translation = self.translation.translate_one(clean).strip()
        return {"text": clean, "translation": translation, "provider": self.translation.config()["provider"]}

    def generate_suggestions(self, limit: int = 20) -> dict[str, Any]:
        """Machine-translate the top unconfigured remote tags into reviewable
        `status='suggested'` dictionary rows. Does NOT link work_tags — that
        only happens when a human confirms/applies the suggestion."""
        if not self.translation:
            raise ValueError("translation service not configured")
        limit = max(1, min(int(limit), 50))
        candidates = self.candidates(status="unconfigured", limit=limit)["result"]
        pending: list[tuple[str, str, int]] = []
        for candidate in candidates:
            original = candidate.get("name") or candidate.get("slug")
            remote_id = candidate.get("id")
            if not original or remote_id is None:
                continue
            pending.append((str(original), str(candidate.get("type") or "tag"), int(remote_id)))
        if not pending:
            return {"generated": 0, "items": []}
        translations = self.translation.translate([item[0] for item in pending])
        items: list[dict[str, Any]] = []
        for (original, tag_type, remote_id), zh in zip(pending, translations):
            zh_name = (zh or "").strip()
            if not zh_name:
                continue
            self._upsert_suggestion(original, zh_name, tag_type, remote_id)
            items.append({"original_text": original, "zh_name": zh_name, "tag_type": tag_type, "remote_tag_id": remote_id})
        return {"generated": len(items), "items": items}

    def _upsert_suggestion(self, original_text: str, zh_name: str, tag_type: str, remote_tag_id: int) -> None:
        key = normalize_key(original_text)
        existing = self.db.fetchone(
            "SELECT id, status, locked FROM local_tag_dictionary WHERE normalized_key = ? AND tag_type = ?",
            (key, tag_type),
        )
        if existing:
            # Never overwrite a human-curated or locked entry with a machine guess.
            if existing["locked"] or existing["status"] in {"configured", "review", "ignored"}:
                return
            self.db.execute(
                """
                UPDATE local_tag_dictionary
                SET zh_name = ?, remote_tag_id = ?, status = 'suggested', source = 'machine', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (zh_name, remote_tag_id, existing["id"]),
            )
            return
        self.db.execute(
            """
            INSERT INTO local_tag_dictionary
              (original_text, normalized_key, zh_name, tag_type, remote_tag_id, scope_json, note, status,
               confidence, locked, ignored, source)
            VALUES (?, ?, ?, ?, ?, '{}', NULL, 'suggested', 80, 0, 0, 'machine')
            """,
            (original_text, key, zh_name, tag_type, remote_tag_id),
        )

    def summary(self) -> dict[str, int]:
        remote_total = self.db.fetchone("SELECT COUNT(*) AS value FROM remote_tags")["value"]
        configured = self.db.fetchone("SELECT COUNT(*) AS value FROM local_tag_dictionary WHERE ignored = 0")["value"]
        ignored = self.db.fetchone("SELECT COUNT(*) AS value FROM local_tag_dictionary WHERE ignored = 1 OR status = 'ignored'")["value"]
        review = self.db.fetchone("SELECT COUNT(*) AS value FROM local_tag_dictionary WHERE ignored = 0 AND status = 'review'")["value"]
        suggestions = self.db.fetchone("SELECT COUNT(*) AS value FROM local_tag_dictionary WHERE ignored = 0 AND status = 'suggested'")["value"]
        # A remote tag counts as "handled" once it has any dictionary row — configured
        # OR ignored (ignored = intentionally kept as original, no translation needed).
        mapped_remote = self.db.fetchone(
            "SELECT COUNT(DISTINCT remote_tag_id) AS value FROM local_tag_dictionary WHERE remote_tag_id IS NOT NULL"
        )["value"]
        return {
            "unconfigured": max(0, int(remote_total or 0) - int(mapped_remote or 0)),
            "configured": int(configured or 0),
            "ignored": int(ignored or 0),
            "review": int(review or 0),
            "suggestions": int(suggestions or 0),
        }

    def autocomplete(self, query: str, limit: int = 20) -> dict[str, Any]:
        q = normalize_key(query)
        if not q:
            return {"result": []}
        limit = max(1, min(limit, 50))
        result: list[dict[str, Any]] = []
        seen: set[tuple[str, int | str]] = set()

        dictionary_rows = self.db.fetchall(
            """
            SELECT d.id, d.original_text, d.zh_name, d.tag_type, d.remote_tag_id, d.status, d.confidence
            FROM local_tag_dictionary d
            LEFT JOIN tag_aliases a ON a.dictionary_id = d.id
            WHERE d.ignored = 0
              AND (
                d.normalized_key LIKE ?
                OR lower(d.zh_name) LIKE ?
                OR a.normalized_key LIKE ?
              )
            ORDER BY d.updated_at DESC, d.id DESC
            LIMIT ?
            """,
            (f"%{q}%", f"%{q}%", f"%{q}%", limit),
        )
        for row in dictionary_rows:
            key = ("dictionary", row["id"])
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "source": "dictionary",
                    "dictionary_id": row["id"],
                    "id": row["remote_tag_id"],
                    "type": row["tag_type"],
                    "name": row["original_text"],
                    "display": row["zh_name"],
                    "status": row["status"],
                    "confidence": row["confidence"],
                }
            )

        alias_rows = self.db.fetchall(
            """
            SELECT a.alias, d.id, d.original_text, d.zh_name, d.tag_type, d.remote_tag_id
            FROM tag_aliases a
            JOIN local_tag_dictionary d ON d.id = a.dictionary_id
            WHERE d.ignored = 0 AND a.normalized_key LIKE ?
            ORDER BY a.id DESC
            LIMIT ?
            """,
            (f"%{q}%", limit),
        )
        for row in alias_rows:
            key = ("dictionary", row["id"])
            if key in seen:
                continue
            seen.add(key)
            result.append(
                {
                    "source": "alias",
                    "dictionary_id": row["id"],
                    "id": row["remote_tag_id"],
                    "type": row["tag_type"],
                    "name": row["original_text"],
                    "display": row["zh_name"],
                    "alias": row["alias"],
                }
            )

        remote_rows = self.db.fetchall(
            """
            SELECT r.remote_id, r.type, r.name, r.slug, d.id AS dictionary_id, d.zh_name
            FROM remote_tags r
            LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = r.remote_id
            WHERE lower(COALESCE(r.name, '')) LIKE ? OR lower(COALESCE(r.slug, '')) LIKE ?
            ORDER BY r.cached_at DESC
            LIMIT ?
            """,
            (f"%{q}%", f"%{q}%", limit),
        )
        for row in remote_rows:
            key = ("remote", int(row["remote_id"]))
            if key in seen:
                continue
            seen.add(key)
            result.append(_remote_tag_result(row, source="remote_cache"))

        if not result and len(q) >= 2:
            payload = self.client.tag_search(query.strip(), limit)
            remote_result = payload.get("result", payload if isinstance(payload, list) else [])
            for tag in remote_result:
                self.cache_remote_tag(tag)
                remote_id = tag.get("id")
                key = ("remote", int(remote_id)) if remote_id is not None else ("remote_name", tag.get("name") or tag.get("slug") or "")
                if key in seen:
                    continue
                seen.add(key)
                result.append(
                    {
                        "source": "remote",
                        "id": remote_id,
                        "type": tag.get("type"),
                        "name": tag.get("name"),
                        "slug": tag.get("slug"),
                        "display": tag.get("name") or tag.get("slug") or str(remote_id),
                    }
                )
                if len(result) >= limit:
                    break

        return {"result": result[:limit]}

    def candidates(
        self,
        query: str = "",
        status: str = "all",
        limit: int = 50,
        offset: int = 0,
        tag_type: str = "all",
    ) -> dict[str, Any]:
        q = normalize_key(query)
        params: list[Any] = []
        where = ["1 = 1"]
        if q:
            where.append("(lower(COALESCE(r.name, '')) LIKE ? OR lower(COALESCE(r.slug, '')) LIKE ?)")
            params.extend([f"%{q}%", f"%{q}%"])
        if status == "unconfigured":
            where.append("d.id IS NULL")
        elif status == "configured":
            where.append("d.id IS NOT NULL AND d.ignored = 0 AND d.status = 'configured'")
        elif status == "ignored":
            where.append("(d.ignored = 1 OR d.status = 'ignored')")
        elif status == "review":
            where.append("d.id IS NOT NULL AND d.ignored = 0 AND d.status = 'review'")
        if tag_type != "all":
            where.append("COALESCE(r.type, d.tag_type) = ?")
            params.append(tag_type)
        sql = f"""
            SELECT
              r.remote_id,
              r.type,
              r.name,
              r.slug,
              r.cached_at,
              d.id AS dictionary_id,
              d.zh_name,
              d.status,
              d.ignored,
              COUNT(DISTINCT wt.work_id) AS impact_work_count
            FROM remote_tags r
            LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = r.remote_id
              OR (
                d.remote_tag_id IS NULL
                AND d.ignored = 0
                AND d.tag_type = COALESCE(r.type, d.tag_type)
                AND (
                  d.normalized_key = lower(COALESCE(r.name, ''))
                  OR d.normalized_key = lower(COALESCE(r.slug, ''))
                )
              )
            LEFT JOIN work_tags wt ON wt.remote_tag_id = r.remote_id
            WHERE {' AND '.join(where)}
            GROUP BY r.remote_id, d.id
            ORDER BY d.id IS NOT NULL, r.cached_at DESC
            LIMIT ? OFFSET ?
        """
        params.extend([max(1, min(limit, 100)), max(0, offset)])
        rows = self.db.fetchall(sql, params)
        result = [_remote_tag_result(row, source="candidate") for row in rows]
        if status in {"all", "configured", "review", "ignored"} and (not q or len(result) < limit):
            result.extend(self._local_only_candidates(q, status, tag_type, max(0, limit - len(result))))
        return {"result": result}

    def evidence(self, remote_tag_id: int | None = None, dictionary_id: int | None = None) -> dict[str, Any]:
        dictionary = None
        if dictionary_id is not None:
            dictionary = self.db.fetchone("SELECT * FROM local_tag_dictionary WHERE id = ?", (dictionary_id,))
            if dictionary and remote_tag_id is None:
                remote_tag_id = dictionary["remote_tag_id"]
        remote_tag = None
        if remote_tag_id is not None:
            remote_tag = self.db.fetchone("SELECT remote_id, type, name, slug FROM remote_tags WHERE remote_id = ?", (remote_tag_id,))
        related_works = []
        co_tags = []
        if remote_tag_id is not None:
            related_works = self.db.fetchall(
                """
                SELECT w.id, w.title, w.title_japanese, w.remote_gallery_id, w.page_count, w.cover_path
                FROM work_tags wt
                JOIN works w ON w.id = wt.work_id
                WHERE wt.remote_tag_id = ?
                ORDER BY w.updated_at DESC
                LIMIT 12
                """,
                (remote_tag_id,),
            )
            co_tags = self.db.fetchall(
                """
                SELECT other.remote_tag_id AS id, COALESCE(d.zh_name, other.remote_name, other.remote_slug) AS display,
                       other.tag_type AS type, COUNT(*) AS count
                FROM work_tags own
                JOIN work_tags other ON other.work_id = own.work_id AND other.remote_tag_id != own.remote_tag_id
                LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = other.remote_tag_id AND d.ignored = 0
                WHERE own.remote_tag_id = ?
                GROUP BY other.remote_tag_id, display, other.tag_type
                ORDER BY count DESC
                LIMIT 16
                """,
                (remote_tag_id,),
            )
        history = []
        if dictionary:
            history.append(
                {
                    "status": dictionary["status"],
                    "source": dictionary["source"],
                    "updated_at": dictionary["updated_at"],
                    "message": f"当前状态：{dictionary['status']}",
                }
            )
            if dictionary["ignored"]:
                history.append(
                    {
                        "status": "ignored",
                        "source": dictionary["source"],
                        "updated_at": dictionary["updated_at"],
                        "message": "已忽略",
                    }
                )
        dictionary_result = _dictionary_result(dictionary)
        if dictionary_result:
            aliases = self.db.fetchall("SELECT alias FROM tag_aliases WHERE dictionary_id = ? ORDER BY id", (dictionary_result["id"],))
            dictionary_result["aliases"] = [row["alias"] for row in aliases]
        return {
            "remote_tag": {
                "id": remote_tag["remote_id"],
                "type": remote_tag["type"],
                "name": remote_tag["name"],
                "slug": remote_tag["slug"],
            }
            if remote_tag
            else None,
            "dictionary": dictionary_result,
            "related_works": related_works,
            "co_tags": co_tags,
            "history": history,
        }

    def preview_apply(self, payload: dict[str, Any]) -> dict[str, Any]:
        cleaned = self._clean_payload(payload)
        conflicts = self._conflicts(cleaned)
        impact = self._impact(cleaned.get("remote_tag_id"))
        return {
            "writes": False,
            "dictionary": cleaned,
            "impact": impact,
            "will_update_tags": impact["tag_count"],
            "will_update_works": impact["work_count"],
            "ignored": 1 if cleaned["ignored"] else 0,
            "samples": self._sample_works(cleaned.get("remote_tag_id")),
            "conflicts": conflicts,
        }

    def apply(self, payload: dict[str, Any]) -> dict[str, Any]:
        cleaned = self._clean_payload(payload)
        if not cleaned["original_text"]:
            raise ValueError("original_text is required")
        # Ignored terms intentionally keep the original text and need no Chinese name.
        if not cleaned["zh_name"] and cleaned["status"] != "ignored":
            raise ValueError("original_text and zh_name are required")
        existing = self.db.fetchone(
            "SELECT id, locked FROM local_tag_dictionary WHERE normalized_key = ? AND tag_type = ?",
            (cleaned["normalized_key"], cleaned["tag_type"]),
        )
        if existing and existing["locked"]:
            dictionary_id = existing["id"]
        elif existing:
            dictionary_id = existing["id"]
            self.db.execute(
                """
                UPDATE local_tag_dictionary
                SET original_text = ?, zh_name = ?, remote_tag_id = ?, scope_json = ?, note = ?,
                    status = ?, confidence = ?, ignored = ?, source = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    cleaned["original_text"],
                    cleaned["zh_name"],
                    cleaned.get("remote_tag_id"),
                    json.dumps(cleaned["scope"], ensure_ascii=False),
                    cleaned.get("note"),
                    cleaned["status"],
                    cleaned["confidence"],
                    int(cleaned["ignored"]),
                    cleaned["source"],
                    dictionary_id,
                ),
            )
        else:
            cursor = self.db.execute(
                """
                INSERT INTO local_tag_dictionary
                  (original_text, normalized_key, zh_name, tag_type, remote_tag_id, scope_json, note, status,
                   confidence, locked, ignored, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cleaned["original_text"],
                    cleaned["normalized_key"],
                    cleaned["zh_name"],
                    cleaned["tag_type"],
                    cleaned.get("remote_tag_id"),
                    json.dumps(cleaned["scope"], ensure_ascii=False),
                    cleaned.get("note"),
                    cleaned["status"],
                    cleaned["confidence"],
                    int(cleaned["locked"]),
                    int(cleaned["ignored"]),
                    cleaned["source"],
                ),
            )
            dictionary_id = cursor.lastrowid

        for alias in cleaned["aliases"]:
            alias_key = normalize_key(alias)
            conflict = self.db.fetchone("SELECT dictionary_id FROM tag_aliases WHERE normalized_key = ?", (alias_key,))
            if conflict and conflict["dictionary_id"] != dictionary_id:
                continue
            self.db.execute(
                """
                INSERT INTO tag_aliases (dictionary_id, alias, normalized_key, source)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(normalized_key) DO UPDATE SET
                  dictionary_id = excluded.dictionary_id,
                  alias = excluded.alias,
                  source = excluded.source
                """,
                (dictionary_id, alias, alias_key, cleaned["source"]),
            )

        work_ids = self._work_ids_for_remote_tag(cleaned.get("remote_tag_id"))
        for work_id in work_ids:
            self._upsert_work_tag(work_id, cleaned.get("remote_tag_id"), dictionary_id, cleaned["tag_type"])

        dictionary = self.db.fetchone("SELECT * FROM local_tag_dictionary WHERE id = ?", (dictionary_id,))
        return {
            "dictionary": _dictionary_result(dictionary),
            "impact": self._impact(cleaned.get("remote_tag_id")),
            "will_update_tags": self._impact(cleaned.get("remote_tag_id"))["tag_count"],
            "will_update_works": self._impact(cleaned.get("remote_tag_id"))["work_count"],
            "ignored": 1 if cleaned["ignored"] else 0,
            "samples": self._sample_works(cleaned.get("remote_tag_id")),
            "conflicts": self._conflicts(cleaned),
        }

    def preview_bulk_import(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        parsed = [self._bulk_row(row, index) for index, row in enumerate(rows, start=1)]
        summary = {
            "valid": len([row for row in parsed if row["status"] == "valid"]),
            "duplicate": len([row for row in parsed if row["status"] == "duplicate"]),
            "conflict": len([row for row in parsed if row["status"] == "conflict"]),
            "invalid": len([row for row in parsed if row["status"] == "invalid"]),
        }
        return {"writes": False, "summary": summary, "rows": parsed}

    def bulk_import(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        preview = self.preview_bulk_import(rows)
        imported = 0
        for row in preview["rows"]:
            if row["status"] != "valid":
                continue
            self.apply(row["payload"] | {"source": "bulk"})
            imported += 1
        return {"summary": {"imported": imported}, "rows": preview["rows"]}

    def ignore(self, dictionary_id: int) -> dict[str, Any]:
        return self._set_status(dictionary_id, "ignored", ignored=True)

    def mark_review(self, dictionary_id: int) -> dict[str, Any]:
        return self._set_status(dictionary_id, "review", ignored=False)

    def delete(self, dictionary_id: int) -> dict[str, Any]:
        current = self.db.fetchone("SELECT id FROM local_tag_dictionary WHERE id = ?", (dictionary_id,))
        if not current:
            raise ValueError("Dictionary term not found")
        self.db.execute("UPDATE work_tags SET dictionary_id = NULL WHERE dictionary_id = ?", (dictionary_id,))
        self.db.execute("DELETE FROM tag_aliases WHERE dictionary_id = ?", (dictionary_id,))
        self.db.execute("DELETE FROM local_tag_dictionary WHERE id = ?", (dictionary_id,))
        return {"deleted": True, "dictionary_id": dictionary_id}

    def link_work_tags(self, work_id: int, tags: list[dict[str, Any]]) -> None:
        for tag in tags:
            remote_id = tag.get("id")
            if remote_id is None:
                continue
            self.cache_remote_tag(tag)
            dictionary = self._dictionary_for_tag(tag)
            self._upsert_work_tag(
                work_id,
                int(remote_id),
                dictionary["id"] if dictionary else None,
                tag.get("type"),
                tag.get("name"),
                tag.get("slug"),
            )

    def cache_remote_tag(self, payload: dict[str, Any]) -> None:
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
                int(remote_id),
                payload.get("type"),
                payload.get("name"),
                payload.get("slug"),
                json.dumps(payload, ensure_ascii=False),
            ),
        )

    def _clean_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        original = str(payload.get("original_text") or payload.get("name") or "").strip()
        zh_name = str(payload.get("zh_name") or payload.get("display") or "").strip()
        aliases = payload.get("aliases") or []
        if isinstance(aliases, str):
            aliases = [value.strip() for value in re.split(r"[,，|/]", aliases) if value.strip()]
        scope = payload.get("scope") or payload.get("scope_json") or []
        if isinstance(scope, str):
            scope = [value.strip() for value in re.split(r"[,，|/]", scope) if value.strip()]
        tag_type = str(payload.get("tag_type") or payload.get("type") or "tag").strip() or "tag"
        remote_tag_id = payload.get("remote_tag_id")
        resolved_remote_tag_id = int(remote_tag_id) if remote_tag_id not in (None, "") else self._resolve_remote_tag_id(original, tag_type)
        return {
            "original_text": original,
            "normalized_key": normalize_key(original),
            "zh_name": zh_name,
            "tag_type": tag_type,
            "remote_tag_id": resolved_remote_tag_id,
            "aliases": [str(value).strip() for value in aliases if str(value).strip()],
            "scope": scope,
            "note": payload.get("note"),
            "status": str(payload.get("status") or "configured"),
            "confidence": int(payload.get("confidence") or 80),
            "locked": bool(payload.get("locked", False)),
            "ignored": bool(payload.get("ignored", False)),
            "source": str(payload.get("source") or "manual"),
        }

    def _bulk_row(self, row: dict[str, Any], index: int) -> dict[str, Any]:
        payload = self._clean_payload(row)
        status = "valid"
        message = ""
        if not payload["original_text"] or not payload["zh_name"]:
            status = "invalid"
            message = "原文和中文名必填"
        else:
            existing = self.db.fetchone(
            "SELECT id FROM local_tag_dictionary WHERE normalized_key = ? AND tag_type = ?",
            (payload["normalized_key"], payload["tag_type"]),
            )
            if existing:
                status = "duplicate"
                message = "词条已存在"
            elif self._conflicts(payload):
                status = "conflict"
                message = "存在别名冲突"
        return {"index": index, "status": status, "message": message, "payload": payload}

    def _resolve_remote_tag_id(self, original: str, tag_type: str) -> int | None:
        key = normalize_key(original)
        if not key:
            return None
        row = self.db.fetchone(
            """
            SELECT remote_id
            FROM remote_tags
            WHERE COALESCE(type, ?) = ?
              AND (lower(COALESCE(name, '')) = ? OR lower(COALESCE(slug, '')) = ?)
            ORDER BY cached_at DESC
            LIMIT 1
            """,
            (tag_type, tag_type, key, key),
        )
        return int(row["remote_id"]) if row else None

    def _local_only_candidates(self, query: str, status: str, tag_type: str, limit: int) -> list[dict[str, Any]]:
        if limit <= 0:
            return []
        params: list[Any] = []
        where = ["d.remote_tag_id IS NULL"]
        if query:
            where.append("(d.normalized_key LIKE ? OR lower(d.zh_name) LIKE ?)")
            params.extend([f"%{query}%", f"%{query}%"])
        if status == "configured":
            where.append("d.ignored = 0 AND d.status = 'configured'")
        elif status == "ignored":
            where.append("(d.ignored = 1 OR d.status = 'ignored')")
        elif status == "review":
            where.append("d.ignored = 0 AND d.status = 'review'")
        if tag_type != "all":
            where.append("d.tag_type = ?")
            params.append(tag_type)
        params.append(limit)
        rows = self.db.fetchall(
            f"""
            SELECT d.id AS dictionary_id, d.original_text, d.zh_name, d.tag_type, d.status, d.ignored
            FROM local_tag_dictionary d
            WHERE {' AND '.join(where)}
              AND NOT EXISTS (
                SELECT 1 FROM remote_tags r
                WHERE COALESCE(r.type, d.tag_type) = d.tag_type
                  AND (lower(COALESCE(r.name, '')) = d.normalized_key OR lower(COALESCE(r.slug, '')) = d.normalized_key)
              )
            ORDER BY d.updated_at DESC, d.id DESC
            LIMIT ?
            """,
            params,
        )
        return [
            {
                "source": "local_dictionary",
                "id": None,
                "type": row["tag_type"],
                "name": row["original_text"],
                "slug": None,
                "display": row["zh_name"],
                "dictionary_id": row["dictionary_id"],
                "status": row["status"],
                "configured": True,
                "ignored": bool(row["ignored"]),
                "impact_work_count": 0,
            }
            for row in rows
        ]

    def _set_status(self, dictionary_id: int, status: str, ignored: bool) -> dict[str, Any]:
        current = self.db.fetchone("SELECT id FROM local_tag_dictionary WHERE id = ?", (dictionary_id,))
        if not current:
            raise ValueError("Dictionary term not found")
        self.db.execute(
            """
            UPDATE local_tag_dictionary
            SET status = ?, ignored = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (status, int(ignored), dictionary_id),
        )
        return {"dictionary": _dictionary_result(self.db.fetchone("SELECT * FROM local_tag_dictionary WHERE id = ?", (dictionary_id,)))}

    def _conflicts(self, cleaned: dict[str, Any]) -> list[dict[str, Any]]:
        conflicts = []
        existing = self.db.fetchone(
            "SELECT id, zh_name FROM local_tag_dictionary WHERE normalized_key = ? AND tag_type = ?",
            (cleaned["normalized_key"], cleaned["tag_type"]),
        )
        if existing:
            conflicts.append({"type": "dictionary", "id": existing["id"], "message": f"原词已存在：{existing['zh_name']}"})
        for alias in cleaned["aliases"]:
            existing_alias = self.db.fetchone(
                """
                SELECT a.dictionary_id, d.zh_name
                FROM tag_aliases a
                JOIN local_tag_dictionary d ON d.id = a.dictionary_id
                WHERE a.normalized_key = ?
                """,
                (normalize_key(alias),),
            )
            if existing_alias:
                conflicts.append(
                    {
                        "type": "alias",
                        "dictionary_id": existing_alias["dictionary_id"],
                        "message": f"别名已属于：{existing_alias['zh_name']}",
                    }
                )
        return conflicts

    def _impact(self, remote_tag_id: int | None) -> dict[str, Any]:
        work_ids = self._work_ids_for_remote_tag(remote_tag_id)
        return {"work_count": len(work_ids), "work_ids": work_ids[:20], "tag_count": 1 if remote_tag_id else 0}

    def _sample_works(self, remote_tag_id: int | None) -> list[dict[str, Any]]:
        if remote_tag_id is None:
            return []
        return self.db.fetchall(
            """
            SELECT w.id, w.title, w.title_japanese, w.remote_gallery_id, w.page_count, w.cover_path
            FROM work_tags wt
            JOIN works w ON w.id = wt.work_id
            WHERE wt.remote_tag_id = ?
            ORDER BY w.updated_at DESC
            LIMIT 6
            """,
            (remote_tag_id,),
        )

    def _work_ids_for_remote_tag(self, remote_tag_id: int | None) -> list[int]:
        if remote_tag_id is None:
            return []
        work_ids = {
            int(row["work_id"])
            for row in self.db.fetchall("SELECT work_id FROM work_tags WHERE remote_tag_id = ?", (remote_tag_id,))
        }
        rows = self.db.fetchall(
            """
            SELECT w.id, g.payload_json
            FROM works w
            JOIN remote_galleries g ON g.gallery_id = w.remote_gallery_id
            WHERE w.remote_gallery_id IS NOT NULL
            """
        )
        for row in rows:
            try:
                payload = json.loads(row["payload_json"])
            except json.JSONDecodeError:
                continue
            for tag in payload.get("tags", []):
                if isinstance(tag, dict) and int(tag.get("id") or 0) == remote_tag_id:
                    work_ids.add(int(row["id"]))
        return sorted(work_ids)

    def _dictionary_for_tag(self, tag: dict[str, Any]) -> dict[str, Any] | None:
        remote_id = tag.get("id")
        if remote_id is not None:
            row = self.db.fetchone("SELECT * FROM local_tag_dictionary WHERE remote_tag_id = ? AND ignored = 0", (int(remote_id),))
            if row:
                return row
        for value in (tag.get("name"), tag.get("slug")):
            if not value:
                continue
            row = self.db.fetchone(
                "SELECT * FROM local_tag_dictionary WHERE normalized_key = ? AND ignored = 0",
                (normalize_key(str(value)),),
            )
            if row:
                return row
        return None

    def _upsert_work_tag(
        self,
        work_id: int,
        remote_tag_id: int | None,
        dictionary_id: int | None,
        tag_type: str | None,
        remote_name: str | None = None,
        remote_slug: str | None = None,
    ) -> None:
        if remote_tag_id is None:
            return
        remote = self.db.fetchone("SELECT name, slug, type FROM remote_tags WHERE remote_id = ?", (remote_tag_id,))
        self.db.execute(
            """
            INSERT INTO work_tags (work_id, remote_tag_id, dictionary_id, tag_type, remote_name, remote_slug)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(work_id, remote_tag_id) DO UPDATE SET
              dictionary_id = COALESCE(excluded.dictionary_id, work_tags.dictionary_id),
              tag_type = excluded.tag_type,
              remote_name = excluded.remote_name,
              remote_slug = excluded.remote_slug
            """,
            (
                work_id,
                remote_tag_id,
                dictionary_id,
                tag_type or (remote["type"] if remote else None),
                remote_name or (remote["name"] if remote else None),
                remote_slug or (remote["slug"] if remote else None),
            ),
        )


def _remote_tag_result(row: dict[str, Any], source: str) -> dict[str, Any]:
    return {
        "source": source,
        "id": row["remote_id"],
        "type": row.get("type"),
        "name": row.get("name"),
        "slug": row.get("slug"),
        "display": row.get("zh_name") or row.get("name") or row.get("slug") or str(row["remote_id"]),
        "dictionary_id": row.get("dictionary_id"),
        "status": row.get("status"),
        "configured": row.get("dictionary_id") is not None,
        "ignored": bool(row.get("ignored", 0)),
        "impact_work_count": int(row.get("impact_work_count", 0) or 0),
    }


def _dictionary_result(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "original_text": row["original_text"],
        "zh_name": row["zh_name"],
        "tag_type": row["tag_type"],
        "remote_tag_id": row["remote_tag_id"],
        "scope": json.loads(row["scope_json"] or "[]"),
        "note": row["note"],
        "status": row["status"],
        "confidence": row["confidence"],
        "locked": bool(row["locked"]),
        "ignored": bool(row["ignored"]),
        "source": row["source"],
    }
