# NH Archive Project Map

## Current Slice

Implemented loop:

`discover remote gallery -> dictionary display/mapping -> detail modal -> remote reader or create import job -> download CBZ -> index local archive/work_tags -> local reader -> save progress -> governance metadata/tag review -> export preview/rename/download CBZ (single or .zip bundle) to the user`

This stage also implements real NH API Key settings and rewrites the discover page into a unified Folio feed. No fake works, fake jobs, fake file counts, or adult sample assets are seeded.

Read order for future AI work:

1. `docs/AGENT_MAP.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_MAP.md`
4. `docs/DEVELOPMENT_RULES.md`
5. The relevant formal component and feature-local CSS from the agent map.

## Development Entry

- Root `npm run dev` delegates to `scripts/dev.py`.
- The stdlib launcher starts the API app on port 8001 and Web app on port 5173, preserves `PYTHONPATH`/`VITE_API_PROXY_TARGET`, and terminates both process groups when either side exits or the user presses `Ctrl+C`. `NH_ARCHIVE_API_PORT` and `NH_ARCHIVE_WEB_PORT` provide temporary QA ports.
- `npm run dev -- --check` validates the local API executable, npm, and Web dependencies without starting servers.
- Runtime state lives at repository-root `.local-data/`, outside both deployable apps. Managed source/cover paths are stored portably as `library/...` and `covers/...`; each runtime resolves them against its active data root. Startup migrates legacy absolute values to that portable form, so the same SQLite can cross the Compose `/data` and host `.local-data` boundary without path flipping.
- `Dockerfile` builds the Web app in a Node stage, then ships only FastAPI and the compiled assets. `compose.yaml` declares `build: .` so `docker compose up -d --build` includes the current checkout, and binds host `./.local-data` to `/data`; its entrypoint runs as that directory's owner while retaining only startup UID/GID-switch capabilities. `/api/health` provides container health.

## API App Map

Root: `apps/api/app/`

- `config.py`
  - `Settings`: resolves local data paths, `NHENTAI_API_KEY`, base URL, user agent, timeout.
  - Environment API key has priority over DB-stored API key.
- `database.py`
  - Tables: `works`, `work_files`, `work_pages`, `remote_galleries`, `remote_tags`, `local_tag_dictionary`, `tag_aliases`, `work_tags`, `work_metadata`, `governance_reviews`, `reader_progress`, `reading_history`, `reading_sessions`, `jobs`, `settings`. `works.favorite` is the local favorite flag; `reading_sessions` stores one idempotent reader visit with cumulative foreground seconds. `governance_reviews` is an append-only human-review ledger with snapshot hashes; export remains a stream-to-browser download and keeps no records. (The legacy `export_records` table is no longer created or used — existing databases may still carry an unused copy.)
  - Legacy migrations include dictionary/work tag shape upgrades.
  - Connections enforce foreign keys, a 5-second busy timeout and NORMAL synchronous mode; schema initialization enables WAL. Query indexes are created only after legacy migrations and cover work files/tags, dictionary references, reading history, task status/order and task logs.
  - Startup path migration recognizes legacy repository `.local-data/...` and Compose `/data/...` values, persists only `library/...` / `covers/...`, and resolves returned path fields against the current runtime root.
- `container.py`
  - Composition root for settings, SQLite, the remote client, and service instances. API modules share this single mutable registry; tests replace registry members instead of patching route modules.
- `api/`
  - Domain routers for auth, discover, dictionary, library, governance, exports, files, works/reader state, jobs, settings, and system/workbench endpoints.
  - `auth.py` owns first-run setup, login, password change, logout and status. `schemas.py` owns HTTP request models; `shared.py` owns remote API error translation and the router-wide authentication dependency. Business logic remains in `services/`.
- `services/auth_service.py`
  - Single-password access without accounts or users. Any non-empty password is accepted without character-combination rules, then stored as a salted stdlib `scrypt` verifier; only SHA-256-derived session keys are persisted in the existing `settings` table.
  - Sessions last 90 days and survive process/container restarts. Password change verifies the current password, revokes every old session, and issues one replacement session to the current browser. Five failed login/change attempts within five minutes temporarily rate-limit that client.
- `services/nhentai_client.py`
  - Remote API wrapper: `latest`, `popular`, `random`, `search`, `tagged`, `gallery`, `tag_search`, `tags_by_ids`, `download_url`, `download_file`, `user`.
  - `media_url()` resolves CDN paths through `/api/v2/cdn`, normalizes duplicate upstream image suffixes such as `.webp.webp`, and leaves the frontend free of URL guessing.
  - `normalize_remote_error()` standardizes 401/404/422/429.
  - Network failures, invalid JSON/Unicode responses and non-object error payloads are normalized to `NhentaiApiError`; nested thumbnail payloads keep a scalar `thumbnail.path`.
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
  - Feed and related-card import state is resolved in one batched `works` query per result set, not one query per card.
  - `build_search_query()` appends confirmed remote filters such as `language:japanese`, `category:doujinshi`, and `category:manga`; selected remote tags retain their real quoted namespace (`artist:"..."`, `tag:"..."`, `parody:"..."`, etc.) and excluded terms retain the signed form (`-tag:"..."`).
  - Enriches cards with real `remote_tags` via `/api/v2/tags/ids` and caches those tags.
  - `cached_tags()` exposes real cached tags for the discover selector; it does not fabricate defaults.
  - Joins `local_tag_dictionary` by `remote_tag_id` to emit dictionary `display` names for discover tags when mappings exist.
