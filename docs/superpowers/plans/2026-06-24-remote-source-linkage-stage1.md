# 远端来源关联 · 阶段一（身份入文件 + 扫描库）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给导出/回写的 ComicInfo 注入 `Web`（nhentai 来源 URL）让文件自描述，并新增「扫描库」把库目录里数据库未索引的 CBZ 识别入库（带 `Web` 的认远端、无的入库为待刮削本地作品），跑成任务中心后台任务。

**Architecture:** 沿用现有分层：`comicinfo.py`（纯函数，导出与治理回写共用）注入 `Web`；新增只读 `LibraryScanService`（扫描预览）+ 后台 `library_scan` 任务（仿 `ExportJobService` 的 daemon 线程 + `JobService`，专属字段塞 `target_json`，不改表结构）；复用 `ArchiveService.ingest_cbz`（`remote_gallery_id=None` 时 SQLite 多 NULL 不冲突，直接插本地作品行）。前端在文件管理页加扫描入口，任务中心复用 bulk_export 行渲染范式。

**Tech Stack:** Python 3 / FastAPI / SQLite（stdlib `zipfile`/`xml.etree`，无新依赖）；TypeScript / React (Vite)。

## Global Constraints

- 源 CBZ 只读；唯一改写是治理 ComicInfo 原子回写（现多注入 `Web`），回写后同步 `work_files.sha256`/`size_bytes`。
- 不改 `jobs` / `job_logs` 表结构；`library_scan` 专属字段全部塞 `target_json`。
- 受管目录（library/covers/tmp/exports）之外路径一律拒绝（目录穿越防护）。
- 扫描**只新增**，不删/不改已索引作品；删除/漂移仍归文件管理。
- 全站显示 tag 走词典 `display`；英文原文只用于 NH API。
- XML 安全：`gallery_id_from_xml` 解析的是未必可信的 CBZ 内嵌 ComicInfo。沿用现有 `governance_service.py:478` 的 stdlib `ElementTree.fromstring`（保持一致、非新增暴露面），但 stdlib 解析器对 billion-laughs/外部实体有已知弱点。决策：本地单用户、文件为用户自有或来自 nhentai，威胁模型低 → 阶段一保留 stdlib；若后续要硬化，应**同时**把本服务与 governance 的解析切到 `defusedxml.ElementTree`（用户对加依赖开放），作为独立小任务，不在本计划内。
- 后端测试：`PYTHONPATH=backend .venv/bin/pytest backend/tests -q`（在 `/opt/nhentai` 跑）。
- 前端构建：`cd /opt/nhentai/frontend && npm run build`。
- 提交信息结尾两行：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 与 `Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir`。

---

### Task 1: ComicInfo `Web` 字段（写入 + 解析往返）

**Files:**
- Modify: `backend/app/services/comicinfo.py`（`COMICINFO_KEYS` 顺序、`build_fields`、`to_xml`，新增 `gallery_id_from_xml`）
- Test: `backend/tests/test_comicinfo.py`（新建）

**Interfaces:**
- Consumes: `aggregate["work"]["remote_gallery_id"]`（已存在，`_work_summary` 输出含此键）。
- Produces:
  - `build_fields(aggregate)`：当 `aggregate["work"].get("remote_gallery_id")` 为真，结果 dict 多一项 `"Web": "https://nhentai.net/g/{id}/"`。
  - `to_xml(fields)`：输出含 `<Web>` 元素（排在 ComicInfo 字段之后）。
  - `gallery_id_from_xml(xml_text: str) -> int | None`：从 ComicInfo XML 文本的 `<Web>` 解析出 nhentai gallery id；无/不可解析返回 `None`。

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_comicinfo.py
from app.services import comicinfo


def _aggregate(remote_gallery_id):
    return {
        "work": {"page_count": 3, "remote_gallery_id": remote_gallery_id},
        "metadata": {"fields": [{"field": "title", "working_value": "T", "current_value": None, "source_value": None}]},
        "tags": {"groups": []},
    }


