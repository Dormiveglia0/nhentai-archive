from __future__ import annotations

import io
import json
import re
import shutil
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryFile
from typing import Any, BinaryIO, Callable

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.dictionary_service import DEFAULT_IGNORED_REMOTE_TYPE_SQL
from app.services.governance_service import METADATA_FIELDS, GovernanceService
from app.services.archive_cache_service import ArchiveCacheService
from app.services.archive_manifest import open_archive

_ILLEGAL_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_MAX_NAME_LENGTH = 120


class ExportService:
    """Persisted previews and streamed, temporary downloads; originals stay intact."""

    def __init__(self, db: Database, settings: Settings, cache: ArchiveCacheService | None = None):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()
        self.governance = GovernanceService(db, settings=settings)
        self.libraries = self.governance.libraries
        self.cache = cache or ArchiveCacheService(db, settings, self.libraries)

    def summary(self) -> dict[str, Any]:
        return self._queue_summary(self._queue_states())

    def queue(self) -> dict[str, Any]:
        states = self._queue_states()
        return {"result": states, "summary": self._queue_summary(states)}

    def _queue_summary(self, states: list[dict[str, Any]]) -> dict[str, int]:
        return {
            "total": len(states),
            "ready": sum(not state["blockers"] for state in states),
            "blocked": sum(bool(state["blockers"]) for state in states),
            "warnings": sum(bool(state["warnings"]) for state in states),
        }

    def _queue_states(self) -> list[dict[str, Any]]:
        rows = self.db.fetchall(
            f"""
            SELECT
              w.*,
              rg.payload_json AS remote_payload_json,
              metadata.saved_title, metadata.saved_artist, metadata.saved_language,
              COALESCE(tags.has_artist, 0) AS has_artist,
              COALESCE(tags.has_language, 0) AS has_language,
              COALESCE(tags.has_dictionary_pending, 0) AS has_dictionary_pending,
              COALESCE(tags.has_dictionary_conflict, 0) AS has_dictionary_conflict
            FROM works w
            LEFT JOIN remote_galleries rg ON rg.gallery_id = w.remote_gallery_id
            LEFT JOIN (
              SELECT
                work_id,
                MAX(CASE WHEN field = 'title' THEN value END) AS saved_title,
                MAX(CASE WHEN field = 'artist' THEN value END) AS saved_artist,
                MAX(CASE WHEN field = 'language' THEN value END) AS saved_language
              FROM work_metadata
              GROUP BY work_id
            ) metadata ON metadata.work_id = w.id
            LEFT JOIN (
              SELECT
                wt.work_id,
                MAX(CASE
                  WHEN wt.tag_type = 'artist'
                   AND TRIM(COALESCE(d.zh_name, wt.remote_name, wt.remote_slug, '')) <> ''
                  THEN 1 ELSE 0 END) AS has_artist,
                MAX(CASE
                  WHEN wt.tag_type = 'language'
                   AND TRIM(COALESCE(d.zh_name, wt.remote_name, wt.remote_slug, '')) <> ''
                  THEN 1 ELSE 0 END) AS has_language,
                MAX(CASE
                  WHEN d.status = 'review'
                    OR (wt.dictionary_id IS NULL
                        AND COALESCE(wt.tag_type, 'tag') NOT IN ({DEFAULT_IGNORED_REMOTE_TYPE_SQL}))
                  THEN 1 ELSE 0 END) AS has_dictionary_pending,
                MAX(CASE WHEN d.status = 'conflict' THEN 1 ELSE 0 END) AS has_dictionary_conflict
              FROM work_tags wt
              LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id
              GROUP BY wt.work_id
            ) tags ON tags.work_id = w.id
            ORDER BY w.updated_at DESC, w.id DESC
            """
        )
        sources = {}
        for source in self.libraries.files(metadata=True):
            if source["kind"] == "source_cbz":
                sources.setdefault(source["work_id"], source)
        return [self._queue_state({**row, "_source_file": sources.get(row["id"])}) for row in rows]

    def _queue_state(self, row: dict[str, Any]) -> dict[str, Any]:
        remote_payload = self._cached_payload(row.get("remote_payload_json"))
        present = {
            "title": self._has_text(row.get("saved_title")) or self._has_text(row.get("title")),
            "artist": self._has_text(row.get("saved_artist")) or bool(row.get("has_artist")),
            "language": self._has_text(row.get("saved_language"))
            or bool(row.get("has_language"))
            or self._has_text(row.get("language")),
        }
        if not all(present.values()):
            sources = self.governance._archive_metadata(row.get("_source_file"))
            for field, has_value in present.items():
                if not has_value:
                    value, _source = self.governance._source_value(
                        field, METADATA_FIELDS[field], sources, remote_payload
                    )
                    present[field] = self._has_text(value)

        source_file = self._source_summary(row.get("_source_file"))
        warnings = []
        for field, key, label in (
            ("title", "Title", "标题"),
            ("artist", "Writer", "作者"),
            ("language", "LanguageISO", "语言"),
        ):
            if not present[field]:
                warnings.append(
                    {
                        "code": f"missing_{key.lower()}",
                        "message": f"缺少 {label} 字段，ComicInfo 将留空。",
                    }
                )
        if row.get("has_dictionary_pending"):
            warnings.append(
                {"code": "dictionary_review", "message": "存在待复核词典标签，导出会使用当前显示名。"}
            )
        if row.get("has_dictionary_conflict"):
            warnings.append(
                {"code": "dictionary_conflict", "message": "存在词典冲突标签，导出会使用当前显示名。"}
            )

        work = self.governance._work_summary({**row, "size_bytes": source_file["size_bytes"]})
        return {
            "work": work,
            "output_name": self._output_name(work),
            "blockers": self._blockers(source_file),
            "warnings": warnings,
            "source_file": source_file,
        }

    def _resolve_options(self, options: dict[str, Any] | None) -> dict[str, Any]:
        options = options or {}
        return {
            "output_name": options.get("output_name"),
            "write_comicinfo": bool(options.get("write_comicinfo", True)),
            "keep_json": bool(options.get("keep_json", True)),
            "compress": bool(options.get("compress", True)),
        }

    def preview(self, work_id: int, options: dict[str, Any] | None = None) -> dict[str, Any]:
        opts = self._resolve_options(options)
        aggregate = self.governance.work_governance(work_id)
        work = aggregate["work"]
        source_file = self._source_file(work_id)
        output_name = self._requested_output_name(work, opts)
        comic_info = comicinfo.build_fields(aggregate)
        source = next((file for file in self.libraries.files(work_id, metadata=True) if file["kind"] == "source_cbz"), None)
        json_members = self._kept_members(source) if source_file["exists"] else []
        will_keep = json_members if opts["keep_json"] else []
        blockers = self._blockers(source_file)
        warnings = self._warnings(comic_info, aggregate) if opts["write_comicinfo"] else []

        return {
            "work": work,
            "source_file": source_file,
            "output_name": output_name,
            "comic_info": comic_info,
            "options": {
                "write_comicinfo": opts["write_comicinfo"],
                "keep_json": opts["keep_json"],
                "compress": opts["compress"],
            },
            "will_write": ["ComicInfo.xml"] if opts["write_comicinfo"] else [],
            "will_keep": will_keep,
            "will_not_modify": [source_file["path"]] if source_file.get("path") else [],
            "blockers": blockers,
            "warnings": warnings,
        }

    def build_cbz(self, work_id: int, options: dict[str, Any] | None = None) -> tuple[str, bytes]:
        buffer = io.BytesIO()
        name = self.write_cbz(work_id, buffer, options)
        return name, buffer.getvalue()

    def write_cbz(self, work_id: int, destination: Path | BinaryIO, options: dict[str, Any] | None = None,
                  checkpoint: Callable[[], None] | None = None) -> str:
        opts = self._resolve_options(options)
        preview = self.preview(work_id, options)
        if preview["blockers"]:
            raise ValueError("; ".join(blocker["message"] for blocker in preview["blockers"]))

        comic_info_xml = comicinfo.to_xml(preview["comic_info"]) if opts["write_comicinfo"] else None
        origin = self.libraries.source_file(work_id) or self.libraries.source_file(work_id, available=False)
        if origin and origin["library_kind"] == "mounted" and not self.cache.required(origin):
            with self.cache.mounted_read(origin, options={"xml": comic_info_xml, "keep_json": opts["keep_json"], "compress": opts["compress"]}, checkpoint=checkpoint) as (path, _type):
                with path.open("rb") as source:
                    if isinstance(destination, Path):
                        with destination.open("wb") as output:
                            shutil.copyfileobj(source, output, 1024 * 1024)
                    else:
                        shutil.copyfileobj(source, destination, 1024 * 1024)
        else:
            with self._export_source(work_id, checkpoint) as source_path:
                comicinfo.reseal_cbz_to(source_path, destination, comic_info_xml, opts["keep_json"], opts["compress"], checkpoint)
        return preview["output_name"]

    @contextmanager
    def _export_source(self, work_id: int, checkpoint):
        origin = self.libraries.source_file(work_id) or self.libraries.source_file(work_id, available=False)
        if not origin:
            raise ValueError("源 CBZ 不可用")
        if self.cache.required(origin):
            prepared = self.cache.prepare(work_id)
            while prepared["status"] not in {"ready", "failed", "cancelled", "paused", "direct"}:
                if checkpoint:
                    checkpoint()
                time.sleep(.1)
                prepared = self.cache.prepare(work_id)
            if prepared["status"] != "ready":
                raise ValueError(prepared.get("error") or "请完成或重试作品缓存准备")
            try:
                with self.cache.source(work_id, prepared["lease"]) as (path, _pages, _cache_id):
                    yield path
            finally:
                self.cache.release(work_id, prepared["lease"])
        else:
            # ponytail: share the lifecycle lock during local export; per-work locks if throughput requires it.
            with self.cache._lock:
                try:
                    origin = self.cache.direct_source(work_id, self.cache.revision(origin))
                    path = self.libraries.resolve_file(origin)
                    before = path.stat()
                    if origin["library_item_id"] and (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino) != (
                        origin["size_bytes"], origin["mtime_ns"], origin["device"], origin["inode"]):
                        raise ValueError("源归档已变化，请重新扫描后导出")
                    yield path
                    after = path.stat()
                    if (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_dev, after.st_ino):
                        raise ValueError("源文件在导出时发生变化，请重新扫描后重试")
                except (OSError, zipfile.BadZipFile) as exc:
                    raise ValueError(str(exc)) from exc

    def build_bundle(
        self, items: list[dict[str, Any]], options: dict[str, Any] | None = None
    ) -> tuple[str, bytes]:
        buffer = io.BytesIO()
        name = self.write_bundle(items, buffer, options)
        return name, buffer.getvalue()

    def write_bundle(self, items: list[dict[str, Any]], destination: Path | BinaryIO,
                     options: dict[str, Any] | None = None) -> str:
        shared = self._resolve_options(options)
        used_names: set[str] = set()
        packaged = 0
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_STORED) as bundle:
            for item in items:
                work_id = int(item.get("work_id") or 0)
                if not work_id:
                    continue
                item_opts = {**shared, "output_name": item.get("output_name")}
                try:
                    self.add_to_bundle(bundle, work_id, item_opts, used_names)
                except ValueError:
                    continue
                packaged += 1
        if packaged == 0:
            raise ValueError("没有可导出的作品（所选项均存在阻塞）。")
        return f"导出合集 ({packaged}).zip"

    def add_to_bundle(self, bundle: zipfile.ZipFile, work_id: int, options: dict[str, Any],
                      used_names: set[str], checkpoint: Callable[[], None] | None = None) -> None:
        # One unnamed temporary CBZ prevents a failed work leaving a broken bundle member.
        with TemporaryFile(dir=self.settings.tmp_dir) as temporary:
            name = self.write_cbz(work_id, temporary, options, checkpoint)
            temporary.seek(0)
            with bundle.open(self._unique_member_name(name, used_names), "w", force_zip64=True) as member:
                if checkpoint is None:
                    shutil.copyfileobj(temporary, member, 1024 * 1024)
                else:
                    while True:
                        checkpoint()
                        chunk = temporary.read(1024 * 1024)
                        if not chunk:
                            break
                        member.write(chunk)

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
        row = next((file for file in self.libraries.files(work_id) if file["kind"] == "source_cbz"), None)
        return self._source_summary(row)

    def _source_summary(self, row: dict[str, Any] | None) -> dict[str, Any]:
        path = row["path"] if row else None
        exists = self.libraries.file_available(row) if row and row["library_item_id"] else self._valid_source(path)
        return {
            "path": path,
            "size_bytes": int(row.get("size_bytes") or 0) if row else 0,
            "sha256": row.get("sha256") if row else None,
            "exists": exists,
        }

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

    def _kept_members(self, source_path: str | dict[str, Any] | None) -> list[str]:
        if isinstance(source_path, dict):
            if source_path["library_item_id"]:
                return sorted(self.libraries.archive_info(source_path).get("json_members", []))
            source_path = source_path.get("path")
        if not source_path:
            return []
        kept = []
        try:
            with open_archive(Path(source_path)) as archive:
                for info in archive.infolist():
                    if info.is_dir():
                        continue
                    name = Path(info.filename).name
                    if name.lower() == "comicinfo.xml":
                        continue
                    if name.lower().endswith(".json"):
                        kept.append(info.filename)
        except (OSError, ValueError, zipfile.BadZipFile):
            return []
        return sorted(kept)

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

    def _cached_payload(self, value: Any) -> dict[str, Any]:
        try:
            payload = json.loads(value or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}
        return payload if isinstance(payload, dict) else {}

    def _valid_source(self, value: Any) -> bool:
        if not value:
            return False
        path = Path(str(value))
        try:
            return path.exists() and zipfile.is_zipfile(path)
        except OSError:
            return False

    def _has_text(self, value: Any) -> bool:
        return bool(self._stringify(value))


def _safe_filename(name: str, max_length: int = _MAX_NAME_LENGTH) -> str:
    cleaned = _ILLEGAL_FILENAME_CHARS.sub("", name or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip().strip(".")
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip()
    return cleaned
