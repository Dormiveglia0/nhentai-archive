from __future__ import annotations

import zlib
from contextlib import nullcontext
from pathlib import Path
from typing import Any

from app.services.archive_manifest import unpack_manifest
from app.services.file_service import FileMaintenanceService
from app.services.media_library_service import MediaLibraryService


class LocalMetadataService:
    """Stored catalogue data, not scan logs; reads never open source archives."""

    def __init__(self, files: FileMaintenanceService, libraries: MediaLibraryService):
        self.files, self.libraries, self.db = files, libraries, files.db

    def _sources(self) -> list[dict[str, Any]]:
        rows = self.db.fetchall("""SELECT f.*, i.status AS source_status, i.relative_path,
            i.missing_since, i.indexed_at, i.metadata_json, i.archive_info_json,
            l.id AS library_id, l.name AS library_name, l.kind AS library_kind,
            l.health, l.removed_at FROM work_files f
            LEFT JOIN library_items i ON i.id=f.library_item_id
            LEFT JOIN media_libraries l ON l.id=i.library_id WHERE f.kind='source_cbz' ORDER BY f.id""")
        for row in rows:
            row["status"] = self._source_status(row)
        return rows

    def _source_status(self, row: dict[str, Any]) -> str:
        if row.get("removed_at") or row.get("source_status") == "detached":
            return "detached"
        if row.get("health") == "offline":
            return "offline"
        if row.get("library_item_id") or row.get("kind") == "item":
            return {"ready": "ready", "missing": "missing"}.get(row["source_status"], "pending")
        return "ready" if self.libraries.file_available(row) else "missing"

    def _items(self, item_id: int | None = None) -> list[dict[str, Any]]:
        return self.db.fetchall("""SELECT i.id, i.library_id, i.work_id, i.relative_path,
            i.size_bytes, i.status AS source_status, i.last_error, i.missing_since,
            i.indexed_at, i.updated_at, i.metadata_json, i.archive_info_json,
            l.name AS library_name, l.root_path, l.health, l.removed_at,
            length(i.manifest) AS manifest_bytes FROM library_items i
            JOIN media_libraries l ON l.id=i.library_id"""
            + (" WHERE i.id=?" if item_id is not None else " WHERE i.work_id IS NULL"),
            (item_id,) if item_id is not None else ())

    def inventory(self, q: str = "", status: str = "all", library_id: int | None = None,
                  page: int = 1, per_page: int = 50, work_id: int | None = None) -> dict[str, Any]:
        sources: dict[int, list[dict[str, Any]]] = {}
        for row in self._sources():
            sources.setdefault(row["work_id"], []).append(row)
        managed = self.db.fetchone("SELECT id,name FROM media_libraries WHERE kind='managed'")
        entries = []
        for row in self.db.fetchall("""SELECT w.*,
            (SELECT COUNT(*) FROM work_metadata m WHERE m.work_id=w.id) AS field_count,
            (SELECT COUNT(*) FROM work_tags t WHERE t.work_id=w.id) AS tag_count
            FROM works w ORDER BY w.updated_at DESC, w.id DESC"""):
            refs = sources.get(row["id"], [])
            visible_refs = [ref for ref in refs if library_id is None or (ref["library_id"] or managed["id"]) == library_id]
            states = {ref["status"] for ref in visible_refs}
            state = next((value for value in ("ready", "offline", "pending", "missing", "detached") if value in states), "missing")
            entries.append({"kind": "work", "id": row["id"], "work_id": row["id"],
                "title": row["pretty_title"] or row["title_japanese"] or row["title"],
                "status": state, "source_count": len(refs), "field_count": row["field_count"],
                "tag_count": row["tag_count"], "page_count": row["page_count"], "updated_at": row["updated_at"],
                "library_ids": list(dict.fromkeys(ref["library_id"] or managed["id"] for ref in refs)),
                "library_names": list(dict.fromkeys(ref["library_name"] or managed["name"] for ref in refs)),
                "paths": [ref["path"] for ref in refs],
                "partial_missing": state == "ready" and any(value != "ready" for value in states)})
        for row in self._items():
            metadata = self.libraries.archive_info(row)
            entries.append({"kind": "item", "id": row["id"], "work_id": None,
                "title": metadata["comicinfo"].get("Title") or row["relative_path"],
                "status": self._source_status({**row, "kind": "item"}), "source_count": 1,
                "field_count": len(metadata["comicinfo"]) + len(metadata.get("json") or {}),
                "tag_count": 0, "page_count": None, "updated_at": row["updated_at"],
                "library_ids": [row["library_id"]], "library_names": [row["library_name"]],
                "paths": [str(Path(row["root_path"]) / row["relative_path"])], "partial_missing": False})
        if library_id is not None:
            entries = [e for e in entries if library_id in e["library_ids"]]
        if work_id is not None:
            entries = [e for e in entries if e["work_id"] == work_id]
        summary = {"works": sum(e["kind"] == "work" for e in entries),
                   "unlinked": sum(e["kind"] == "item" for e in entries),
                   **{key: sum(e["status"] == key for e in entries) for key in ("ready", "missing", "offline", "detached", "pending")}}
        if status == "unlinked":
            entries = [e for e in entries if e["kind"] == "item"]
        elif status == "partial_missing":
            entries = [e for e in entries if e["partial_missing"]]
        elif status != "all":
            entries = [e for e in entries if e["status"] == status]
        if q.strip():
            query = q.strip().casefold()
            entries = [e for e in entries if query in " ".join([e["title"], *e["paths"], *e["library_names"]]).casefold()]
        page, per_page = max(1, page), max(1, min(100, per_page))
        return {"result": entries[(page - 1) * per_page:page * per_page], "total": len(entries),
                "summary": summary, "page": page, "per_page": per_page,
                "database_path": str(self.db.path)}

    def detail(self, kind: str, record_id: int) -> dict[str, Any]:
        if kind == "item":
            rows = self._items(record_id)
            if not rows:
                raise ValueError("元数据记录不存在")
            row = rows[0]
            return {"kind": kind, "id": record_id, "database_path": str(self.db.path),
                    "record": {k: v for k, v in row.items() if k not in {"metadata_json", "archive_info_json"}},
                    "archive_metadata": self.libraries.archive_info(row),
                    "sources": [], "fields": [], "tags": [], "assets": [], "progress": None, "counts": {}}
        if kind != "work":
            raise ValueError("未知元数据类型")
        work = self.db.fetchone("SELECT * FROM works WHERE id=?", (record_id,))
        if not work:
            raise ValueError("作品元数据不存在")
        sources = []
        for row in self._sources():
            if row["work_id"] != record_id:
                continue
            metadata = self.libraries.archive_info(row)
            sources.append({**{k: v for k, v in row.items() if k not in {"metadata_json", "archive_info_json"}},
                            "archive_metadata": metadata})
        counts = {table: self.db.fetchone(f"SELECT COUNT(*) AS n FROM {table} WHERE work_id=?", (record_id,))["n"]
                  for table in ("work_pages", "work_tags", "work_metadata", "reading_history", "reading_sessions", "governance_reviews")}
        counts["manifest_pages"] = 0
        manifest_errors = []
        for row in self.db.fetchall("SELECT id,manifest FROM library_items WHERE work_id=? AND manifest IS NOT NULL", (record_id,)):
            try:
                counts["manifest_pages"] += len(unpack_manifest(row["manifest"]))
            except (ValueError, TypeError, zlib.error) as exc:
                manifest_errors.append(f"索引 {row['id']}：{exc}")
        assets = self.files.derived_inventory(work_id=record_id, per_page=500)
        return {"kind": kind, "id": record_id, "database_path": str(self.db.path), "record": work,
                "sources": sources, "fields": self.db.fetchall("SELECT field,value,source,source_value,updated_at FROM work_metadata WHERE work_id=? ORDER BY field", (record_id,)),
                "tags": self.db.fetchall("""SELECT t.tag_type,t.remote_name,t.remote_slug,d.zh_name
                    FROM work_tags t LEFT JOIN local_tag_dictionary d ON d.id=t.dictionary_id WHERE t.work_id=? ORDER BY t.id""", (record_id,)),
                "progress": self.db.fetchone("SELECT * FROM reader_progress WHERE work_id=?", (record_id,)),
                "counts": counts, "manifest_errors": manifest_errors,
                "assets": assets["result"], "assets_total": assets["total"]}

    def _cleanup(self, kind: str, record_id: int) -> tuple[dict[str, Any], list[Path]]:
        if kind == "work":
            detail = self.detail(kind, record_id)
            sources = detail["sources"]
            if any(s["status"] not in {"missing", "detached"} for s in sources):
                raise ValueError("作品仍有可用、待检查或离线来源；请恢复媒体库或重新扫描后再判断，不能清除整部作品元数据")
            for source in sources:
                if source["library_id"]:
                    self.libraries._require_idle(source["library_id"])
            items = self.db.fetchall("SELECT id,library_id,relative_path FROM library_items WHERE work_id=?", (record_id,))
            for item in items:
                self._check_item(item["id"])
            # Reuse reader/lease/job/shared-file protection, but never include source files.
            paths = [p for p, _ in self.files._work_files(record_id, keep_sources=True) if p.is_file()]
            return {"kind": kind, "id": record_id, "title": detail["record"]["pretty_title"] or detail["record"]["title"],
                    "counts": {**detail["counts"], "library_items": len(items)}, "progress": detail["progress"],
                    "items": items}, paths
        if kind == "item":
            rows = self._items(record_id)
            if not rows:
                raise ValueError("元数据记录不存在")
            row = rows[0]
            self._check_item(record_id)
            if row["work_id"]:
                self.files._work_files(row["work_id"], keep_sources=True)
            metadata = self.libraries.archive_info(row)
            return {"kind": kind, "id": record_id, "title": metadata["comicinfo"].get("Title") or row["relative_path"],
                    "counts": {"library_items": 1}, "work_preserved": row["work_id"], "items": [row]}, []
        if kind == "source":
            row = next((r for r in self._sources() if r["id"] == record_id), None)
            if not row or row["library_item_id"] or row["status"] != "missing":
                raise ValueError("只能清除未关联扫描索引且已缺失的旧文件关联")
            self.files._work_files(row["work_id"], keep_sources=True)
            return {"kind": kind, "id": record_id, "title": row["path"], "counts": {"work_files": 1},
                    "work_preserved": row["work_id"], "items": []}, []
        raise ValueError("未知元数据类型")

    def _check_item(self, item_id: int) -> None:
        row = self._items(item_id)[0]
        if self._source_status({**row, "kind": "item"}) not in {"missing", "detached"}:
            raise ValueError("来源仍可用、待检查或离线，请重新扫描后再判断")
        self.libraries._require_idle(row["library_id"])
        library = self.libraries.get(row["library_id"], include_removed=True)
        if not library["removed_at"]:
            if library["health"] != "online":
                raise ValueError("媒体库尚未完成在线扫描；请先恢复并重新扫描，不能把离线或未检查的来源当成残留")
            if library["kind"] != "mounted":
                path, _ = self.libraries.resolve_item(item_id)
                if path.is_file():
                    raise ValueError("源文件已经恢复，请重新扫描更新索引，而不是清除元数据")

    def preview_delete(self, kind: str, record_id: int) -> dict[str, Any]:
        try:
            record, paths = self._cleanup(kind, record_id)
            return {**{k: v for k, v in record.items() if k != "items"}, "allowed": True,
                    "files": [str(p) for p in paths], "reclaim_bytes": sum(p.stat().st_size for p in paths),
                    "source_files_deleted": False, "scan_logs_deleted": False, "warnings": []}
        except (OSError, ValueError) as exc:
            return {"kind": kind, "id": record_id, "allowed": False, "files": [], "counts": {},
                    "reclaim_bytes": 0, "source_files_deleted": False, "scan_logs_deleted": False, "warnings": [str(exc)]}

    def delete(self, kind: str, record_id: int) -> dict[str, Any]:
        with self.files.cache._lock if self.files.cache else nullcontext():
            with self.db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                record, paths = self._cleanup(kind, record_id)
                errors = []
                freed = 0
                for path in paths:
                    freed += self.files._unlink(path, {"kind": kind, "id": record_id}, errors) or 0
                if errors:
                    raise ValueError("部分派生文件未能清理；元数据已保留，请重试：" + "；".join(e["message"] for e in errors))
                for item in record["items"]:
                    conn.execute("DELETE FROM work_files WHERE library_item_id=?", (item["id"],))
                    conn.execute("DELETE FROM library_changes WHERE library_id=? AND relative_path=?", (item["library_id"], item["relative_path"]))
                    conn.execute("DELETE FROM library_items WHERE id=?", (item["id"],))
                if kind == "work":
                    conn.execute("DELETE FROM works WHERE id=?", (record_id,))
                elif kind == "source":
                    conn.execute("DELETE FROM work_files WHERE id=?", (record_id,))
        return {"removed": record_id, "kind": kind, "source_files_deleted": False,
                "scan_logs_deleted": False, "deleted_files": len(paths), "reclaimed_bytes": freed}