def test_build_fields_injects_web_for_remote_work():
    fields = comicinfo.build_fields(_aggregate(177013))
    assert fields["Web"] == "https://nhentai.net/g/177013/"


def test_build_fields_omits_web_for_local_work():
    fields = comicinfo.build_fields(_aggregate(None))
    assert "Web" not in fields


def test_web_round_trips_through_xml():
    xml = comicinfo.to_xml(comicinfo.build_fields(_aggregate(177013)))
    assert "<Web>https://nhentai.net/g/177013/</Web>" in xml
    assert comicinfo.gallery_id_from_xml(xml) == 177013


def test_gallery_id_from_xml_returns_none_without_web():
    xml = comicinfo.to_xml({"Title": "T"})
    assert comicinfo.gallery_id_from_xml(xml) is None
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_comicinfo.py -q`
Expected: FAIL（`Web` 未注入 / `gallery_id_from_xml` 不存在）。

- [ ] **Step 3: 实现**

在 `comicinfo.py`：`COMICINFO_KEYS` 字典末尾**不**加 `Web`（它不是治理字段），改为在 `to_xml` 的输出顺序里追加 `Web`，并在 `build_fields` 末尾特判注入。

```python
import re  # 文件顶部已无 re，需新增

# build_fields(...) 末尾、`return comic_info` 之前插入：
    gallery_id = aggregate.get("work", {}).get("remote_gallery_id")
    if gallery_id:
        comic_info["Web"] = f"https://nhentai.net/g/{int(gallery_id)}/"
    return comic_info


# to_xml(...)：在按 COMICINFO_KEYS.values() 写完后，追加 Web
def to_xml(fields: dict[str, str]) -> str:
    root = ElementTree.Element("ComicInfo")
    for key in COMICINFO_KEYS.values():
        value = _stringify(fields.get(key))
        if value:
            child = ElementTree.SubElement(root, key)
            child.text = value
    web = _stringify(fields.get("Web"))
    if web:
        child = ElementTree.SubElement(root, "Web")
        child.text = web
    return ElementTree.tostring(root, encoding="unicode", short_empty_elements=False)


# 新增解析器：
def gallery_id_from_xml(xml_text: str) -> int | None:
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return None
    web = root.findtext("Web")
    if not web:
        return None
    match = re.search(r"nhentai\.net/g/(\d+)", web)
    return int(match.group(1)) if match else None
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_comicinfo.py -q`
Expected: PASS（4 passed）。

- [ ] **Step 5: 回归既有导出/治理测试**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_export_service.py backend/tests/test_governance_service.py -q`
Expected: PASS（导出/回写现会多写 `<Web>`，已有断言不应检查 ComicInfo 字段全等；若有全等断言失败则更新该断言以包含 Web）。

- [ ] **Step 6: 提交**

```bash
cd /opt/nhentai && git add backend/app/services/comicinfo.py backend/tests/test_comicinfo.py && git commit -m "$(printf 'feat(comicinfo): ComicInfo 注入 nhentai 来源 Web 字段并支持解析\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir')"
```

---

### Task 2: `LibraryScanService` 扫描预览（只读）

**Files:**
- Create: `backend/app/services/library_scan_service.py`
- Test: `backend/tests/test_library_scan_service.py`（新建）

**Interfaces:**
- Consumes: `Settings`（`library_dir`）、`Database`、`comicinfo.gallery_id_from_xml`（Task 1）。
- Produces:
  - `class LibraryScanService(settings: Settings, db: Database)`
  - `LibraryScanService.preview() -> dict`：返回
    `{"new_linked": [...], "new_local": [...], "already_known": [...], "unreadable": [...], "counts": {...}}`；每个明细项形如 `{"path": str, "gallery_id": int | None}`（`already_known`/`unreadable` 的 `gallery_id` 为 `None`）。
  - `LibraryScanService._read_gallery_id(cbz_path: Path) -> int | None`：从 CBZ 内 `ComicInfo.xml` 成员读 `Web` → gallery id；无 ComicInfo/无 Web 返回 `None`。
  - `LibraryScanService._indexed(self) -> tuple[set[str], set[str]]`：返回 `(已索引的归一化路径集合, 已索引 sha256 集合)`，来自 `work_files` kind=`source_cbz`。

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_library_scan_service.py
import hashlib
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.library_scan_service import LibraryScanService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, web_gallery_id=None) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        if web_gallery_id is not None:
            xml = comicinfo.to_xml({"Title": "T", "Web": f"https://nhentai.net/g/{web_gallery_id}/"})
            archive.writestr("ComicInfo.xml", xml)


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    settings.ensure_directories()
    db = Database(settings.database_path)
    archive = ArchiveService(settings, db)
    return settings, db, archive


def test_preview_classifies_linked_local_and_unreadable(tmp_path):
    settings, db, _ = _setup(tmp_path)
    _make_cbz(settings.library_dir / "linked.cbz", web_gallery_id=177013)
    _make_cbz(settings.library_dir / "local.cbz")
    (settings.library_dir / "broken.cbz").write_bytes(b"not a zip")

    preview = LibraryScanService(settings, db).preview()

    assert [p["gallery_id"] for p in preview["new_linked"]] == [177013]
    assert len(preview["new_local"]) == 1
    assert len(preview["unreadable"]) == 1
    assert preview["counts"]["new_linked"] == 1


def test_preview_skips_already_indexed(tmp_path):
    settings, db, archive = _setup(tmp_path)
    src = tmp_path / "seed.cbz"
    _make_cbz(src)
    archive.ingest_cbz(src, source="local", title="seed", remote_gallery_id=None, metadata={})

    preview = LibraryScanService(settings, db).preview()

    assert preview["new_local"] == []
    assert preview["new_linked"] == []
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_scan_service.py -q`
Expected: FAIL（`library_scan_service` 模块不存在）。

- [ ] **Step 3: 实现**

```python
# backend/app/services/library_scan_service.py
from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services import comicinfo


class LibraryScanService:
    """只读扫描库目录，找出未被数据库索引的 CBZ 并分类。绝不调 NH API。"""

    def __init__(self, settings: Settings, db: Database):
        self.settings = settings
        self.db = db

    def _indexed(self) -> tuple[set[str], set[str]]:
        rows = self.db.fetchall("SELECT path, sha256 FROM work_files WHERE kind = 'source_cbz'")
        paths = {str(Path(r["path"]).resolve()) for r in rows if r["path"]}
        digests = {r["sha256"] for r in rows if r["sha256"]}
        return paths, digests

    def _read_gallery_id(self, cbz_path: Path) -> int | None:
        try:
            with zipfile.ZipFile(cbz_path) as archive:
                member = next(
                    (n for n in archive.namelist() if Path(n).name.lower() == "comicinfo.xml"),
                    None,
                )
                if member is None:
                    return None
                xml = archive.read(member).decode("utf-8", errors="replace")
        except (zipfile.BadZipFile, OSError):
            return None
        return comicinfo.gallery_id_from_xml(xml)

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def preview(self) -> dict[str, Any]:
        indexed_paths, indexed_digests = self._indexed()
        new_linked: list[dict[str, Any]] = []
        new_local: list[dict[str, Any]] = []
        already_known: list[dict[str, Any]] = []
        unreadable: list[dict[str, Any]] = []

        for entry in sorted(self.settings.library_dir.glob("*.cbz")):
            resolved = str(entry.resolve())
            if resolved in indexed_paths:
                continue
            if not zipfile.is_zipfile(entry):
                unreadable.append({"path": resolved, "gallery_id": None})
                continue
            if self._sha256(entry) in indexed_digests:
                already_known.append({"path": resolved, "gallery_id": None})
                continue
            gallery_id = self._read_gallery_id(entry)
            if gallery_id is not None:
                new_linked.append({"path": resolved, "gallery_id": gallery_id})
            else:
                new_local.append({"path": resolved, "gallery_id": None})

        counts = {
            "new_linked": len(new_linked),
            "new_local": len(new_local),
            "already_known": len(already_known),
            "unreadable": len(unreadable),
        }
        return {
            "new_linked": new_linked,
            "new_local": new_local,
            "already_known": already_known,
            "unreadable": unreadable,
            "counts": counts,
        }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_scan_service.py -q`
Expected: PASS（2 passed）。

- [ ] **Step 5: 提交**

```bash
cd /opt/nhentai && git add backend/app/services/library_scan_service.py backend/tests/test_library_scan_service.py && git commit -m "$(printf 'feat(scan): LibraryScanService 扫描库目录未索引 CBZ 并分类\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir')"
```

---

### Task 3: `library_scan` 后台入库任务

**Files:**
- Create: `backend/app/services/library_scan_job_service.py`
- Test: `backend/tests/test_library_scan_job_service.py`（新建）

**Interfaces:**
- Consumes: `Settings`、`JobService`、`ArchiveService`、`LibraryScanService`（Task 2，用 `preview` 拿待入库列表）、`JobCancelled`。
- Produces:
  - `class LibraryScanJobService(settings, jobs, archive, scan)`
  - `enqueue_scan(paths: list[str]) -> dict`：`jobs.create("library_scan", target)`，`target = {"paths": [...], "total": N, "ingested": 0, "skipped": []}`，启动 worker，返回 job。
  - `run_scan(job_id: int) -> None`：逐路径 `jobs.checkpoint` → 读 gallery id（有则 `source="remote", remote_gallery_id=id`；无则 `source="local", remote_gallery_id=None`）→ `archive.ingest_cbz`，失败记 `skipped`，`jobs.update_progress`。完成 `jobs.complete(job_id, {"ingested": n, "skipped": [...]})`。`JobCancelled` → `jobs.mark_cancelled`。
  - `retry_job` / `resume_job` / `cancel_job`：与 `ExportJobService` 对称（`type == "library_scan"`）。

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_library_scan_job_service.py
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.job_service import JobService
from app.services.library_scan_service import LibraryScanService
from app.services.library_scan_job_service import LibraryScanJobService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, web_gallery_id=None) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        if web_gallery_id is not None:
            xml = comicinfo.to_xml({"Title": "T", "Web": f"https://nhentai.net/g/{web_gallery_id}/"})
            archive.writestr("ComicInfo.xml", xml)


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    settings.ensure_directories()
    db = Database(settings.database_path)
    archive = ArchiveService(settings, db)
    jobs = JobService(db)
    scan = LibraryScanService(settings, db)
    return settings, db, archive, jobs, scan


def test_run_scan_ingests_linked_and_local(tmp_path):
    settings, db, archive, jobs, scan = _setup(tmp_path)
    _make_cbz(settings.library_dir / "linked.cbz", web_gallery_id=177013)
    _make_cbz(settings.library_dir / "local.cbz")
    service = LibraryScanJobService(settings, jobs, archive, scan)

    preview = scan.preview()
    paths = [p["path"] for p in preview["new_linked"] + preview["new_local"]]
    job = service.enqueue_scan(paths)
    service._workers[job["id"]].join(timeout=10)

    done = jobs.get(job["id"])
    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 2
    linked = db.fetchone("SELECT remote_gallery_id FROM works WHERE remote_gallery_id = 177013")
    assert linked is not None
    local_count = db.fetchone("SELECT COUNT(*) AS c FROM works WHERE remote_gallery_id IS NULL")["c"]
    assert local_count == 1


def test_run_scan_skips_unreadable(tmp_path):
    settings, db, archive, jobs, scan = _setup(tmp_path)
    bad = settings.library_dir / "broken.cbz"
    bad.write_bytes(b"not a zip")
    service = LibraryScanJobService(settings, jobs, archive, scan)

    job = service.enqueue_scan([str(bad.resolve())])
    service._workers[job["id"]].join(timeout=10)

    done = jobs.get(job["id"])
    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 0
    assert len(done["target"]["skipped"]) == 1
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_scan_job_service.py -q`
Expected: FAIL（`library_scan_job_service` 模块不存在）。

- [ ] **Step 3: 实现**

```python
# backend/app/services/library_scan_job_service.py
from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from app.config import Settings
from app.services.archive_service import ArchiveService
from app.services.job_service import JobCancelled, JobService
from app.services.library_scan_service import LibraryScanService


class LibraryScanJobService:
    """后台逐文件入库（library_scan 任务）。仿 ExportJobService 线程模型。"""

    def __init__(self, settings: Settings, jobs: JobService, archive: ArchiveService, scan: LibraryScanService):
        self.settings = settings
        self.jobs = jobs
        self.archive = archive
        self.scan = scan
        self._worker_lock = threading.Lock()
        self._workers: dict[int, threading.Thread] = {}

    def enqueue_scan(self, paths: list[str]) -> dict[str, Any]:
        clean = [str(Path(p).resolve()) for p in paths if p]
        target = {"paths": clean, "total": len(clean), "ingested": 0, "skipped": []}
        job = self.jobs.create("library_scan", target)
        self._start_worker(job["id"])
        return job

    def retry_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "failed" or existing["type"] != "library_scan":
            raise ValueError("Only failed library scan jobs can be retried")
        job = self.jobs.retry(job_id)
        self._start_worker(job_id)
        return job

    def resume_job(self, job_id: int) -> dict[str, Any]:
        existing = self.jobs.get(job_id)
        if existing["status"] != "paused":
            return existing
        if existing["type"] != "library_scan":
            raise ValueError("Only paused library scan jobs can be resumed")
        job = self.jobs.resume(job_id)
        if not self._worker_alive(job_id):
            self._start_worker(job_id)
        return job

    def cancel_job(self, job_id: int) -> dict[str, Any]:
        job = self.jobs.cancel(job_id)
        if job["status"] == "cancelling" and not self._worker_alive(job_id):
            self.jobs.mark_cancelled(job_id)
            return self.jobs.get(job_id)
        return job

    def _worker_alive(self, job_id: int) -> bool:
        with self._worker_lock:
            thread = self._workers.get(job_id)
            return bool(thread and thread.is_alive())

    def _start_worker(self, job_id: int) -> None:
        thread = threading.Thread(target=self._run_worker, args=(job_id,), daemon=True)
        with self._worker_lock:
            self._workers[job_id] = thread
        thread.start()

    def _run_worker(self, job_id: int) -> None:
        try:
            self.run_scan(job_id)
        finally:
            with self._worker_lock:
                if self._workers.get(job_id) is threading.current_thread():
                    self._workers.pop(job_id, None)

    def run_scan(self, job_id: int) -> None:
        job = self.jobs.get(job_id)
        paths = [Path(p) for p in job["target"].get("paths", [])]
        total = len(paths)
        skipped: list[dict[str, Any]] = []
        ingested = 0
        try:
            self.jobs.mark_running(job_id, "ingesting", 0, total)
            for path in paths:
                self.jobs.checkpoint(job_id)
                try:
                    gallery_id = self.scan._read_gallery_id(path)
                    if gallery_id is not None:
                        self.archive.ingest_cbz(
                            path, source="remote", title=path.stem,
                            remote_gallery_id=gallery_id, metadata={"remote": "nhentai"},
                        )
                    else:
                        self.archive.ingest_cbz(
                            path, source="local", title=path.stem,
                            remote_gallery_id=None, metadata={},
                        )
                    ingested += 1
                except Exception as exc:  # noqa: BLE001 - 单文件失败不中断整批
                    skipped.append({"path": str(path), "reason": str(exc)})
                self.jobs.update_progress(job_id, "running", "ingesting", ingested + len(skipped), total)
            self.jobs.complete(job_id, {"ingested": ingested, "skipped": skipped})
        except JobCancelled:
            self.jobs.mark_cancelled(job_id)
```

