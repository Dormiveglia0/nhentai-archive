# Phase 6 文件管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NH Archive 增加文件管理模块,展示数据目录内全部文件(作品源 CBZ+封面、孤立文件、临时/导出残留)的真实清单,并允许选中→预览→删除(健康作品删除 = 级联整体移除)。

**Architecture:** 后端新增 `FileMaintenanceService`(本地文件系统 + SQLite,绝不调 NH API),扫描真实文件计算 overview/inventory,提供 preview-delete/delete(删除是唯一动盘操作,删 works 行经 SQLite `ON DELETE CASCADE` 级联清空所有引用表,文件 unlink 受"受管目录"穿越防护)。前端新增 `components/files/`,沿用 export/governance 的"编排容器 + 薄组件 + state hook"模式,替换现有 `#files` 边界页。

**Tech Stack:** Python 3 + FastAPI + sqlite3(`Database` 封装);React + TypeScript + Vite;pytest;`.venv` 解释器。

## Global Constraints

- 绝不调用 NH API;绝不杜撰容量/重复/损坏/孤立计数;空目录显示真实空态。(`docs/DEVELOPMENT_RULES.md`)
- 删除是唯一会动盘的操作;CBZ 字节永不被修改,只能整体删除;受管目录之外的任何路径一律拒绝。
- `work_files.path` 与 `works.cover_path` 在生产中**相对**(相对运行目录/仓库根),在测试中**绝对**;一律先归一化为 `.resolve()` 绝对路径再判定存在性、删除、穿越校验。
- 删除健康作品的源 CBZ = 级联整体移除该作品(`works` 及全部引用表 + 封面文件)。
- 全站显示 tag 走词典 `display`;英文仅用于后端 NH API。
- 验证命令:后端 `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`;前端 `cd frontend && npm run build`。
- Python 解释器路径:`/opt/nhentai/.venv/bin/python`(从 `backend/` 下用 `../.venv/bin/python`)。

---

### Task 1: FileMaintenanceService — 路径归一化 + 扫描 + overview + inventory

**Files:**
- Create: `backend/app/services/file_service.py`
- Test: `backend/tests/test_file_service.py`

**Interfaces:**
- Produces:
  - `FileMaintenanceService(db: Database, settings: Settings)`
  - `.overview() -> dict` keys: `work_count, source_bytes, cover_ok, missing_source, missing_cover, orphan_count, orphan_bytes, stale_count, stale_bytes, reclaimable_bytes`
  - `.inventory(category="all", q=None, status=None, page=1, per_page=50) -> {"result": list[entry], "total": int, "page": int, "per_page": int}`
  - work entry: `{kind:"work", id:"work-<id>", work_id, title, source_path, cover_path, size_bytes, page_count, source, remote_gallery_id, status, flags}`
  - orphan entry: `{kind:"orphan", id:"orphan-<abs>", path, name, size_bytes, dir, status:"orphan", flags:["orphan"]}`
  - stale entry: `{kind:"stale", id:"stale-<abs>", path, name, size_bytes, dir, status:"stale", flags:["stale"]}`
  - `status` ∈ `ok | missing_source | missing_cover | orphan | stale`; `flags` 可含 `missing_source`/`missing_cover`/`size_mismatch`/`orphan`/`stale`。
  - Module helpers consumed by later tasks: `._abs(path) -> Path|None`, `._within_managed(path) -> bool`, `._managed_roots() -> list[Path]`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_file_service.py`:

```python
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.file_service import FileMaintenanceService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    files = FileMaintenanceService(db, settings)
    return settings, db, archive, files


def _import_work(db, archive, tmp_path, title="Rain", gallery_id=1234) -> int:
    cbz = tmp_path / f"source-{gallery_id}.cbz"
    _make_cbz(cbz)
    return archive.ingest_cbz(
        cbz, "remote", title, gallery_id,
        {"remote": "nhentai", "media_id": f"media-{gallery_id}", "title_japanese": "雨"},
    )