- `services/dictionary_service.py`
  - `summary()`: counts unconfigured/configured/ignored/review/suggested terms from real tables.
  - `autocomplete(q, limit)`: local dictionary, aliases, cached `remote_tags`, then real remote tag search only when no local/cache hit exists.
  - `candidates(q, status, limit, offset, tag_type)`: real remote tag candidate pool with impact count and configured/ignored state; searches original text, slug, Chinese name, and aliases; also exposes local-only dictionary rows so bad imports can be selected and removed. Direct remote-id, normalized-name and normalized-slug dictionary matches use separate indexed joins, avoiding the former `OR` join's N×M fallback scan.
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
  - Enqueue is idempotent: an active job for the same gallery is reused, and a gallery already in the library returns an immediately completed job instead of leaving an orphaned queued record.
  - Caches imported gallery and real gallery tags before downloading/indexing CBZ.
  - Calls `DictionaryService.link_work_tags()` after ingest so imported works gain real `work_tags`.
  - Partial download files are removed on success, cancellation and failure; a process crash remains visible as a stale managed tmp file for file maintenance. CBZ transfer reports real downloaded/total bytes into the job row and maps that transfer across the 15–90% progress segment before indexing.
- `services/archive_service.py`
  - `ingest_cbz()`, `list_works()`, `get_work()`, `list_pages()`, `read_page()`.
  - Archive copies, covers and generated thumbnails use unique same-directory temporary files plus atomic replace. Re-ingest invalidates page thumbnails/stale covers, and page member sizes are indexed from one ZIP directory read rather than reopening the archive for every page. A failed first ingest removes its placeholder work so import idempotency cannot mistake a fileless row for success.
- `services/reader_service.py`
  - `get_state()`, `update_state()` persist page progress without incrementing visit counts.
  - `start_session()` creates one idempotent local-reader visit and one `reading_history` open; `update_session()` accepts only monotonic cumulative visible-time totals, the latest bounded page, and an optional finished marker.
- `services/library_service.py`
  - Local-only library reads; queries only `works`, `reader_progress`, `work_files`, `work_tags`, `local_tag_dictionary`. Never calls NH API.
  - `work(work_id)`: one full local work record through the same `WORK_COLUMNS`/`WORK_JOINS` and `_attach_tags()` path as library search. The reader therefore receives real author/group/parody/character/content/category/language tags without a remote lookup.
  - `summary()`: real total/favorite/reading/completed/unread/untagged counts, total pages, total source-CBZ bytes, source breakdown, and language facets (from `work_tags` type `language`, dictionary `display` when mapped); generic `translated`/`translate*` markers are excluded because they are not languages.
  - `search(q, page, per_page, sort, read_status, source, language, tag_ids, favorite_only)`: SQL-backed pagination. Keyword matches title/japanese/pretty/gallery-id and joined tag names/zh. `tag_ids` is AND semantics (work must carry every selected remote tag). Sort keys are whitelisted in `SORT_ORDERS`; favorite-only is a real `works.favorite` predicate.
  - `set_favorite(work_id, favorite)`: updates only the local flag and returns the same full local work shape used by the library and reader.
  - `statistics(days, timezone_offset_minutes, limit)`: real local overview, filled daily activity, most-read works by time/visits, and author/tag affinity. It reads session starts in the browser's local-day boundary, attributes a session to its start day, and never fabricates historical time before session tracking existed.
  - `recent_added(limit)`, `recent_read(limit)`, `continue_reading(limit)`: real shelves from `works`/`reader_progress`; empty when no real rows.
  - `tag_filters(q, limit)`: distinct used remote tags joined to dictionary `zh_name`, ranked by work count; excludes `language` type (language has its own facet).
  - Internals: `WORK_COLUMNS`/`WORK_JOINS` shared select (adds progress, source-CBZ size, tag_count), `_build_filters()`, `_top()`, `_attach_tags()` (one batched tag query per result page, sorted by `CARD_TAG_TYPES` priority).
- `services/metadata_refresh_service.py`
  - Read-only preview then explicit apply for up to 50 selected local works. Matching priority is existing remote gallery ID, ComicInfo `Web`, manually supplied gallery ID, then normalized fuzzy title search.
  - Fuzzy auto-apply requires at least 92% title confidence, a 7-point lead over the next candidate, and matching page count unless title confidence is at least 97%. Ambiguous rows stay review-only until a gallery ID is supplied and previewed again.
  - Apply fetches fresh remote detail and independently reruns fuzzy candidate ranking on the server; it never trusts confidence/margin values from the browser. It updates remote titles/media identity, replaces stale remote tags, preserves local source ownership and every manual `work_metadata` decision, and isolates failures per work.