> 注意：`ingest_cbz` 把文件**复制**进 `library_dir/{work_id}-...`。扫描入库的源文件本就在 `library_dir`，会产生一份带 work_id 前缀的规范化副本，原散落文件需在 Task 5 入库成功后清理（见该任务 cleanup 说明）。本任务只负责 DB 索引正确；副本清理在 Task 5 端点层做（保持本服务纯粹）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_scan_job_service.py -q`
Expected: PASS（2 passed）。

- [ ] **Step 5: 提交**

```bash
cd /opt/nhentai && git add backend/app/services/library_scan_job_service.py backend/tests/test_library_scan_job_service.py && git commit -m "$(printf 'feat(scan): library_scan 后台入库任务\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir')"
```

---

### Task 4: API 路由与服务装配

**Files:**
- Modify: `backend/app/main.py`（装配 `LibraryScanService` / `LibraryScanJobService`；新增两个路由；`_job_dispatch` 增 `library_scan` 分流）
- Test: `backend/tests/test_library_scan_api.py`（新建）

**Interfaces:**
- Consumes: Task 2/3 的服务；现有 `_job_dispatch(job_id)`（bulk_export/remote_import 分流，见 `main.py`）。
- Produces:
  - `POST /api/library/scan/preview` → `library_scan_service.preview()`。
  - `POST /api/library/scan`（body `{"paths": [str, ...]}`，省略则取 preview 的 new_linked+new_local 全部）→ `library_scan_jobs.enqueue_scan(paths)`，入库成功后删除 `library_dir` 下被规范化副本取代的原始散落文件。
  - `_job_dispatch`：`library_scan` → `library_scan_jobs`。

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_library_scan_api.py
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

from app import main


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def test_scan_preview_lists_new_local(tmp_path, monkeypatch):
    with zipfile.ZipFile(main.settings.library_dir / "fresh.cbz", "w") as archive:
        archive.writestr("001.png", _png())
    client = TestClient(main.app)
    resp = client.post("/api/library/scan/preview")
    assert resp.status_code == 200
    assert resp.json()["counts"]["new_local"] >= 1
    (main.settings.library_dir / "fresh.cbz").unlink(missing_ok=True)
```

