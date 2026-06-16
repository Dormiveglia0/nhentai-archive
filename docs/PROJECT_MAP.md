# NH Archive Project Map

## Current Slice

Implemented loop:

`discover remote gallery -> dictionary display/mapping -> detail modal -> remote reader or create import job -> download CBZ -> index local archive/work_tags -> local reader -> save progress`

This stage also implements real NH API Key settings and rewrites the discover page into a unified feed against `design/搜索导入.png`. No fake works, fake jobs, fake file counts, or adult sample assets are seeded.

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
  - Tables: `works`, `work_files`, `work_pages`, `remote_galleries`, `remote_tags`, `local_tag_dictionary`, `tag_aliases`, `work_tags`, `reader_progress`, `reading_history`, `jobs`, `settings`.
- `services/nhentai_client.py`
  - Remote API wrapper: `latest`, `popular`, `random`, `search`, `tagged`, `gallery`, `tag_search`, `tags_by_ids`, `download_url`, `download_file`, `user`.
  - `media_url()` resolves CDN paths through `/api/v2/cdn`; frontend must not guess image URLs.
  - `normalize_remote_error()` standardizes 401/404/422/429.
  - API quota protection:
    - caches cacheable remote GET/selected tag-search calls by request key;
    - uses longer TTLs for CDN/tag/detail/popular responses and short TTLs for feed/search pages;
    - enters a local cooldown window after 429 and does not keep forwarding remote requests during cooldown;
    - may serve stale cached data during a 429 cooldown when available.
- `services/discover_service.py`
  - `latest/popular/random/feed/tagged/search/gallery/tag_autocomplete/cached_tags`.
  - `feed()` is the unified discovery entry:
    - no filters: current page only through `/api/v2/galleries`;
    - language/type/query/sort: real `/api/v2/search` query;
    - single remote tag: `/api/v2/galleries/tagged`.
  - Adds local `imported/work_id` state to remote gallery summaries.
  - `build_search_query()` appends confirmed remote filters such as `language:japanese`, `tag:"doujinshi"`, and `tag:"manga"`.
  - Enriches cards with real `remote_tags` via `/api/v2/tags/ids` and caches those tags.
  - `cached_tags()` exposes real cached tags for the discover selector; it does not fabricate defaults.
  - Joins `local_tag_dictionary` by `remote_tag_id` to emit dictionary `display` names for discover tags when mappings exist.
- `services/dictionary_service.py`
  - `summary()`: counts unconfigured/configured/ignored/review/suggested terms from real tables.
  - `autocomplete(q, limit)`: local dictionary, aliases, cached `remote_tags`, then real remote tag search only when no local/cache hit exists.
  - `candidates(q, status, limit, offset, tag_type)`: real remote tag candidate pool with impact count and configured/ignored state; also exposes local-only dictionary rows so bad imports can be selected and removed.
  - `evidence(remote_tag_id, dictionary_id)`: real related works, co-tags, remote tag info, and local status history.
  - `preview_apply(payload)`: calculates conflicts, affected real works, samples, and tag update counts without writes.
  - `apply(payload)`: writes/updates `local_tag_dictionary`, `tag_aliases`, remote mapping, and related `work_tags`; if `remote_tag_id` is omitted it resolves a cached remote tag by normalized original text and type.
  - `ignore(id)` / `mark_review(id)` / `delete(id)`: real status transitions and deletion; delete removes aliases and unlinks `work_tags.dictionary_id` without deleting remote tags or works.
  - `preview_bulk_import(rows)` / `bulk_import(rows)`: parse user rows, report valid/duplicate/conflict/invalid rows, write only valid rows. Minimum row shape is `原文, 中文名`; type and aliases are optional.
  - `link_work_tags(work_id, tags)`: links imported works to real gallery tags and existing dictionary mappings.
- `services/settings_service.py`
  - `get()`: safe settings summary; never returns API key text.
  - `patch()`: saves DB key and UI preferences; immediately updates runtime `NhentaiClient.api_key` and clears runtime remote cache when the effective key changes.
  - `verify_nhentai()`: verifies current effective key through an authenticated remote request.
- `services/import_service.py`
  - `enqueue_remote_import()`, `run_remote_import()`, `retry_job()`.
  - Caches imported gallery and real gallery tags before downloading/indexing CBZ.
  - Calls `DictionaryService.link_work_tags()` after ingest so imported works gain real `work_tags`.
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
- `GET /api/discover/feed?page=&per_page=&q=&sort=&language=&type=&tag_id=&tag_names=&unimported_only=`
- `GET /api/discover/tagged?tag_id=&page=&per_page=&sort=&unimported_only=`
- `GET /api/discover/popular`
- `GET /api/discover/random`
- `GET /api/discover/search?q=&page=&per_page=&sort=&language=&type=&unimported_only=`
- `GET /api/discover/galleries/{gallery_id}`
  - Detail payload includes `pages[]` with resolved `url` values when the remote API returns page paths. These URLs are consumed only by the remote reader route, not by the detail modal.
- `POST /api/discover/galleries/{gallery_id}/import`
- `GET /api/discover/tags/autocomplete`
- `GET /api/discover/tags/cached`
- `GET /api/dictionary/summary`
- `GET /api/dictionary/candidates?q=&type=&status=&limit=&offset=`
- `GET /api/dictionary/evidence?remote_tag_id=&dictionary_id=`
- `GET /api/dictionary/autocomplete?q=&limit=`
- `POST /api/dictionary/preview-apply`
- `POST /api/dictionary/apply`
- `POST /api/dictionary/preview-bulk-import`
- `POST /api/dictionary/bulk-import`
- `POST /api/dictionary/{id}/ignore`
- `POST /api/dictionary/{id}/review`
- `DELETE /api/dictionary/{id}`
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
  - Routes include local `#reader/{work_id}` and remote `#reader/remote/{gallery_id}`.