- `services/governance_service.py`
  - Local-only governance reads/writes; never calls the NH API.
  - `queue()`: real queue items, explicit human-review state and automatic reason counts from `works`, `work_files`, `work_tags`, `local_tag_dictionary`, source CBZ ComicInfo presence, and cover file existence. `summary.total` is the unreviewed/stale backlog, not the automatic-issue count.
  - `work_governance(work_id)`: aggregate with work header, files, metadata field diffs, tag groups, dictionary summary, automatic check groups, recommended actions, and current review state/history.
  - Reads source metadata from real stored CBZ members (`ComicInfo.xml` and the first JSON metadata file when present) plus cached `remote_galleries.payload_json`.
  - `apply(work_id, payload)`: persists final metadata decisions into `work_metadata`; optional dictionary apply delegates to `DictionaryService.apply()`. It does not mutate source CBZ files.
  - `review(work_id, action, note)`: appends approve/reopen events. Approval hashes the current work/metadata/tag/dictionary/file snapshot; any later change makes that approval stale. Open automatic issues require an explanatory note.
  - `translate_metadata(work_id, fields)`: read-only suggestions for title/subtitle/summary; never writes or auto-adopts output.
  - `bulk_preview()` / `bulk_apply()`: selected-work batch actions for fill-missing metadata, opt-in ComicInfo write-back, source Web backfill, and confirming existing dictionary `review/conflict` terms when they are unlocked, not ignored, and already have a Chinese name.
- `services/export_service.py`
  - Local-only export preview/packaging for **browser download**; never calls the NH API, never mutates source CBZ files, and never writes a second copy to the server. No export records are kept.
  - `queue()` / `summary()`: one aggregate SQLite query resolves real source state, metadata/tag presence and dictionary warnings; CBZ metadata is opened only for still-missing fields. `summary()` returns only the queue counts (`total`/`ready`/`blocked`/`warnings`) and shares the exact same state derivation as the full queue.
  - `preview(work_id, options)`: uses `GovernanceService.work_governance()` so final metadata values come from `work_metadata` when present, then current/source values. Returns source file state, output name, ComicInfo fields, resolved export options, members to keep/write, blockers, and warnings. `options.output_name` is sanitized and forced to `.cbz`; `write_comicinfo` / `keep_json` / `compress` control the preview. No server output path is involved.
  - `build_cbz(work_id, options)`: packages a single work into CBZ **bytes** in memory, honoring `write_comicinfo`, `keep_json`, and `compress`, and returns `(filename, bytes)`; raises `ValueError` when the work has blockers. The original archive is never touched.
  - `build_bundle(items, options)`: packages multiple works into one `.zip` of CBZs (bytes) for a single download, applying shared export options, deduping member names, skipping blocked items, and raising when none can be exported.
- `services/export_job_service.py`
  - Long-running bulk export owner for `bulk_export` jobs. Selections over `EXPORT_SYNC_THRESHOLD` are packaged in a daemon worker, using `JobService` progress/log/control and `ExportService.build_cbz()`.
  - Artifacts are temporary `.zip` files under the export-jobs directory, deleted after download and swept after 24h; download/deletion accepts only the exact job-owned path, and source CBZ files remain immutable.
- `services/file_service.py`
  - Local-only file inventory + deletion over the managed data dir; never calls the NH API.
  - `overview()`: real metrics — work count, source bytes, cover ok/missing, missing source, orphan/stale counts + bytes, reclaimable bytes.
  - `inventory(category, q, status, page, per_page)`: unified file entries — `work` (source CBZ + cover aggregated, status ok/missing_source/missing_cover, size_mismatch flag), `orphan` (loose files in library/covers with no DB reference), `stale` (tmp/exports leftovers). Source rows are preloaded once and visible-work tags are fetched in one batch. Work entries expose structured `tag_items`; portable DB paths arrive already resolved against the active data root, and `_abs()` normalizes them before filesystem checks.
  - `preview_delete(targets)`: read-only; expands `work` targets to all cascaded DB rows (work_tags count, has_progress, has_governance) + source/cover files; reports files_to_delete/works_to_remove/reclaim_bytes + warnings (has_progress/has_governance/already_gone/forbidden_path).
  - `delete(targets)`: deletion is the only disk-touching op. `work` target deletes the works row (SQLite `ON DELETE CASCADE` clears work_files/work_pages/work_tags/work_metadata/governance_reviews/reader_progress/reading_history/reading_sessions) + unlinks source CBZ + cover; `orphan`/`stale` unlink the single file. Paths outside managed roots rejected (`_within_managed`). CBZ bytes never modified.
- `services/job_service.py`
  - `create/list/get/mark_running/update_progress/complete/fail/retry/pause/resume/cancel/logs/checkpoint`.
  - `list()` batch-loads work/gallery presentation metadata and tolerates corrupt/non-object `target_json`; startup recovery closes process-owned queued/running/cancelling states while leaving paused jobs resumable.
  - Job payloads include `created_at` / `updated_at`; statuses include `queued/running/paused/completed/failed/cancelled`.
  - Writes durable `job_logs` for creation, stage changes, completion, failures, pause/resume/cancel, and retry.
- `services/import_service.py`
  - Remote import jobs call `JobService.checkpoint()` between safe stages so pause/cancel is real and cooperative. Cancelling after a temporary CBZ download removes the tmp file before returning.
- `services/library_scan_service.py` / `services/library_scan_job_service.py`
  - Local library scan preview and background ingestion for already-present CBZ files under the managed library directory, routed through the task center as `library_scan` jobs.
- `services/workbench_service.py`
  - Read-only aggregator composing library/governance/jobs/files/exports summaries; never calls the NH API; one method `overview()` returning `{library, governance, files, exports, jobs, continue_reading, recent_added}` from real existing module services.
