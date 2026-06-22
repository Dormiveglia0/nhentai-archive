from __future__ import annotations

import hashlib
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from app.database import Database
from app.services import comicinfo


METADATA_FIELDS = {
    "title": {"label": "标题", "work": "title", "comic": "Title"},
    "title_japanese": {"label": "副标题", "work": "title_japanese", "comic": "AlternateSeries"},
    "pretty_title": {"label": "整理标题", "work": "pretty_title", "comic": "LocalizedSeries"},
    "artist": {"label": "作者", "tag_type": "artist", "comic": "Writer"},
    "group": {"label": "社团", "tag_type": "group", "comic": "Publisher"},
    "language": {"label": "语言", "work": "language", "tag_type": "language", "comic": "LanguageISO"},
    "tags": {"label": "标签", "tag_type": "tag", "comic": "Tags"},
    "summary": {"label": "简介", "comic": "Summary"},
    "published_at": {"label": "发布时间", "comic": "Year"},
    "pages": {"label": "页数", "work": "page_count", "comic": "PageCount"},
}

ALLOWED_METADATA_SOURCES = {"manual", "remote", "comicinfo", "current"}
PROBLEM_DICTIONARY_STATUSES = {"review", "conflict"}

TAG_GROUP_LABELS = {
    "artist": "作者与社团",
    "group": "作者与社团",
    "parody": "原作与角色",
    "character": "原作与角色",
    "tag": "内容标签",
    "language": "语言与分类",
    "category": "语言与分类",
}


