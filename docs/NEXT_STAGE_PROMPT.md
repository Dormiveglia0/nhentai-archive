# Next Stage Prompt: Continue After Task Center

Use this prompt after Phase 7 task center remains green (`pytest` + `npm run build` + browser screenshot check).

## Required Reading Order

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md`
5. For task/job work: `design/任务中心.png`
6. For file maintenance follow-up: `design/文件管理.png`
7. For workbench: `design/库.png`, `design/元数据.png`, and any future workbench reference.

## What Already Exists

- Imported source CBZ files are stored in `backend/.local-data/library/*.cbz` and indexed in `work_files` / `work_pages`.
- Governance persists final metadata decisions in `work_metadata`.
- Dictionary mappings and tag links live in `local_tag_dictionary`, `tag_aliases`, and `work_tags`.
- `ExportService` can preview and stream new CBZ downloads for real local works, including custom output names, batch `.zip` bundles, and per-download options:
  - `GET /api/exports/queue`
  - `GET /api/exports/summary`
  - `GET /api/works/{id}/export-preview`
  - `POST /api/works/{id}/export-preview`
  - `GET /api/works/{id}/export/download`
  - `POST /api/exports/download`
- Export options currently include `write_comicinfo`, `keep_json`, and `compress`; exports are generated in memory and delivered to the browser.
- No generated exports are written under `settings.export_dir`, and no `export_records` are kept.
- Original source CBZ files remain read-only.
- `#tasks` is now a real task center backed by `/api/jobs`; it shows real metrics/list/detail/logs and supports retry, pause, resume, and cancel through backend APIs.
- Import jobs cooperate with pause/cancel at safe stage checkpoints. Cancellation during a blocking download takes effect at the next checkpoint and cleans temp CBZ files.

## Option A: Long-Running Export Jobs

- Move optional long-running/bulk export into the real job system only if progress, pause/resume/cancel, logs, retry, or history is needed.
- Keep source CBZ files immutable and keep browser download semantics unless a real export-job artifact model is designed.

## Option B: Task Center Visual QA And Polish

- Run browser screenshot QA against `design/任务中心.png`.
- Tighten table density, right inspector spacing, and mobile collapse only if screenshots show drift.
- Do not add fake jobs or fake throughput to make the page look fuller.

## Option C: File Maintenance Follow-Up

- Add inventory pagination controls; the API already paginates.
- Continue visual refinement against `design/文件管理.png`.
- Keep cleanup explicit and previewed before deletion.

## Option D: Workbench Aggregate Dashboard

- Build `#workbench` only from existing real summaries: library, governance queue, file overview, export summary, and jobs.
- Do not invent fake aggregate counts or fake recommendations.

## Verification

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
- `cd frontend && npm run build`
- Static scan for mock/sample/random hardcoded records in the touched module.
- For task work: create real or test DB jobs and verify list/detail/filter/retry/control behavior matches persisted job state.
- For file work: create a temp data dir with real missing/orphan/stale files and verify the API reports exactly those real findings.