- `main.py`
  - Small FastAPI application factory: lifespan (interrupted-job recovery and export-artifact sweep), CORS, static Web mounting, and authentication enforcement for `/api` except health/auth bootstrap endpoints.

## API Status

Implemented:

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/change`
- `POST /api/auth/logout`
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
- `GET /api/library/search?q=&page=&per_page=&sort=&read_status=&source=&language=&tag_ids=&favorite_only=`
  - `tag_ids` is a comma-separated remote tag id list; non-numeric tokens are ignored. AND semantics.
- `GET /api/library/recent-added?limit=`
- `GET /api/library/recent-read?limit=`
- `GET /api/library/continue-reading?limit=`
- `GET /api/library/reading-history?page=&per_page=`
- `GET /api/library/statistics?days=&timezone_offset_minutes=`
- `GET /api/library/tag-filters?q=&limit=`
- `POST /api/library/scan/preview`
- `POST /api/library/scan`
- `GET /api/governance/queue`
- `GET /api/works/{work_id}/governance`
- `POST /api/works/{work_id}/governance/apply`
- `POST /api/works/{work_id}/governance/translate`
- `POST /api/governance/bulk/preview`
- `POST /api/governance/bulk/apply`
- `POST /api/governance/metadata-refresh/preview`
- `POST /api/governance/metadata-refresh/apply`
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
- `GET /api/works/{work_id}` (full local library work, progress, file facts, and structured real tags)
- `GET /api/works/{work_id}/cover`
- `GET /api/works/{work_id}/pages`
- `GET /api/works/{work_id}/pages/{page_index}`
- `GET /api/works/{work_id}/reader-state`
- `PATCH /api/works/{work_id}/reader-state`
- `PATCH /api/works/{work_id}/favorite`
- `POST /api/works/{work_id}/reading-sessions`
- `PATCH /api/works/{work_id}/reading-sessions/{session_id}`
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

## Web App Map

Root: `apps/web/src/`

- `docs/AGENT_MAP.md`
  - Fast locator for the active demo visual contract, nine module bodies/scenes, ordered CSS layers, formal page owners, and real API entry points. Read this before loading frontend files.
- `components/folio/`
  - Production-neutral full-screen visual system: page configuration, shell, navigation, animated module scenes/backdrops, shared controls, and ordered CSS layers.
  - Dependency direction is `demo -> folio` and `formal feature -> folio`; this directory must never import `components/demo/`.
- `components/demo/`
  - Public `/demo` content only: preview navigation/state, nine demo page bodies, and the demo command bar. Formal routes must not import this directory.

- `App.tsx`
  - `AuthGate` resolves access before hash route composition or route-level `React.lazy` boundaries mount. `ArchiveShell` stays in the initial shell while every primary/secondary page, both readers, and `/demo` load as independent chunks.
  - All primary and secondary routes are real pages: discover/gallery/library/history/readers/governance/dictionary/export/files/tasks/settings/workbench. No route remains a boundary screen.
  - Local and remote readers render directly as immersive viewports; all other routes render through `ArchiveShell`.
- `components/auth/AuthGate.tsx`
  - First visit creates any non-empty access password without character-combination rules; later visits accept that password and retain a 90-day HttpOnly/SameSite session. App content never mounts behind the gate, and any protected-request 401 returns the surface to login.
  - The top-right lock action revokes the current session. No username, account list, localStorage token, password recovery flow, or auth dependency is introduced.
- `lib/useGridColumns.ts`
  - A `ResizeObserver` counts the actual computed CSS grid tracks instead of guessing card width from `window.innerWidth`. Page sizes are derived only after measurement and remain divisible by the active column count.
- `lib/navigation.ts`
  - Hash route parser, `navigate()`, and `tagSearchHref()` as the single URL builder for tag-search anchors.
  - Routes include local `#reader/{work_id}`, remote `#reader/remote/{gallery_id}`, `#governance`, and `#governance/{work_id}`.
  - Formal tag surfaces use native anchors built by `tagSearchHref()`: primary click may keep the current in-app filtering behavior, while middle/modifier click opens the corresponding discover search in a new tab.
- `lib/motion/`
  - 阶段 0 动画原语层。`tokens.ts`(时长/缓动/stagger 常量,全站统一节奏)、`primitives.tsx`(`FadeIn`/`Stagger`/`StaggerItem`/`Reveal`/`Presence`,基于 `motion/react`)、`useReducedMotion.ts`、`index.ts` 出口。`FadeIn` 透传合法 div/ARIA 属性，因此消息的 `role`、`aria-label` 等语义不会被动画包装层吞掉。后续页面动画一律从此取用,禁止写魔法数。
- `components/effects/`
  - 从 magicui/react-bits 引入并改造后的效果组件落地处。`README.md` 为硬性接入规范(库只作效果来源、token 改造、`.fx-scope` 隔离、reduced-motion 降级)。当前含 `StaggerDemo`、`ShineBorder` 两个验证示例。
- `styles/tailwind-entry.css`
  - Tailwind v4 入口(方案 A:省略 Preflight、不加前缀、按层导入),`@theme` 将 `app.css` 设计 token 映射为 `--color-*`。在 `main.tsx` 中先于 `app.css` 引入。
