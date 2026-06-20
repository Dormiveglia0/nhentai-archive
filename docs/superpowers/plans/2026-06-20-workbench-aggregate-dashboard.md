# Workbench Aggregate Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `#workbench` boundary screen with a real daily-entry dashboard that aggregates existing real module summaries (library, governance, jobs, files, exports) behind one read-only endpoint.

**Architecture:** A new `WorkbenchService` composes the existing service singletons via constructor injection and exposes a single `overview()` aggregate. One FastAPI route `GET /api/workbench/overview` returns it. The frontend renders a metric strip + two reused cover shelves + four module summary cards, all from that one payload.

**Tech Stack:** Python 3 / FastAPI / SQLite (backend); React + TypeScript + Vite (frontend). Tests: `pytest` (backend), `npm run build` / `tsc` (frontend gate).

## Global Constraints

- No fabricated data: aggregate only real module outputs; any zero is a real zero rendered as a real zero/empty state. (DEVELOPMENT_RULES)
- No NH API calls anywhere in this module — all data is local SQLite/disk.
- No synthesized collection health score; show only raw real metrics.
- Sensitive values (API keys) are never surfaced.
- Backend tests run with: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` from `/opt/nhentai`.
- Frontend build gate: `cd frontend && npm run build`.
- Commit message trailers required on every commit:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
  ```
- UI tags always show dictionary `display`; English only for backend/NH API (not directly relevant here, but no raw English tag names rendered).

---

## File Structure

- `backend/app/services/workbench_service.py` (Create) — `WorkbenchService.overview()` aggregator. Owns no data source; composes injected services.
- `backend/app/main.py` (Modify) — construct `workbench` singleton + add `GET /api/workbench/overview`.
- `backend/tests/test_workbench_service.py` (Create) — unit tests for the aggregator over a real temp DB.
- `backend/tests/test_workbench_api.py` (Create) — route test with a stub service.
- `frontend/src/lib/api.ts` (Modify) — `WorkbenchOverview` type + `workbenchOverview()` method.
- `frontend/src/components/workbench/WorkbenchPage.tsx` (Create) — thin container.
- `frontend/src/components/workbench/useWorkbenchState.ts` (Create) — fetch/loading/error/refresh hook.
- `frontend/src/components/workbench/WorkbenchMetricStrip.tsx` (Create) — top real-number strip.
- `frontend/src/components/workbench/WorkbenchModuleCards.tsx` (Create) — four jump cards.
- `frontend/src/components/workbench/workbenchHelpers.ts` (Create) — `formatBytes` re-export/util.
- `frontend/src/App.tsx` (Modify) — render `WorkbenchPage` for `#workbench`.
- `frontend/src/styles/app.css` (Modify) — `.workbench-*` styles.
- `frontend/src/components/library/ContinueReadingRow.tsx` (Reuse, no change) — used for both shelves.
- `docs/PROJECT_STATUS.md`, `docs/PROJECT_MAP.md` (Modify) — record the new module/API.

---

## Task 1: WorkbenchService aggregator (backend)

**Files:**
- Create: `backend/app/services/workbench_service.py`
- Test: `backend/tests/test_workbench_service.py`

**Interfaces:**
- Consumes (existing, already constructed in `main.py`):
  - `LibraryService.summary() -> dict` with keys `total, reading, completed, unread, untagged, total_pages, total_size_bytes, sources, languages`.
  - `LibraryService.continue_reading(limit=12) -> {"result": list[work]}`
  - `LibraryService.recent_added(limit=12) -> {"result": list[work]}`
  - `GovernanceService.queue() -> {"result": [...], "summary": {total, missing_metadata, untagged, dictionary_review, dictionary_conflict, missing_comicinfo, missing_cover}}`
  - `FileMaintenanceService.overview() -> {work_count, source_bytes, cover_ok, missing_source, missing_cover, orphan_count, orphan_bytes, stale_count, stale_bytes, reclaimable_bytes}`
  - `ExportService.summary() -> {total, ready, blocked, warnings}`
  - `JobService.list() -> list[job]` where each job has `id, type, status, stage, progress, target, meta, error, retry_after, created_at, updated_at`.
- Produces:
  - `WorkbenchService(library, governance, jobs, files, exports)`
  - `WorkbenchService.overview() -> dict` with the exact shape asserted in the tests below.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_workbench_service.py`:

```python
import io
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_service import ExportService
from app.services.file_service import FileMaintenanceService
from app.services.governance_service import GovernanceService
from app.services.dictionary_service import DictionaryService
from app.services.job_service import JobService
from app.services.library_service import LibraryService
from app.services.reader_service import ReaderService
from app.services.workbench_service import WorkbenchService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, pages: int = 3) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for index in range(1, pages + 1):
            archive.writestr(f"{index:03d}.png", _png())


def _build(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    library = LibraryService(db)
    dictionary = DictionaryService(db, client=None)
    governance = GovernanceService(db, dictionary)
    jobs = JobService(db)
    files = FileMaintenanceService(db, settings)
    exports = ExportService(db, settings)
    reader = ReaderService(db)
    workbench = WorkbenchService(library, governance, jobs, files, exports)
    return settings, db, archive, reader, jobs, workbench


def _import_work(archive, tmp_path, name, title, source, gallery_id, pages=3):
    cbz = tmp_path / f"{name}.cbz"
    _make_cbz(cbz, pages)
    return archive.ingest_cbz(cbz, source, title, gallery_id, {"remote": "nhentai" if source == "remote" else None})


def test_overview_empty_db_is_all_real_zeros(tmp_path):
    _, _, _, _, _, workbench = _build(tmp_path)

    data = workbench.overview()

    assert data["library"]["total"] == 0
    assert data["governance"]["total"] == 0
    assert data["files"]["work_count"] == 0
    assert data["exports"]["total"] == 0
    assert data["jobs"] == {
        "running": 0,
        "queued": 0,
        "paused": 0,
        "failed": 0,
        "completed": 0,
        "failed_recent": [],
    }
    assert data["continue_reading"] == []
    assert data["recent_added"] == []


def test_overview_reflects_real_works_jobs_and_progress(tmp_path):
    settings, db, archive, reader, jobs, workbench = _build(tmp_path)
    work_id = _import_work(archive, tmp_path, "w1", "Rainy Day", "remote", 100001, pages=4)
    reader.update_state(work_id, page_index=2, completed=False)

    failed = jobs.create("remote_import", {"gallery_id": 100001})
    jobs.fail(failed["id"], "remote limited", retry_after=60)
    done = jobs.create("remote_import", {"gallery_id": 100002})
    jobs.complete(done["id"])

    data = workbench.overview()

    assert data["library"]["total"] == 1
    assert data["library"]["reading"] == 1
    assert data["jobs"]["failed"] == 1
    assert data["jobs"]["completed"] == 1
    assert len(data["jobs"]["failed_recent"]) == 1
    recent_fail = data["jobs"]["failed_recent"][0]
    assert recent_fail["id"] == failed["id"]
    assert recent_fail["error"] == "remote limited"
    assert recent_fail["target"] == {"gallery_id": 100001}
    assert [w["id"] for w in data["continue_reading"]] == [work_id]
    assert work_id in [w["id"] for w in data["recent_added"]]


def test_overview_caps_failed_recent_at_five(tmp_path):
    _, _, _, _, jobs, workbench = _build(tmp_path)
    for i in range(7):
        job = jobs.create("remote_import", {"gallery_id": 200000 + i})
        jobs.fail(job["id"], f"boom {i}")

    data = workbench.overview()

    assert data["jobs"]["failed"] == 7
    assert len(data["jobs"]["failed_recent"]) == 5
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_workbench_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.workbench_service'`.

> Note: if `DictionaryService(db, client=None)` raises in `__init__`, change that line to `DictionaryService(db, None)` to match its positional signature; the dictionary instance is only needed to construct `GovernanceService` and is not exercised by these tests.

- [ ] **Step 3: Implement `WorkbenchService`**

Create `backend/app/services/workbench_service.py`:

```python
from __future__ import annotations

from typing import Any

_JOB_STATUSES = ("running", "queued", "paused", "failed", "completed")
_FAILED_RECENT_LIMIT = 5
_SHELF_LIMIT = 8


class WorkbenchService:
    """Read-only aggregator over existing module services. No new data source,
    no remote calls. Every value is a projection of a real module summary."""

    def __init__(self, library, governance, jobs, files, exports) -> None:
        self.library = library
        self.governance = governance
        self.jobs = jobs
        self.files = files
        self.exports = exports

    def overview(self) -> dict[str, Any]:
        lib = self.library.summary()
        gov = self.governance.queue()["summary"]
        files = self.files.overview()
        exports = self.exports.summary()
        return {
            "library": {
                "total": lib["total"],
                "reading": lib["reading"],
                "completed": lib["completed"],
                "unread": lib["unread"],
                "untagged": lib["untagged"],
                "total_pages": lib["total_pages"],
                "total_size_bytes": lib["total_size_bytes"],
            },
            "governance": {
                "total": gov["total"],
                "missing_metadata": gov["missing_metadata"],
                "untagged": gov["untagged"],
                "dictionary_review": gov["dictionary_review"],
                "dictionary_conflict": gov["dictionary_conflict"],
                "missing_comicinfo": gov["missing_comicinfo"],
                "missing_cover": gov["missing_cover"],
            },
            "files": {
                "work_count": files["work_count"],
                "source_bytes": files["source_bytes"],
                "cover_ok": files["cover_ok"],
                "missing_source": files["missing_source"],
                "missing_cover": files["missing_cover"],
                "orphan_count": files["orphan_count"],
                "stale_count": files["stale_count"],
                "reclaimable_bytes": files["reclaimable_bytes"],
            },
            "exports": {
                "total": exports["total"],
                "ready": exports["ready"],
                "blocked": exports["blocked"],
                "warnings": exports["warnings"],
            },
            "jobs": self._jobs_summary(),
            "continue_reading": self.library.continue_reading(limit=_SHELF_LIMIT)["result"],
            "recent_added": self.library.recent_added(limit=_SHELF_LIMIT)["result"],
        }

    def _jobs_summary(self) -> dict[str, Any]:
        jobs = self.jobs.list()
        counts = {status: 0 for status in _JOB_STATUSES}
        for job in jobs:
            status = job["status"]
            if status in counts:
                counts[status] += 1
        failed_recent = [
            {
                "id": job["id"],
                "type": job["type"],
                "target": job["target"],
                "error": job["error"],
                "updated_at": job["updated_at"],
            }
            for job in jobs
            if job["status"] == "failed"
        ][:_FAILED_RECENT_LIMIT]
        return {**counts, "failed_recent": failed_recent}
```

> `JobService.list()` already returns rows ordered by `updated_at DESC`, so the failed slice is newest-first without extra sorting.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_workbench_service.py -q`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /opt/nhentai
git add backend/app/services/workbench_service.py backend/tests/test_workbench_service.py
git commit -m "$(cat <<'EOF'
feat(workbench): WorkbenchService 聚合真实 library/governance/jobs/files/exports 摘要

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 2: Wire `GET /api/workbench/overview` (backend)

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_workbench_api.py`

**Interfaces:**
- Consumes: `WorkbenchService` from Task 1; module-level singletons `library, governance, jobs, files_service, exports` already constructed in `main.py` (lines ~104–112).
- Produces: route `GET /api/workbench/overview` returning `workbench.overview()`; module attribute `main.workbench` (a `WorkbenchService`) for test monkeypatching.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_workbench_api.py`:

```python
from fastapi.testclient import TestClient

from app import main


class StubWorkbench:
    def overview(self):
        return {
            "library": {
                "total": 2, "reading": 1, "completed": 0, "unread": 1,
                "untagged": 1, "total_pages": 40, "total_size_bytes": 1024,
            },
            "governance": {
                "total": 1, "missing_metadata": 1, "untagged": 1,
                "dictionary_review": 0, "dictionary_conflict": 0,
                "missing_comicinfo": 1, "missing_cover": 0,
            },
            "files": {
                "work_count": 2, "source_bytes": 1024, "cover_ok": 2,
                "missing_source": 0, "missing_cover": 0,
                "orphan_count": 0, "stale_count": 0, "reclaimable_bytes": 0,
            },
            "exports": {"total": 2, "ready": 1, "blocked": 1, "warnings": 0},
            "jobs": {
                "running": 0, "queued": 0, "paused": 0, "failed": 1, "completed": 1,
                "failed_recent": [
                    {"id": 5, "type": "remote_import", "target": {"gallery_id": 123},
                     "error": "remote limited", "updated_at": "2026-06-20 09:00:00"}
                ],
            },
            "continue_reading": [],
            "recent_added": [],
        }


def test_workbench_overview_route_returns_aggregate(monkeypatch):
    monkeypatch.setattr(main, "workbench", StubWorkbench())
    client = TestClient(main.app)

    body = client.get("/api/workbench/overview").json()

    assert body["library"]["total"] == 2
    assert body["jobs"]["failed"] == 1
    assert body["jobs"]["failed_recent"][0]["id"] == 5
    assert body["exports"]["ready"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_workbench_api.py -q`
Expected: FAIL — `AttributeError: module 'app.main' has no attribute 'workbench'` (or 404 on the route).

- [ ] **Step 3: Add the import, singleton, and route**

In `backend/app/main.py`, add the import near the other service imports:

```python
from app.services.workbench_service import WorkbenchService
```

After the existing singleton block (right after `settings_service = SettingsService(...)`, around line 114), add:

```python
workbench = WorkbenchService(library, governance, jobs, files_service, exports)
```

Add the route (place it alongside the other read-only GET routes, e.g. near the `/api/files/overview` route):

```python
@app.get("/api/workbench/overview")
def workbench_overview():
    return workbench.overview()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests/test_workbench_api.py -q`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full backend suite**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS (all prior tests + 4 new).

- [ ] **Step 6: Commit**

```bash
cd /opt/nhentai
git add backend/app/main.py backend/tests/test_workbench_api.py
git commit -m "$(cat <<'EOF'
feat(workbench): 新增 GET /api/workbench/overview 路由

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 3: Frontend workbench page

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/workbench/workbenchHelpers.ts`
- Create: `frontend/src/components/workbench/useWorkbenchState.ts`
- Create: `frontend/src/components/workbench/WorkbenchMetricStrip.tsx`
- Create: `frontend/src/components/workbench/WorkbenchModuleCards.tsx`
- Create: `frontend/src/components/workbench/WorkbenchPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/app.css`
- Reuse (no change): `frontend/src/components/library/ContinueReadingRow.tsx`

**Interfaces:**
- Consumes: `GET /api/workbench/overview` (Task 2); existing `LibraryWork` type, `request()` wrapper, `navigate()`, and `ContinueReadingRow`.
- Produces: `WorkbenchOverview` type + `api.workbenchOverview()`; `<WorkbenchPage blurCovers={boolean} />`.

- [ ] **Step 1: Add the API type and method**

In `frontend/src/lib/api.ts`, after the `Job`/`JobLog` types (around line 500), add:

```ts
export type WorkbenchFailedJob = {
  id: number;
  type: string;
  target: Record<string, unknown>;
  error?: string | null;
  updated_at: string;
};

export type WorkbenchOverview = {
  library: {
    total: number;
    reading: number;
    completed: number;
    unread: number;
    untagged: number;
    total_pages: number;
    total_size_bytes: number;
  };
  governance: {
    total: number;
    missing_metadata: number;
    untagged: number;
    dictionary_review: number;
    dictionary_conflict: number;
    missing_comicinfo: number;
    missing_cover: number;
  };
  files: {
    work_count: number;
    source_bytes: number;
    cover_ok: number;
    missing_source: number;
    missing_cover: number;
    orphan_count: number;
    stale_count: number;
    reclaimable_bytes: number;
  };
  exports: { total: number; ready: number; blocked: number; warnings: number };
  jobs: {
    running: number;
    queued: number;
    paused: number;
    failed: number;
    completed: number;
    failed_recent: WorkbenchFailedJob[];
  };
  continue_reading: LibraryWork[];
  recent_added: LibraryWork[];
};
```

Then add the method inside the exported `api` object (next to `librarySummary`, around line 720):

```ts
  workbenchOverview: () => request<WorkbenchOverview>("/api/workbench/overview"),
```

- [ ] **Step 2: Add the helpers**

Create `frontend/src/components/workbench/workbenchHelpers.ts`:

```ts
export { formatBytes } from "../library/libraryHelpers";

export function targetLabel(target: Record<string, unknown>): string {
  const galleryId = target.gallery_id;
  if (typeof galleryId === "number" || typeof galleryId === "string") {
    return `Gallery ID ${galleryId}`;
  }
  const workId = target.work_id;
  if (typeof workId === "number" || typeof workId === "string") {
    return `Work ${workId}`;
  }
  return "任务";
}
```

- [ ] **Step 3: Add the data hook**

Create `frontend/src/components/workbench/useWorkbenchState.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

import { api, WorkbenchOverview } from "../../lib/api";

export function useWorkbenchState() {
  const [overview, setOverview] = useState<WorkbenchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.workbenchOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载工作台数据");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refresh = useCallback(() => load("refresh"), [load]);

  return { overview, loading, refreshing, error, refresh };
}
```

- [ ] **Step 4: Add the metric strip**

Create `frontend/src/components/workbench/WorkbenchMetricStrip.tsx`:

```tsx
import { AlertTriangle, BookMarked, ClipboardList, HardDrive } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";

export function WorkbenchMetricStrip({ overview }: { overview: WorkbenchOverview }) {
  const metrics = [
    { label: "馆藏作品", value: overview.library.total, icon: BookMarked, tone: "muted" },
    { label: "待治理", value: overview.governance.total, icon: ClipboardList, tone: overview.governance.total > 0 ? "warn" : "ok" },
    { label: "失败任务", value: overview.jobs.failed, icon: AlertTriangle, tone: overview.jobs.failed > 0 ? "bad" : "ok" },
    { label: "缺失源文件", value: overview.files.missing_source, icon: HardDrive, tone: overview.files.missing_source > 0 ? "bad" : "ok" },
  ];

  return (
    <div className="workbench-summary">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div className={`workbench-summary-metric tone-${metric.tone}`} key={metric.label}>
            <span className="workbench-summary-icon">
              <Icon size={18} />
            </span>
            <div>
              <strong>{metric.value.toLocaleString("zh-CN")}</strong>
              <span>{metric.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Add the module cards**

Create `frontend/src/components/workbench/WorkbenchModuleCards.tsx`:

```tsx
import { ArrowRight, ClipboardList, Download, FolderCog, ListChecks } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { formatBytes, targetLabel } from "./workbenchHelpers";

export function WorkbenchModuleCards({ overview }: { overview: WorkbenchOverview }) {
  const { governance, jobs, files, exports } = overview;
  return (
    <div className="workbench-cards">
      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><ClipboardList size={18} /></span>
          <h3>治理</h3>
          <strong>{governance.total}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>缺失元数据</dt><dd>{governance.missing_metadata}</dd></div>
          <div><dt>未打标签</dt><dd>{governance.untagged}</dd></div>
          <div><dt>词典待复核</dt><dd>{governance.dictionary_review}</dd></div>
        </dl>
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "governance" })}>
          进入治理 <ArrowRight size={14} />
        </button>
      </section>

      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><ListChecks size={18} /></span>
          <h3>任务</h3>
          <strong>{jobs.failed}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>正在运行</dt><dd>{jobs.running}</dd></div>
          <div><dt>等待中</dt><dd>{jobs.queued}</dd></div>
          <div><dt>失败</dt><dd>{jobs.failed}</dd></div>
        </dl>
        {jobs.failed_recent.length > 0 ? (
          <ul className="workbench-fail-list">
            {jobs.failed_recent.map((job) => (
              <li key={job.id}>
                <strong>{targetLabel(job.target)}</strong>
                <small>{job.error ?? "失败"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="workbench-card-empty">无失败任务。</p>
        )}
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "tasks" })}>
          打开任务中心 <ArrowRight size={14} />
        </button>
      </section>

      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><FolderCog size={18} /></span>
          <h3>文件</h3>
          <strong>{files.work_count}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>缺失源</dt><dd>{files.missing_source}</dd></div>
          <div><dt>孤立 / 残留</dt><dd>{files.orphan_count + files.stale_count}</dd></div>
          <div><dt>可回收</dt><dd>{formatBytes(files.reclaimable_bytes)}</dd></div>
        </dl>
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "files" })}>
          打开文件管理 <ArrowRight size={14} />
        </button>
      </section>

      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><Download size={18} /></span>
          <h3>导出</h3>
          <strong>{exports.ready}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>可导出</dt><dd>{exports.ready}</dd></div>
          <div><dt>受阻</dt><dd>{exports.blocked}</dd></div>
          <div><dt>有警告</dt><dd>{exports.warnings}</dd></div>
        </dl>
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "export" })}>
          打开导出中心 <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Add the page container**

Create `frontend/src/components/workbench/WorkbenchPage.tsx`:

```tsx
import { RefreshCw } from "lucide-react";

import { ContinueReadingRow } from "../library/ContinueReadingRow";
import { WorkbenchMetricStrip } from "./WorkbenchMetricStrip";
import { WorkbenchModuleCards } from "./WorkbenchModuleCards";
import { useWorkbenchState } from "./useWorkbenchState";

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const { overview, loading, refreshing, error, refresh } = useWorkbenchState();

  return (
    <section className="page workbench-page">
      <div className="hero">
        <div>
          <h1>工作台</h1>
          <p>聚合真实馆藏、治理、任务、文件与导出状态，作为每日入口。</p>
        </div>
        <button className="workbench-refresh" type="button" onClick={() => void refresh()} disabled={refreshing || loading}>
          <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
          刷新
        </button>
      </div>

      {error ? <div className="workbench-error">{error}</div> : null}

      {loading && !overview ? (
        <div className="workbench-empty">正在加载工作台数据...</div>
      ) : overview ? (
        <>
          <WorkbenchMetricStrip overview={overview} />
          <ContinueReadingRow title="继续阅读" works={overview.continue_reading} blurCovers={blurCovers} />
          <ContinueReadingRow title="最近导入" works={overview.recent_added} blurCovers={blurCovers} />
          <WorkbenchModuleCards overview={overview} />
        </>
      ) : (
        <div className="workbench-empty">暂无工作台数据。</div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Wire the route in `App.tsx`**

In `frontend/src/App.tsx`, add the import near the other page imports:

```tsx
import { WorkbenchPage } from "./components/workbench/WorkbenchPage";
```

Replace the workbench `BoundaryPage` branch:

```tsx
      {page.name === "workbench" ? (
        <BoundaryPage
          title="工作台"
          description="工作台聚合馆藏、任务、治理与文件健康状态；当前阶段未接入真实聚合数据。"
        />
      ) : null}
```

with:

```tsx
      {page.name === "workbench" ? <WorkbenchPage blurCovers={blurCovers} /> : null}
```

> The `BoundaryPage` component stays defined in `App.tsx` (still unused by other branches is fine — but it is no longer referenced anywhere). If `tsc` flags `BoundaryPage` as unused, delete the `BoundaryPage` function definition at the bottom of `App.tsx`.

- [ ] **Step 8: Add styles**

In `frontend/src/styles/app.css`, append this block at the end of the file:

```css
/* Workbench */
.workbench-page .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.workbench-refresh {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface-solid); color: var(--ink); cursor: pointer;
}
.workbench-refresh:disabled { opacity: 0.5; cursor: default; }
.workbench-error { padding: 12px 16px; border: 1px solid var(--bad); border-radius: 10px; color: var(--bad); margin-bottom: 16px; }
.workbench-empty { padding: 40px; text-align: center; color: var(--ink-soft); }

.workbench-summary {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;
}
.workbench-summary-metric {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
}
.workbench-summary-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 50%;
  border: 1.5px solid var(--tone-accent, var(--line)); color: var(--tone-accent, var(--ink));
}
.workbench-summary-metric strong { display: block; font-size: 24px; line-height: 1.1; }
.workbench-summary-metric span { color: var(--ink-soft); font-size: 13px; }
.workbench-summary-metric.tone-ok { --tone-accent: var(--ok, #3a7d44); }
.workbench-summary-metric.tone-warn { --tone-accent: var(--warn, #b8860b); }
.workbench-summary-metric.tone-bad { --tone-accent: var(--bad, #b3261e); }
.workbench-summary-metric.tone-muted { --tone-accent: var(--ink-soft); }

.workbench-cards {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px;
}
.workbench-card {
  display: flex; flex-direction: column; gap: 12px;
  padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface);
}
.workbench-card header { display: flex; align-items: center; gap: 10px; }
.workbench-card header h3 { margin: 0; font-size: 16px; flex: 1; }
.workbench-card header strong { font-size: 22px; }
.workbench-card-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); color: var(--ink-soft);
}
.workbench-card-stats { display: flex; gap: 18px; margin: 0; }
.workbench-card-stats div { display: flex; flex-direction: column; gap: 2px; }
.workbench-card-stats dt { color: var(--ink-soft); font-size: 12px; }
.workbench-card-stats dd { margin: 0; font-size: 18px; font-weight: 600; }
.workbench-fail-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.workbench-fail-list li { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; }
.workbench-fail-list strong { font-size: 13px; }
.workbench-fail-list small { color: var(--bad); font-size: 12px; }
.workbench-card-empty { color: var(--ink-soft); font-size: 13px; margin: 0; }
.workbench-card-go {
  align-self: flex-start; margin-top: auto;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: none; border-radius: 8px;
  background: var(--accent); color: #fff; cursor: pointer; font-size: 13px;
}
@media (max-width: 860px) {
  .workbench-summary { grid-template-columns: repeat(2, 1fr); }
  .workbench-cards { grid-template-columns: 1fr; }
}
```

> These reuse existing design tokens (`--line`, `--surface`, `--surface-solid`, `--ink`, `--ink-soft`, `--accent`, `--ok`, `--warn`, `--bad`). The `var(..., fallback)` forms guarantee a sane color even if a token name differs. If `--accent` is not the terracotta token in this codebase, change `.workbench-card-go` background to the project's primary-action variable (grep `app.css` for the terracotta primary used by `.tasks-refresh`/primary buttons).

- [ ] **Step 9: Build to verify the frontend compiles**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS (`tsc -b && vite build` with no type errors).

> If `tsc` reports `BoundaryPage` is declared but never used, delete the `BoundaryPage` function at the bottom of `App.tsx` and rebuild.

- [ ] **Step 10: Static fake-data scan**

Run: `cd /opt/nhentai && grep -rniE "mock|sample|random|placeholder|faker|lorem" backend/app/services/workbench_service.py frontend/src/components/workbench/ frontend/src/lib/api.ts | grep -vi "WorkbenchOverview\|workbenchOverview"`
Expected: no real hits (only unrelated matches, if any, outside workbench code).

- [ ] **Step 11: Commit**

```bash
cd /opt/nhentai
git add frontend/src/lib/api.ts frontend/src/components/workbench/ frontend/src/App.tsx frontend/src/styles/app.css
git commit -m "$(cat <<'EOF'
feat(workbench): 真实工作台页——指标条+继续阅读/最近导入书架+四模块跳转卡

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Task 4: Documentation + final verification

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/PROJECT_MAP.md`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: updated status/map docs; final green verification.

- [ ] **Step 1: Update `docs/PROJECT_MAP.md`**

- Under "Backend Map", add a `services/workbench_service.py` bullet:
  `Read-only aggregator composing library/governance/jobs/files/exports summaries; never calls the NH API; one method overview().`
- Under "API Status → Implemented", add: `- GET /api/workbench/overview`
- Under "Frontend Map", add a `components/workbench/` bullet describing `WorkbenchPage`, `useWorkbenchState`, `WorkbenchMetricStrip`, `WorkbenchModuleCards`, `workbenchHelpers`, and that it reuses `ContinueReadingRow` for both shelves and honors `blurCovers`.
- Update the `App.tsx` bullet so it no longer says workbench is a boundary page (workbench is now a real page).

- [ ] **Step 2: Update `docs/PROJECT_STATUS.md`**

- Add a "Completed" entry at the top describing the workbench: real `#workbench` daily dashboard aggregating library/governance/jobs/files/exports through `GET /api/workbench/overview`, no health score, no fabricated counts, with metric strip + continue-reading/recent-added shelves + four module jump cards; new `WorkbenchService` + tests; verification (pytest + npm build).
- Remove "Workbench aggregate dashboard" from the "Not Implemented Yet" list.
- Update the "Next Plan" paragraph to drop the workbench follow-up (keep long-running export jobs, file-inventory pagination, reading-history page).
- Add a Decision line: `工作台只聚合真实模块摘要,不造健康分、不造假聚合数;隐私开关沿用全局,不在工作台重复。`

- [ ] **Step 3: Run the full backend suite and frontend build**

Run: `cd /opt/nhentai && PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS (all tests including the 4 new workbench tests).

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai
git add docs/PROJECT_STATUS.md docs/PROJECT_MAP.md
git commit -m "$(cat <<'EOF'
docs(workbench): 记录工作台聚合面板与 /api/workbench/overview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** backend aggregate endpoint (Task 1–2), no health score (Task 1 shape has no score field), full daily-entry scope = metric strip + two shelves + four module cards (Task 3), no duplicate privacy toggle / shelves honor `blurCovers` (Task 3 Steps 6–7), empty states (Task 1 tests + Task 3 page/card empty branches), testing + verification (Tasks 1–2 + Task 4). All spec sections map to a task.
- **No NH API:** `WorkbenchService` only calls local services; verified by composition (no client passed in).
- **Type consistency:** `overview()` keys in Task 1 match the `WorkbenchOverview` type in Task 3 and the stub in Task 2. `failed_recent` items use `{id, type, target, error, updated_at}` consistently across service, API stub, and `WorkbenchFailedJob`.
- **Reuse:** `ContinueReadingRow` (existing) renders both shelves and already returns `null` when empty, satisfying the empty-shelf requirement without new code.
