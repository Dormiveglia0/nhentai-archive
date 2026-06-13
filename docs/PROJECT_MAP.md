# NH Archive Project Map

## Current Slice

Implemented loop:

`discover remote gallery -> create import job -> download CBZ -> index local archive -> read pages -> save progress`

This stage also implements real NH API Key settings and rewrites the discover page against `design/搜索导入.png`. No fake works, fake jobs, fake file counts, or adult sample assets are seeded.

Read order for future AI work:

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md`
5. The relevant `design/*.png`

## Backend Map

Root: `backend/app/`

- `config.py`
  - `Settings`: resolves local data paths, `NHENTAI_API_KEY`, base URL, user agent, timeout.
  - Environment API key has priority over DB-stored API key.
- `database.py`
  - Tables: `works`, `work_files`, `work_pages`, `remote_galleries`, `remote_tags`, `reader_progress`, `reading_history`, `jobs`, `settings`.
- `services/nhentai_client.py`
  - Remote API wrapper: `latest`, `popular`, `random`, `search`, `gallery`, `tag_search`, `tags_by_ids`, `download_url`, `download_file`, `user`.
  - `media_url()` resolves CDN paths through `/api/v2/cdn`; frontend must not guess image URLs.
  - `normalize_remote_error()` standardizes 401/404/422/429.
- `services/discover_service.py`
  - `latest/popular/random/search/gallery/tag_autocomplete`.
  - Adds local `imported/work_id` state to remote gallery summaries.
  - `build_search_query()` appends real remote filters such as `language:japanese` and `tag:"artist cg"`.
  - Enriches cards with real `remote_tags` via `/api/v2/tags/ids` and caches those tags.
- `services/settings_service.py`
  - `get()`: safe settings summary; never returns API key text.
  - `patch()`: saves DB key and UI preferences; immediately updates runtime `NhentaiClient.api_key`.
  - `verify_nhentai()`: verifies current effective key through an authenticated remote request.
- `services/import_service.py`
  - `enqueue_remote_import()`, `run_remote_import()`, `retry_job()`.
  - Caches imported gallery and real gallery tags before downloading/indexing CBZ.
- `services/archive_service.py`
  - `ingest_cbz()`, `list_works()`, `get_work()`, `list_pages()`, `read_page()`.
- `services/reader_service.py`
  - `get_state()`, `update_state()`.
- `services/job_service.py`
  - `create/list/get/mark_running/update_progress/complete/fail/retry`.
- `main.py`
  - FastAPI route wiring.

## API Status

Implemented:

- `GET /api/health`
- `GET /api/discover/latest`
- `GET /api/discover/popular`
- `GET /api/discover/random`
- `GET /api/discover/search?q=&page=&per_page=&sort=&language=&type=&unimported_only=`
- `GET /api/discover/galleries/{gallery_id}`
- `POST /api/discover/galleries/{gallery_id}/import`
- `GET /api/discover/tags/autocomplete`
- `GET /api/works`
- `GET /api/works/{work_id}`
- `GET /api/works/{work_id}/cover`
- `GET /api/works/{work_id}/pages`
- `GET /api/works/{work_id}/pages/{page_index}`
- `GET /api/works/{work_id}/reader-state`
- `PATCH /api/works/{work_id}/reader-state`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `POST /api/jobs/{job_id}/retry`
- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/nhentai/verify`

Reserved, not implemented:

- Dictionary: `/api/dictionary/*`
- Governance: `/api/governance/*`, `/api/works/{id}/governance`
- Export center: `/api/exports/*`
- File maintenance: `/api/files/*`
- Job controls: pause/resume/cancel

## Frontend Map

Root: `frontend/src/`

- `App.tsx`
  - Hash route composition.
  - Boundary pages for workbench, governance, dictionary, export, files, and full tasks.
- `lib/navigation.ts`
  - Hash route parser and `navigate()`.
- `lib/api.ts`
  - Typed API wrapper for implemented backend endpoints.
- `components/layout/ArchiveShell.tsx`
  - Global topbar, full secondary nav, privacy/blur switches, bottom `TaskDock`.
- `components/layout/TaskDock.tsx`
  - Polls real `/api/jobs`; no synthetic tasks.
- `components/discover/DiscoverPage.tsx`
  - Design-baseline discover page: modes, filters, grid/list, pagination, detail drawer, import action.
  - Card title uses Japanese title first; author/language/tags come from real cached remote tags.
- `components/settings/SettingsPage.tsx`
  - NH API Key save/clear/verify, safe config summary, storage paths, UI preferences.
- `components/library/LibraryPage.tsx`
  - Current simple real `/api/works` library; Phase 3 will enhance it.
- `components/reader/ReaderPage.tsx`
  - Reads indexed pages and persists progress.
- `styles/app.css`
  - Shared NH Archive design system matching warm paper, editorial headings, terracotta actions, right inspectors, and task dock.

## Data Directory

Default: `backend/.local-data/`

- `archive.db`: SQLite database.
- `library/{work_id}.cbz`: imported source archive.
- `covers/{work_id}.{ext}`: extracted cover.
- `pages/`: reserved page cache.
- `tmp/`: download workspace.
- `exports/`: reserved export directory.

## Verification

Backend:

```bash
PYTHONPATH=backend pytest backend/tests -q
```

Frontend:

```bash
cd frontend
npm run build
```