- `lib/api.ts`
  - Typed API wrapper for implemented backend endpoints.
  - Discover GET calls use a short in-browser cache and in-flight request reuse to avoid duplicate feed/popular/detail/tag requests within one UI session. Import/library-scan completion, file deletion and dictionary/governance mutations invalidate cached local import/display state so remote cards cannot remain stale after local writes.
  - Dictionary API types and helpers live here: candidates, autocomplete, preview/apply, preview/import bulk rows.
  - Library API types/helpers: `LibrarySummary`, `LibraryWork`, `LibraryTagFilter`, `LibrarySearchParams`, and `library*` request methods (summary/search/recent-added/recent-read/continue-reading/tag-filters). Library calls are not run through the discover session cache.
  - Governance API types/helpers: queue, aggregate, explicit review approve/reopen, metadata translation suggestions, bulk preview/apply (fill missing metadata, write-back, confirm dictionary terms), remote metadata refresh preview/apply, and apply payload/result. Remote refresh invalidates discover cache only after a successful write.
  - Export API types/helpers: queue, preview, `downloadExport` / `downloadExportBundle` (blob fetch + browser save), `enqueueBulkExport` for task-center bulk artifacts, and persisted preset settings. Export calls are local-only and not run through the discover session cache.
  - Job API type/helpers: `Job` (including `created_at` / `updated_at`, `paused/cancelled/cancelling` statuses and bulk-export target fields), `JobLog`, `jobs()`, `jobLogs()`, `pauseJob()`, `resumeJob()`, `cancelJob()`, `retryJob()`, delete/clear, and bulk-export download URL.
- `vite.config.ts`
  - Dev proxy defaults `/api` to `http://127.0.0.1:8001`.
  - Set `VITE_API_PROXY_TARGET=http://127.0.0.1:<port>` when verifying against a temporary backend port.
- `components/layout/ArchiveShell.tsx`
  - Folio-only shell for every non-reader route. History reuses the library module context with its own heading; gallery detail reuses discover context while suppressing the repeated page heading. `scrollKey` resets each route/detail scroll position. `TaskDock` remains outside the chrome.
- `components/layout/RouteFallback.tsx`
  - Honest, data-free loading surfaces for lazy formal routes and the immersive reader. `RouteFallback.css` owns the paper-sheet loop and reduced-motion fallback; it must not duplicate page titles, metrics, or fake content.
- `components/layout/TaskDock.tsx`
  - Polls real `/api/jobs` only while the document is visible and schedules the next poll only after the previous request settles. The initial poll also uses a clearable zero-delay timer so React StrictMode can dispose its exploratory mount without issuing a duplicate request. It renders running/queued/paused/cancelling jobs, retryable failures, or a polling error so resumable/in-flight work cannot disappear from the global surface; `apps/web/e2e/taskdock.spec.ts` protects non-overlap plus hidden/visible behavior against a deliberately slow real response.
  - `TaskDock.css` owns its compact Folio live ledger, custom ARIA progress, responsive position above fixed action bars, and reduced-motion behavior. Retriable failures reuse the same `canRetry` boundary as the task center and expose guarded busy/error state.
- `components/folio/ui/FolioPrimitives.tsx`
  - Shared Folio search, field, toggle, empty-state and custom-select controls. The select popup is a native button group with `aria-pressed` state rather than an incomplete listbox implementation; Escape and selection both restore focus to the trigger.
- `components/folio/ui/FolioMetricGrid.tsx`
  - Shared real-data summary/status entries for formal routes. It owns icon/value/detail composition, semantic status tones, staggered entry and responsive layout; entries use separated light-paper panels without hover or shadow, while joined cells stay reserved for genuine record tables. The six-item library summary becomes a compact 3×2 grid at 560px and below.
- `styles/app.css`
  - Base-only root tokens/reset/form inheritance/shared spin/reduced-motion layer. The former legacy topbar, navigation, page, card, drawer, preview-modal, default pager/tag scroller, TaskDock and reader selectors have been removed or moved to direct component owners.
- `components/discover/DiscoverPage.tsx`
  - Direct Folio composition for `#discover`: real popular band, combined keyword/tag query, custom filters, one responsive card grid, notices and pager. It imports no demo code and contains no API orchestration.
  - Card/random/popular selection navigates to the real gallery detail route; import actions enqueue the existing real import flow.
- `components/discover/useDiscoverState.ts`
  - Owns restored query/filter/page/scroll state, current `.folio-scroll` persistence, measured four-row page sizing, stale feed-request invalidation, one-shot StrictMode-safe popular loading, remote search, random navigation and import actions.
  - Multiple tags retain their original remote names/ids/types; a single tag-only query uses `tag_id`, while combined keyword/tag filters preserve the remote namespace (`artist:`, `tag:`, `parody:`, etc.). A missing remote `total` remains explicit instead of being fabricated.
- `components/discover/DiscoverPage.css`
  - Production-only ranked editorial wall, query composer, custom filter row, result card grid/pager and four-viewport responsive layout. Desktop popular works form one five-poster shelf with titles below the artwork; mobile uses five fully visible compact poster columns with no horizontal scrolling. Replaced legacy discover/tag-picker/popular-fan selectors were removed from `styles/app.css`.
- `components/discover/DiscoverToolbar.tsx`
  - Keyword/Gallery ID input plus visible multi-tag chips, icon-only random action, equal-height query action, custom Folio language/type/sort menus and unimported toggle. Discover has no duplicate list-view mode; upload/scan are not toolbar modes.
