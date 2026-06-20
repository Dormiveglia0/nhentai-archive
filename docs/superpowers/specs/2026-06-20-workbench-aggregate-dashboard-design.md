# Workbench Aggregate Dashboard — Design

Date: 2026-06-20
Status: Approved (pre-implementation)
Module: `#workbench` (工作台)

## Purpose

Turn the `#workbench` boundary screen into a real daily-entry dashboard. It is the
last unimplemented main navigation module. Per the product flow doc (§Phase 7
"工作台与体验深化"), the workbench is a *daily entry point* that aggregates real
data already exposed by existing modules and lets the user jump into discover,
reading, governance, tasks, and file maintenance.

There is no `design/工作台.png` mockup, so the layout follows the established NH
Archive visual language (warm paper, editorial headings, terracotta actions,
hairline metric strips, right-inspector idioms).

## Non-Negotiables (carried from DEVELOPMENT_RULES)

- Aggregate only real module data. No fabricated aggregate counts, no invented
  recommendations, no synthesized scores.
- Any zero is a real zero and renders as a real empty/zero state.
- No NH API calls anywhere in this module (all data is local SQLite/disk).
- Sensitive values (API keys) are never surfaced.

## Decisions

- **Aggregation layer:** new backend aggregate endpoint (not frontend fan-out).
  The frontend makes one request with one loading state; aggregation logic and
  any derived counts live server-side where they are testable.
- **No collection health score.** The product doc lists 馆藏健康分, but a
  synthesized score conflicts with the no-fabrication rule. The workbench shows
  only raw real metrics (待补标签 N, 缺失源 N, 失败任务 N, etc.).
- **v1 scope = full daily entry:** real metric strip + two content shelves
  (继续阅读 / 最近导入) + four module summary cards (治理 / 任务 / 文件 / 导出),
  each card jumps to its module.
- **No duplicate privacy toggle.** The global blur/privacy switches already live
  in the topbar (`ArchiveShell`). The workbench does not duplicate them; its
  shelves honor the existing `blurCovers` prop.

## Architecture & Data Flow

A new `WorkbenchService` composes the existing service singletons that
`main.py` already constructs — `library`, `governance`, `jobs`, `files_service`,
`exports` — via constructor injection. It owns no new data source. One read-only
endpoint, `GET /api/workbench/overview`, returns a single aggregated payload.

Cost note: `governance.queue()` and `files.overview()` perform real DB/disk
scans (CBZ ComicInfo presence, data-dir scan) — the same work the governance and
files pages already do on load. This is acceptable for a daily dashboard. No
remote calls are involved.

## Backend

### `backend/app/services/workbench_service.py`

```python
class WorkbenchService:
    def __init__(self, library, governance, jobs, files, exports): ...

    def overview(self) -> dict[str, Any]:
        ...
```

`overview()` returns:

```jsonc
{
  "library": {
    "total", "reading", "completed", "unread",
    "untagged", "total_pages", "total_size_bytes"
  },                                   // subset of library.summary()
  "governance": {
    "total", "missing_metadata", "untagged",
    "dictionary_review", "dictionary_conflict",
    "missing_comicinfo", "missing_cover"
  },                                   // governance.queue()["summary"]
  "files": {
    "work_count", "source_bytes", "cover_ok",
    "missing_source", "missing_cover",
    "orphan_count", "stale_count", "reclaimable_bytes"
  },                                   // files.overview()
  "exports": { "total", "ready", "blocked", "warnings" },  // exports.summary()
  "jobs": {
    "running", "queued", "paused", "failed", "completed",
    "failed_recent": [ { "id", "type", "target", "error", "updated_at" } ]
  },                                   // derived from jobs.list(); max 5 failed
  "continue_reading": [ /* work summary */ ],   // library.continue_reading(limit=8)["result"]
  "recent_added":     [ /* work summary */ ]    // library.recent_added(limit=8)["result"]
}
```

- `jobs` counts: group `JobService.list()` rows by status. `failed_recent` is the
  newest ≤5 failed jobs (id/type/target/error/updated_at) for the failure card.
  `list()` does no network I/O.
- `library` block is a projection of `library.summary()` (drops sources/languages
  facets the workbench does not show).
- Shelves reuse `library.continue_reading` / `library.recent_added` with limit 8;
  each returns `{"result": [...]}` so the service reads `["result"]`.

### `backend/app/main.py`

```python
workbench = WorkbenchService(library, governance, jobs, files_service, exports)

@app.get("/api/workbench/overview")
def workbench_overview():
    return workbench.overview()
```

Wired after the existing service singletons (it depends on them).

## Frontend — `frontend/src/components/workbench/`

Replaces the `#workbench` boundary screen in `App.tsx`.

- `WorkbenchPage.tsx` — thin container, takes `blurCovers`. Renders hero, handles
  load/error/refresh, composes the sections below.
- `useWorkbenchState.ts` — fetches `/api/workbench/overview`; exposes
  `overview`, `loading`, `error`, `refresh`, `refreshing`.
- `WorkbenchMetricStrip.tsx` — top hairline real-number strip:
  馆藏(total) / 待治理(governance.total) / 失败任务(jobs.failed) / 文件健康
  (cover_ok vs work_count, missing_source). Reuses the existing metric idiom.
- `WorkbenchShelves.tsx` — 继续阅读 (continue_reading) + 最近导入 (recent_added)
  cover shelves. Renders nothing for an empty shelf. Honors `blurCovers`. Both
  shelves hold local works, so every card opens the local reader at
  `#reader/{workId}`. Reuses the library shelf/card visual language.
- `WorkbenchModuleCards.tsx` — four summary cards with real counts and a jump:
  - 治理 → `#governance` (total + top reason counts)
  - 任务 → `#tasks` (running/queued/failed; lists `failed_recent` with a route
    into tasks for retry)
  - 文件 → `#files` (missing_source / orphan+stale / reclaimable_bytes)
  - 导出 → `#export` (ready / blocked / warnings)
- `workbenchHelpers.ts` — formatting helpers (reuse `formatBytes` idiom; module
  card metadata).

### `frontend/src/lib/api.ts`

Add `WorkbenchOverview` type (mirrors the payload above; reuse existing
`LibraryWork` for shelf rows and `Job` fields for `failed_recent`) and
`workbenchOverview()` request method. Not run through the discover session cache.

### `frontend/src/App.tsx`

Render `<WorkbenchPage blurCovers={blurCovers} />` for `page.name === "workbench"`,
removing the `BoundaryPage` branch for workbench.

## Empty States

- Whole dashboard with zero works: metric strip shows real zeros; shelves render
  nothing; module cards show real zero counts with their jump still available.
- No failed jobs: failure card shows an honest "无失败任务" state, not a fake row.

## Testing

- `backend/tests/test_workbench_service.py`
  - Empty DB → all-zero summaries, empty `continue_reading`/`recent_added`,
    empty `failed_recent`, zero job counts.
  - After ingesting a real CBZ + creating a failed job + a completed job →
    correct library/files/jobs counts, the failed job appears in `failed_recent`,
    completed/failed reflected in job counts, recent_added reflects the work.
  - Continue-reading appears only after real reader progress exists.
- `backend/tests/test_workbench_api.py`
  - `GET /api/workbench/overview` returns 200 with the aggregated payload shape
    (stub `WorkbenchService` via the app's dependency, matching existing test
    patterns in `test_jobs_api.py`).
- Frontend: `cd frontend && npm run build` (`tsc -b && vite build`).

## Verification

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` green.
- `cd frontend && npm run build` green.
- Static fake-data scan over `workbench_service.py` and `components/workbench/`
  + `lib/api.ts` additions: no mock/sample/random/placeholder records.
- Manual: run the API against an empty DB (all real zeros, empty shelves) and
  against a populated DB (counts match the per-module pages).

## Out of Scope (this phase)

- Any new computed score or recommendation engine.
- Bulk actions from the workbench.
- A dedicated reading-history page (tracked separately).
- Real-time push/polling; the dashboard loads on navigation with a manual refresh.
