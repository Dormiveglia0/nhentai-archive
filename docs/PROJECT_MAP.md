# NH Archive Project Map

## Current Implementation Slice

The implemented slice is the first real product loop:

`remote discover -> remote import job -> CBZ stored locally -> CBZ indexed -> library entry -> reader page API -> reader progress saved`

No built-in gallery cards, covers, pages, or fake tasks are seeded. Empty states and remote/API errors are shown directly.

## Backend

Root: `backend/app/`

- `config.py`
  - `Settings`: resolves `NH_ARCHIVE_DATA_DIR`, `NHENTAI_API_KEY`, request timeout, and local data paths.
  - `Settings.ensure_directories()`: creates `library/`, `covers/`, `pages/`, `tmp/`, `exports/`.
- `database.py`
  - `Database.init_schema()`: creates SQLite tables.
  - Tables: `works`, `work_files`, `work_pages`, `remote_galleries`, `remote_tags`, `reader_progress`, `reading_history`, `jobs`, `settings`.
- `services/nhentai_client.py`
  - `NhentaiClient.latest/popular/random/search/gallery/tag_search/download_url/download_file`.
  - `NhentaiClient.media_url()`: resolves media paths through `/api/v2/cdn`; frontends must not guess CDN URLs.
  - `map_gallery_summary()`: converts API gallery summaries into frontend-safe shape.
  - `normalize_remote_error()`: maps 401/404/422/429 and remote JSON errors to `NhentaiApiError`.
- `services/discover_service.py`
  - `DiscoverService.latest/popular/random/search/gallery/tag_autocomplete`.
  - Adds `imported` and `work_id` by checking local `works`.
  - Caches remote gallery/tag payloads.
- `services/job_service.py`
  - `JobService.create/list/get/update_progress/complete/fail/retry`.
  - All task progress shown in the frontend task dock comes from this table.
- `services/import_service.py`
  - `ImportService.enqueue_remote_import()`: creates a `remote_import` job.
  - `ImportService.run_remote_import()`: fetches gallery detail, requests download URL, downloads CBZ, indexes it, completes/fails the job.
  - `ImportService.retry_job()`: restarts failed remote imports.
- `services/archive_service.py`
  - `ArchiveService.ingest_cbz()`: validates ZIP/CBZ, stores source CBZ, extracts cover, indexes image pages.
  - `ArchiveService.list_works/get_work/list_pages/read_page`.
- `services/reader_service.py`
  - `ReaderService.get_state/update_state`: persists reading progress and appends reading history.
- `main.py`
  - FastAPI entrypoint and route wiring.

## Backend API Status

Implemented:

- `GET /api/health` -> `main.health`
- `GET /api/discover/latest` -> `DiscoverService.latest`
- `GET /api/discover/popular` -> `DiscoverService.popular`
- `GET /api/discover/random` -> `DiscoverService.random`
- `GET /api/discover/search` -> `DiscoverService.search`
- `GET /api/discover/galleries/{gallery_id}` -> `DiscoverService.gallery`
- `POST /api/discover/galleries/{gallery_id}/import` -> `ImportService.enqueue_remote_import`
- `GET /api/discover/tags/autocomplete` -> `DiscoverService.tag_autocomplete`
- `GET /api/works` -> `ArchiveService.list_works`
- `GET /api/works/{work_id}` -> `ArchiveService.get_work`
- `GET /api/works/{work_id}/cover` -> `ArchiveService.get_work` + `FileResponse`
- `GET /api/works/{work_id}/pages` -> `ArchiveService.list_pages`
- `GET /api/works/{work_id}/pages/{page_index}` -> `ArchiveService.read_page`
- `GET /api/works/{work_id}/reader-state` -> `ReaderService.get_state`
- `PATCH /api/works/{work_id}/reader-state` -> `ReaderService.update_state`
- `GET /api/jobs` -> `JobService.list`
- `GET /api/jobs/{job_id}` -> `JobService.get`
- `POST /api/jobs/{job_id}/retry` -> `ImportService.retry_job`

Reserved for later modules, not implemented as working features:

- Governance: `/api/governance/*`, `/api/works/{id}/governance`
- Dictionary apply preview: `/api/dictionary/preview-apply`, `/api/dictionary/apply`
- Export center: `/api/exports/preview`, `/api/exports`
- File maintenance: `/api/files/*`

## Frontend

Root: `frontend/src/`

- `App.tsx`: hash-based page composition and privacy/cover blur state.
- `lib/api.ts`: typed API client for implemented backend endpoints.
- `lib/navigation.ts`: hash route parser and navigation helper.
- `components/layout/ArchiveShell.tsx`: top navigation, global controls, privacy switches.
- `components/layout/TaskDock.tsx`: polls `/api/jobs`; no synthetic progress.
- `components/discover/DiscoverPage.tsx`: latest/popular/search/gallery ID, preview drawer, import queue action.
- `components/library/LibraryPage.tsx`: reads only real `/api/works` entries, opens reader.
- `components/reader/ReaderPage.tsx`: reads indexed CBZ pages, saves progress, keyboard navigation, privacy mask.
- `styles/app.css`: shared Doujin Archive Gallery visual system.

## Data Directory Contract

Default path: `backend/.local-data/`.

- `archive.db`: SQLite database.
- `library/{work_id}.cbz`: immutable imported source archive copy.
- `covers/{work_id}.{ext}`: extracted first image for local cover.
- `pages/`: reserved for future page cache.
- `tmp/`: download workspace; successful imports remove their temp CBZ.
- `exports/`: reserved for future export center.

## Verification Commands

Backend service tests:

```bash
PYTHONPATH=backend pytest backend/tests -q
```

Backend runtime after dependencies:

```bash
cd backend
uvicorn app.main:app --reload
```

Frontend after dependencies:

```bash
cd frontend
npm run build
```