class GovernanceService:
    """Local-only metadata/tag governance aggregate backed by SQLite and stored CBZ files."""

    def __init__(self, db: Database, dictionary_service: Any | None = None, settings: Any | None = None):
        self.db = db
        self.dictionary_service = dictionary_service
        self.settings = settings

    def queue(self) -> dict[str, Any]:
        rows = self.db.fetchall(
            """
            SELECT
              w.*,
              COALESCE(f.size_bytes, 0) AS size_bytes,
              f.path AS source_path,
              (SELECT wm.value FROM work_metadata wm WHERE wm.work_id = w.id AND wm.field = 'title') AS title_metadata,
              (SELECT wm.value FROM work_metadata wm WHERE wm.work_id = w.id AND wm.field = 'language') AS language_metadata,
              (SELECT COUNT(*) FROM work_tags wt WHERE wt.work_id = w.id) AS tag_count,
              (SELECT COUNT(*)
                 FROM work_tags wt
                 JOIN local_tag_dictionary d ON d.id = wt.dictionary_id
                WHERE wt.work_id = w.id AND d.status = 'review') AS review_count,
              (SELECT COUNT(*)
                 FROM work_tags wt
                 JOIN local_tag_dictionary d ON d.id = wt.dictionary_id
                WHERE wt.work_id = w.id AND d.status = 'conflict') AS conflict_count,
              (SELECT COUNT(*) FROM work_metadata wm WHERE wm.work_id = w.id) AS metadata_count
            FROM works w
            LEFT JOIN (
              SELECT work_id, path, SUM(size_bytes) AS size_bytes
              FROM work_files
              WHERE kind = 'source_cbz'
              GROUP BY work_id
            ) f ON f.work_id = w.id
            ORDER BY w.updated_at DESC, w.id DESC
            """
        )
        items = []
        summary = {
            "total": len(rows),
            "missing_metadata": 0,
            "untagged": 0,
            "dictionary_review": 0,
            "dictionary_conflict": 0,
            "missing_comicinfo": 0,
            "missing_cover": 0,
        }
        for row in rows:
            reasons = self._queue_reasons(row)
            for reason in reasons:
                if reason["code"] in summary:
                    summary[reason["code"]] += 1
            items.append(
                {
                    "work": self._work_summary(row),
                    "reasons": reasons,
                    "completeness_percent": self._completeness(reasons),
                    "updated_at": row.get("updated_at"),
                }
            )
        return {"result": items, "summary": summary}

    def work_governance(self, work_id: int) -> dict[str, Any]:
        work = self._work_row(work_id)
        if not work:
            raise ValueError(f"Work {work_id} not found")
        files = self.db.fetchall("SELECT * FROM work_files WHERE work_id = ? ORDER BY created_at DESC, id DESC", (work_id,))
        source_path = next((row["path"] for row in files if row["kind"] == "source_cbz"), None)
        archive_sources = self._archive_metadata(source_path)
        remote_payload = self._remote_payload(work)
        saved = {
            row["field"]: row
            for row in self.db.fetchall("SELECT field, value, source, source_value, updated_at FROM work_metadata WHERE work_id = ?", (work_id,))
        }
        tag_rows = self._tag_rows(work_id)
        metadata_fields = self._metadata_fields(work, tag_rows, archive_sources, remote_payload, saved)
        tag_groups, tag_summary, dictionary_summary = self._tag_summary(tag_rows)
        reasons = self._queue_reasons(self._queue_row_for_work(work, files, tag_rows, saved))

        return {
            "work": self._work_summary(work),
            "files": [self._file_summary(row) for row in files],
            "metadata": {"fields": metadata_fields},
            "tags": {"groups": tag_groups, "summary": tag_summary},
            "dictionary": dictionary_summary,
            "exports": [],
            "recommended_actions": self._recommended_actions(reasons),
            "completeness_percent": self._completeness(reasons),
        }

    def apply(self, work_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        work = self._work_row(work_id)
        if not work:
            raise ValueError(f"Work {work_id} not found")
        metadata_rows = payload.get("metadata") or []
        if not isinstance(metadata_rows, list):
            raise ValueError("metadata must be a list")

        aggregate = self.work_governance(work_id)
        source_values = {field["field"]: field.get("source_value") for field in aggregate["metadata"]["fields"]}
        saved = 0
        with self.db.connect() as conn:
            for row in metadata_rows:
                if not isinstance(row, dict):
                    raise ValueError("metadata entries must be objects")
                field = str(row.get("field") or "").strip()
                source = str(row.get("source") or "manual").strip()
                if field not in METADATA_FIELDS:
                    raise ValueError(f"Unsupported metadata field: {field}")
                if source not in ALLOWED_METADATA_SOURCES:
                    raise ValueError(f"Unsupported metadata source: {source}")
                value = row.get("value")
                if value is not None:
                    value = str(value)
                conn.execute(
                    """
                    INSERT INTO work_metadata (work_id, field, value, source, source_value, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(work_id, field) DO UPDATE SET
                      value = excluded.value,
                      source = excluded.source,
                      source_value = excluded.source_value,
                      updated_at = CURRENT_TIMESTAMP
                    """,
                    (work_id, field, value, source, source_values.get(field)),
                )
                saved += 1

        dictionary_results = []
        for dictionary_payload in payload.get("dictionary_apply") or []:
            if self.dictionary_service is None:
                raise ValueError("dictionary apply is not configured")
            dictionary_results.append(self.dictionary_service.apply(dictionary_payload))

        response: dict[str, Any] = {
            "saved": saved,
            "dictionary": dictionary_results,
        }
        if payload.get("write_back"):
            try:
                response["write_back"] = self.write_back_comicinfo(work_id)
            except Exception as exc:  # metadata already persisted; a failed write-back does not roll back
                response["write_back"] = {"error": str(exc)}
        response["governance"] = self.work_governance(work_id)
        return response

    def write_back_comicinfo(self, work_id: int) -> dict[str, Any]:
        if self.settings is None:
            raise ValueError("write-back requires settings (library directory)")
        aggregate = self.work_governance(work_id)
        row = self.db.fetchone(
            "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz' "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (work_id,),
        )
        source_path = Path(row["path"]).resolve() if row and row["path"] else None
        if source_path is None or not source_path.exists() or not zipfile.is_zipfile(source_path):
            raise ValueError("源 CBZ 文件不存在或不是有效 ZIP，无法回写。")
        library_root = self.settings.library_dir.resolve()
        if not (source_path == library_root or library_root in source_path.parents):
            raise ValueError("源文件不在受管 library 目录内，拒绝回写。")

        fields = comicinfo.build_fields(aggregate)
        xml = comicinfo.to_xml(fields)
        data = comicinfo.reseal_cbz(source_path, xml, keep_json=True, compress=True)

        tmp_path = source_path.with_suffix(source_path.suffix + ".tmp")
        try:
            with open(tmp_path, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_path, source_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

        new_sha256 = hashlib.sha256(data).hexdigest()
        new_size = len(data)
        self.db.execute(
            "UPDATE work_files SET sha256 = ?, size_bytes = ? "
            "WHERE work_id = ? AND kind = 'source_cbz'",
            (new_sha256, new_size, work_id),
        )
        self.db.execute(
            "UPDATE works SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (work_id,)
        )
        return {
            "written": True,
            "fields": fields,
            "new_sha256": new_sha256,
            "new_size_bytes": new_size,
        }

    def _queue_reasons(self, row: dict[str, Any]) -> list[dict[str, Any]]:
        reasons: list[dict[str, Any]] = []
        if self._missing_metadata(row):
            reasons.append({"code": "missing_metadata", "label": "待补 metadata", "severity": "warning"})
        if int(row.get("tag_count") or 0) == 0:
            reasons.append({"code": "untagged", "label": "暂无标签", "severity": "warning"})
        if int(row.get("review_count") or 0) > 0:
            reasons.append({"code": "dictionary_review", "label": "词典待复核", "severity": "warning"})
        if int(row.get("conflict_count") or 0) > 0:
            reasons.append({"code": "dictionary_conflict", "label": "词典冲突", "severity": "danger"})
        if not self._archive_has_comicinfo(row.get("source_path")):
            reasons.append({"code": "missing_comicinfo", "label": "缺 ComicInfo", "severity": "warning"})
        cover_path = row.get("cover_path")
        if not cover_path or not Path(str(cover_path)).exists():
            reasons.append({"code": "missing_cover", "label": "缺封面", "severity": "warning"})
        return reasons

    def _missing_metadata(self, row: dict[str, Any]) -> bool:
        required_values = [self._final_metadata_value(row, "title"), self._final_metadata_value(row, "language")]
        return any(value is None or str(value).strip() == "" for value in required_values)

    def _final_metadata_value(self, row: dict[str, Any], field: str) -> Any:
        saved_key = f"{field}_metadata"
        if saved_key in row and row.get(saved_key) is not None:
            return row.get(saved_key)
        return row.get(field)

    def _archive_has_comicinfo(self, source_path: str | None) -> bool:
        if not source_path or not Path(source_path).exists() or not zipfile.is_zipfile(source_path):
            return False
        with zipfile.ZipFile(source_path) as archive:
            return any(Path(info.filename).name.lower() == "comicinfo.xml" for info in archive.infolist() if not info.is_dir())

    def _archive_metadata(self, source_path: str | None) -> dict[str, dict[str, str]]:
        result: dict[str, dict[str, str]] = {"comicinfo": {}, "json": {}}
        if not source_path or not Path(source_path).exists() or not zipfile.is_zipfile(source_path):
            return result
        with zipfile.ZipFile(source_path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                name = Path(info.filename).name.lower()
                if name == "comicinfo.xml":
                    result["comicinfo"] = self._parse_comicinfo(archive.read(info.filename))
                elif name.endswith(".json") and not result["json"]:
                    result["json"] = self._parse_json_metadata(archive.read(info.filename))
        return result

    def _parse_comicinfo(self, body: bytes) -> dict[str, str]:
        try:
            root = ElementTree.fromstring(body)
        except ElementTree.ParseError:
            return {}
        parsed: dict[str, str] = {}
        for child in root:
            tag = _strip_namespace(child.tag)
            text = (child.text or "").strip()
            if text:
                parsed[tag] = text
        return parsed

    def _parse_json_metadata(self, body: bytes) -> dict[str, str]:
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return {}
        if not isinstance(payload, dict):
            return {}
        return {str(key): self._stringify(value) for key, value in payload.items() if value is not None and self._stringify(value)}

    def _metadata_fields(
        self,
        work: dict[str, Any],
        tag_rows: list[dict[str, Any]],
        archive_sources: dict[str, dict[str, str]],
        remote_payload: dict[str, Any],
        saved: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        fields = []
        for field, config in METADATA_FIELDS.items():
            current_value = self._current_value(work, tag_rows, field, config)
            source_value, source = self._source_value(field, config, archive_sources, remote_payload)
            saved_row = saved.get(field)
            working_value = saved_row["value"] if saved_row else current_value
            working_source = saved_row["source"] if saved_row else "current"
            fields.append(
                {
                    "field": field,
                    "label": config["label"],
                    "current_value": current_value,
                    "source_value": source_value,
                    "source": source,
                    "working_value": working_value,
                    "working_source": working_source,
                    "dirty": self._normalize_value(working_value) != self._normalize_value(current_value),
                    "differs_from_source": self._normalize_value(working_value) != self._normalize_value(source_value),
                    "updated_at": saved_row["updated_at"] if saved_row else None,
                }
            )
        return fields

    def _current_value(self, work: dict[str, Any], tag_rows: list[dict[str, Any]], field: str, config: dict[str, Any]) -> str | None:
        if "tag_type" in config:
            value = self._joined_tag_names(tag_rows, str(config["tag_type"]))
            if value:
                return value
        work_column = config.get("work")
        if work_column and work.get(str(work_column)) is not None:
            return self._stringify(work.get(str(work_column)))
        if field == "pages":
            return self._stringify(work.get("page_count"))
        return None

    def _source_value(
        self,
        field: str,
        config: dict[str, Any],
        archive_sources: dict[str, dict[str, str]],
        remote_payload: dict[str, Any],
    ) -> tuple[str | None, str]:
        comic_key = str(config.get("comic") or "")
        comic_value = archive_sources.get("comicinfo", {}).get(comic_key)
        if comic_value:
            return comic_value, "comicinfo"
        json_value = self._json_source_value(field, archive_sources.get("json", {}))
        if json_value:
            return json_value, "json"
        remote_value = self._remote_source_value(field, remote_payload)
        if remote_value:
            return remote_value, "remote"
        return None, "unknown"

    def _json_source_value(self, field: str, payload: dict[str, str]) -> str | None:
        for key in (field, field.lower(), "page_count" if field == "pages" else ""):
            if key and payload.get(key):
                return payload[key]
        return None

    def _remote_source_value(self, field: str, payload: dict[str, Any]) -> str | None:
        title = payload.get("title") if isinstance(payload.get("title"), dict) else {}
        if field == "title":
            return self._stringify(title.get("english") or payload.get("title"))
        if field == "title_japanese":
            return self._stringify(title.get("japanese"))
        if field == "pretty_title":
            return self._stringify(title.get("pretty"))
        if field == "pages":
            return self._stringify(payload.get("num_pages") or payload.get("page_count"))
        if field == "published_at":
            return self._format_timestamp(payload.get("upload_date"))
        if field in {"artist", "group", "language", "tags"}:
            tag_type = {"tags": "tag"}.get(field, field)
            values = [
                self._stringify(tag.get("name") or tag.get("slug"))
                for tag in payload.get("tags", [])
                if isinstance(tag, dict) and tag.get("type") == tag_type
            ]
            return " / ".join(value for value in values if value) or None
        return None

    def _tag_rows(self, work_id: int) -> list[dict[str, Any]]:
        return self.db.fetchall(
            """
            SELECT
              wt.id, wt.work_id, wt.remote_tag_id, wt.dictionary_id, wt.tag_type,
              wt.remote_name, wt.remote_slug, wt.created_at,
              d.zh_name, d.status AS dictionary_status, d.ignored
            FROM work_tags wt
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id
            WHERE wt.work_id = ?
            ORDER BY wt.tag_type ASC, wt.remote_name ASC, wt.remote_slug ASC
            """,
            (work_id,),
        )

    def _tag_summary(self, rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int], dict[str, int]]:
        groups: dict[str, dict[str, Any]] = {}
        tag_summary = {"confirmed": 0, "pending": 0, "conflicts": 0}
        dictionary_summary = {"matched": 0, "pending": 0, "conflicts": 0}
        for row in rows:
            status = row.get("dictionary_status")
            state = "confirmed"
            if status == "review":
                state = "pending"
            elif status == "conflict":
                state = "conflict"
            tag_summary["conflicts" if state == "conflict" else state] += 1
            if row.get("dictionary_id") and status not in PROBLEM_DICTIONARY_STATUSES:
                dictionary_summary["matched"] += 1
            elif status == "review":
                dictionary_summary["pending"] += 1
            elif status == "conflict":
                dictionary_summary["conflicts"] += 1

            group_key = TAG_GROUP_LABELS.get(str(row.get("tag_type") or "other"), "其他")
            group = groups.setdefault(group_key, {"key": group_key, "label": group_key, "tags": []})
            group["tags"].append(
                {
                    "id": row["id"],
                    "remote_tag_id": row["remote_tag_id"],
                    "dictionary_id": row["dictionary_id"],
                    "type": row["tag_type"] or "tag",
                    "name": row["remote_name"],
                    "slug": row["remote_slug"],
                    "display": row["zh_name"] or row["remote_name"] or row["remote_slug"] or str(row["remote_tag_id"]),
                    "dictionary_status": status,
                    "state": state,
                }
            )
        return list(groups.values()), tag_summary, dictionary_summary

    def _joined_tag_names(self, tag_rows: list[dict[str, Any]], tag_type: str) -> str | None:
        values = [
            self._stringify(row.get("zh_name") or row.get("remote_name") or row.get("remote_slug"))
            for row in tag_rows
            if row.get("tag_type") == tag_type
        ]
        return " / ".join(value for value in values if value) or None

    def _remote_payload(self, work: dict[str, Any]) -> dict[str, Any]:
        gallery_id = work.get("remote_gallery_id")
        if not gallery_id:
            return {}
        row = self.db.fetchone("SELECT payload_json FROM remote_galleries WHERE gallery_id = ?", (gallery_id,))
        if not row:
            return {}
        try:
            payload = json.loads(row["payload_json"])
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    def _work_row(self, work_id: int) -> dict[str, Any] | None:
        return self.db.fetchone("SELECT * FROM works WHERE id = ?", (work_id,))

    def _queue_row_for_work(
        self,
        work: dict[str, Any],
        files: list[dict[str, Any]],
        tag_rows: list[dict[str, Any]],
        saved: dict[str, dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        source_file = next((row for row in files if row["kind"] == "source_cbz"), None)
        review_count = sum(1 for row in tag_rows if row.get("dictionary_status") == "review")
        conflict_count = sum(1 for row in tag_rows if row.get("dictionary_status") == "conflict")
        saved = saved or {}
        return {
            **work,
            "source_path": source_file["path"] if source_file else None,
            "title_metadata": saved.get("title", {}).get("value"),
            "language_metadata": saved.get("language", {}).get("value"),
            "tag_count": len(tag_rows),
            "review_count": review_count,
            "conflict_count": conflict_count,
        }

    def _work_summary(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "remote": row.get("remote"),
            "remote_gallery_id": row.get("remote_gallery_id"),
            "media_id": row.get("media_id"),
            "title": row.get("title"),
            "title_japanese": row.get("title_japanese"),
            "pretty_title": row.get("pretty_title"),
            "source": row.get("source"),
            "language": row.get("language"),
            "page_count": int(row.get("page_count") or 0),
            "cover_path": row.get("cover_path"),
            "size_bytes": int(row.get("size_bytes") or 0),
            "updated_at": row.get("updated_at"),
        }

    def _file_summary(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "kind": row["kind"],
            "path": row["path"],
            "size_bytes": int(row.get("size_bytes") or 0),
            "sha256": row.get("sha256"),
            "created_at": row.get("created_at"),
            "exists": Path(str(row["path"])).exists(),
        }

    def _recommended_actions(self, reasons: list[dict[str, Any]]) -> list[dict[str, str]]:
        labels = {
            "missing_metadata": "补全文本元数据",
            "untagged": "应用词典或重新解析标签",
            "dictionary_review": "复核词典映射",
            "dictionary_conflict": "解决词典冲突",
            "missing_comicinfo": "等待导出阶段生成 ComicInfo",
            "missing_cover": "检查源文件封面",
        }
        return [{"code": reason["code"], "label": labels[reason["code"]]} for reason in reasons if reason["code"] in labels]

    def _completeness(self, reasons: list[dict[str, Any]]) -> int:
        penalty = sum(20 if reason["severity"] == "danger" else 12 for reason in reasons)
        return max(0, min(100, 100 - penalty))

    def _stringify(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            return " / ".join(str(item).strip() for item in value if str(item).strip()) or None
        text = str(value).strip()
        return text or None

    def _normalize_value(self, value: Any) -> str:
        return str(value or "").strip()

    def _format_timestamp(self, value: Any) -> str | None:
        if value is None:
            return None
        try:
            timestamp = int(value)
        except (TypeError, ValueError):
            return self._stringify(value)
        return datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()


def _strip_namespace(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag
