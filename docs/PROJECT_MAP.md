# NH Archive Project Map

## Current Slice

Implemented loop:

`discover remote gallery -> dictionary display/mapping -> detail modal -> remote reader or create import job -> download CBZ -> index local archive/work_tags -> local reader -> save progress -> governance metadata/tag review -> export preview/rename/download CBZ (single or .zip bundle) to the user`

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
  - Tables: `works`, `work_files`, `work_pages`, `remote_galleries`, `remote_tags`, `local_tag_dictionary`, `tag_aliases`, `work_tags`, `work_metadata`, `reader_progress`, `reading_history`, `jobs`, `settings`. (Export is a stream-to-browser download and keeps no records; the legacy `export_records` table is no longer created or used — existing databases may still carry an unused copy.)
  - Legacy migrations include dictionary/work tag shape upgrades.
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
    - language/type/query: real `/api/v2/search` query;
    - empty query: current latest feed, never the old `pages:>0` search fallback;
    - single remote tag: `/api/v2/galleries/tagged`.
  - Adds local `imported/work_id` state to remote gallery summaries.
  - `build_search_query()` appends confirmed remote filters such as `language:japanese`, `tag:"doujinshi"`, and `tag:"manga"`.
  - Enriches cards with real `remote_tags` via `/api/v2/tags/ids` and caches those tags.
  - `cached_tags()` exposes real cached tags for the discover selector; it does not fabricate defaults.
  - Joins `local_tag_dictionary` by `remote_tag_id` to emit dictionary `display` names for discover tags when mappings exist.
- `services/dictionary_service.py`
  - `summary()`: counts unconfigured/configured/ignored/review/suggested terms from real tables.
  - `autocomplete(q, limit)`: local dictionary, aliases, cached `remote_tags`, then real remote tag search only when no local/cache hit exists.
  - `candidates(q, status, limit, offset, tag_type)`: real remote tag candidate pool with impact count and configured/ignored state; searches original text, slug, Chinese name, and aliases; also exposes local-only dictionary rows so bad imports can be selected and removed.
  - `evidence(remote_tag_id, dictionary_id)`: real related works, co-tags, remote tag info, and local status history.
  - `preview_apply(payload)`: calculates conflicts, affected real works, samples, and tag update counts without writes.
  - `apply(payload)`: writes/updates `local_tag_dictionary`, `tag_aliases`, remote mapping, and related `work_tags`; if `remote_tag_id` is omitted it resolves a cached remote tag by normalized original text and type.
  - `ignore(id)` / `mark_review(id)` / `delete(id)`: real status transitions and deletion; delete removes aliases and unlinks `work_tags.dictionary_id` without deleting remote tags or works.
  - `preview_bulk_import(rows)` / `bulk_import(rows)`: parse user rows, report valid/duplicate/conflict/invalid rows, write only valid rows. Minimum row shape is `原文, 中文名`; type and aliases are optional.
  - `link_work_tags(work_id, tags)`: links imported works to real gallery tags and existing dictionary mappings.
  - `translate_text(text)`: single on-demand machine translation via the injected `TranslationService`.
  - `generate_suggestions(limit)`: machine-translates the top unconfigured remote tags and upserts reviewable `status='suggested'` rows (source `machine`); never overwrites a human-configured/locked entry and never links `work_tags` before confirmation.
- `services/translation_service.py`
  - Provider-adapter machine translation over the local `settings` table; uses stdlib `urllib` (no new deps). Two providers: `google_free` (unofficial endpoint, no key) and `deepl` (REST, auth key in `mt.deepl_api_key`). Config under `mt.*` keys.
  - `translate()` / `translate_one()`: EN→ZH (provider-selected); `verify()` runs a sample translate and records `mt.last_verify`; `public_config()` reports provider/plan/configured state and never echoes the DeepL key. Module-level `_http_get_json` / `_http_post_form` are the monkeypatch seams for tests.
