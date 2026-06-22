# Governance ComicInfo Write-Back to Source CBZ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the governed ComicInfo atomically back into the source CBZ in place, as an opt-in step of the governance "apply" action.

**Architecture:** First extract the three pure functions for ComicInfo field generation, XML serialization, and zip resealing out of `ExportService` into a stateless shared module `comicinfo.py` (this avoids a circular import where `GovernanceService` would import `ExportService`, and guarantees the export download and the source write-back produce identical bytes). `GovernanceService` gains `write_back_comicinfo`, which uses the same functions to build the bytes, writes a temp file in the same directory, fsyncs it, and atomically replaces the source via `os.replace`, then recomputes and updates `sha256`/`size_bytes` in `work_files`. The `apply` API gains a `write_back` flag; the frontend apply panel gains a default-off checkbox plus a risk confirmation.

**Tech Stack:** Python 3.11 / FastAPI / SQLite (`app.database.Database`) / stdlib `zipfile`, `hashlib`, `os`; frontend TypeScript / React / Vite.

## Global Constraints

- ComicInfo only: every page-image member's decompressed bytes must stay identical; only the zip container is resealed.
- Atomic write: the temp file lives in the **same directory / same filesystem** as the source; `flush + os.fsync` then `os.replace`; **no backup**; any exception cleans up the temp file and leaves the source untouched.
- Traversal guard: the source path, after `.resolve()`, must live inside `settings.library_dir`; otherwise reject and do not write.
- After write-back, `work_files.sha256` and `size_bytes` must be recomputed and updated (file maintenance relies on them for dedupe / size checks).
- Failure isolation: once `work_metadata` is written, a failed write-back does NOT roll back the metadata; the response surfaces it via `write_back.error`.
- Default off: `write_back` defaults to `false`; the frontend checkbox is unchecked by default.
- Site-wide tags render via the dictionary `display` (write-back reuses the existing `_tag_output` inside `build_fields`, so this rule needs no change).
- Out of scope: bulk write-back, backup/undo, cover normalization / page renaming / meta.json cleanup.

---

## File Structure

- **Create** `backend/app/services/comicinfo.py` — shared pure functions: `COMICINFO_KEYS`, `build_fields`, `to_xml`, `reseal_cbz`.
- **Create** `backend/tests/test_comicinfo.py` — unit tests for the shared module.
- **Create** `backend/tests/test_governance_writeback.py` — write-back behavior + consistency tests.
- **Modify** `backend/app/services/export_service.py` — drop the extracted methods, delegate to the shared module.
- **Modify** `backend/app/services/governance_service.py` — `__init__` gains `settings`; add `write_back_comicinfo`; `apply` accepts `write_back`.
- **Modify** `backend/app/main.py` — `GovernanceApplyRequest` gains `write_back`; construct `governance` with `settings`.
- **Modify** `frontend/src/lib/api.ts` — extend `GovernanceApplyPayload` / `GovernanceApplyResult`.
- **Modify** `frontend/src/components/governance/useGovernanceState.ts` — `writeBack` state + confirm + result feedback.
- **Modify** `frontend/src/components/governance/GovernanceActionBar.tsx` — checkbox + risk hint.

---

## Task 1: Extract shared `comicinfo.py` and make ExportService delegate

**Files:**
- Create: `backend/app/services/comicinfo.py`
- Create: `backend/tests/test_comicinfo.py`
- Modify: `backend/app/services/export_service.py`

**Interfaces:**
- Produces:
  - `comicinfo.COMICINFO_KEYS: dict[str, str]`
  - `comicinfo.build_fields(aggregate: dict[str, Any]) -> dict[str, str]` — derives ComicInfo fields from the structure returned by `GovernanceService.work_governance(id)` (keys are ComicInfo tag names like `Title`/`Writer`/…).
  - `comicinfo.to_xml(fields: dict[str, str]) -> str`
  - `comicinfo.reseal_cbz(source_path: Path, comic_info_xml: str | None, keep_json: bool = True, compress: bool = True) -> bytes`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_comicinfo.py`:

```python
import io
import zipfile
from pathlib import Path

from app.services import comicinfo


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
        archive.writestr("meta.json", '{"source":"real"}')
        archive.writestr("ComicInfo.xml", "<ComicInfo><Title>Old</Title></ComicInfo>")