def test_healthy_work_is_ok_and_overview_counts_real_state(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    inv = files.inventory(category="work")
    entry = inv["result"][0]
    assert entry["kind"] == "work"
    assert entry["work_id"] == work_id
    assert entry["status"] == "ok"
    assert entry["flags"] == []
    assert entry["size_bytes"] > 0

    overview = files.overview()
    assert overview["work_count"] == 1
    assert overview["missing_source"] == 0
    assert overview["missing_cover"] == 0
    assert overview["source_bytes"] > 0


def test_missing_source_and_cover_are_flagged(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = db.fetchone(
        "SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (work_id,)
    )
    Path(source["path"]).unlink()
    cover = db.fetchone("SELECT cover_path FROM works WHERE id=?", (work_id,))
    Path(cover["cover_path"]).unlink()

    entry = files.inventory(category="work")["result"][0]
    assert entry["status"] == "missing_source"
    assert "missing_source" in entry["flags"]
    assert "missing_cover" in entry["flags"]
    assert files.overview()["missing_source"] == 1
    assert files.overview()["missing_cover"] == 1


def test_relative_path_is_normalized_against_cwd(tmp_path, monkeypatch):
    _settings, db, archive, files = _setup(tmp_path)
    monkeypatch.chdir(tmp_path)
    rel_dir = tmp_path / "data" / "library"
    rel_dir.mkdir(parents=True, exist_ok=True)
    _make_cbz(rel_dir / "rel.cbz")
    db.execute(
        "INSERT INTO works (title, source, page_count) VALUES ('Rel', 'local', 0)"
    )
    work_id = db.fetchone("SELECT id FROM works WHERE title='Rel'")["id"]
    db.execute(
        "INSERT INTO work_files (work_id, kind, path, size_bytes) VALUES (?, 'source_cbz', 'data/library/rel.cbz', 1)",
        (work_id,),
    )

    entry = next(e for e in files.inventory(category="work")["result"] if e["work_id"] == work_id)
    assert entry["status"] == "ok"
    assert "missing_source" not in entry["flags"]


def test_orphan_and_stale_files_are_detected(tmp_path):
    settings, db, archive, files = _setup(tmp_path)
    _import_work(db, archive, tmp_path)
    (settings.library_dir / "loose.cbz").write_bytes(b"loose-bytes")
    (settings.tmp_dir / "partial.download").write_bytes(b"tmp")
    (settings.export_dir / "old.cbz").write_bytes(b"export-leftover")

    orphans = files.inventory(category="orphan")["result"]
    assert any(e["name"] == "loose.cbz" and e["status"] == "orphan" for e in orphans)
    stale = files.inventory(category="stale")["result"]
    stale_names = {e["name"] for e in stale}
    assert {"partial.download", "old.cbz"}.issubset(stale_names)

    overview = files.overview()
    assert overview["orphan_count"] == 1
    assert overview["stale_count"] == 2
    assert overview["reclaimable_bytes"] == len(b"loose-bytes") + len(b"tmp") + len(b"export-leftover")


def test_size_mismatch_flag_when_db_size_differs(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        "UPDATE work_files SET size_bytes = 999999999 WHERE work_id=? AND kind='source_cbz'",
        (work_id,),
    )
    entry = files.inventory(category="work")["result"][0]
    assert "size_mismatch" in entry["flags"]


def test_inventory_filters_by_query_and_status(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    _import_work(db, archive, tmp_path, title="Sunset Road", gallery_id=1)
    _import_work(db, archive, tmp_path, title="Rainy Day", gallery_id=2)

    hit = files.inventory(q="sunset")
    assert len(hit["result"]) == 1
    assert hit["result"][0]["title"] == "Sunset Road"
    assert files.inventory(status="ok")["total"] == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_file_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.file_service'`.

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/file_service.py`:

```python
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database


class FileMaintenanceService:
    """Local file inventory + deletion over the managed data directory.

    Never calls the NH API. Deletion is the only operation that touches disk;
    CBZ bytes are never modified, only whole files removed. Any path outside the
    managed roots (library/covers/tmp/exports) is rejected.
    """

    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()

    # --- path helpers -------------------------------------------------
    def _abs(self, path: str | None) -> Path | None:
        if not path:
            return None
        p = Path(path)
        if not p.is_absolute():
            p = Path.cwd() / p
        return p.resolve()

    def _managed_roots(self) -> list[Path]:
        return [
            self.settings.library_dir.resolve(),
            self.settings.covers_dir.resolve(),
            self.settings.tmp_dir.resolve(),
            self.settings.export_dir.resolve(),
        ]

    def _within_managed(self, path: Path | None) -> bool:
        if path is None:
            return False
        rp = path.resolve()
        return any(rp == root or root in rp.parents for root in self._managed_roots())

    def _loose_files(self, directory: Path) -> list[Path]:
        d = directory.resolve()
        if not d.is_dir():
            return []
        return [p for p in sorted(d.iterdir()) if p.is_file()]

    # --- scanning -----------------------------------------------------
    def _scan(self) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        referenced_sources: set[str] = set()
        referenced_covers: set[str] = set()

        for w in self.db.fetchall("SELECT * FROM works ORDER BY updated_at DESC, id DESC"):
            work_id = int(w["id"])
            frow = self.db.fetchone(
                "SELECT path, size_bytes FROM work_files WHERE work_id=? AND kind='source_cbz' "
                "ORDER BY created_at DESC, id DESC LIMIT 1",
                (work_id,),
            )
            src_abs = self._abs(frow["path"]) if frow else None
            if src_abs:
                referenced_sources.add(str(src_abs))
            src_exists = bool(src_abs and src_abs.is_file())
            src_size = src_abs.stat().st_size if src_exists else 0
            db_size = int(frow["size_bytes"]) if frow else 0

            cover_abs = self._abs(w.get("cover_path"))
            if cover_abs:
                referenced_covers.add(str(cover_abs))
            cover_exists = bool(cover_abs and cover_abs.is_file())
            cover_size = cover_abs.stat().st_size if cover_exists else 0

            flags: list[str] = []
            if not src_exists:
                flags.append("missing_source")
            if not cover_exists:
                flags.append("missing_cover")
            if src_exists and db_size and db_size != src_size:
                flags.append("size_mismatch")
            status = "missing_source" if not src_exists else ("missing_cover" if not cover_exists else "ok")

            entries.append(
                {
                    "kind": "work",
                    "id": f"work-{work_id}",
                    "work_id": work_id,
                    "title": w.get("pretty_title") or w.get("title_japanese") or w.get("title") or f"work-{work_id}",
                    "source_path": str(src_abs) if src_abs else None,
                    "cover_path": str(cover_abs) if cover_abs else None,
                    "size_bytes": src_size + cover_size,
                    "page_count": int(w.get("page_count") or 0),
                    "source": w.get("source"),
                    "remote_gallery_id": w.get("remote_gallery_id"),
                    "status": status,
                    "flags": flags,
                }
            )

        for p in self._loose_files(self.settings.library_dir):
            if str(p) not in referenced_sources:
                entries.append(self._loose_entry(p, "orphan", "library"))
        for p in self._loose_files(self.settings.covers_dir):
            if str(p) not in referenced_covers:
                entries.append(self._loose_entry(p, "orphan", "covers"))
        for p in self._loose_files(self.settings.tmp_dir):
            entries.append(self._loose_entry(p, "stale", "tmp"))
        for p in self._loose_files(self.settings.export_dir):
            entries.append(self._loose_entry(p, "stale", "exports"))

        return entries

    def _loose_entry(self, path: Path, kind: str, directory: str) -> dict[str, Any]:
        size = path.stat().st_size if path.is_file() else 0
        return {
            "kind": kind,
            "id": f"{kind}-{path}",
            "path": str(path),
            "name": path.name,
            "size_bytes": size,
            "dir": directory,
            "status": kind,
            "flags": [kind],
        }

    # --- public reads -------------------------------------------------
    def overview(self) -> dict[str, Any]:
        entries = self._scan()
        works = [e for e in entries if e["kind"] == "work"]
        orphans = [e for e in entries if e["kind"] == "orphan"]
        stale = [e for e in entries if e["kind"] == "stale"]
        orphan_bytes = sum(e["size_bytes"] for e in orphans)
        stale_bytes = sum(e["size_bytes"] for e in stale)
        return {
            "work_count": len(works),
            "source_bytes": sum(e["size_bytes"] for e in works),
            "cover_ok": sum(1 for e in works if "missing_cover" not in e["flags"]),
            "missing_source": sum(1 for e in works if "missing_source" in e["flags"]),
            "missing_cover": sum(1 for e in works if "missing_cover" in e["flags"]),
            "orphan_count": len(orphans),
            "orphan_bytes": orphan_bytes,
            "stale_count": len(stale),
            "stale_bytes": stale_bytes,
            "reclaimable_bytes": orphan_bytes + stale_bytes,
        }

    def inventory(
        self,
        category: str = "all",
        q: str | None = None,
        status: str | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        entries = self._scan()
        if category in ("work", "orphan", "stale"):
            entries = [e for e in entries if e["kind"] == category]
        if status:
            entries = [e for e in entries if e["status"] == status]
        if q:
            ql = q.strip().lower()
            entries = [
                e
                for e in entries
                if ql in (e.get("title") or "").lower()
                or ql in (e.get("source_path") or e.get("path") or "").lower()
                or ql in (e.get("name") or "").lower()
            ]
        total = len(entries)
        per_page = max(1, min(int(per_page or 50), 200))
        page = max(1, int(page or 1))
        start = (page - 1) * per_page
        return {"result": entries[start : start + per_page], "total": total, "page": page, "per_page": per_page}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_file_service.py -q`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/file_service.py backend/tests/test_file_service.py
git commit -m "feat(files): FileMaintenanceService 扫描/overview/inventory（含路径归一化）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 2: FileMaintenanceService.preview_delete

**Files:**
- Modify: `backend/app/services/file_service.py`
- Test: `backend/tests/test_file_service.py`

**Interfaces:**
- Consumes: `._abs`, `._within_managed` (Task 1).
- Produces: `.preview_delete(targets: list[dict]) -> dict` with keys `items, files_to_delete, works_to_remove, reclaim_bytes`. Each `items[i]` for a `work` target: `{kind, work_id, title, exists, files:[abs paths], work_tags, has_progress, has_governance, reclaim_bytes, warnings, status}`; for `orphan|stale`: `{kind, path, exists, reclaim_bytes, warnings, status}`. `warnings` may contain `has_progress`/`has_governance`/`already_gone`/`forbidden_path`.
- Target shapes: `{"kind":"work","work_id":int}` or `{"kind":"orphan"|"stale","path":str}`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_file_service.py`:

```python
def test_preview_delete_work_expands_cascade_without_touching_disk(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) VALUES (5, 'tag', 't', 't', '{}') "
        "ON CONFLICT(remote_id) DO NOTHING"
    )
    db.execute(
        "INSERT INTO work_tags (work_id, remote_tag_id, tag_type, remote_name) VALUES (?, 5, 'tag', 't')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source) VALUES (?, 'title', 'X', 'manual')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO reader_progress (work_id, page_index, page_count, progress_percent) VALUES (?, 1, 2, 50)",
        (work_id,),
    )
    source = db.fetchone("SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (work_id,))

    preview = files.preview_delete([{"kind": "work", "work_id": work_id}])

    item = preview["items"][0]
    assert item["work_tags"] == 1
    assert item["has_progress"] is True
    assert item["has_governance"] is True
    assert "has_progress" in item["warnings"]
    assert "has_governance" in item["warnings"]
    assert preview["works_to_remove"] == 1
    assert preview["files_to_delete"] >= 2  # source + cover
    assert preview["reclaim_bytes"] > 0
    # nothing deleted by preview
    assert Path(source["path"]).exists()
    assert db.fetchone("SELECT 1 FROM works WHERE id=?", (work_id,)) is not None


def test_preview_delete_orphan_reports_reclaim_bytes(tmp_path):
    settings, _db, _archive, files = _setup(tmp_path)
    orphan = settings.library_dir / "loose.cbz"
    orphan.write_bytes(b"xyz")

    preview = files.preview_delete([{"kind": "orphan", "path": str(orphan)}])

    assert preview["items"][0]["exists"] is True
    assert preview["reclaim_bytes"] == 3
    assert orphan.exists()


def test_preview_delete_flags_already_gone_and_forbidden(tmp_path):
    _settings, _db, _archive, files = _setup(tmp_path)
    outside = tmp_path / "outside.cbz"
    outside.write_bytes(b"nope")

    preview = files.preview_delete(
        [{"kind": "work", "work_id": 999}, {"kind": "stale", "path": str(outside)}]
    )

    assert "already_gone" in preview["items"][0]["warnings"]
    assert "forbidden_path" in preview["items"][1]["warnings"]
    assert preview["reclaim_bytes"] == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_file_service.py -k preview_delete -q`
Expected: FAIL — `AttributeError: 'FileMaintenanceService' object has no attribute 'preview_delete'`.

- [ ] **Step 3: Write the implementation**

Add these methods to `FileMaintenanceService` in `backend/app/services/file_service.py`:

```python
    def _work_files(self, work_id: int) -> list[Path]:
        paths: list[Path] = []
        for row in self.db.fetchall("SELECT path FROM work_files WHERE work_id=?", (work_id,)):
            ap = self._abs(row["path"])
            if ap is not None:
                paths.append(ap)
        cover = self.db.fetchone("SELECT cover_path FROM works WHERE id=?", (work_id,))
        cover_abs = self._abs(cover["cover_path"]) if cover else None
        if cover_abs is not None:
            paths.append(cover_abs)
        # de-dupe preserving order
        seen: set[str] = set()
        unique: list[Path] = []
        for p in paths:
            if str(p) not in seen:
                seen.add(str(p))
                unique.append(p)
        return unique

    def _preview_work(self, work_id: int) -> dict[str, Any]:
        row = self.db.fetchone("SELECT * FROM works WHERE id=?", (work_id,))
        if not row:
            return {"kind": "work", "work_id": work_id, "exists": False, "files": [],
                    "work_tags": 0, "has_progress": False, "has_governance": False,
                    "reclaim_bytes": 0, "warnings": ["already_gone"], "status": "already_gone"}
        files = self._work_files(work_id)
        existing = [p for p in files if p.is_file()]
        reclaim = sum(p.stat().st_size for p in existing)
        work_tags = self.db.fetchone("SELECT COUNT(*) AS n FROM work_tags WHERE work_id=?", (work_id,))["n"]
        has_progress = self.db.fetchone("SELECT 1 FROM reader_progress WHERE work_id=?", (work_id,)) is not None
        has_governance = self.db.fetchone("SELECT 1 FROM work_metadata WHERE work_id=?", (work_id,)) is not None
        warnings: list[str] = []
        if has_progress:
            warnings.append("has_progress")
        if has_governance:
            warnings.append("has_governance")
        return {
            "kind": "work",
            "work_id": work_id,
            "title": row.get("pretty_title") or row.get("title_japanese") or row.get("title") or f"work-{work_id}",
            "exists": True,
            "files": [str(p) for p in existing],
            "work_tags": int(work_tags),
            "has_progress": has_progress,
            "has_governance": has_governance,
            "reclaim_bytes": reclaim,
            "warnings": warnings,
            "status": "ready",
        }

    def _preview_loose(self, kind: str, path_str: str) -> dict[str, Any]:
        ap = self._abs(path_str)
        if not self._within_managed(ap):
            return {"kind": kind, "path": path_str, "exists": False, "reclaim_bytes": 0,
                    "warnings": ["forbidden_path"], "status": "forbidden"}
        exists = bool(ap and ap.is_file())
        if not exists:
            return {"kind": kind, "path": str(ap), "exists": False, "reclaim_bytes": 0,
                    "warnings": ["already_gone"], "status": "already_gone"}
        return {"kind": kind, "path": str(ap), "exists": True, "reclaim_bytes": ap.stat().st_size,
                "warnings": [], "status": "ready"}

    def preview_delete(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        for target in targets or []:
            kind = target.get("kind")
            if kind == "work":
                items.append(self._preview_work(int(target.get("work_id") or 0)))
            elif kind in ("orphan", "stale"):
                items.append(self._preview_loose(kind, target.get("path") or ""))
        files_to_delete = sum(len(i.get("files", [])) if i["kind"] == "work" else (1 if i.get("exists") else 0) for i in items)
        works_to_remove = sum(1 for i in items if i["kind"] == "work" and i.get("exists"))
        reclaim_bytes = sum(i["reclaim_bytes"] for i in items)
        return {"items": items, "files_to_delete": files_to_delete, "works_to_remove": works_to_remove, "reclaim_bytes": reclaim_bytes}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_file_service.py -q`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/file_service.py backend/tests/test_file_service.py
git commit -m "feat(files): preview_delete 展开级联影响与警告

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 3: FileMaintenanceService.delete (级联 + 穿越防护)

**Files:**
- Modify: `backend/app/services/file_service.py`
- Test: `backend/tests/test_file_service.py`

**Interfaces:**
- Consumes: `._abs`, `._within_managed`, `._work_files` (Tasks 1-2).
- Produces: `.delete(targets: list[dict]) -> dict` with keys `deleted_files:int, removed_works:int, reclaimed_bytes:int, errors:list`. Each error: `{"target":dict, "code":str, "message":str}`. Codes: `already_gone`, `forbidden_path`, `unlink_failed`.
- DB cascade: deleting the `works` row relies on SQLite `ON DELETE CASCADE` + `PRAGMA foreign_keys=ON` (already set in `Database.connect`).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_file_service.py`:

```python
def test_delete_work_cascades_all_tables_and_files(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    keep_id = _import_work(db, archive, tmp_path, title="Keep", gallery_id=1)
    drop_id = _import_work(db, archive, tmp_path, title="Drop", gallery_id=2)
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) VALUES (5, 'tag', 't', 't', '{}') "
        "ON CONFLICT(remote_id) DO NOTHING"
    )
    db.execute("INSERT INTO work_tags (work_id, remote_tag_id, tag_type) VALUES (?, 5, 'tag')", (drop_id,))
    db.execute("INSERT INTO work_metadata (work_id, field, value, source) VALUES (?, 'title', 'X', 'manual')", (drop_id,))
    db.execute("INSERT INTO reader_progress (work_id, page_index, page_count, progress_percent) VALUES (?, 1, 2, 50)", (drop_id,))
    db.execute("INSERT INTO reading_history (work_id, page_index) VALUES (?, 1)", (drop_id,))
    drop_source = Path(db.fetchone("SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (drop_id,))["path"])
    drop_cover = Path(db.fetchone("SELECT cover_path FROM works WHERE id=?", (drop_id,))["cover_path"])
    keep_source = Path(db.fetchone("SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (keep_id,))["path"])
    keep_bytes = keep_source.read_bytes()

    result = files.delete([{"kind": "work", "work_id": drop_id}])

    assert result["removed_works"] == 1
    assert result["deleted_files"] >= 2
    assert result["reclaimed_bytes"] > 0
    assert result["errors"] == []
    assert not drop_source.exists()
    assert not drop_cover.exists()
    for table in ("works", "work_files", "work_pages", "work_tags", "work_metadata", "reader_progress", "reading_history"):
        assert db.fetchone(f"SELECT 1 FROM {table} WHERE work_id=?", (drop_id,)) is None if table != "works" else db.fetchone("SELECT 1 FROM works WHERE id=?", (drop_id,)) is None
    # other work untouched
    assert db.fetchone("SELECT 1 FROM works WHERE id=?", (keep_id,)) is not None
    assert keep_source.read_bytes() == keep_bytes


def test_delete_orphan_removes_only_that_file(tmp_path):
    settings, _db, _archive, files = _setup(tmp_path)
    orphan = settings.library_dir / "loose.cbz"
    orphan.write_bytes(b"xyz")

    result = files.delete([{"kind": "orphan", "path": str(orphan)}])

    assert result["deleted_files"] == 1
    assert result["reclaimed_bytes"] == 3
    assert not orphan.exists()


def test_delete_rejects_path_outside_managed_roots(tmp_path):
    _settings, _db, _archive, files = _setup(tmp_path)
    outside = tmp_path / "evil.cbz"
    outside.write_bytes(b"nope")

    result = files.delete([{"kind": "stale", "path": str(outside)}])

    assert result["deleted_files"] == 0
    assert any(err["code"] == "forbidden_path" for err in result["errors"])
    assert outside.exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_file_service.py -k "delete_work or delete_orphan or rejects_path" -q`
Expected: FAIL — `AttributeError: ... has no attribute 'delete'`.

- [ ] **Step 3: Write the implementation**

Add to `FileMaintenanceService` in `backend/app/services/file_service.py`:

```python
    def _unlink(self, path: Path, target: dict[str, Any], errors: list[dict[str, Any]]) -> int:
        if not self._within_managed(path):
            errors.append({"target": target, "code": "forbidden_path", "message": "路径不在受管目录内。"})
            return 0
        if not path.is_file():
            return 0
        size = path.stat().st_size
        try:
            path.unlink()
        except OSError as exc:
            errors.append({"target": target, "code": "unlink_failed", "message": str(exc)})
            return 0
        return size

    def delete(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        deleted_files = 0
        removed_works = 0
        reclaimed_bytes = 0
        errors: list[dict[str, Any]] = []

        for target in targets or []:
            kind = target.get("kind")
            if kind == "work":
                work_id = int(target.get("work_id") or 0)
                if self.db.fetchone("SELECT 1 FROM works WHERE id=?", (work_id,)) is None:
                    errors.append({"target": target, "code": "already_gone", "message": "作品不存在。"})
                    continue
                paths = self._work_files(work_id)  # gather BEFORE cascade removes work_files rows
                self.db.execute("DELETE FROM works WHERE id=?", (work_id,))  # ON DELETE CASCADE clears all references
                removed_works += 1
                for path in paths:
                    freed = self._unlink(path, target, errors)
                    if freed > 0 or (self._within_managed(path) and not path.exists()):
                        if freed > 0:
                            deleted_files += 1
                            reclaimed_bytes += freed
            elif kind in ("orphan", "stale"):
                path = self._abs(target.get("path"))
                if path is None:
                    errors.append({"target": target, "code": "forbidden_path", "message": "路径无效。"})
                    continue
                freed = self._unlink(path, target, errors)
                if freed > 0:
                    deleted_files += 1
                    reclaimed_bytes += freed

        return {"deleted_files": deleted_files, "removed_works": removed_works, "reclaimed_bytes": reclaimed_bytes, "errors": errors}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_file_service.py -q`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/file_service.py backend/tests/test_file_service.py
git commit -m "feat(files): delete 级联整体移除作品 + 穿越防护

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 4: API routes + Pydantic models + TestClient tests

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_files_api.py`

**Interfaces:**
- Consumes: `FileMaintenanceService` (Tasks 1-3).
- Produces routes:
  - `GET /api/files/overview` → `files_service.overview()`
  - `GET /api/files/inventory?category=&q=&status=&page=&per_page=` → `files_service.inventory(...)`
  - `POST /api/files/preview-delete` body `{"targets":[{kind, work_id?, path?}]}` → `files_service.preview_delete(targets)`
  - `POST /api/files/delete` body `{"targets":[...]}` → `files_service.delete(targets)`
- Module global: `files_service = FileMaintenanceService(db, settings)`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_files_api.py`:

```python
from fastapi.testclient import TestClient

from app import main


class FakeFiles:
    def overview(self):
        return {"work_count": 3, "reclaimable_bytes": 42}

    def inventory(self, category="all", q=None, status=None, page=1, per_page=50):
        return {"result": [{"kind": "work", "id": "work-1", "category": category, "q": q}], "total": 1, "page": page, "per_page": per_page}

    def preview_delete(self, targets):
        return {"items": targets, "files_to_delete": len(targets), "works_to_remove": 0, "reclaim_bytes": 0}

    def delete(self, targets):
        return {"deleted_files": len(targets), "removed_works": 0, "reclaimed_bytes": 7, "errors": []}


def test_files_overview_and_inventory_routes(monkeypatch):
    monkeypatch.setattr(main, "files_service", FakeFiles())
    client = TestClient(main.app)

    assert client.get("/api/files/overview").json()["work_count"] == 3
    body = client.get("/api/files/inventory?category=work&q=rain&page=2").json()
    assert body["result"][0]["category"] == "work"
    assert body["result"][0]["q"] == "rain"
    assert body["page"] == 2


def test_files_preview_and_delete_routes(monkeypatch):
    monkeypatch.setattr(main, "files_service", FakeFiles())
    client = TestClient(main.app)

    preview = client.post("/api/files/preview-delete", json={"targets": [{"kind": "work", "work_id": 1}]})
    assert preview.json()["files_to_delete"] == 1

    result = client.post("/api/files/delete", json={"targets": [{"kind": "orphan", "path": "x"}]})
    assert result.json()["deleted_files"] == 1
    assert result.json()["reclaimed_bytes"] == 7


def test_files_delete_accepts_empty_targets(monkeypatch):
    monkeypatch.setattr(main, "files_service", FakeFiles())
    client = TestClient(main.app)
    assert client.post("/api/files/delete", json={"targets": []}).status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_files_api.py -q`
Expected: FAIL — `AttributeError: module 'app.main' has no attribute 'files_service'` (or 404s).

- [ ] **Step 3: Write the implementation**

In `backend/app/main.py`:

3a. Add the import next to the other service imports (after line 16's `ExportService` import):

```python
from app.services.file_service import FileMaintenanceService
```

3b. Add Pydantic models near the other request models (after `ExportBatchRequest`):

```python
class FileTargetRequest(BaseModel):
    kind: str
    work_id: int | None = None
    path: str | None = None


class FileDeleteRequest(BaseModel):
    targets: list[FileTargetRequest] = []
```

3c. Add the service instance after `exports = ExportService(db, settings)`:

```python
files_service = FileMaintenanceService(db, settings)
```

3d. Add the routes after the export bundle route (`export_download_bundle`, before `@app.get("/api/works")`):

```python
@app.get("/api/files/overview")
def files_overview():
    return files_service.overview()


@app.get("/api/files/inventory")
def files_inventory(
    category: str = "all",
    q: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 50,
):
    return files_service.inventory(category=category, q=q, status=status, page=page, per_page=per_page)


@app.post("/api/files/preview-delete")
def files_preview_delete(payload: FileDeleteRequest):
    return files_service.preview_delete([t.model_dump(exclude_none=True) for t in payload.targets])


@app.post("/api/files/delete")
def files_delete(payload: FileDeleteRequest):
    return files_service.delete([t.model_dump(exclude_none=True) for t in payload.targets])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_files_api.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full backend suite + commit**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS (all prior tests + 15 new).

```bash
cd /opt/nhentai
git add backend/app/main.py backend/tests/test_files_api.py
git commit -m "feat(files): /api/files overview/inventory/preview-delete/delete 路由

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 5: Frontend api.ts — types + helpers

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `request<T>` (existing), `JSON_HEADERS` (existing).
- Produces (exported types + `api` methods):
  - `FileOverview`, `FileEntry`, `FileDeleteTarget`, `FileDeletePreview`, `FileDeleteResult`, `FileInventory`
  - `api.filesOverview()`, `api.filesInventory(params)`, `api.previewFileDelete(targets)`, `api.deleteFiles(targets)`

- [ ] **Step 1: Add types** near the export types (after `ExportSummaryStats`, around line 359):

```typescript
export type FileEntry = {
  kind: "work" | "orphan" | "stale";
  id: string;
  status: "ok" | "missing_source" | "missing_cover" | "orphan" | "stale";
  flags: string[];
  size_bytes: number;
  // work entries
  work_id?: number;
  title?: string;
  source_path?: string | null;
  cover_path?: string | null;
  page_count?: number;
  source?: string | null;
  remote_gallery_id?: number | null;
  // loose entries
  path?: string;
  name?: string;
  dir?: string;
};

export type FileOverview = {
  work_count: number;
  source_bytes: number;
  cover_ok: number;
  missing_source: number;
  missing_cover: number;
  orphan_count: number;
  orphan_bytes: number;
  stale_count: number;
  stale_bytes: number;
  reclaimable_bytes: number;
};

export type FileInventory = { result: FileEntry[]; total: number; page: number; per_page: number };

export type FileDeleteTarget = { kind: "work" | "orphan" | "stale"; work_id?: number; path?: string };

export type FileDeletePreviewItem = {
  kind: string;
  work_id?: number;
  title?: string;
  path?: string;
  exists: boolean;
  files?: string[];
  work_tags?: number;
  has_progress?: boolean;
  has_governance?: boolean;
  reclaim_bytes: number;
  warnings: string[];
  status: string;
};

export type FileDeletePreview = {
  items: FileDeletePreviewItem[];
  files_to_delete: number;
  works_to_remove: number;
  reclaim_bytes: number;
};

export type FileDeleteResult = {
  deleted_files: number;
  removed_works: number;
  reclaimed_bytes: number;
  errors: { target: FileDeleteTarget; code: string; message: string }[];
};

export type FileInventoryParams = {
  category?: string;
  q?: string;
  status?: string;
  page?: number;
  per_page?: number;
};
```

- [ ] **Step 2: Add `api` methods** inside the `api` object (after the `downloadExportBundle` entry, around line 667):

```typescript
  filesOverview: () => request<FileOverview>("/api/files/overview"),
  filesInventory: (params: FileInventoryParams = {}) => {
    const query = new URLSearchParams();
    query.set("category", params.category ?? "all");
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 50));
    return request<FileInventory>(`/api/files/inventory?${query.toString()}`);
  },
  previewFileDelete: (targets: FileDeleteTarget[]) =>
    request<FileDeletePreview>("/api/files/preview-delete", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ targets }),
    }),
  deleteFiles: (targets: FileDeleteTarget[]) =>
    request<FileDeleteResult>("/api/files/delete", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ targets }),
    }),