- `services/settings_service.py`
  - `get()`: safe settings summary; never returns API key text; includes a `machine_translation` block from `TranslationService.public_config()`.
  - `patch()`: saves DB key, UI preferences, storage export directory, persisted export preset state, and machine-translation config (`mt.provider` / `mt.deepl_api_key` / `mt.deepl_plan`, plus clear); immediately updates runtime `NhentaiClient.api_key` and clears runtime remote cache when the effective key changes.
  - `verify_nhentai()`: verifies current effective key through an authenticated remote request.
- `services/import_service.py`
  - `enqueue_remote_import()`, `run_remote_import()`, `retry_job()`.
  - Caches imported gallery and real gallery tags before downloading/indexing CBZ.
  - Calls `DictionaryService.link_work_tags()` after ingest so imported works gain real `work_tags`.
- `services/archive_service.py`
  - `ingest_cbz()`, `list_works()`, `get_work()`, `list_pages()`, `read_page()`.
- `services/reader_service.py`
  - `get_state()`, `update_state()`.
- `services/library_service.py`
  - Local-only library reads; queries only `works`, `reader_progress`, `work_files`, `work_tags`, `local_tag_dictionary`. Never calls NH API.
  - `summary()`: real total/reading/completed/unread/untagged counts, total pages, total source-CBZ bytes, source breakdown, and language facets (from `work_tags` type `language`, dictionary `display` when mapped).
  - `search(q, page, per_page, sort, read_status, source, language, tag_ids)`: SQL-backed pagination. Keyword matches title/japanese/pretty/gallery-id and joined tag names/zh. `tag_ids` is AND semantics (work must carry every selected remote tag). Sort keys are whitelisted in `SORT_ORDERS`.
  - `recent_added(limit)`, `recent_read(limit)`, `continue_reading(limit)`: real shelves from `works`/`reader_progress`; empty when no real rows.
  - `tag_filters(q, limit)`: distinct used remote tags joined to dictionary `zh_name`, ranked by work count; excludes `language` type (language has its own facet).
  - Internals: `WORK_COLUMNS`/`WORK_JOINS` shared select (adds progress, source-CBZ size, tag_count), `_build_filters()`, `_top()`, `_attach_tags()` (one batched tag query per result page, sorted by `CARD_TAG_TYPES` priority).
- `services/governance_service.py`
  - Local-only governance reads/writes; never calls the NH API.
  - `queue()`: real queue items and reason counts from `works`, `work_files`, `work_tags`, `local_tag_dictionary`, source CBZ ComicInfo presence, and cover file existence.
  - `work_governance(work_id)`: aggregate with work header, files, metadata field diffs, tag groups, dictionary summary, recommended actions, and completeness.
  - Reads source metadata from real stored CBZ members (`ComicInfo.xml` and the first JSON metadata file when present) plus cached `remote_galleries.payload_json`.
  - `apply(work_id, payload)`: persists final metadata decisions into `work_metadata`; optional dictionary apply delegates to `DictionaryService.apply()`. It does not mutate source CBZ files.
  - `bulk_preview()` / `bulk_apply()`: selected-work batch actions for fill-missing metadata, opt-in ComicInfo write-back, source Web backfill, and confirming existing dictionary `review/conflict` terms when they are unlocked, not ignored, and already have a Chinese name.
- `services/export_service.py`
  - Local-only export preview/packaging for **browser download**; never calls the NH API, never mutates source CBZ files, and never writes a second copy to the server. No export records are kept.
  - `queue()` / `summary()`: real export readiness from `works`, `work_files`, source file existence, and preview blockers/warnings. `summary()` returns only the queue counts (`total`/`ready`/`blocked`/`warnings`).
  - `preview(work_id, options)`: uses `GovernanceService.work_governance()` so final metadata values come from `work_metadata` when present, then current/source values. Returns source file state, output name, ComicInfo fields, resolved export options, members to keep/write, blockers, and warnings. `options.output_name` is sanitized and forced to `.cbz`; `write_comicinfo` / `keep_json` / `compress` control the preview. No server output path is involved.
  - `build_cbz(work_id, options)`: packages a single work into CBZ **bytes** in memory, honoring `write_comicinfo`, `keep_json`, and `compress`, and returns `(filename, bytes)`; raises `ValueError` when the work has blockers. The original archive is never touched.
  - `build_bundle(items, options)`: packages multiple works into one `.zip` of CBZs (bytes) for a single download, applying shared export options, deduping member names, skipping blocked items, and raising when none can be exported.