def test_build_fields_and_to_xml_from_aggregate():
    aggregate = {
        "work": {"id": 1, "page_count": 2},
        "metadata": {"fields": [
            {"field": "title", "working_value": "New Title", "current_value": None, "source_value": None},
            {"field": "artist", "working_value": "tonari", "current_value": None, "source_value": None},
        ]},
        "tags": {"groups": [
            {"tags": [{"display": "雨", "name": "rain", "slug": "rain"}]},
        ]},
    }
    fields = comicinfo.build_fields(aggregate)
    assert fields["Title"] == "New Title"
    assert fields["Writer"] == "tonari"
    assert fields["Tags"] == "雨"
    assert fields["PageCount"] == "2"

    xml = comicinfo.to_xml(fields)
    assert "<Title>New Title</Title>" in xml
    assert "<Tags>雨</Tags>" in xml


def test_reseal_cbz_replaces_comicinfo_and_preserves_pages(tmp_path):
    source = tmp_path / "src.cbz"
    _make_cbz(source)
    with zipfile.ZipFile(source) as original:
        original_pages = {n: original.read(n) for n in ("001.png", "002.png", "meta.json")}

    data = comicinfo.reseal_cbz(source, "<ComicInfo><Title>New</Title></ComicInfo>")

    with zipfile.ZipFile(io.BytesIO(data)) as resealed:
        names = resealed.namelist()
        assert names.count("ComicInfo.xml") == 1
        assert resealed.read("ComicInfo.xml").decode() == "<ComicInfo><Title>New</Title></ComicInfo>"
        for name, body in original_pages.items():
            assert resealed.read(name) == body
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_comicinfo.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.comicinfo'`

- [ ] **Step 3: Create the shared module**

Create `backend/app/services/comicinfo.py`:

```python
from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


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


def _stringify(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _field_value(field: dict[str, Any] | None) -> str | None:
    if not field:
        return None
    for key in ("working_value", "current_value", "source_value"):
        value = _stringify(field.get(key))
        if value:
            return value
    return None


def _tag_output(aggregate: dict[str, Any]) -> str | None:
    values: list[str] = []
    for group in aggregate["tags"]["groups"]:
        for tag in group["tags"]:
            display = _stringify(tag.get("display") or tag.get("name") or tag.get("slug"))
            if display and display not in values:
                values.append(display)
    return ", ".join(values) if values else None


def build_fields(aggregate: dict[str, Any]) -> dict[str, str]:
    fields = {field["field"]: field for field in aggregate["metadata"]["fields"]}
    comic_info: dict[str, str] = {}
    for field, key in COMICINFO_KEYS.items():
        value = _field_value(fields.get(field))
        if value:
            comic_info[key] = value
    if "PageCount" not in comic_info:
        comic_info["PageCount"] = str(aggregate["work"].get("page_count") or 0)
    tags = _tag_output(aggregate)
    if tags:
        comic_info["Tags"] = tags
    return comic_info


def to_xml(fields: dict[str, str]) -> str:
    root = ElementTree.Element("ComicInfo")
    for key in COMICINFO_KEYS.values():
        value = _stringify(fields.get(key))
        if value:
            child = ElementTree.SubElement(root, key)
            child.text = value
    return ElementTree.tostring(root, encoding="unicode", short_empty_elements=False)


def reseal_cbz(
    source_path: Path, comic_info_xml: str | None, keep_json: bool = True, compress: bool = True
) -> bytes:
    compression = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    buffer = io.BytesIO()
    with zipfile.ZipFile(source_path) as source, zipfile.ZipFile(
        buffer, "w", compression=compression
    ) as target:
        for info in source.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name.lower()
            if name == "comicinfo.xml":
                continue
            if not keep_json and name.endswith(".json"):
                continue
            target.writestr(info.filename, source.read(info.filename))
        if comic_info_xml is not None:
            target.writestr("ComicInfo.xml", comic_info_xml)
    return buffer.getvalue()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_comicinfo.py -q`
Expected: PASS (2 passed)

- [ ] **Step 5: Make ExportService delegate to the shared module**

In `backend/app/services/export_service.py`, change the import block (original lines 1–12) to:

```python
from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.governance_service import GovernanceService
```

Delete the `COMICINFO_KEYS = {...}` constant in this file (original lines 15–26; now lives in the shared module). Keep `_ILLEGAL_FILENAME_CHARS` and `_MAX_NAME_LENGTH`.

In `preview`, change `comic_info = self._comic_info(aggregate)` to:

```python
        comic_info = comicinfo.build_fields(aggregate)
```

In `build_cbz`, change these two lines:

```python
        comic_info_xml = self._comicinfo_xml(preview["comic_info"]) if opts["write_comicinfo"] else None
        data = self._package_bytes(source_path, comic_info_xml, opts["keep_json"], opts["compress"])
```

to:

```python
        comic_info_xml = comicinfo.to_xml(preview["comic_info"]) if opts["write_comicinfo"] else None
        data = comicinfo.reseal_cbz(source_path, comic_info_xml, opts["keep_json"], opts["compress"])
```

Delete these now-extracted method definitions from `ExportService`: `_package_bytes`, `_comic_info`, `_field_value`, `_tag_output`, `_comicinfo_xml`. Keep `_unique_member_name`, `_source_file`, `_blockers`, `_warnings`, `_kept_members`, `_output_name`, `_requested_output_name`, `_stringify`, and the module-level `_safe_filename`.

