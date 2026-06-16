# NH Archive Project Status

## Current Version

Design baseline recovery + dictionary foundation refit, Phase 2.

Current real slice:

`NH API Key settings -> remote discover/search/detail -> dictionary mapping -> remote reader or import job -> local CBZ/work_tags -> library -> local reader -> progress save`

## Completed

- Restored code baseline to `5a85959` and removed the previous incomplete dictionary/settings/library UI stack.
- Kept project/product documentation as the development memory layer.
- Added real settings APIs:
  - `GET /api/settings`
  - `PATCH /api/settings`
  - `POST /api/settings/nhentai/verify`
- Added runtime NH API Key update:
  - Environment variable key has priority.
  - DB key can be saved/cleared from the UI.
  - API key text is never returned to the frontend.
- Rebuilt settings page against `design/设置.png` as a minimal real settings surface.
- Rebuilt discover page against `design/搜索导入.png`, with a later design decision recorded in `docs/superpowers/specs/2026-06-14-discover-popular-fan-design.md`:
  - structure is now title area + discovery controls/results
  - 今日热门 is a title-side image-first sunset fan driven by scroll progress
  - unified discovery feed instead of separate latest/popular/random pages
  - current-page dynamic loading only; remote `total/num_pages` is pagination metadata
  - real feed/search/tagged routing for latest-like browsing, language/type/sort, keyword, and single/multiple remote tags
  - real popular fan uses `/api/discover/popular`, shows real covers, respects cover blur, and does not poll
  - popular fan visual correction: no bordered/shadowed window container, no large cover-obscuring title/action blocks, no fade-only or scale-only animation; covers follow a rightward semicircle arc and clip out on down-scroll, then reverse on up-scroll
  - mobile popular fan stays visible and supports touch drag as a circular carousel so each real popular work can move into the center position
  - random, Gallery ID, and card detail modal previews with backdrop/Escape close
  - detail modal is information/actions only; `阅读` routes to the full reader page
  - remote read-only reader route `#reader/remote/{gallery_id}` uses real gallery page URLs when available and does not save local progress
  - single keyword/Gallery ID input; removed redundant remote search and Gallery ID tabs
  - grid/list switching
  - icon-only first/previous/page input/next/last pagination
  - unimported-only filtering
  - real import queue action
- Remote gallery cards now prefer Japanese title and show real cached author/language/tag data when available.
- Discover cards were reworked toward `design/库.png`: cover-first vertical layout, fixed metadata order, and draggable hidden-scrollbar tag rows.
- Discover tag filter uses dictionary-aware autocomplete/display mapping while preserving original remote tag IDs/names for remote queries.
- Discover visual hierarchy was tightened: removed stacked section panels, centered feed cards, custom filter menus, softer import-state chips.
- Task dock no longer stays visible when no running/queued/failed job or job API error exists.
- Added API quota protection after live screenshot QA hit remote rate limits:
  - backend request-key TTL cache for cacheable NH API calls;
  - backend 429 cooldown that stops repeated remote forwarding and can serve stale cached data;
  - frontend discover-session cache and in-flight reuse for feed/popular/detail/tag GET calls.
- Full navigation is visible, but unimplemented modules are explicit boundary screens.
- Implemented and refit Phase 2 dictionary foundation:
  - tables: `local_tag_dictionary`, `tag_aliases`, `work_tags`
  - APIs: `/api/dictionary/summary`, `/api/dictionary/candidates`, `/api/dictionary/evidence`, `/api/dictionary/autocomplete`, `/api/dictionary/preview-apply`, `/api/dictionary/apply`, `/api/dictionary/preview-bulk-import`, `/api/dictionary/bulk-import`, `/api/dictionary/{id}/ignore`, `/api/dictionary/{id}/review`, `DELETE /api/dictionary/{id}`
  - `DictionaryService` supports real summary, local creation/editing, alias lookup, cached remote tag candidates, remote tag search through the existing cached client, evidence lookup, apply preview, apply, status changes, delete, bulk import preview/import, and real `work_tags` linking.
  - Bulk import accepts the minimum row shape `原文, 中文名`; type and aliases are optional. Imported rows automatically map to cached remote tags by normalized original text and type when possible.
  - Import flow links imported works to real gallery tags after CBZ ingestion.
  - Discover cards/tag selector render dictionary `display` names when mapped, without using Chinese names as remote API query tokens.
  - `DictionaryPage` was refit against `design/词典.png`: top summary strip, table-like candidate pool, editor with aliases/scope chips and disabled machine suggestion state, evidence tabs, expandable apply preview, and row-level bulk import preview.