- `services/export_job_service.py`
  - Long-running bulk export owner for `bulk_export` jobs. Selections over `EXPORT_SYNC_THRESHOLD` are packaged in a daemon worker, using `JobService` progress/log/control and `ExportService.build_cbz()`.
  - Artifacts are temporary `.zip` files under the export-jobs directory, deleted after download and swept after 24h; source CBZ files remain immutable.
- `services/file_service.py`
  - Local-only file inventory + deletion over the managed data dir; never calls the NH API.
  - `overview()`: real metrics — work count, source bytes, cover ok/missing, missing source, orphan/stale counts + bytes, reclaimable bytes.
  - `inventory(category, q, status, page, per_page)`: unified file entries — `work` (source CBZ + cover aggregated, status ok/missing_source/missing_cover, size_mismatch flag), `orphan` (loose files in library/covers with no DB reference), `stale` (tmp/exports leftovers). Paths normalized via `_abs()` (relative resolved against cwd, then `.resolve()`).
  - `preview_delete(targets)`: read-only; expands `work` targets to all cascaded DB rows (work_tags count, has_progress, has_governance) + source/cover files; reports files_to_delete/works_to_remove/reclaim_bytes + warnings (has_progress/has_governance/already_gone/forbidden_path).
  - `delete(targets)`: deletion is the only disk-touching op. `work` target deletes the works row (SQLite `ON DELETE CASCADE` clears work_files/work_pages/work_tags/work_metadata/reader_progress/reading_history) + unlinks source CBZ + cover; `orphan`/`stale` unlink the single file. Paths outside managed roots rejected (`_within_managed`). CBZ bytes never modified.
- `services/job_service.py`
  - `create/list/get/mark_running/update_progress/complete/fail/retry/pause/resume/cancel/logs/checkpoint`.
  - Job payloads include `created_at` / `updated_at`; statuses include `queued/running/paused/completed/failed/cancelled`.
  - Writes durable `job_logs` for creation, stage changes, completion, failures, pause/resume/cancel, and retry.
- `services/import_service.py`
  - Remote import jobs call `JobService.checkpoint()` between safe stages so pause/cancel is real and cooperative. Cancelling after a temporary CBZ download removes the tmp file before returning.
- `services/library_scan_service.py` / `services/library_scan_job_service.py`
  - Local library scan preview and background ingestion for already-present CBZ files under the managed library directory, routed through the task center as `library_scan` jobs.
- `services/workbench_service.py`
  - Read-only aggregator composing library/governance/jobs/files/exports summaries; never calls the NH API; one method `overview()` returning `{library, governance, files, exports, jobs, continue_reading, recent_added}` from real existing module services.
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
- `POST /api/dictionary/translate` (single on-demand machine translation of one term)
- `POST /api/dictionary/suggest-batch` (machine-translate top unconfigured remote tags into reviewable `status='suggested'` rows; does not link `work_tags`)
- `POST /api/dictionary/{id}/ignore`
- `POST /api/dictionary/{id}/review`
- `DELETE /api/dictionary/{id}`
- `GET /api/library/summary`
- `GET /api/library/search?q=&page=&per_page=&sort=&read_status=&source=&language=&tag_ids=`
  - `tag_ids` is a comma-separated remote tag id list; non-numeric tokens are ignored. AND semantics.