- [ ] **Step 6: Run export regression + shared-module tests**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_export_service.py backend/tests/test_export_api.py backend/tests/test_comicinfo.py -q`
Expected: PASS (all pass; export behavior unchanged)

- [ ] **Step 7: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/comicinfo.py backend/tests/test_comicinfo.py backend/app/services/export_service.py
git commit -m "$(cat <<'EOF'
refactor(comicinfo): extract shared ComicInfo build/reseal module; ExportService delegates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 2: `GovernanceService.write_back_comicinfo` — atomic write + consistency + guards

**Files:**
- Modify: `backend/app/services/governance_service.py`
- Create: `backend/tests/test_governance_writeback.py`

**Interfaces:**
- Consumes: `comicinfo.build_fields`, `comicinfo.to_xml`, `comicinfo.reseal_cbz` (Task 1); `app.config.Settings`.
- Produces:
  - `GovernanceService.__init__(self, db, dictionary_service=None, settings=None)`
  - `GovernanceService.write_back_comicinfo(work_id: int) -> dict[str, Any]` — returns `{"written": True, "fields": dict, "new_sha256": str, "new_size_bytes": int}`; raises `ValueError` (without writing) when the source is missing / not a zip / outside the library / settings is None.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_governance_writeback.py` (reusing the export tests' fixture shape):

```python
import hashlib
import io
import zipfile
from pathlib import Path

import pytest

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_service import ExportService
from app.services.governance_service import GovernanceService


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
        archive.writestr("meta.json", '{"source":"real"}')
        archive.writestr("ComicInfo.xml", "<ComicInfo><Title>Old Title</Title></ComicInfo>")


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    governance = GovernanceService(db, settings=settings)
    return settings, db, archive, governance


def _import_work(db, archive, tmp_path, gallery_id: int = 1234) -> int:
    cbz = tmp_path / f"source-{gallery_id}.cbz"
    _make_cbz(cbz)
    work_id = archive.ingest_cbz(
        cbz, "remote", "Rain Classroom", gallery_id,
        {"remote": "nhentai", "media_id": "media-1234",
         "title_japanese": "雨后の教室", "pretty_title": "Rain Classroom Pretty"},
    )
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source, source_value) "
        "VALUES (?, 'title', 'New Title', 'manual', NULL)",
        (work_id,),
    )
    return work_id


def _source_path(db, work_id: int) -> Path:
    row = db.fetchone(
        "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,)
    )
    return Path(row["path"])


def test_write_back_injects_comicinfo_and_preserves_pages(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    with zipfile.ZipFile(source) as original:
        pages = {n: original.read(n) for n in ("001.png", "002.png")}

    result = governance.write_back_comicinfo(work_id)

    assert result["written"] is True
    assert result["fields"]["Title"] == "New Title"
    with zipfile.ZipFile(source) as written:
        assert written.namelist().count("ComicInfo.xml") == 1
        assert "<Title>New Title</Title>" in written.read("ComicInfo.xml").decode()
        for name, body in pages.items():
            assert written.read(name) == body


def test_write_back_updates_work_files_hash_and_size(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)

    result = governance.write_back_comicinfo(work_id)

    on_disk = source.read_bytes()
    expected_sha = hashlib.sha256(on_disk).hexdigest()
    row = db.fetchone(
        "SELECT sha256, size_bytes FROM work_files WHERE work_id = ? AND kind = 'source_cbz'",
        (work_id,),
    )
    assert row["sha256"] == expected_sha == result["new_sha256"]
    assert int(row["size_bytes"]) == len(on_disk) == result["new_size_bytes"]


def test_write_back_matches_export_comicinfo_fields(tmp_path):
    settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    exports = ExportService(db, settings)

    _name, export_bytes = exports.build_cbz(work_id)
    with zipfile.ZipFile(io.BytesIO(export_bytes)) as exported:
        export_xml = exported.read("ComicInfo.xml").decode()

    governance.write_back_comicinfo(work_id)
    with zipfile.ZipFile(_source_path(db, work_id)) as written:
        write_back_xml = written.read("ComicInfo.xml").decode()

    assert export_xml == write_back_xml


def test_write_back_raises_for_missing_source_without_touching_disk(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    source.unlink()

    with pytest.raises(ValueError):
        governance.write_back_comicinfo(work_id)
    assert not source.exists()
    assert list(source.parent.glob("*.tmp")) == []


def test_write_back_rejects_path_outside_library(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    outside = tmp_path / "outside.cbz"
    _make_cbz(outside)
    db.execute(
        "UPDATE work_files SET path = ? WHERE work_id = ? AND kind = 'source_cbz'",
        (str(outside), work_id),
    )
    before = outside.read_bytes()

    with pytest.raises(ValueError):
        governance.write_back_comicinfo(work_id)
    assert outside.read_bytes() == before


def test_write_back_keeps_source_intact_when_reseal_fails(tmp_path, monkeypatch):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    before = source.read_bytes()

    from app.services import comicinfo
    monkeypatch.setattr(comicinfo, "reseal_cbz", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))

    with pytest.raises(RuntimeError):
        governance.write_back_comicinfo(work_id)
    assert source.read_bytes() == before
    assert list(source.parent.glob("*.tmp")) == []
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_writeback.py -q`
Expected: FAIL — `TypeError` (`__init__` does not accept `settings`) or `AttributeError` (no `write_back_comicinfo`)

- [ ] **Step 3: Change `__init__` to accept settings**

In `backend/app/services/governance_service.py`, change the import block (original lines 1–10) to:

```python
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
```

Change `__init__` to:

```python
    def __init__(self, db: Database, dictionary_service: Any | None = None, settings: Any | None = None):
        self.db = db
        self.dictionary_service = dictionary_service
        self.settings = settings
```

- [ ] **Step 4: Implement `write_back_comicinfo`**

Inside `GovernanceService`, right after the `apply` method, add:

```python
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
```

Note: after a successful `os.replace`, `tmp_path` no longer exists, so the `finally` cleanup only matters on the error path — if `reseal_cbz` raises, `tmp_path` was never created (`exists()` is false); if writing the temp file raises midway, `finally` removes the leftover temp file and the source was never touched by `os.replace`, so it stays intact.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_writeback.py -q`
Expected: PASS (6 passed)

- [ ] **Step 6: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/governance_service.py backend/tests/test_governance_writeback.py
git commit -m "$(cat <<'EOF'
feat(governance): write_back_comicinfo atomic write-back to source CBZ + hash/size sync

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 3: Wire the API — `apply(write_back)` flag + failure isolation

**Files:**
- Modify: `backend/app/services/governance_service.py` (`apply`)
- Modify: `backend/app/main.py` (`GovernanceApplyRequest` + `governance` construction)
- Modify: `backend/tests/test_governance_writeback.py` (append apply integration tests)

**Interfaces:**
- Consumes: `GovernanceService.write_back_comicinfo` (Task 2).
- Produces: `GovernanceService.apply(work_id, payload)` — when `payload["write_back"]` is truthy, the response gains a `"write_back"` key (the `write_back_comicinfo` return value on success, or `{"error": str}` on failure).

- [ ] **Step 1: Write the failing test (append to the end of test_governance_writeback.py)**

```python
def test_apply_with_write_back_writes_source(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)

    result = governance.apply(
        work_id,
        {"metadata": [{"field": "title", "value": "Applied Title", "source": "manual"}], "write_back": True},
    )

    assert result["write_back"]["written"] is True
    with zipfile.ZipFile(source) as written:
        assert "<Title>Applied Title</Title>" in written.read("ComicInfo.xml").decode()


def test_apply_without_write_back_never_touches_source(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    before = source.read_bytes()

    result = governance.apply(
        work_id,
        {"metadata": [{"field": "title", "value": "Applied Title", "source": "manual"}]},
    )

    assert "write_back" not in result
    assert source.read_bytes() == before


def test_apply_keeps_metadata_when_write_back_fails(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    _source_path(db, work_id).unlink()  # force write-back to fail

    result = governance.apply(
        work_id,
        {"metadata": [{"field": "title", "value": "Persisted Title", "source": "manual"}], "write_back": True},
    )

    assert result["saved"] == 1
    assert "error" in result["write_back"]
    saved = db.fetchone(
        "SELECT value FROM work_metadata WHERE work_id = ? AND field = 'title'", (work_id,)
    )
    assert saved["value"] == "Persisted Title"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_writeback.py -k apply -q`
Expected: FAIL — `KeyError: 'write_back'`, or metadata not saved (write-back exception bubbling up)

- [ ] **Step 3: Wire write_back into the end of `apply`**

In `governance_service.py`, replace the final segment of `apply` (the original `return {"saved": saved, ...}`) with:

```python
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
```

- [ ] **Step 4: Update the API request model + service construction**

In `backend/app/main.py`, change `GovernanceApplyRequest` (original lines 76–78) to:

```python
class GovernanceApplyRequest(BaseModel):
    metadata: list[GovernanceMetadataPatch] = []
    dictionary_apply: list[DictionaryApplyRequest] = []
    write_back: bool = False
```

Change the service construction on line 122 to pass `settings`:

```python
governance = GovernanceService(db, dictionary, settings)
```

(`settings` is already defined on line 106, `settings = load_settings()`, before line 122.)

- [ ] **Step 5: Run regression (governance + export + api)**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_writeback.py backend/tests/test_governance_service.py backend/tests/test_export_service.py backend/tests/test_export_api.py -q`
Expected: PASS (all pass)

- [ ] **Step 6: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/governance_service.py backend/app/main.py backend/tests/test_governance_writeback.py
git commit -m "$(cat <<'EOF'
feat(governance): apply supports write_back flag; failed write-back keeps metadata

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 4: Frontend — write-back checkbox + risk confirm + result feedback

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/governance/useGovernanceState.ts`
- Modify: `frontend/src/components/governance/GovernanceActionBar.tsx`
- Modify: `frontend/src/components/governance/GovernancePage.tsx`

**Interfaces:**
- Consumes: the `write_back` field of the `apply` response (Task 3).
- Produces: `useGovernanceState` return adds `writeBack: boolean` and `setWriteBack: (v: boolean) => void`; `GovernanceActionBar` receives and renders the checkbox.

- [ ] **Step 1: Add the type fields in api.ts**

Change `GovernanceApplyPayload` in `frontend/src/lib/api.ts` (original lines 294–297) to:

```typescript
export type GovernanceApplyPayload = {
  metadata: Array<{ field: string; value: string | null; source: "manual" | "remote" | "comicinfo" | "current" }>;
  dictionary_apply?: DictionaryApplyPayload[];
  write_back?: boolean;
};
```

Change `GovernanceApplyResult` (original lines 299–303) to:

```typescript
export type GovernanceApplyResult = {
  saved: number;
  dictionary: DictionaryApplyResult[];
  governance: GovernanceAggregate;
  write_back?: {
    written?: boolean;
    fields?: Record<string, string>;
    new_size_bytes?: number;
    error?: string;
  };
};
```

- [ ] **Step 2: Add writeBack state + confirm + feedback in useGovernanceState**

In `frontend/src/components/governance/useGovernanceState.ts`, in the state declaration area (near `const [saving, setSaving] = ...`), add:

```typescript
  const [writeBack, setWriteBack] = useState(false);
```

Replace the body of `saveMetadata` with (adds the confirm and the write-back feedback on top of the existing logic):

```typescript
  const saveMetadata = async () => {
    if (!aggregate || !changedFields.length) {
      setNotice("没有需要保存的修改。");
      return;
    }
    if (writeBack && !window.confirm("将就地改写源 CBZ 的 ComicInfo，此操作不可撤销。是否继续？")) {
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const changed = changedFields.map((field) => ({
        field: field.field,
        value: edits[field.field].value.trim() || null,
        source: edits[field.field].source,
      }));
      const result = await api.applyWorkGovernance(aggregate.work.id, {
        metadata: changed,
        write_back: writeBack,
      });
      setAggregate(result.governance);
      setQueue(await api.governanceQueue());
      if (result.write_back?.error) {
        setNotice(`已保存 ${result.saved} 个字段，但回写源文件失败：${result.write_back.error}`);
      } else if (result.write_back?.written) {
        setNotice(`已保存 ${result.saved} 个字段，并回写 ComicInfo 到源文件。`);
      } else {
        setNotice(`已保存 ${result.saved} 个字段。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
```

Add `writeBack,` and `setWriteBack,` to the returned object (alongside `saving`, `saveMetadata`).

- [ ] **Step 3: Confirm `useState` is imported**

The top of `useGovernanceState.ts` should already have `import { useEffect, useMemo, useState } from "react";`. If `useState` is missing, add it.

- [ ] **Step 4: Add the checkbox in GovernanceActionBar**

Replace `frontend/src/components/governance/GovernanceActionBar.tsx` entirely with:

```tsx
import { Download, RefreshCw, Save, Tags } from "lucide-react";

import { navigate } from "../../lib/navigation";

export function GovernanceActionBar({
  workId,
  changedCount,
  saving,
  writeBack,
  onWriteBackChange,
  onSave,
  onReload,
}: {
  workId: number;
  changedCount: number;
  saving: boolean;
  writeBack: boolean;
  onWriteBackChange: (value: boolean) => void;
  onSave: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="governance-actionbar">
      <button className="governance-action primary" type="button" onClick={() => void onSave()} disabled={saving || changedCount === 0}>
        <Save size={17} />
        {saving ? "保存中..." : `保存修改${changedCount ? ` (${changedCount})` : ""}`}
      </button>
      <label className="governance-writeback">
        <input
          type="checkbox"
          checked={writeBack}
          onChange={(event) => onWriteBackChange(event.target.checked)}
        />
        同时回写源文件（ComicInfo）
        <span className="governance-writeback-hint">将就地改写源 CBZ，不可撤销</span>
      </label>
      <button className="governance-action" type="button" onClick={() => navigate({ name: "dictionary" })}>
        <Tags size={16} />
        管理词典
      </button>
      <button className="governance-action" type="button" onClick={() => navigate({ name: "export", workId })}>
        <Download size={16} />
        进入导出
      </button>
      <button className="governance-action" type="button" onClick={() => void onReload()}>
        <RefreshCw size={16} />
        重新读取
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Pass the new props through GovernancePage**

In `frontend/src/components/governance/GovernancePage.tsx`, find where `<GovernanceActionBar ... />` is rendered and add `writeBack={gov.writeBack}` and `onWriteBackChange={gov.setWriteBack}` (where `gov` is the `useGovernanceState()` return value; keep the existing `workId`/`changedCount`/`saving`/`onSave`/`onReload` props as-is). If the local variable name differs, use the corresponding hook return value from context.

- [ ] **Step 6: Build gate**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS (`tsc -b && vite build`, zero errors)

- [ ] **Step 7: Commit**

```bash
cd /opt/nhentai
git add frontend/src/lib/api.ts frontend/src/components/governance/useGovernanceState.ts frontend/src/components/governance/GovernanceActionBar.tsx frontend/src/components/governance/GovernancePage.tsx
git commit -m "$(cat <<'EOF'
feat(governance/ui): apply-panel write-back checkbox + risk confirm + result feedback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 5: Documentation decisions update + full verification

**Files:**
- Modify: `docs/PROJECT_STATUS.md`

- [ ] **Step 1: Update PROJECT_STATUS decisions**

Append one entry to the `## Completed` section of `docs/PROJECT_STATUS.md`:

```
- 治理 ComicInfo 回写源 CBZ：新增共享模块 `comicinfo.py`（ComicInfo 字段生成/XML/zip 重封，ExportService 与回写共用，保证导出下载与源回写产出一致）。`GovernanceService.write_back_comicinfo` 把治理后的 ComicInfo 就地原子写进源 CBZ：写同目录 tmp → fsync → `os.replace`，无备份；只换 ComicInfo.xml，页面图像字节不变；回写后重算并更新 `work_files.sha256`/`size_bytes`。API `POST /api/works/{id}/governance/apply` 增 `write_back` 开关（默认关），metadata 写入成功后回写失败不回滚、以 `write_back.error` 回显。前端应用面板加默认关闭的「同时回写源文件」复选框 + 风险提示 + 二次确认。
```

In `## Risks And Decisions`, narrow the "source CBZ is never modified" decision by appending:

```
- Decision: 治理 ComicInfo 回写是唯一受认可的源 CBZ 改写（仅 ComicInfo、原子替换、无备份、显式 opt-in、默认关）；导出仍永不写源（导出=下载给用户）；文件管理删除仍是另一条独立动盘操作。回写后必须同步 `work_files.sha256`/`size_bytes` 以维持去重/体积检测的真实性。
```

In `## Not Implemented Yet`, remove the "source-CBZ ComicInfo write-back" item (now implemented); keep governance bulk preview/apply, machine-translation automation, and the other remaining items.

- [ ] **Step 2: Full backend test suite**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS (all green, including the new `test_comicinfo.py` and `test_governance_writeback.py`)

- [ ] **Step 3: Frontend build gate**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS

- [ ] **Step 4: Static fake-data / leak scan**

Run: `cd /opt/nhentai && grep -rnE "mock|fake|placeholder|TODO|FIXME" backend/app/services/comicinfo.py backend/app/services/governance_service.py`
Expected: no hits (SQL `?` parameter placeholders do not count)

- [ ] **Step 5: Commit**

```bash
cd /opt/nhentai
git add docs/PROJECT_STATUS.md
git commit -m "$(cat <<'EOF'
docs: record governance ComicInfo write-back (shared module / atomic write / hash sync)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Shared module / avoid circular import / single source of truth → Task 1. ✓
- In-place atomic write, tmp+fsync+os.replace, no backup → Task 2 Step 4 + test Step 1 (`test_write_back_keeps_source_intact_when_reseal_fails`). ✓
- ComicInfo only, page bytes unchanged → Task 1 (`reseal_cbz` test) + Task 2 (`test_write_back_injects_comicinfo_and_preserves_pages`). ✓
- sha256/size_bytes sync → Task 2 Step 4 + `test_write_back_updates_work_files_hash_and_size`. ✓
- Traversal guard → Task 2 Step 4 + `test_write_back_rejects_path_outside_library`. ✓
- Export and write-back ComicInfo consistency → Task 2 `test_write_back_matches_export_comicinfo_fields`. ✓
- API write_back flag + failure isolation → Task 3. ✓
- Frontend checkbox default-off + risk hint + confirm + feedback → Task 4. ✓
- Documentation decisions update → Task 5. ✓

**2. Placeholder scan:** No TBD/TODO; every code-changing step carries full code. Task 4 Step 5's wording about passing props through GovernancePage ("if the local variable name differs, use the corresponding hook return value") is a genuine wiring instruction, not a placeholder — that file's render structure is not expanded line-by-line here, so the implementer wires it in place. ✓

**3. Type consistency:** `write_back_comicinfo` returns `{written, fields, new_sha256, new_size_bytes}` — defined in Task 2, passed through by `apply` in Task 3, and matched by the frontend type `write_back?: {written?, fields?, new_size_bytes?, error?}` in Task 4 (the frontend reads only `written`/`error`, an optional subset — consistent). `GovernanceService.__init__(db, dictionary_service=None, settings=None)` is defined in Task 2 and called positionally as `GovernanceService(db, dictionary, settings)` in main.py (Task 3) — argument order matches. ✓