```

- [ ] **Step 3: Verify build**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS (`tsc -b && vite build`, zero errors).

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai
git add frontend/src/lib/api.ts
git commit -m "feat(files): api.ts 文件管理类型与请求方法

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 6: Frontend state hook + helpers

**Files:**
- Create: `frontend/src/components/files/fileHelpers.tsx`
- Create: `frontend/src/components/files/useFilesState.ts`

**Interfaces:**
- Consumes: `api.filesOverview/filesInventory/previewFileDelete/deleteFiles`, types from Task 5.
- Produces:
  - `formatBytes(n: number): string`, `statusLabel(status: string): string`, `targetKey(entry: FileEntry): string`, `entryToTarget(entry: FileEntry): FileDeleteTarget`
  - `useFilesState()` returning `{ overview, inventory, loading, error, category, setCategory, query, setQuery, statusFilter, setStatusFilter, page, setPage, selected, toggleSelect, clearSelection, focusId, setFocusId, preview, requestPreview, confirmDelete, busy, reload }`.

- [ ] **Step 1: Create `frontend/src/components/files/fileHelpers.tsx`**

```tsx
import type { FileDeleteTarget, FileEntry } from "../../lib/api";

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const STATUS_LABELS: Record<string, string> = {
  ok: "正常",
  missing_source: "缺失源",
  missing_cover: "缺失封面",
  orphan: "孤立文件",
  stale: "临时残留",
  size_mismatch: "体积不符",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function targetKey(entry: FileEntry): string {
  return entry.id;
}

export function entryToTarget(entry: FileEntry): FileDeleteTarget {
  if (entry.kind === "work") return { kind: "work", work_id: entry.work_id };
  return { kind: entry.kind, path: entry.path };
}
```

- [ ] **Step 2: Create `frontend/src/components/files/useFilesState.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  type FileDeletePreview,
  type FileEntry,
  type FileInventory,
  type FileOverview,
} from "../../lib/api";
import { entryToTarget } from "./fileHelpers";