> 说明：测试直接复用 `main` 进程装配的真实 `settings`（与现有 `test_jobs_api.py` 同范式）。若现有测试 fixture 用独立临时目录，按既有约定调整路径来源。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_scan_api.py -q`
Expected: FAIL（路由 404）。

- [ ] **Step 3: 实现**

在 `main.py` 服务装配区（`export_jobs = ExportJobService(...)` 附近）加：

```python
from app.services.library_scan_service import LibraryScanService
from app.services.library_scan_job_service import LibraryScanJobService

library_scan_service = LibraryScanService(settings, db)
library_scan_jobs = LibraryScanJobService(settings, library_scan_service.settings and settings, archive, library_scan_service)
```

> 修正：构造用 `LibraryScanJobService(settings, jobs, archive, library_scan_service)`，去掉上面误写的 `.settings and` 占位。最终一行为：
> `library_scan_jobs = LibraryScanJobService(settings, jobs, archive, library_scan_service)`

新增路由（放在导出 bulk-jobs 路由附近）：

```python
@app.post("/api/library/scan/preview")
def library_scan_preview():
    return library_scan_service.preview()


class LibraryScanRequest(BaseModel):
    paths: list[str] | None = None


@app.post("/api/library/scan")
def library_scan(payload: LibraryScanRequest):
    paths = payload.paths
    if paths is None:
        preview = library_scan_service.preview()
        paths = [p["path"] for p in preview["new_linked"] + preview["new_local"]]
    return library_scan_jobs.enqueue_scan(paths)