- `components/discover/DiscoverFeed.tsx`
  - Result count, empty/error/notice states, dynamic current-page cards, icon pager.
- `components/discover/DiscoverCard.tsx`
  - Cover-first Folio card: title, author/group, page/language/ID, draggable tag row. Author/language labels use dictionary `display`; language skips generic `translated`.
- `components/discover/TagFilterSelector.tsx`
  - Real cached multi-select tag picker plus dictionary-aware autocomplete; Chinese input can search immediately, duplicate matches are collapsed by remote tag id, selected options stay at the top, and one fixed clear action removes all selected tags. It opens on content `tag` results only; author/group/parody/character/category/language live in a separate “作者与作品信息” scope. Mobile gives selected chips their own full-width row so the first chip cannot sit under the trigger.
  - Candidate scopes and the files/tasks/export segmented filters are filter button groups with `aria-pressed`; they are not tabs because they do not own tab panels.
  - Only terms with real remote tag IDs can be selected for discover remote filtering.
- `components/folio/ui/TagScroller.tsx`
  - Pointer-drag horizontal tag row with hidden scrollbar and click-to-filter support. Summary cards expose at most six native search anchors plus a non-interactive remainder count; drag suppression applies only to the primary pointer so middle/modifier navigation remains intact.
  - Uses `tag.display || tag.name || tag.slug || id`, so dictionary display names flow without rewriting card logic.
- `components/folio/ui/AmbientCover.tsx`
  - Shared primary-cover frame for popular, gallery hero, and reader info. The foreground always uses `contain`; a non-semantic duplicate supplies the blurred/dimmed ambient fill so mismatched ratios do not create dead bands or crop meaningful artwork.
- `components/discover/PopularFan.tsx`
  - Real `/api/discover/popular` five-item ranked editorial showcase between the Folio heading and search workbench. It has no viewport state, drag state or fabricated entries; every cover, title, count, import state and action comes from the real payload.
  - Desktop renders five portrait frames with copy below the image; mobile keeps all five in one non-scrolling row with compact 30px import rails.
  - Cards expose only real title/page/favorite/import state and never fabricate badges or statistics.
- `components/discover/GalleryDetailPage.tsx` + `components/discover/gallery/`
  - Direct route-local gallery composition split into real data/model, fixed-slot hero, full-width tag ledger, initial page preview, keyboard/focus-restoring lightbox, and related works. It imports no demo state.
  - The hero cover slot uses `AmbientCover`: the meaningful foreground stays `contain`, while the same-image ambient layer fills ratio gaps without losing edge content. The page lightbox remains `contain` and derives a clamped width from the active page ratio. Variable tag counts never share the cover column. Related results are capped at five and render as one five-column desktop row / five compact mobile rows, so the fixed five-item payload cannot orphan its last card. Import state has latest-request/unmount protection and a fixed-width busy/queued action.
- `components/discover/IconPager.tsx`
  - Icon-only first/previous/input/next/last pagination.
- `components/settings/` — refactored settings module:
  - `SettingsPage.tsx` — direct Folio composition with six horizontal chapters, unique section headings, animated chapter transitions, real sync/dirty state, inline feedback, and a viewport-fixed reload/save rail. It imports no demo state and has no left navigation.
  - `SettingsPage.css` — production-only settings layout, metrics, manifests, storage paths, fixed action rail, 1024/390/320 responsive rules, and reduced-motion fallback. Replaced settings deck/rail/form/export-recipe rules were removed from `styles/app.css`.
  - `useSettingsState.ts` — all real config state/actions, password-change drafts/action, latest-request and unmount protection, complete dirty comparison, secret-draft reset, and load/save/verify/clear flows. Hydration also synchronizes saved privacy/cover defaults into `ArchiveApp`, so cover blur changes apply to other routes without a reload. Validation actions only run against saved config.
  - `ConnectionSection` / `TranslationSection` / `PreferencesSection` / `ExportDefaultsSection` / `DataSection` / `StorageSection` — shared Folio fields/selects/toggles over real settings, auth, runtime, library, and file APIs. `PreferencesSection` owns the current/new/confirmation password controls; data/storage fetch only when their chapter is active. `settingsHelpers` owns only `StatusDot`.
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
  - Owns the existing real summary/shelf/search flow, stale-request invalidation, filters, paging, focused work, and cross-page multi-selection. The grid passes a measured whole-row page size: for example, five columns request 25 rather than the incomplete hardcoded 24. Independent overview requests still run in parallel.
- `components/library/LibraryPage.css`
  - Production-only library layout and responsive behavior. Mobile work details use an opaque bottom sheet with a backdrop; all replaced legacy library/inspector/batch rules were removed from `styles/app.css`.
- `components/library/LibrarySummaryStrip.tsx`
  - Real summary strip: 总收藏 / 已读 / 阅读中 / 未读 / 待补标签 / 占用容量. No broad 待治理 fabrication; 待补标签 = works with zero `work_tags`, while detailed governance state lives in the governance page.
- `components/library/LibraryToolbar.tsx`
  - Search form (submit on Enter), custom Folio language/status/source/sort selects, `LibraryTagFilter`, animated grid/list view toggle, reset, and removable selected-tag chips. Language options come from real summary facets.