- `GET /api/library/recent-added?limit=`
- `GET /api/library/recent-read?limit=`
- `GET /api/library/continue-reading?limit=`
- `GET /api/library/reading-history?page=&per_page=`
- `GET /api/library/tag-filters?q=&limit=`
- `POST /api/library/scan/preview`
- `POST /api/library/scan`
- `GET /api/governance/queue`
- `GET /api/works/{work_id}/governance`
- `POST /api/works/{work_id}/governance/apply`
- `POST /api/works/{work_id}/governance/translate`
- `POST /api/governance/bulk/preview`
- `POST /api/governance/bulk/apply`
- `GET /api/exports/queue`
- `GET /api/exports/summary`
- `GET /api/works/{work_id}/export-preview`
- `POST /api/works/{work_id}/export-preview`
- `GET /api/works/{work_id}/export/download` (streams a single CBZ as a download)
- `POST /api/exports/download` (streams a `.zip` bundle of selected CBZs as a download)
- `POST /api/exports/bulk-jobs` (creates a temporary-artifact `bulk_export` job)
- `GET /api/jobs/{job_id}/export/download` (downloads a completed bulk-export artifact once, then deletes it)
- `GET /api/files/overview`
- `GET /api/files/inventory?category=&q=&status=&sort=&page=&per_page=`
- `POST /api/files/preview-delete`
- `POST /api/files/delete`
- `GET /api/works`
- `GET /api/works/{work_id}`
- `GET /api/works/{work_id}/cover`
- `GET /api/works/{work_id}/pages`
- `GET /api/works/{work_id}/pages/{page_index}`
- `GET /api/works/{work_id}/reader-state`
- `PATCH /api/works/{work_id}/reader-state`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `GET /api/jobs/{job_id}/logs`
- `POST /api/jobs/{job_id}/pause`
- `POST /api/jobs/{job_id}/resume`
- `POST /api/jobs/{job_id}/cancel`
- `POST /api/jobs/{job_id}/retry`
- `POST /api/jobs/clear`
- `DELETE /api/jobs/{job_id}`
- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/nhentai/verify`
- `POST /api/settings/translation/verify`
- `GET /api/workbench/overview`

## Frontend Map

Root: `frontend/src/`

- `docs/AGENT_MAP.md`
  - Fast locator for the active demo visual contract, nine module bodies/scenes, ordered CSS layers, formal page owners, and real API entry points. Read this before loading frontend files.
- `components/folio/`
  - Production-neutral full-screen visual system: page configuration, shell, navigation, animated module scenes/backdrops, shared controls, and ordered CSS layers.
  - Dependency direction is `demo -> folio` and `formal feature -> folio`; this directory must never import `components/demo/`.
- `components/demo/`
  - Public `/demo` content only: preview navigation/state, nine demo page bodies, and the demo command bar. Formal routes must not import this directory.

- `App.tsx`
  - Hash route composition.
  - All main modules are now real pages: discover/library/reader/governance/dictionary/export/files/tasks/settings/workbench. No module remains a boundary screen.
- `lib/navigation.ts`
  - Hash route parser and `navigate()`.
  - Routes include local `#reader/{work_id}`, remote `#reader/remote/{gallery_id}`, `#governance`, and `#governance/{work_id}`.
- `lib/motion/`
  - 阶段 0 动画原语层。`tokens.ts`(时长/缓动/stagger 常量,全站统一节奏)、`primitives.tsx`(`FadeIn`/`Stagger`/`StaggerItem`/`Reveal`/`Presence`,基于 `motion/react`)、`useReducedMotion.ts`、`index.ts` 出口。后续页面动画一律从此取用,禁止写魔法数。
- `components/effects/`
  - 从 magicui/react-bits 引入并改造后的效果组件落地处。`README.md` 为硬性接入规范(库只作效果来源、token 改造、`.fx-scope` 隔离、reduced-motion 降级)。当前含 `StaggerDemo`、`ShineBorder` 两个验证示例。
- `styles/tailwind-entry.css`
  - Tailwind v4 入口(方案 A:省略 Preflight、不加前缀、按层导入),`@theme` 将 `app.css` 设计 token 映射为 `--color-*`。在 `main.tsx` 中先于 `app.css` 引入。