export function useFilesState() {
  const [overview, setOverview] = useState<FileOverview | null>(null);
  const [inventory, setInventory] = useState<FileInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const requestToken = useRef(0);

  const loadOverview = useCallback(() => {
    api.filesOverview().then(setOverview).catch((e) => setError(String(e)));
  }, []);

  const loadInventory = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    api
      .filesInventory({ category, q: query || undefined, status: statusFilter || undefined, page })
      .then((data) => {
        if (token !== requestToken.current) return;
        setInventory(data);
        setError(null);
      })
      .catch((e) => {
        if (token !== requestToken.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (token === requestToken.current) setLoading(false);
      });
  }, [category, query, statusFilter, page]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const reload = useCallback(() => {
    loadOverview();
    loadInventory();
  }, [loadOverview, loadInventory]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFocusId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setPreview(null);
  }, []);

  const targetsFor = useCallback(
    (ids: Set<string>) => {
      const entries = inventory?.result ?? [];
      return entries.filter((e: FileEntry) => ids.has(e.id)).map(entryToTarget);
    },
    [inventory],
  );

  const requestPreview = useCallback(async () => {
    const targets = targetsFor(selected);
    if (targets.length === 0) {
      setPreview(null);
      return null;
    }
    setBusy(true);
    try {
      const result = await api.previewFileDelete(targets);
      setPreview(result);
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [selected, targetsFor]);

  const confirmDelete = useCallback(async () => {
    const targets = targetsFor(selected);
    if (targets.length === 0) return;
    setBusy(true);
    try {
      await api.deleteFiles(targets);
      clearSelection();
      reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [selected, targetsFor, clearSelection, reload]);

  return {
    overview,
    inventory,
    loading,
    error,
    category,
    setCategory: (c: string) => {
      setCategory(c);
      setPage(1);
    },
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setPage(1);
    },
    statusFilter,
    setStatusFilter: (s: string) => {
      setStatusFilter(s);
      setPage(1);
    },
    page,
    setPage,
    selected,
    toggleSelect,
    clearSelection,
    focusId,
    setFocusId,
    preview,
    requestPreview,
    confirmDelete,
    busy,
    reload,
  };
}
```

- [ ] **Step 3: Verify build**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai
git add frontend/src/components/files/fileHelpers.tsx frontend/src/components/files/useFilesState.ts
git commit -m "feat(files): useFilesState 状态/取数 hook 与 helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 7: Frontend FilesPage + 子组件 + 路由接线 + CSS

**Files:**
- Create: `frontend/src/components/files/FilesPage.tsx`
- Create: `frontend/src/components/files/FileOverviewStrip.tsx`
- Create: `frontend/src/components/files/FileToolbar.tsx`
- Create: `frontend/src/components/files/FileList.tsx`
- Create: `frontend/src/components/files/FileInspector.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/app.css`

**Interfaces:**
- Consumes: `useFilesState`, `formatBytes`, `statusLabel`, types from Task 5.
- Produces: `FilesPage` default-named export `export function FilesPage()`. `App.tsx` renders it for `page.name === "files"`.

- [ ] **Step 1: Create `frontend/src/components/files/FileOverviewStrip.tsx`**

```tsx
import type { FileOverview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";

export function FileOverviewStrip({ overview }: { overview: FileOverview | null }) {
  if (!overview) return null;
  const metrics: { label: string; value: string; tone?: string }[] = [
    { label: "作品数", value: String(overview.work_count) },
    { label: "源占用", value: formatBytes(overview.source_bytes) },
    { label: "缺失源", value: String(overview.missing_source), tone: overview.missing_source ? "warn" : undefined },
    { label: "缺失封面", value: String(overview.missing_cover), tone: overview.missing_cover ? "warn" : undefined },
    { label: "孤立文件", value: String(overview.orphan_count) },
    { label: "临时残留", value: String(overview.stale_count) },
    { label: "可回收", value: formatBytes(overview.reclaimable_bytes), tone: "accent" },
  ];
  return (
    <div className="files-overview">
      {metrics.map((m) => (
        <div key={m.label} className={`files-metric${m.tone ? ` files-metric-${m.tone}` : ""}`}>
          <span className="files-metric-value">{m.value}</span>
          <span className="files-metric-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/files/FileToolbar.tsx`**

```tsx
const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "work", label: "作品" },
  { key: "orphan", label: "孤立" },
  { key: "stale", label: "临时" },
];

const STATUSES = [
  { key: "", label: "全部状态" },
  { key: "ok", label: "正常" },
  { key: "missing_source", label: "缺失源" },
  { key: "missing_cover", label: "缺失封面" },
  { key: "orphan", label: "孤立" },
  { key: "stale", label: "临时" },
];

type Props = {
  category: string;
  onCategory: (c: string) => void;
  query: string;
  onQuery: (q: string) => void;
  statusFilter: string;
  onStatus: (s: string) => void;
  total: number;
};

export function FileToolbar({ category, onCategory, query, onQuery, statusFilter, onStatus, total }: Props) {
  return (
    <div className="files-toolbar">
      <div className="files-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`files-tab${category === c.key ? " is-active" : ""}`}
            onClick={() => onCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        className="files-search"
        type="search"
        placeholder="搜索标题或路径"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <select className="files-status" value={statusFilter} onChange={(e) => onStatus(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="files-count">{total} 项</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/files/FileList.tsx`**

```tsx
import type { FileEntry } from "../../lib/api";
import { formatBytes, statusLabel } from "./fileHelpers";

type Props = {
  entries: FileEntry[];
  selected: Set<string>;
  focusId: string | null;
  onToggle: (id: string) => void;
  loading: boolean;
};

export function FileList({ entries, selected, focusId, onToggle, loading }: Props) {
  if (loading && entries.length === 0) {
    return <div className="files-empty">加载中…</div>;
  }
  if (entries.length === 0) {
    return <div className="files-empty">没有匹配的文件。</div>;
  }
  return (
    <ul className="files-list">
      {entries.map((entry) => {
        const name = entry.kind === "work" ? entry.title : entry.name;
        const sub = entry.kind === "work" ? entry.source_path : entry.path;
        return (
          <li
            key={entry.id}
            className={`files-row${selected.has(entry.id) ? " is-selected" : ""}${focusId === entry.id ? " is-focused" : ""}`}
            onClick={() => onToggle(entry.id)}
          >
            <input type="checkbox" checked={selected.has(entry.id)} readOnly />
            <div className="files-row-main">
              <span className="files-row-name">{name}</span>
              <span className="files-row-sub">{sub}</span>
            </div>
            <span className={`files-badge files-badge-${entry.status}`}>{statusLabel(entry.status)}</span>
            <span className="files-row-size">{formatBytes(entry.size_bytes)}</span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/files/FileInspector.tsx`**

```tsx
import type { FileDeletePreview, FileEntry } from "../../lib/api";
import { formatBytes, statusLabel } from "./fileHelpers";

type Props = {
  focus: FileEntry | null;
  selectedCount: number;
  preview: FileDeletePreview | null;
  busy: boolean;
  onPreview: () => void;
  onConfirm: () => void;
  onClear: () => void;
};

const WARNING_LABELS: Record<string, string> = {
  has_progress: "该作品有阅读进度",
  has_governance: "该作品有治理元数据",
  already_gone: "目标已不存在",
  forbidden_path: "路径不在受管目录内",
};

export function FileInspector({ focus, selectedCount, preview, busy, onPreview, onConfirm, onClear }: Props) {
  const hasHealthyWork = preview?.items.some((i) => i.kind === "work" && i.exists) ?? false;
  return (
    <aside className="files-inspector">
      {focus ? (
        <div className="files-inspector-detail">
          <h3>{focus.kind === "work" ? focus.title : focus.name}</h3>
          <dl>
            <div><dt>状态</dt><dd>{statusLabel(focus.status)}</dd></div>
            <div><dt>占用</dt><dd>{formatBytes(focus.size_bytes)}</dd></div>
            {focus.kind === "work" ? (
              <>
                <div><dt>页数</dt><dd>{focus.page_count ?? 0}</dd></div>
                <div><dt>来源</dt><dd>{focus.source ?? "—"}</dd></div>
                <div><dt>ID</dt><dd>{focus.remote_gallery_id ?? "—"}</dd></div>
                <div><dt>源路径</dt><dd className="files-path">{focus.source_path ?? "—"}</dd></div>
              </>
            ) : (
              <div><dt>路径</dt><dd className="files-path">{focus.path}</dd></div>
            )}
          </dl>
        </div>
      ) : (
        <p className="files-empty">选择一个文件查看详情。</p>
      )}

      <div className="files-actions">
        <button type="button" onClick={onPreview} disabled={busy || selectedCount === 0}>
          预览删除（{selectedCount}）
        </button>
        {preview ? (
          <div className="files-delete-preview">
            <p>
              将删除 {preview.files_to_delete} 个文件
              {preview.works_to_remove > 0 ? `，移除 ${preview.works_to_remove} 个作品` : ""}，
              可回收 {formatBytes(preview.reclaim_bytes)}。
            </p>
            <ul className="files-warn-list">
              {preview.items.flatMap((item, idx) =>
                item.warnings.map((w) => (
                  <li key={`${idx}-${w}`} className="files-warn">
                    {WARNING_LABELS[w] ?? w}
                    {item.kind === "work" && item.title ? `：${item.title}` : ""}
                  </li>
                )),
              )}
            </ul>
            <div className="files-confirm-row">
              <button type="button" className="files-danger" onClick={onConfirm} disabled={busy}>
                {hasHealthyWork ? "确认删除（不可恢复）" : "确认删除"}
              </button>
              <button type="button" onClick={onClear} disabled={busy}>
                取消
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/files/FilesPage.tsx`**

```tsx
import { FileInspector } from "./FileInspector";
import { FileList } from "./FileList";
import { FileOverviewStrip } from "./FileOverviewStrip";
import { FileToolbar } from "./FileToolbar";
import { useFilesState } from "./useFilesState";

export function FilesPage() {
  const state = useFilesState();
  const entries = state.inventory?.result ?? [];
  const focus = entries.find((e) => e.id === state.focusId) ?? null;

  return (
    <section className="page files-page">
      <div className="hero">
        <div>
          <h1>文件管理</h1>
          <p>数据目录内全部文件的真实清单。删除前会预览影响；删除作品会连同其数据库记录一起移除。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <FileOverviewStrip overview={state.overview} />
      {state.error ? <div className="files-error">{state.error}</div> : null}

      <div className="files-body">
        <div className="files-main">
          <FileToolbar
            category={state.category}
            onCategory={state.setCategory}
            query={state.query}
            onQuery={state.setQuery}
            statusFilter={state.statusFilter}
            onStatus={state.setStatusFilter}
            total={state.inventory?.total ?? 0}
          />
          <FileList
            entries={entries}
            selected={state.selected}
            focusId={state.focusId}
            onToggle={state.toggleSelect}
            loading={state.loading}
          />
        </div>
        <FileInspector
          focus={focus}
          selectedCount={state.selected.size}
          preview={state.preview}
          busy={state.busy}
          onPreview={state.requestPreview}
          onConfirm={state.confirmDelete}
          onClear={state.clearSelection}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Wire `App.tsx`**

Add the import after the `ExportPage` import (line 6):

```tsx
import { FilesPage } from "./components/files/FilesPage";
```

Replace the `page.name === "files"` boundary block (lines 50-52) with:

```tsx
      {page.name === "files" ? <FilesPage /> : null}
```

- [ ] **Step 7: Add CSS** — append to `frontend/src/styles/app.css`:

```css
/* --- File maintenance --- */
.files-overview {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 2.5rem;
  padding: 1rem 0 1.25rem;
  border-bottom: 1px solid var(--hairline, rgba(0, 0, 0, 0.12));
}
.files-metric { display: flex; flex-direction: column; gap: 0.15rem; }
.files-metric-value { font-size: 1.6rem; font-weight: 600; line-height: 1; }
.files-metric-label { font-size: 0.75rem; opacity: 0.6; }
.files-metric-warn .files-metric-value { color: var(--danger, #b3402f); }
.files-metric-accent .files-metric-value { color: var(--primary, #c2603f); }
.files-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); gap: 1.5rem; margin-top: 1.25rem; }
.files-toolbar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.files-tabs { display: flex; gap: 0.25rem; }
.files-tab { border: none; background: transparent; padding: 0.35rem 0.7rem; border-radius: 6px; cursor: pointer; }
.files-tab.is-active { background: var(--surface-solid, #ece6dc); font-weight: 600; }
.files-search { flex: 1; min-width: 160px; border: none; border-bottom: 1px solid var(--hairline, rgba(0,0,0,0.2)); background: transparent; padding: 0.35rem 0.25rem; }
.files-status { border: 1px solid var(--hairline, rgba(0,0,0,0.2)); border-radius: 6px; padding: 0.3rem 0.5rem; background: transparent; }
.files-count { font-size: 0.8rem; opacity: 0.6; }
.files-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.files-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--hairline, rgba(0,0,0,0.08)); cursor: pointer; }
.files-row.is-selected { background: rgba(194, 96, 63, 0.08); }
.files-row.is-focused { box-shadow: inset 3px 0 0 var(--primary, #c2603f); }
.files-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.files-row-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.files-row-sub { font-size: 0.72rem; opacity: 0.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.files-row-size { font-variant-numeric: tabular-nums; font-size: 0.8rem; opacity: 0.7; }
.files-badge { font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 999px; white-space: nowrap; }
.files-badge-ok { color: #2f7d4f; }
.files-badge-missing_source, .files-badge-missing_cover { color: var(--danger, #b3402f); }
.files-badge-orphan, .files-badge-stale { color: #a07628; }
.files-inspector { border-left: 1px solid var(--hairline, rgba(0,0,0,0.1)); padding-left: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.files-inspector dl { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
.files-inspector dl div { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.82rem; }
.files-inspector dt { opacity: 0.55; }
.files-path { word-break: break-all; text-align: right; font-size: 0.72rem; opacity: 0.7; }
.files-actions button { width: 100%; padding: 0.5rem; border: 1px solid var(--hairline, rgba(0,0,0,0.2)); border-radius: 8px; background: var(--surface-solid, #ece6dc); cursor: pointer; }
.files-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.files-delete-preview { margin-top: 0.75rem; font-size: 0.82rem; }
.files-warn-list { list-style: none; padding: 0; margin: 0.5rem 0; display: flex; flex-direction: column; gap: 0.25rem; }
.files-warn { color: #a07628; font-size: 0.76rem; }
.files-confirm-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.files-danger { color: #fff !important; background: var(--danger, #b3402f) !important; border-color: var(--danger, #b3402f) !important; }
.files-empty, .files-error { padding: 1.5rem 0.5rem; opacity: 0.6; }
.files-error { color: var(--danger, #b3402f); }
@media (max-width: 860px) {
  .files-body { grid-template-columns: 1fr; }
  .files-inspector { border-left: none; border-top: 1px solid var(--hairline, rgba(0,0,0,0.1)); padding-left: 0; padding-top: 1rem; }
}
```

- [ ] **Step 8: Verify build**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS (`tsc -b && vite build`, zero errors).

- [ ] **Step 9: Commit**

```bash
cd /opt/nhentai
git add frontend/src/components/files/ frontend/src/App.tsx frontend/src/styles/app.css
git commit -m "feat(files): FilesPage 全文件清单 + 检查器 + 删除预览/确认

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

### Task 8: 文档更新 + 收尾验证

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/PROJECT_MAP.md`

- [ ] **Step 1: Run the full backend suite**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS (all prior + 15 new file tests).

- [ ] **Step 2: Run the frontend build**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS.

- [ ] **Step 3: Static fake-data scan**

Run: `cd /opt/nhentai && grep -rniE "mock|sample|fake|random|lorem|placeholder" backend/app/services/file_service.py frontend/src/components/files/ | grep -viE "no-?mock|//|#"`
Expected: no hardcoded fake records (only legitimate matches, if any, should be unrelated words). Investigate and remove any seeded fake data.

- [ ] **Step 4: Manual end-to-end check (real temp data dir)**

Run:
```bash
cd /opt/nhentai && NH_ARCHIVE_DATA_DIR="$(mktemp -d)/data" PYTHONPATH=backend .venv/bin/python - <<'PY'
import os, zipfile
from pathlib import Path
from app.config import load_settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.file_service import FileMaintenanceService

settings = load_settings()
db = Database(settings.database_path); db.init_schema()
archive = ArchiveService(db, settings)
files = FileMaintenanceService(db, settings)

cbz = settings.data_dir / "seed.cbz"
with zipfile.ZipFile(cbz, "w") as z:
    z.writestr("001.png", b"\x89PNG\r\n\x1a\n")
wid = archive.ingest_cbz(cbz, "remote", "Manual Check", 9001, {"remote": "nhentai"})

(settings.library_dir / "orphan.cbz").write_bytes(b"orphan")
(settings.tmp_dir / "leftover.tmp").write_bytes(b"tmp")

print("overview:", files.overview())
preview = files.preview_delete([{"kind": "work", "work_id": wid}])
print("preview reclaim:", preview["reclaim_bytes"], "files:", preview["files_to_delete"])
print("delete:", files.delete([{"kind": "work", "work_id": wid}]))
print("works left:", db.fetchone("SELECT COUNT(*) AS n FROM works")["n"])
print("work_tags left:", db.fetchone("SELECT COUNT(*) AS n FROM work_tags")["n"])
print("source file exists:", (settings.library_dir / f"{wid}.cbz").exists())
PY
```
Expected: overview reports 1 work + 1 orphan + 1 stale; preview shows non-zero reclaim; delete removes the work; `works left: 0`; `work_tags left: 0`; source file no longer exists.

- [ ] **Step 5: Update `docs/PROJECT_STATUS.md`**

Under `## Completed`, add a Phase 6 entry (top of the list):

```markdown
- Phase 6 文件管理:新增 `FileMaintenanceService`(本地文件系统 + SQLite,绝不调 NH API)与 API `GET /api/files/overview`、`GET /api/files/inventory`、`POST /api/files/preview-delete`、`POST /api/files/delete`。文件清单统一展示三类条目:作品(源 CBZ + 封面聚合为一个单元,状态 ok/missing_source/missing_cover,体积不符标 size_mismatch)、孤立文件(library/covers 下无 DB 引用)、临时残留(tmp/exports)。`work_files.path`/`works.cover_path` 的绝对/相对混用统一归一化为 `.resolve()` 绝对路径后再判定。删除是唯一动盘操作:删除作品经 SQLite `ON DELETE CASCADE` 级联清空 works/work_files/work_pages/work_tags/work_metadata/reader_progress/reading_history 并删源 CBZ + 封面;孤立/临时仅 unlink;受管目录外路径一律拒绝(穿越防护);CBZ 字节从不被修改,只整体删除。删除前强制 preview(展开级联影响、可回收字节、阅读进度/治理警告)。前端 `#files` 边界页替换为真实 `FilesPage`(overview 指标条 + toolbar + 可多选清单 + 检查器,预览→二次确认→执行→刷新)。验证:`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿(新增 test_file_service.py 12 项 + test_files_api.py 3 项);`cd frontend && npm run build` 通过;静态扫描无假数据;临时数据目录手验 overview/preview/级联删除符合真实状态。
```

Under `## Risks And Decisions`, add:

```markdown
- Decision: 文件管理是管理库内全部文件,不只异常清理;清单含健康作品,所有行可删。
- Decision: 删除健康作品的源 CBZ = 级联整体移除该作品(works 及全部引用表 + 封面文件)。
- Decision: 删除是文件管理唯一会动盘的操作;CBZ 永不被修改,只能整体删除;受管目录(library/covers/tmp/exports)之外的任何路径一律拒绝(目录穿越防护)。
- Decision: `work_files.path`/`works.cover_path` 绝对/相对混用,一律归一化为 `.resolve()` 绝对路径后再判定存在/删除/穿越。
```

Update `## Not Implemented Yet` by removing the `File maintenance.` line.

- [ ] **Step 6: Update `docs/PROJECT_MAP.md`**

Add a service entry under Backend Map (after `services/export_service.py`):

```markdown
- `services/file_service.py`
  - Local-only file inventory + deletion over the managed data dir; never calls the NH API.
  - `overview()`: real metrics — work count, source bytes, cover ok/missing, missing source, orphan/stale counts + bytes, reclaimable bytes.
  - `inventory(category, q, status, page, per_page)`: unified file entries — `work` (source CBZ + cover aggregated, status ok/missing_source/missing_cover, size_mismatch flag), `orphan` (loose files in library/covers with no DB reference), `stale` (tmp/exports leftovers). Paths normalized via `_abs()` (relative resolved against cwd, then `.resolve()`).
  - `preview_delete(targets)`: read-only; expands `work` targets to all cascaded DB rows (work_tags count, has_progress, has_governance) + source/cover files; reports files_to_delete/works_to_remove/reclaim_bytes + warnings (has_progress/has_governance/already_gone/forbidden_path).
  - `delete(targets)`: deletion is the only disk-touching op. `work` target deletes the works row (SQLite `ON DELETE CASCADE` clears work_files/work_pages/work_tags/work_metadata/reader_progress/reading_history) + unlinks source CBZ + cover; `orphan`/`stale` unlink the single file. Paths outside managed roots rejected (`_within_managed`). CBZ bytes never modified.
```

Move `File maintenance: /api/files/*` from "Reserved, not implemented" to "Implemented" and list the four routes:

```markdown
- `GET /api/files/overview`
- `GET /api/files/inventory?category=&q=&status=&page=&per_page=`
- `POST /api/files/preview-delete`
- `POST /api/files/delete`
```

Add frontend entries under Frontend Map:

```markdown
- `components/files/` — file maintenance module:
  - `FilesPage.tsx` — thin container: overview strip + toolbar + multi-select list + inspector.
  - `useFilesState.ts` — overview/inventory fetch, category/q/status filters with request token, selected Set, focus, delete preview + confirm orchestration.
  - `FileOverviewStrip.tsx` / `FileToolbar.tsx` / `FileList.tsx` / `FileInspector.tsx` — metrics, filters, selectable rows, focused-detail + delete preview/confirm.
  - `fileHelpers.tsx` — `formatBytes`, `statusLabel`, `targetKey`, `entryToTarget`.
  - `App.tsx` renders `FilesPage` for `#files` (replaced the boundary screen).
```

- [ ] **Step 7: Commit**

```bash
cd /opt/nhentai
git add docs/PROJECT_STATUS.md docs/PROJECT_MAP.md
git commit -m "docs(files): 记录 Phase 6 文件管理（服务/API/组件/决策）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018oh8FJuMuFCB7z1A7h5dN4"
```

---

## Self-Review

**1. Spec coverage:**
- 检测四类(缺失源/缺失封面/孤立/临时) → Task 1 (`_scan`) + tests ✓
- 路径归一化 → Task 1 `_abs` + `test_relative_path_is_normalized_against_cwd` ✓
- overview 指标 → Task 1 ✓
- inventory 搜索/筛选/分页 → Task 1 ✓
- target 标识 + 预览展开级联 + 真实计数 + 警告 → Task 2 ✓
- delete 级联 + 事务(FK cascade)+ 穿越防护 + 如实报错 + 隔离性 → Task 3 ✓
- 4 个 API + 错误/空 targets → Task 4 ✓
- 前端 api/types → Task 5;state hook → Task 6;页面/组件/路由/CSS → Task 7 ✓
- 测试/构建/静态扫描/手验/文档 → Task 8 ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**3. Type consistency:** `FileEntry.id` is the stable select key (`targetKey`/`entryToTarget` use `entry.id`/`entry.kind`); service entry `id`/`status`/`flags`/`kind` match api.ts `FileEntry`; `preview_delete`/`delete` return shapes match `FileDeletePreview`/`FileDeleteResult`; route service global named `files_service` consistently across Task 4 and tests. ✓

> Note (size_mismatch UI): `statusLabel` includes a `size_mismatch` label for completeness, but `FileEntry.status` is never `size_mismatch` (it lives in `flags`); the badge always renders the primary `status`. This is intentional — flags beyond the primary status are surfaced in the inspector copy, not as the row badge. No code change needed.