```

在 `_job_dispatch(job_id)` 内，bulk_export 分流旁加：

```python
    if job_type == "library_scan":
        return library_scan_jobs
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_scan_api.py -q`
Expected: PASS（1 passed）。

- [ ] **Step 5: 全量回归**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS（全绿，含新增用例）。

- [ ] **Step 6: 提交**

```bash
cd /opt/nhentai && git add backend/app/main.py backend/tests/test_library_scan_api.py && git commit -m "$(printf 'feat(scan): 扫描库预览/入队路由 + 任务类型分流\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir')"
```

---

### Task 5: 存量补写来源标识（可选治理批量动作）

**Files:**
- Modify: `backend/app/services/governance_service.py`（`bulk_apply` 支持 `backfill_source_web` 动作）
- Test: `backend/tests/test_governance_backfill_web.py`（新建）

**Interfaces:**
- Consumes: 现有 `GovernanceService.bulk_apply(work_ids, options)`、`write_back_comicinfo`、`comicinfo.gallery_id_from_xml`（Task 1，用于判断是否已含 Web）。
- Produces: `bulk_apply` 接受 `options["backfill_source_web"] == True`：对每个带 `remote_gallery_id` 且源 CBZ 的 ComicInfo 缺 `Web` 的作品，执行 ComicInfo 原子回写注入 Web（复用 `write_back_comicinfo`，回写后同步 sha256/size）。无 gallery id 或已含 Web 的作品跳过（记 `skipped`）。

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_governance_backfill_web.py
# 构造一个带 remote_gallery_id、源 CBZ 无 Web 的作品；bulk_apply backfill 后，
# 源 CBZ 的 ComicInfo 含 <Web>，work_files.sha256 已更新。
# （沿用 test_governance_service.py 的既有 fixture 构造作品与源 CBZ。）
```

> 实现期：照搬 `test_governance_service.py` 里构造作品 + 源 CBZ 的 fixture，新增一条断言：
> 调 `service.bulk_apply([work_id], {"backfill_source_web": True})` 后，
> 用 `comicinfo.gallery_id_from_xml` 读回源 CBZ 的 ComicInfo，应等于该作品 gallery id；
> 且 `work_files.sha256` 较回写前改变。再加一条：无 gallery id 的作品被记入 `skipped`。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_backfill_web.py -q`
Expected: FAIL（`backfill_source_web` 未处理）。

- [ ] **Step 3: 实现**

在 `GovernanceService.bulk_apply` 的动作分发里加分支（与 `fill_missing_metadata` / ComicInfo 回写同层）：

```python
        if options.get("backfill_source_web"):
            for work_id in work_ids:
                aggregate = self.aggregate(work_id)
                gallery_id = aggregate["work"].get("remote_gallery_id")
                if not gallery_id:
                    skipped.append({"work_id": work_id, "reason": "no_gallery_id"})
                    continue
                if self._comicinfo_has_web(work_id):  # 复用读取源 ComicInfo 的现有 helper
                    skipped.append({"work_id": work_id, "reason": "already_has_web"})
                    continue
                self.write_back_comicinfo(work_id)  # build_fields 现会注入 Web
```

> `_comicinfo_has_web`：复用 governance_service 既有读取源 ComicInfo 成员的逻辑（见 `~line 459/470` 的 ComicInfo 成员读取），解析 `Web` 是否存在（`comicinfo.gallery_id_from_xml(...) is not None`）。若无现成读取器则加一个私有读取器返回源 ComicInfo XML 文本。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_backfill_web.py -q`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
cd /opt/nhentai && git add backend/app/services/governance_service.py backend/tests/test_governance_backfill_web.py && git commit -m "$(printf 'feat(governance): 批量补写源 CBZ 的 ComicInfo Web 来源标识\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir')"
```

---

### Task 6: 前端扫描库入口 + 任务中心行

**Files:**
- Modify: `frontend/src/lib/api.ts`（`scanLibraryPreview()`、`enqueueLibraryScan(paths?)`；`Job["target"]`/`JobTarget` 补 `library_scan` 字段 `paths`/`ingested`/`skipped`）
- Modify: `frontend/src/components/files/FileHealthRail.tsx`（或 `FilesPage.tsx`）加「扫描库」入口与预览展示
- Modify: `frontend/src/components/tasks/taskHelpers.ts`（`library_scan` 标签/阶段/skipped 摘要）
- Modify: `frontend/src/components/tasks/TaskList.tsx` / `TaskInspector.tsx`（`library_scan` 行进度 + skipped 摘要，复用 bulk_export 范式）

**Interfaces:**
- Consumes: Task 4 的两个端点；现有 `api.ts` job 类型与任务中心组件。
- Produces: 文件管理页一个「扫描库」按钮 → 调 preview → 展示「新增 linked/local、已知、不可读」计数 → 「开始扫描」调 enqueue（无参=全部）→ 跳任务中心；任务中心 `library_scan` 行可见进度与跳过摘要。

- [ ] **Step 1: 加 api.ts 方法与类型**

```typescript
// frontend/src/lib/api.ts —— 仿现有 enqueueBulkExport 风格
export interface LibraryScanPreview {
  new_linked: { path: string; gallery_id: number }[];
  new_local: { path: string; gallery_id: number | null }[];
  already_known: { path: string }[];
  unreadable: { path: string }[];
  counts: { new_linked: number; new_local: number; already_known: number; unreadable: number };
}