- `components/library/LibraryTagFilter.tsx`
  - Multi-select tag picker backed by `/api/library/tag-filters` (local used tags only, debounced search, dictionary display names). Does not call NH API.
- `components/library/WorkCard.tsx`
  - Cover-first card with direct semantic controls: read status, source/language, author/group, page/ID, custom progress, content-only Tag row, and reader action. The Tag row filters strictly to `type=tag`; on mobile it becomes a centered two-column, three-row keyword grid instead of repeating author/language metadata or hiding useful tags. Language display skips generic translation markers and prefers a concrete language tag. Selection buttons are not nested; double-clicking the cover opens the reader.
- `components/library/WorkInspector.tsx`
  - Sticky desktop inspector and mobile bottom sheet for real file size/pages, source/ID, language, reading progress, tags, reader, governance, and export routes.
- `components/library/ContinueReadingRow.tsx`
  - Horizontal shelf for 继续阅读 / 最近添加; renders nothing when no real rows. The shared primary-pointer capture/threshold logic provides press-drag scrolling without accidental card activation in both library and workbench.
- `components/library/libraryHelpers.ts`
  - `formatBytes`, title/author/language/read-status derivation, and shared sort/status/source option lists.
- `components/history/`
  - `HistoryPage.tsx` directly composes the real date-bucket timeline, summary, pager and reader links inside the library Folio context; `useHistoryState.ts` owns request invalidation and pagination, while `HistoryPage.css` owns responsive timeline geometry.
  - History shows only aggregated real events from `/api/library/reading-history`; it never expands or invents per-page events.
- `components/reader/ReaderPage.tsx`
  - Immersive fixed-viewport reader outside `ArchiveShell`, with discriminated sources:
    - local `workId`: reads indexed CBZ pages and persists progress;
    - remote `galleryId`: reads remote `pages[].url` from gallery detail, does not save local progress, exposes import queue action.
  - `useReaderData.ts` owns latest-request/unmount guards, separate load/action feedback, normalized readable remote pages, debounced local progress and guarded import state. `WebtoonView` observes the actual reader scroller through a center band, so tall continuous pages update current-page progress reliably.
  - `ReaderToolbar` hides single-page direction controls in continuous mode; `ReaderScrubber` provides keyboard/touch progress without a native slider. `ReaderInfoPanel` groups real author/group, parody/character, content, category and language tags, retains the real gallery-display link, and contains no duplicate reader settings. `ThumbnailOverlay` clips its own width so large page counts cannot create a document-level horizontal scrollbar. `ThumbnailOverlay` and `ReaderJumpDialog` remain focus-restoring modal surfaces.
- `components/governance/GovernancePage.tsx`
  - Direct Folio composition for `#governance`: real queue rail, single/bulk modebar, automatic-check + human-review panel, metadata document and source-check rail. It imports no demo code and does not adapt legacy DOM.
  - Loads `/api/governance/queue`, auto-selects a real work when available, and loads `/api/works/{id}/governance` through `useGovernanceState`.
  - Empty library/empty queue is an honest empty state; no sample works, fake conflicts, or fake recommendations.
  - Fixed viewport action bar keeps save/write-back visible at every document length and includes real dictionary/export/reload routes. ComicInfo write-back and bulk write-back still require the existing irreversible-action confirmations.
- `components/governance/GovernancePage.css` / `GovernanceEditor.css`
  - Production-only three-column workspace, review/check ledger, work header, source rail, fixed command bar, bulk reports, translation decision cards, field provenance ledger and tag groups. Mobile keeps the real queue as a horizontal track and moves source evidence below the editor; no native checkbox chrome is visible.
- `components/governance/GovernanceReviewPanel.tsx`
  - Separates three automatic check groups (metadata/dictionary/files) from explicit human approval. Shows current/stale/approved state, requires notes for accepted warnings, and exposes reopen without pretending that a clean check equals human review.
- `components/governance/GovernanceTranslationPanel.tsx`
  - Field-scoped Chinese suggestion flow: select title/subtitle/summary, compare original and suggestion, then accept one/all or ignore. Acceptance only updates the editor; the fixed save action remains the sole persistence step.
- `components/governance/GovernanceSourceRail.tsx`
  - Real source type, Gallery ID, page/file facts, tag/dictionary counts and backend-recommended actions. It does not calculate or invent a health score.
- `components/governance/MetadataEditor.tsx`
  - Source/current/final field comparison with auto-growing textareas, adopt/revert actions and animated decision filtering. Source differences and missing required values enter the decision view; translation suggestions remain separate until explicitly accepted. “只看待确认” is an `aria-pressed` custom control, not a native checkbox.
- `components/governance/GovernanceQueueRail.tsx` / `GovernanceBulkBar.tsx`
  - Queue separates pending review, automatic metadata/dictionary/file issues, approved snapshots and all works, with an in-place definition for every filter. Bulk preview/apply remains real and read-only-before-apply; custom checkbox visuals preserve semantic inputs and mutation safeguards.
