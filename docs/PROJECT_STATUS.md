# NH Archive Project Status

## Current Version

Design baseline recovery, Phase 1.1.

Current real slice:

`NH API Key settings -> remote discover/search/detail -> import job -> local CBZ -> library -> reader -> progress save`

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
- Rebuilt discover page against `design/搜索导入.png`:
  - latest/popular/random/search/gallery ID modes
  - real search filters
  - grid/list switching
  - pagination
  - unimported-only filtering
  - right detail drawer
  - real import queue action
- Remote gallery cards now prefer Japanese title and show real cached author/language/tag data when available.
- Full navigation is visible, but unimplemented modules are explicit boundary screens.

## Not Implemented Yet

- Complete dictionary module:
  - local custom dictionary
  - bulk dictionary import
  - remote tag mapping
  - aliases
  - preview/apply
  - work tag links
- Enhanced library filters and pagination.
- Governance center.
- Export center.
- File maintenance.
- Job pause/resume/cancel controls.
- Workbench aggregate dashboard.

## Next Plan

Phase 2 should implement the full dictionary foundation, not a remote-tag-only selector.

Required dictionary scope:

- `local_tag_dictionary`, `tag_aliases`, `work_tags`.
- Local manual term creation and editing.
- Bulk dictionary import with preview.
- Remote tag mapping from cached/imported tags and `/api/v2/tags/search`.
- Apply preview before writing.
- Apply updates real `work_tags`.
- Discover page Chinese tag selector can use dictionary mapping, but must not pretend complex multi-tag semantics are complete.

## Risks And Decisions

- Decision: API Key settings and discover correctness are higher priority than expanding modules.
- Decision: language/type/sort controls must either call real APIs or be disabled; no inert clickable filters.
- Decision: unimplemented modules stay boundary screens.
- Risk: tag enrichment calls `/api/v2/tags/ids`; if remote rate limits, cards may show cached/empty tags rather than invented labels.
- Risk: search query syntax follows the compact API doc and should be manually checked against live API behavior.

## Verification Record

- `PYTHONPATH=backend pytest backend/tests -q`: passed, 7 tests.
- `npm run build`: passed.
- Static scan found no hardcoded fake work arrays or fake job arrays in frontend/backend code. Matches were documentation rules, state declarations, and empty-cover labels.
- Browser screenshot comparison is still pending in this environment.