- `lib/api.ts`
  - Typed API wrapper for implemented backend endpoints.
  - Discover GET calls use a short in-browser cache and in-flight request reuse to avoid duplicate feed/popular/detail/tag requests within one UI session.
  - Dictionary API types and helpers live here: candidates, autocomplete, preview/apply, preview/import bulk rows.
  - Library API types/helpers: `LibrarySummary`, `LibraryWork`, `LibraryTagFilter`, `LibrarySearchParams`, and `library*` request methods (summary/search/recent-added/recent-read/continue-reading/tag-filters). Library calls are not run through the discover session cache.
  - Governance API types/helpers: queue, aggregate, metadata translate, bulk preview/apply (fill missing metadata, write-back, confirm dictionary terms), and apply payload/result. Governance calls are local-only and not run through the discover session cache.
  - Export API types/helpers: queue, preview, `downloadExport` / `downloadExportBundle` (blob fetch + browser save), `enqueueBulkExport` for task-center bulk artifacts, and persisted preset settings. Export calls are local-only and not run through the discover session cache.
  - Job API type/helpers: `Job` (including `created_at` / `updated_at`, `paused/cancelled/cancelling` statuses and bulk-export target fields), `JobLog`, `jobs()`, `jobLogs()`, `pauseJob()`, `resumeJob()`, `cancelJob()`, `retryJob()`, delete/clear, and bulk-export download URL.
- `vite.config.ts`
  - Dev proxy defaults `/api` to `http://127.0.0.1:8001`.
  - Set `VITE_API_PROXY_TARGET=http://127.0.0.1:<port>` when verifying against a temporary backend port.
- `components/layout/ArchiveShell.tsx`
  - Routes direct-migrated to Folio (`workbench`, `library`, `discover`, `governance`, `dictionary`) render through `FolioChrome`; routes still awaiting migration retain the legacy shell. `TaskDock` remains outside either chrome.
- `components/layout/TaskDock.tsx`
  - Polls real `/api/jobs`; renders only when jobs are running/queued/failed or an error exists.
  - Failed-job retry remains available for existing import jobs.
- `components/discover/DiscoverPage.tsx`
  - Direct Folio composition for `#discover`: real popular band, combined keyword/tag query, custom filters, animated grid/list results, notices and pager. It imports no demo code and contains no API orchestration.
  - Card/random/popular selection navigates to the real gallery detail route; import actions enqueue the existing real import flow.
- `components/discover/useDiscoverState.ts`
  - Owns restored query/filter/page/scroll state, current `.folio-scroll` persistence, responsive page sizing, stale feed-request invalidation, one-shot StrictMode-safe popular loading, remote search, random navigation and import actions.
  - Multiple tags retain their original remote names/ids; a single tag-only query uses `tag_id`, while combined keyword/tag filters use remote query tokens. A missing remote `total` remains explicit instead of being fabricated.
- `components/discover/DiscoverPage.css`
  - Production-only popular fan, query composer, custom filter row, result/card/list/pager and four-viewport responsive layout. Replaced legacy discover/tag-picker/popular-fan selectors were removed from `styles/app.css`.
- `components/discover/DiscoverToolbar.tsx`
  - Keyword/Gallery ID input plus visible multi-tag chips, icon-only random action, animated grid/list controls, equal-height query action, custom Folio language/type/sort menus and unimported toggle. Upload/scan are not discover toolbar modes.
- `components/discover/DiscoverFeed.tsx`
  - Result count, empty/error/notice states, dynamic current-page cards, icon pager.
- `components/discover/DiscoverCard.tsx`
  - Cover-first card based on `design/库.png`: title, author/group, page/language/ID, draggable tag row. Author/language labels use dictionary `display`; language skips generic `translated`.
- `components/discover/TagFilterSelector.tsx`
  - Real cached multi-select tag picker plus dictionary-aware autocomplete; Chinese input can search immediately, duplicate matches are collapsed by remote tag id, selected chips remain visible in the query composer, and the panel stays open for consecutive selection.
  - Only terms with real remote tag IDs can be selected for discover remote filtering.
- `components/discover/TagScroller.tsx`
  - Pointer-drag horizontal tag row with hidden scrollbar and click-to-filter support.
  - Uses `tag.display || tag.name || tag.slug || id`, so dictionary display names flow without rewriting card logic.
- `components/discover/PopularFan.tsx`
  - Real `/api/discover/popular` editorial cover fan between the Folio heading and search workbench.
  - Scroll progress drives the animation: covers follow a rightward semicircle arc, rotate, clip out through the right/bottom edge on down-scroll, and reverse on up-scroll.
  - `cardStyle()` uses trigonometric semicircle coordinates; do not replace it with linear scale/translate interpolation.
  - It binds to the actual `.folio-scroll` container. Mobile uses a touch-driven circular fan carousel; native image drag is disabled so pointer capture remains stable.
  - Do not restore bordered/shadowed window styling, popover/floating mode, close buttons, or large metadata/action blocks inside the fan.