- `components/export/` — export center (browser-download model), split into focused modules:
  - `ExportPage.tsx` — direct Folio composition for real queue summary, toolbar, local-work list and CBZ recipe inspector. It imports no demo code.
  - `ExportPage.css` — production-only responsive source/recipe layout, custom selection/status controls, metadata ledger and sticky action recipe. Replaced global `.export-*` rules were removed from `styles/app.css`.
  - `useExportState.ts` — all state and data-fetching logic; queue loads and debounced preview requests have latest-response guards, so rapid rename/option/focus changes cannot restore stale previews. `downloadSelected()` still downloads one CBZ, a synchronous `.zip`, or enqueues a real bulk-export job over the existing threshold.
  - `ExportToolbar.tsx` — Folio search, animated status index, batch mode, select-ready, and clear actions.
  - `ExportWorkList.tsx` — semantic selectable work buttons with cover, title, remote ID/source, selection/focus state, and ready/warning/blocked status.
  - `ExportInspector.tsx` — focused-work output rename, ComicInfo preview, blockers/warnings, selected cover strip, semantic hidden-checkbox option switches, refresh, selected download, and current-work download.
  - `exportHelpers.tsx` — shared render utilities: `Cover`, export item status classification, and status labels.
  - Export delivers files to the user via the browser (`api.downloadExport` / `api.downloadExportBundle` fetch a blob and trigger a save); nothing is written to a server output directory and no history is kept. Original CBZs are never modified.
- `components/files/` — file maintenance module:
  - `FilesPage.tsx` — direct Folio composition for real overview, filters, semantic file list, pager, focused detail, cleanup preview, delete confirmation dialog and directory-scan preview. Desktop selection scrolls the existing side detail into view when it would otherwise sit below the first viewport; mobile keeps the bounded drawer. It imports no demo code.
  - `FilesPage.css` — production-only metric, toolbar, custom scrollbar, list/detail/maintenance rail and four-viewport responsive layout. Desktop keeps detail beside the inventory; 900px and below open focused detail as a bounded bottom operation drawer. Replaced global `.files-*` rules were removed from `styles/app.css`.
  - `useFilesState.ts` — owns one guarded file-operation state for delete preview/cleanup/delete/scan preview/scan enqueue; inventory requests retain latest-filter semantics and clamp invalid pages after deletion. Scan enqueue submits the exact paths from the visible preview instead of recalculating them.
  - `FileDeleteDialog.tsx` — native modal confirmation shared by single, batch and cleanup deletion; it stays viewport-visible, defaults focus to cancel, restores the triggering control, and shows warnings or execution failures in place.
  - `FileToolbar.tsx` — animated category index, Folio search/custom status and sort selects, and an always-present selection summary; there is no prerequisite “batch mode”.
  - `FileList.tsx` — separate always-visible checkbox and full-row focus button with real path/type/size/status, size-mismatch display and styled internal scrolling.
  - `FileDetailPanel.tsx` — focused real cover/path/metadata/structured tag links plus reader, gallery display, governance, export, native path-copy and delete-preview actions; cover respects `blurCovers`.
  - `FileHealthRail.tsx` — presentation-only real index and duplicate counts, cleanup launchers, read-only library-scan preview and guarded scan-task enqueue controls; async ownership stays in `useFilesState.ts`.
  - `fileHelpers.tsx` — byte/kind/status formatting and delete-target conversion.
- `components/tasks/` — task center:
  - `TasksPage.tsx` — direct Folio composition for `#tasks`: real status metrics, animated status index, search/refresh/confirmed clear, semantic task list, and source-of-truth inspector. It imports no demo code.
  - `TasksPage.css` — production-only responsive table/card layout, custom progress visuals, inspector progress ring and logs. The replaced global `.tasks-*` rules were removed from `styles/app.css`; visible operational text stays at 10px or above.
  - `useTasksState.ts` — polls `/api/jobs` every 2.5s only while the document is visible, filters by status/query, tracks focus, loads logs, and calls pause/resume/cancel/retry/delete. Job/log request tokens prevent stale poll or fast-focus responses from overwriting current state; single-record deletion now confirms before mutation.
  - `TaskSummaryStrip.tsx` — counts real queued/running/failed/completed jobs and today's updated jobs in the Folio hairline metric strip.
  - `TaskList.tsx` — semantic task rows with an independent focus button and action region, custom ARIA progress, target/stage/time, real download/retry/pause/resume/cancel/log/delete capabilities; no nested interactive controls or native progress chrome.
  - `TaskInspector.tsx` — focused job target, circular progress, errors/retry-after, bulk-export or scan facts, real controls, copy feedback, and durable job log timeline.
  - `taskHelpers.ts` — known job/stage/status labels, target formatting, retry eligibility, and time formatting.
  - Failed bulk exports and failed `remote_import` jobs with a real `gallery_id` can retry; running/queued jobs can pause/cancel; paused jobs can resume/cancel. Browser visual QA never triggers these mutations.
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

Default: repository-level `.local-data/`

- `archive.db`: SQLite database.
- `library/{work_id}.cbz`: imported source archive.
- `covers/{work_id}.{ext}`: extracted cover.
- `pages/`: reserved page cache.
- `tmp/`: download workspace.
- `exports/`: legacy export directory (still created by config/settings, but no longer written to — export now streams downloads to the browser).

## Verification

`apps/api/tests/conftest.py` assigns a stdlib temporary `NH_ARCHIVE_DATA_DIR` before test modules import the application. Keep this isolation: collecting API tests must never initialize or rebase the root `.local-data/archive.db` used by Compose.

Backend:

```bash
PYTHONPATH=apps/api pytest apps/api/tests -q
```

Frontend:

```bash
cd apps/web
npm run build
```