- `lib/api.ts`
  - Typed API wrapper for implemented backend endpoints.
  - Discover GET calls use a short in-browser cache and in-flight request reuse to avoid duplicate feed/popular/detail/tag requests within one UI session.
  - Dictionary API types and helpers live here: candidates, autocomplete, preview/apply, preview/import bulk rows.
- `vite.config.ts`
  - Dev proxy defaults `/api` to `http://127.0.0.1:8001`.
  - Set `VITE_API_PROXY_TARGET=http://127.0.0.1:<port>` when verifying against a temporary backend port.
- `components/layout/ArchiveShell.tsx`
  - Global topbar, full secondary nav, privacy/blur switches, bottom `TaskDock`.
- `components/layout/TaskDock.tsx`
  - Polls real `/api/jobs`; renders only when jobs are running/queued/failed or an error exists.
- `components/discover/DiscoverPage.tsx`
  - Target design baseline is documented in `docs/superpowers/specs/2026-06-14-discover-popular-fan-design.md`.
  - Stable structure is title area + discover controls/results.
  - Popular is a title-side image-first sunset fan driven by scroll progress, not a permanent page section.
  - Single feed with keyword/Gallery ID input, filters, grid/list, title-side popular fan, random/gallery/detail modal, import action.
  - Card title uses Japanese title first; author/language/tags come from real cached remote tags.
- `components/discover/DiscoverToolbar.tsx`
  - Feed/upload/scan tabs, keyword or Gallery ID input, remote tag selector, custom language/type/sort menus, unimported toggle, random action.
- `components/discover/FilterMenu.tsx`
  - Custom compact menu used instead of native select controls on discover filters.
- `components/discover/DiscoverFeed.tsx`
  - Result count, empty/error/notice states, dynamic current-page cards, icon pager.
- `components/discover/DiscoverCard.tsx`
  - Cover-first card based on `design/库.png`: title, author/group, page/language/ID, draggable tag row.
- `components/discover/TagFilterSelector.tsx`
  - Real cached multi-select tag picker plus dictionary-aware autocomplete.
  - Only terms with real remote tag IDs can be selected for discover remote filtering.
- `components/discover/TagScroller.tsx`
  - Pointer-drag horizontal tag row with hidden scrollbar and click-to-filter support.
  - Uses `tag.display || tag.name || tag.slug || id`, so dictionary display names flow without rewriting card logic.
- `components/discover/PopularFan.tsx`
  - Real `/api/discover/popular` title-side sunset fan UI.
  - Initial state shows an unframed image-first cover fan integrated into the `发现 / 导入` title area.
  - Scroll progress drives the animation: covers follow a rightward semicircle arc, rotate, clip out through the right/bottom edge on down-scroll, and reverse on up-scroll.
  - `cardStyle()` uses trigonometric semicircle coordinates; do not replace it with linear scale/translate interpolation.
  - Mobile uses a touch-driven circular fan carousel: horizontal drag changes the center work and wraps cards from one side to the other.
  - Do not restore bordered/shadowed window styling, popover/floating mode, close buttons, or large metadata/action blocks inside the fan.
- `components/discover/GalleryPreviewModal.tsx`
  - Random, Gallery ID, and card detail modal; backdrop click/Escape close.
  - Shows metadata, tags, related works, `阅读`, and `加入导入队列` only. It does not contain an embedded reader.
- `components/discover/IconPager.tsx`
  - Icon-only first/previous/input/next/last pagination.
- `components/settings/SettingsPage.tsx`
  - NH API Key save/clear/verify, safe config summary, storage paths, UI preferences.
- `components/dictionary/DictionaryPage.tsx`
  - Page orchestration only: loads summary/candidates/evidence/preview, selects candidates, writes terms, status changes, and refreshes dependent sections.
- `components/dictionary/DictionarySummaryStrip.tsx`
  - Real top summary strip for unconfigured/configured/ignored/review/suggestions.
- `components/dictionary/DictionaryCandidatePool.tsx`
  - Table-like candidate pool from `/api/dictionary/candidates`, with type/status filters and pagination.
- `components/dictionary/DictionaryEditor.tsx`
  - Edits original term, Chinese display, aliases, type, scope, confidence, note; triggers preview/apply/ignore/review. Machine suggestions are visibly disabled until real service exists.
- `components/dictionary/DictionaryEvidencePanel.tsx`
  - Tabs for real related works, co-tags, remote info, and history from `/api/dictionary/evidence`.
- `components/dictionary/DictionaryApplyPreview.tsx`
  - Expandable sticky bottom tray for real preview impact, samples, tag diff, and conflicts.
- `components/dictionary/BulkImportPanel.tsx`
  - Paste-based CSV/TSV/comma import with row-level preview before write.
- `components/library/LibraryPage.tsx`
  - Current simple real `/api/works` library; Phase 3 will enhance it.
- `components/reader/ReaderPage.tsx`
  - Discriminated source reader:
    - local `workId`: reads indexed CBZ pages and persists progress;
    - remote `galleryId`: reads remote `pages[].url` from gallery detail, does not save local progress, exposes import queue action.
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