- `components/discover/IconPager.tsx`
  - Icon-only first/previous/input/next/last pagination.
- `components/settings/` — refactored settings module:
  - `SettingsPage.tsx` — thin orchestrator: hero + functional left section nav (`Presence`-faded section switch) + active section + config summary aside.
  - `useSettingsState.ts` — all state/actions (NH key, privacy/blur/reader, machine-translation provider/key/plan, load/save/verify/clear + `verifyTranslation`/`clearDeeplKey`).
  - `ConnectionSection` / `TranslationSection` (NEW MT config card: provider picker google_free/deepl, DeepL key + plan, 测试机翻) / `PreferencesSection` / `StorageSection`, plus `settingsHelpers` (`StatusDot`/`SummaryRow`).
- `components/dictionary/DictionaryPage.tsx`
  - Direct Folio composition for `#dictionary`: real summary, candidate pool, editor, evidence/preview ledger, fixed viewport command bar, and accessible bulk-import modal. It imports no demo code and contains no API orchestration.
- `components/dictionary/useDictionaryState.ts`
  - Owns all real summary/candidate/evidence/preview/mutation flow, latest-request invalidation, selection/form state, machine translation, review/ignore/delete, and batch suggestions. Editing invalidates the current preview; apply remains disabled until the current form has a read-only preview.
- `components/dictionary/DictionaryPage.css` / `DictionaryEditor.css`
  - Production-only responsive layout, custom focus treatment, candidate table, evidence ledger, modal and fixed command bar. All replaced legacy dictionary selectors and the orphaned `FilterMenu` were removed from `styles/app.css`.
- `components/dictionary/DictionarySummaryStrip.tsx`
  - Real top summary strip for unconfigured/configured/ignored/review/suggestions.
- `components/dictionary/DictionaryCandidatePool.tsx`
  - Table-like candidate pool from `/api/dictionary/candidates`, with custom Folio type/status/page-size selects, pagination, batch import, and review-only machine suggestions.
- `components/dictionary/DictionaryEditor.tsx`
  - Edits original term, Chinese display, aliases, type, scope, and note. The real 机翻填充中文名 action (`/api/dictionary/translate`) only fills `zh_name` for human review; the field labels keep their neutral color during focus.
- `components/dictionary/DictionaryActionBar.tsx`
  - Fixed preview/apply/ignore/review/delete controls. Preview is read-only; delete retains an irreversible-action confirmation; all actions stay available on mobile with compact labels.
- `components/dictionary/DictionaryEvidencePanel.tsx`
  - One visible split ledger for real impact metrics, tag diff, co-tags, conflicts, remote mapping, and related works from `/api/dictionary/evidence` and `/preview-apply`; it does not hide evidence behind tabs.
- `components/dictionary/BulkImportPanel.tsx`
  - Paste-based CSV/TSV/comma import with row-level preview before write.
- `components/library/LibraryPage.tsx`
  - Direct Folio composition for `#library`: real summary, custom filter workbench, optional shelves, result index, batch tray, cards, pager, and inspector. It contains no API orchestration and imports no demo code.
- `components/library/useLibraryState.ts`
  - Owns the existing real summary/shelf/search flow, stale-request invalidation, filters, paging, focused work, and cross-page multi-selection. Independent overview requests still run in parallel.
- `components/library/LibraryPage.css`
  - Production-only library layout and responsive behavior. Mobile work details use an opaque bottom sheet with a backdrop; all replaced legacy library/inspector/batch rules were removed from `styles/app.css`.
- `components/library/LibrarySummaryStrip.tsx`
  - Real summary strip: 总收藏 / 已读 / 阅读中 / 未读 / 待补标签 / 占用容量. No broad 待治理 fabrication; 待补标签 = works with zero `work_tags`, while detailed governance state lives in the governance page.
- `components/library/LibraryToolbar.tsx`
  - Search form (submit on Enter), custom Folio language/status/source/sort selects, `LibraryTagFilter`, animated grid/list view toggle, reset, and removable selected-tag chips. Language options come from real summary facets.
