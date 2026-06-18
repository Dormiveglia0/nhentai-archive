# Next Stage Prompt: Phase 5 Export Center

Use this prompt only after Phase 4 governance remains green (`pytest` + `npm run build`).

## Required Reading Order

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md` (chapter 13 导出中心, plus governance/export handoff sections)
5. `design/导出中心.png`
6. `design/元数据.png`
7. `design/库.png`

## What Already Exists

- Imported source CBZ files are stored in `backend/.local-data/library/{work_id}.cbz` and indexed in `work_files` / `work_pages`.
- Phase 4 governance persists final metadata decisions in `work_metadata`.
- Dictionary mappings and tag links live in `local_tag_dictionary`, `tag_aliases`, and `work_tags`.
- Library and reader load real local works only; no fake assets are allowed.

## Task

Build the export center so users can preview and generate new archive outputs from real local works and governance metadata. Do not mutate original source CBZ files. Export generation must write new files under the configured export directory.

## Hard Rules

- No fake export records, fake file sizes, fake filenames, or fake readiness scores.
- Export preview must be computed from real source CBZ, `work_metadata`, `work_tags`, dictionary mappings, and current file existence.
- Original source CBZ files remain read-only.
- Export generation must be explicit and local-only; no NH API calls.
- ComicInfo output must use final `work_metadata` decisions when present, then real current/source values, then unknown/empty values. Do not invent metadata.
- Keep library, reader, dictionary, governance, and settings working.

## Target Backend

- Add an `ExportService` with:
  - `queue()` / `summary()` for real export readiness.
  - `preview(work_id)` showing source file, target filename, ComicInfo fields to write, tag output, missing blockers/warnings, and estimated output path.
  - `generate(work_id, options)` that creates a new CBZ under `settings.exports_dir` with original pages plus generated `ComicInfo.xml`.
- Add export tables only if needed for real generated export records. If a table is added, use non-destructive migration in `database.py`.
- Add APIs:
  - `GET /api/exports/queue`
  - `GET /api/works/{id}/export-preview`
  - `POST /api/works/{id}/export`
  - `GET /api/exports`

## Target Frontend

- Replace export boundary page with a real export center against `design/导出中心.png`.
- Show export queue/readiness, preview panel, ComicInfo output preview, file target details, and generated export history if backed by real records.
- Add export entry from library/governance only when it routes to real preview/generate capability.
- Keep generation disabled when blockers exist; show exact real blockers.

## Verification

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
- `cd frontend && npm run build`
- Static scan for fake/mock/random export data.
- In-process smoke: import a tiny CBZ, save governance metadata, preview export, generate CBZ, verify output exists and contains generated `ComicInfo.xml`.
