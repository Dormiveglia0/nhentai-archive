from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from app.config import Settings
from app.database import Database
from app.services.governance_service import GovernanceService


COMICINFO_KEYS = {
    "title": "Title",
    "title_japanese": "AlternateSeries",
    "pretty_title": "LocalizedSeries",
    "artist": "Writer",
    "group": "Publisher",
    "language": "LanguageISO",
    "tags": "Tags",
    "summary": "Summary",
    "published_at": "Year",
    "pages": "PageCount",
}

_ILLEGAL_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_MAX_NAME_LENGTH = 120


class ExportService:
    """Local-only CBZ export: preview + on-the-fly packaging for browser download.

    Source CBZs live at the configured library path; export never writes a second
    copy to the server. ``build_cbz`` / ``build_bundle`` return packaged bytes that
    the API streams to the user as a download. Original archives are never modified.
    """

    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()
        self.governance = GovernanceService(db)

    def summary(self) -> dict[str, Any]:
        return self.queue()["summary"]

    def queue(self) -> dict[str, Any]:
        rows = self.db.fetchall(
            """
            SELECT w.*, f.path AS source_path, f.size_bytes AS source_size_bytes, f.sha256 AS source_sha256
            FROM works w
            LEFT JOIN work_files f ON f.work_id = w.id AND f.kind = 'source_cbz'
            ORDER BY w.updated_at DESC, w.id DESC
            """
        )
        items = []
        summary = {"total": len(rows), "ready": 0, "blocked": 0, "warnings": 0}
        for row in rows:
            preview = self.preview(int(row["id"]))
            if preview["blockers"]:
                summary["blocked"] += 1
            else:
                summary["ready"] += 1
            if preview["warnings"]:
                summary["warnings"] += 1
            items.append(
                {
                    "work": preview["work"],
                    "output_name": preview["output_name"],
                    "blockers": preview["blockers"],
                    "warnings": preview["warnings"],
                    "source_file": preview["source_file"],
                }
            )
        return {"result": items, "summary": summary}

    def preview(self, work_id: int, options: dict[str, Any] | None = None) -> dict[str, Any]:
        options = options or {}
        aggregate = self.governance.work_governance(work_id)
        work = aggregate["work"]
        source_file = self._source_file(work_id)
        output_name = self._requested_output_name(work, options)
        comic_info = self._comic_info(aggregate)
        will_keep = self._kept_members(source_file["path"]) if source_file["exists"] else []
        blockers = self._blockers(source_file)
        warnings = self._warnings(comic_info, aggregate)

        return {
            "work": work,
            "source_file": source_file,
            "output_name": output_name,
            "comic_info": comic_info,
            "will_write": ["ComicInfo.xml"],
            "will_keep": will_keep,
            "will_not_modify": [source_file["path"]] if source_file.get("path") else [],
            "blockers": blockers,
            "warnings": warnings,
        }

    def build_cbz(self, work_id: int, options: dict[str, Any] | None = None) -> tuple[str, bytes]:
        """Package a single work into CBZ bytes (source + freshly written ComicInfo.xml)."""
        preview = self.preview(work_id, options)
        if preview["blockers"]:
            raise ValueError("; ".join(blocker["message"] for blocker in preview["blockers"]))

        source_path = Path(preview["source_file"]["path"])
        comic_info_xml = self._comicinfo_xml(preview["comic_info"])
        return preview["output_name"], self._package_bytes(source_path, comic_info_xml)

    def build_bundle(self, items: list[dict[str, Any]]) -> tuple[str, bytes]:
        """Package multiple works into one .zip of CBZs for a single download."""
        buffer = io.BytesIO()
        used_names: set[str] = set()
        packaged = 0
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as bundle:
            for item in items:
                work_id = int(item.get("work_id") or 0)
                if not work_id:
                    continue
                opts = {"output_name": item["output_name"]} if item.get("output_name") else None
                try:
                    name, data = self.build_cbz(work_id, opts)
                except ValueError:
                    continue
                bundle.writestr(self._unique_member_name(name, used_names), data)
                packaged += 1
        if packaged == 0:
            raise ValueError("没有可导出的作品（所选项均存在阻塞）。")
        return f"导出合集 ({packaged}).zip", buffer.getvalue()

    def _package_bytes(self, source_path: Path, comic_info_xml: str) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(source_path) as source, zipfile.ZipFile(
            buffer, "w", compression=zipfile.ZIP_DEFLATED
        ) as target:
            for info in source.infolist():
                if info.is_dir():
                    continue
                if Path(info.filename).name.lower() == "comicinfo.xml":
                    continue
                target.writestr(info, source.read(info.filename))
            target.writestr("ComicInfo.xml", comic_info_xml)
        return buffer.getvalue()

    def _unique_member_name(self, name: str, used: set[str]) -> str:
        candidate = name
        if candidate in used:
            stem, suffix = candidate.rsplit(".", 1) if "." in candidate else (candidate, "")
            index = 2
            while True:
                candidate = f"{stem} ({index}).{suffix}" if suffix else f"{stem} ({index})"
                if candidate not in used:
                    break
                index += 1
        used.add(candidate)
        return candidate

    def _source_file(self, work_id: int) -> dict[str, Any]:
        row = self.db.fetchone(
            "SELECT * FROM work_files WHERE work_id = ? AND kind = 'source_cbz' ORDER BY created_at DESC, id DESC LIMIT 1",
            (work_id,),
        )
        path = row["path"] if row else None
        exists = bool(path and Path(path).exists() and zipfile.is_zipfile(path))
        return {
            "path": path,
            "size_bytes": int(row.get("size_bytes") or 0) if row else 0,
            "sha256": row.get("sha256") if row else None,
            "exists": exists,
        }

    def _comic_info(self, aggregate: dict[str, Any]) -> dict[str, str]:
        fields = {field["field"]: field for field in aggregate["metadata"]["fields"]}
        comic_info: dict[str, str] = {}
        for field, key in COMICINFO_KEYS.items():
            value = self._field_value(fields.get(field))
            if value:
                comic_info[key] = value
        if "PageCount" not in comic_info:
            comic_info["PageCount"] = str(aggregate["work"].get("page_count") or 0)
        tags = self._tag_output(aggregate)
        if tags:
            comic_info["Tags"] = tags
        return comic_info

    def _field_value(self, field: dict[str, Any] | None) -> str | None:
        if not field:
            return None
        for key in ("working_value", "current_value", "source_value"):
            value = self._stringify(field.get(key))
            if value:
                return value
        return None

    def _tag_output(self, aggregate: dict[str, Any]) -> str | None:
        values: list[str] = []
        for group in aggregate["tags"]["groups"]:
            for tag in group["tags"]:
                display = self._stringify(tag.get("display") or tag.get("name") or tag.get("slug"))
                if display and display not in values:
                    values.append(display)
        return ", ".join(values) if values else None

    def _blockers(self, source_file: dict[str, Any]) -> list[dict[str, str]]:
        if not source_file["exists"]:
            return [
                {
                    "code": "missing_source_file",
                    "message": "源 CBZ 文件不存在或不是有效 ZIP，无法生成导出文件。",
                }
            ]
        return []

    def _warnings(self, comic_info: dict[str, str], aggregate: dict[str, Any]) -> list[dict[str, str]]:
        warnings: list[dict[str, str]] = []
        for key, label in (("Title", "标题"), ("Writer", "作者"), ("LanguageISO", "语言")):
            if not comic_info.get(key):
                warnings.append({"code": f"missing_{key.lower()}", "message": f"缺少 {label} 字段，ComicInfo 将留空。"})
        if aggregate["dictionary"].get("pending"):
            warnings.append({"code": "dictionary_review", "message": "存在待复核词典标签，导出会使用当前显示名。"})
        if aggregate["dictionary"].get("conflicts"):
            warnings.append({"code": "dictionary_conflict", "message": "存在词典冲突标签，导出会使用当前显示名。"})
        return warnings

    def _kept_members(self, source_path: str | None) -> list[str]:
        if not source_path:
            return []
        kept = []
        with zipfile.ZipFile(source_path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                name = Path(info.filename).name
                if name.lower() == "comicinfo.xml":
                    continue
                if name.lower().endswith(".json"):
                    kept.append(info.filename)
        return sorted(kept)

    def _comicinfo_xml(self, fields: dict[str, str]) -> str:
        root = ElementTree.Element("ComicInfo")
        for key in COMICINFO_KEYS.values():
            value = self._stringify(fields.get(key))
            if value:
                child = ElementTree.SubElement(root, key)
                child.text = value
        return ElementTree.tostring(root, encoding="unicode", short_empty_elements=False)

    def _output_name(self, work: dict[str, Any]) -> str:
        title = work.get("pretty_title") or work.get("title_japanese") or work.get("title") or f"work-{work['id']}"
        marker = work.get("remote_gallery_id") or work.get("id")
        stem = _safe_filename(str(title)) or f"work-{work['id']}"
        return f"{stem} [{marker}].cbz"

    def _requested_output_name(self, work: dict[str, Any], options: dict[str, Any]) -> str:
        requested = self._stringify(options.get("output_name"))
        if not requested:
            return self._output_name(work)
        name = _safe_filename(Path(requested).name)
        if not name:
            return self._output_name(work)
        if not name.lower().endswith(".cbz"):
            name = f"{name}.cbz"
        return name

    def _stringify(self, value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None


def _safe_filename(name: str, max_length: int = _MAX_NAME_LENGTH) -> str:
    cleaned = _ILLEGAL_FILENAME_CHARS.sub("", name or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip().strip(".")
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip()
    return cleaned