- `components/library/LibraryTagFilter.tsx`
  - Multi-select tag picker backed by `/api/library/tag-filters` (local used tags only, debounced search, dictionary display names). Does not call NH API.
- `components/library/WorkCard.tsx`
  - Cover-first card with direct semantic controls: read status, source/language, author/group, page/ID, custom progress, draggable tag row, and reader action. Selection buttons are not nested; double-clicking the cover opens the reader.
- `components/library/WorkInspector.tsx`
  - Sticky desktop inspector and mobile bottom sheet for real file size/pages, source/ID, language, reading progress, tags, reader, governance, and export routes.
- `components/library/ContinueReadingRow.tsx`
  - Horizontal shelf for 继续阅读 / 最近添加; renders nothing when no real rows.
- `components/library/libraryHelpers.ts`
  - `formatBytes`, title/author/language/read-status derivation, and shared sort/status/source option lists.
- `components/reader/ReaderPage.tsx`
  - Discriminated source reader:
    - local `workId`: reads indexed CBZ pages and persists progress;
    - remote `galleryId`: reads remote `pages[].url` from gallery detail, does not save local progress, exposes import queue action.
  - Local reader exposes a real `进入治理` route to `#governance/{work_id}`.
- `components/governance/GovernancePage.tsx`
  - Direct Folio composition for `#governance`: real queue rail, single/bulk modebar, metadata document and source-check rail. It imports no demo code and does not adapt legacy DOM.
  - Loads `/api/governance/queue`, auto-selects a real work when available, and loads `/api/works/{id}/governance` through `useGovernanceState`.
  - Empty library/empty queue is an honest empty state; no sample works, fake conflicts, or fake recommendations.
  - Fixed viewport action bar keeps save/write-back visible at every document length and includes real dictionary/export/reload routes. ComicInfo write-back and bulk write-back still require the existing irreversible-action confirmations.
- `components/governance/GovernancePage.css` / `GovernanceEditor.css`
  - Production-only three-column workspace, animated queue progress, work header, source rail, fixed command bar, bulk reports, field provenance ledger and tag groups. Mobile keeps the real queue as a horizontal track and moves source evidence below the editor; no native checkbox chrome is visible.
- `components/governance/GovernanceSourceRail.tsx`
  - Real source type, Gallery ID, page/file facts, tag/dictionary counts and backend-recommended actions. It does not calculate or invent a health score.
- `components/governance/MetadataEditor.tsx`
  - Source/current/final field comparison with auto-growing textareas, adopt/revert actions, machine-translation prefill and animated difference filtering. “仅看差异” is an `aria-pressed` custom control, not a native checkbox.
- `components/governance/GovernanceQueueRail.tsx` / `GovernanceBulkBar.tsx`
  - Queue reasons/completeness and real bulk preview/apply. Custom checkbox visuals preserve semantic inputs; preview remains read-only and apply retains all current mutation safeguards.
- `components/export/` — export center (browser-download model), split into focused modules:
  - `ExportPage.tsx` — thin compositional container for toolbar, work list, and inspector.
  - `useExportState.ts` — all state and data-fetching logic; single selected `Set`, separate `focusId`, search/status filters, output-name overrides, export option switches, and download orchestration. `downloadSelected()` downloads one CBZ (single target) or a `.zip` bundle (multi), and `downloadOne(id)` downloads the focused work.
  - `ExportToolbar.tsx` — page title, search, status chips, select-ready, and clear actions.
  - `ExportWorkList.tsx` — compact selectable work list with cover, title, remote ID/source, selected state, focus state, and ready/warning/blocked status.
  - `ExportInspector.tsx` — focused-work detail: output rename, ComicInfo preview, blockers/warnings, selected cover strip, option switches (`ComicInfo` / `保留JSON` / `压缩`), refresh, selected download, and current-work download.
  - `exportHelpers.tsx` — shared render utilities: `Cover`, export item status classification, and status labels.
  - Export delivers files to the user via the browser (`api.downloadExport` / `api.downloadExportBundle` fetch a blob and trigger a save); nothing is written to a server output directory and no history is kept. Original CBZs are never modified.