export async function scanLibraryPreview(): Promise<LibraryScanPreview> {
  return request<LibraryScanPreview>("/api/library/scan/preview", { method: "POST" });
}

export async function enqueueLibraryScan(paths?: string[]): Promise<Job> {
  return request<Job>("/api/library/scan", {
    method: "POST",
    body: JSON.stringify({ paths: paths ?? null }),
  });
}
```

在 `JobTarget`（bulk_export 字段所在类型）补：`paths?: string[]; ingested?: number; skipped?: { path: string; reason: string }[];`

- [ ] **Step 2: 文件管理页加扫描入口**

在 `FileHealthRail`（清理工具区附近）加按钮：点击调 `scanLibraryPreview()`，把 `counts` 渲染成一行（「新增 X linked / Y local · 已知 Z · 不可读 W」），下方「开始扫描」按钮调 `enqueueLibraryScan()`（无参），成功后提示「已加入任务中心」并可跳 `#tasks`。沿用现有清理工具的预览→确认→刷新交互范式。

- [ ] **Step 3: 任务中心识别 library_scan**

在 `taskHelpers.ts`：`library_scan` 的中文标签（如「扫描库」）、阶段标签（`ingesting`→「入库中」）、`skipped` 摘要文案（「跳过 N 个（不可读/失败）」）。在 `TaskList`/`TaskInspector` 让 `library_scan` 行像 bulk_export 一样显示 `ingested/total` 进度与 skipped 明细（无下载按钮）。

- [ ] **Step 4: 构建**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS（`tsc -b && vite build` 零错误）。

- [ ] **Step 5: 提交**

```bash
cd /opt/nhentai && git add frontend/src && git commit -m "$(printf 'feat(scan): 文件管理页扫描库入口 + 任务中心 library_scan 行\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir')"
```

---

## Self-Review

**Spec 覆盖（阶段一范围）：**
- 〇 身份入文件（ComicInfo Web 写入）→ Task 1。存量可选补写 → Task 5。✓
- 一 扫描库（预览分类 + 后台入库 + 只新增 + 复用 ingest_cbz）→ Task 2/3/4。✓
- 路由（scan/preview、scan、job 分流）→ Task 4。✓
- 前端（文件管理扫描入口、任务中心行）→ Task 6。✓
- 二 刷新 tag / 三 刮削 → **阶段二、三另起 plan**，不在本计划。

**占位符扫描：** Task 5 的测试体留了「照搬既有 fixture」说明而非完整代码——因为它强依赖 `test_governance_service.py` 现有作品构造夹具，实现期需读取该文件复用；其余任务均含完整可运行代码。Task 4 Step 3 含一处「修正」行，最终装配语句已明确为 `LibraryScanJobService(settings, jobs, archive, library_scan_service)`。

**类型一致性：** `_read_gallery_id`（Task 2 定义，Task 3 复用）、`preview()` 返回结构（Task 2 定义，Task 4/6 消费）、`enqueue_scan(paths)`（Task 3 定义，Task 4 调用）、`gallery_id_from_xml`（Task 1 定义，Task 2/5 复用）签名一致。

**风险点（实现期注意）：**
- `ingest_cbz` 会把源文件复制成 `{work_id}-...` 规范名，扫描的源散落文件需在入库成功后清理——Task 4 端点层负责；务必确认删除路径在 `library_dir` 内（穿越防护）。
- Task 5 的 `_comicinfo_has_web` 若 governance 无现成源 ComicInfo 读取器，需新增私有读取器。
