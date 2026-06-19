# Next Stage Prompt: Continue Export Download Polish Or Start File Maintenance

Use this prompt after the current Phase 5 browser-download slice remains green (`pytest` + `npm run build` + browser screenshot check).

## Required Reading Order

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md`
5. For export polish: `design/导出中心.png`, `design/元数据.png`, `design/库.png`
6. For file maintenance: `design/文件管理.png`

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

## Option A: Continue Phase 5 Export Polish

Finish the export center beyond the first real slice.

- Move batch export into the real job/task flow only if long-running progress, pause, retry, or download history becomes necessary. The current UI can already send selected works to the backend and stream multiple CBZ files as one `.zip`.
- Decide whether export option presets should be persisted again; current controls are immediate per-session switches, not saved settings.
- Continue visual refinement against `design/导出中心.png`; the current page uses the toolbar + work-list + inspector model with real data, but global chrome and density can still be tuned.
- Keep source CBZ files immutable.

## Option B: Start Phase 6 File Maintenance

Build the file maintenance module against `design/文件管理.png`.

- Compute file health from real filesystem and SQLite state.
- Detect missing source files, missing covers, orphaned generated exports, and stale temp files.
- Any cleanup must be explicit and previewed before deletion.
- Do not invent capacity, duplicate counts, corruption counts, or orphan rows.

## Verification

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
- `cd frontend && npm run build`
- Static scan for mock/sample/random hardcoded records in the touched module.
- For export work: create/ingest a tiny CBZ in a temp data dir, preview, download/build bytes, verify the output CBZ honors `ComicInfo.xml` / JSON / compression options, and verify the source CBZ bytes did not change.
- For file work: create a temp data dir with real missing/orphan/stale files and verify the API reports exactly those real findings.