## Not Implemented Yet

- Enhanced library filters and pagination.
- Governance center.
- Export center.
- File maintenance.
- Job pause/resume/cancel controls.
- Workbench aggregate dashboard.

## Next Plan

Phase 3 should enhance “我的库” using real local data and the new `work_tags` links, only after the Phase 2 dictionary refit remains green.

Required library scope:

- Add backend `LibraryService` for real summary, paginated search, sorting, reading-state filters, source filters, and dictionary tag filters.
- Replace the current simple `/api/works` frontend list with the `design/库.png` library layout.
- Add pagination/per-page controls so large libraries never render all works on one page.
- Add continue-reading/recently-added/recently-read sections only from real `reader_progress`, `reading_history`, and `works`.
- Use dictionary display names for tag filters and work tag rows where mappings exist.

## Risks And Decisions

- Decision: API Key settings and discover correctness are higher priority than expanding modules.
- Decision: language/type/sort controls must either call real APIs or be disabled; no inert clickable filters.
- Decision: Latest-like browsing uses `/api/discover/feed`; it switches to search/tagged only when filters require remote search semantics.
- Decision: Popular is a progressive title-side image-first sunset fan, not a permanent section, not a horizontal mini-list, not a framed panel, and not a manual-only hidden popover.
- Decision: Gallery ID is handled by the main keyword input when the query is pure numeric; no separate Gallery ID tab.
- Decision: Type filtering is limited to confirmed UI options `doujinshi` and `manga` until broader remote type semantics are verified.
- Decision: Card details use a modal, not a right-side drawer; no discovery layout space is reserved for details.
- Decision: Multiple selected tags use search query `tag:"..."` terms; single tag without other filters may use `/api/discover/tagged`.
- Decision: all future remote-backed modules must use cached service/client boundaries and must not call NH API directly from page-level loops or screenshot scripts.
- Decision: dictionary autocomplete only calls remote tag search when local dictionary/cache has no hit, reducing API quota pressure.
- Decision: local-only dictionary terms can be created, but discover remote filtering only selects terms mapped to real remote tag IDs.
- Decision: machine suggestions remain disabled until a real suggestion source exists; the UI must not invent suggestions.
- Decision: dictionary candidate/evidence/preview metrics are computed from SQLite tables only.
- Decision: unimplemented modules stay boundary screens.
- Risk: tag enrichment calls `/api/v2/tags/ids`; if remote rate limits, cards may show cached/empty tags rather than invented labels.
- Risk: search query syntax follows the compact API doc and should be manually checked against live API behavior.

## Verification Record

- `PYTHONPATH=backend pytest backend/tests -q`: passed, 21 tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- Static scan found no restored right-side drawer, modal reader tab, fake work arrays, invalid discover type options, or fake dictionary candidate arrays. Matches were rule/documentation text, placeholders in input fields, and real `samples` preview fields.
- Browser screenshot QA ran after Playwright became available and exposed remaining visual issues plus API quota pressure. Do not rerun remote-backed screenshot loops until NH API cooldown has cleared or a local response fixture/proxy is introduced for visual-only QA.
- Dictionary screenshot QA attempted with a local 8002 backend and Vite proxy override, but the final Playwright screenshot command was blocked by environment usage limits. Code/build/API verification passed; visual QA should be rerun by opening `#dictionary` after restarting backend.