- `components/files/` — file maintenance module:
  - Visual layout follows `design/文件管理.png`: hairline thin-number metric strip + multi-column file table + bottom cover-detail panel + right health/cleanup rail.
  - `FilesPage.tsx` — thin container (takes `blurCovers`): overview strip + toolbar + file table + detail panel + health rail.
  - `useFilesState.ts` — overview/inventory fetch, category/q/status filters with request token, selected Set, focus, delete preview + confirm orchestration; `actionNotice` surfaces delete success/errors; preview cleared on selection/filter change.
  - `FileOverviewStrip.tsx` — hairline thin-number metric grid (dict-metric idiom).
  - `FileToolbar.tsx` — category tabs + search + status filter + count.
  - `FileList.tsx` — multi-column selectable table (文件名/路径/类型/大小/状态) with selected highlight + focus bar.
  - `FileDetailPanel.tsx` — focused-item detail: real cover thumbnail (respects `blurCovers`) + 4 stat blocks.
  - `FileHealthRail.tsx` — right rail: 健康度 (real overview), 重复检测 (honest 未接入 boundary — no fake dedupe), 清理工具 (preview → confirm delete + result notice).
  - `fileHelpers.tsx` — `formatBytes`, `statusLabel`, `kindLabel`, `statusTone`, `targetKey`, `entryToTarget`.
  - `App.tsx` renders `FilesPage` for `#files` with `blurCovers` (replaced the boundary screen).
- `components/tasks/` — task center:
  - Visual layout follows `design/任务中心.png`: real status metrics + tabbed task table + right inspector.
  - `TasksPage.tsx` — route container for `#tasks`, replacing the previous boundary page.
  - `useTasksState.ts` — polls `/api/jobs` every 2.5s, filters by status/query, tracks focus, loads logs, calls pause/resume/cancel/retry.
  - `TaskSummaryStrip.tsx` — counts real queued/running/paused/failed/completed jobs and today's updated jobs.
  - `TaskList.tsx` — compact table for task type, target, stage, progress, updated time, and retry/view action.
  - `TaskInspector.tsx` — focused job detail, progress, error/retry-after, real pause/resume/cancel/retry/copy actions, and durable job log timeline.
  - `taskHelpers.ts` — known job/stage/status labels, target formatting, retry eligibility, and time formatting.
  - Only failed `remote_import` jobs with a real `gallery_id` can retry; running/queued jobs can pause/cancel; paused jobs can resume/cancel.
- `components/workbench/` — daily workbench dashboard:
  - `WorkbenchPage.tsx` — first directly migrated Folio route. Keeps the real overview hook/API flow while owning new semantic page structure; it does not wrap the legacy dashboard or import demo content.
  - `WorkbenchPage.css` — production-only toolbar, metric, shelf-grid, and module-ledger layout. The replaced `.workbench-*` rules were removed from `styles/app.css`.
  - `useWorkbenchState.ts` — fetches `GET /api/workbench/overview`; manages loading/error/refresh state.
  - `WorkbenchMetricStrip.tsx` — hairline thin-number strip showing real metrics: 馆藏作品 / 待治理 / 失败任务 / 缺失源文件.
  - `WorkbenchModuleCards.tsx` — ruled module ledger (治理 / 任务 / 文件 / 导出) linking to `#governance` / `#tasks` / `#files` / `#export`.
  - `workbenchHelpers.ts` — shared label/formatting utilities.
  - Reuses `ContinueReadingRow` (from library) with direct shared Folio shelf markup for both the 继续阅读 and 最近导入 shelves; shelves render nothing when no real rows exist. `blurCovers` is honored throughout.
- `styles/app.css`
  - Shared NH Archive design system matching warm paper, editorial headings, terracotta actions, right inspectors, and task dock.

## Data Directory

Default: `backend/.local-data/`

- `archive.db`: SQLite database.
- `library/{work_id}.cbz`: imported source archive.
- `covers/{work_id}.{ext}`: extracted cover.
- `pages/`: reserved page cache.
- `tmp/`: download workspace.
- `exports/`: legacy export directory (still created by config/settings, but no longer written to — export now streams downloads to the browser).

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
