# Next Stage Prompt: Phase 3 Library Enhancement

Use this prompt only after the Phase 2 dictionary refit is accepted and remains green.

## Required Reading Order

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md`
5. `design/库.png`
6. `design/词典.png`
7. `design/搜索导入.png`

## Task

Enhance “我的库” with real local data. Do not rewrite discover, popular fan, settings, or dictionary unless a library integration requires a small typed boundary change.

The current dictionary foundation is implemented:

- `local_tag_dictionary`, `tag_aliases`, `work_tags`
- `/api/dictionary/summary`, candidates, evidence, autocomplete, preview/apply, bulk import, ignore/review
- `DictionaryService.link_work_tags()`
- discover tag display uses dictionary `display` when mapped
- dictionary UI is aligned to `design/词典.png` with real summary, candidate table, editor, evidence tabs, preview tray, and bulk import preview

## Hard Rules

- Do not add fake works, fake covers, fake tags, fake reading history, fake statistics, or fake task rows.
- Large libraries must be paginated or virtualized; never render every work on one page.
- Empty library/search/filter states must show real empty states.
- Reuse `work_tags` and dictionary mappings for tag filters; do not re-query NH API from library pages.
- Do not regress dictionary UI or reintroduce fake dictionary suggestions/statistics.
- Unimplemented governance/export/file actions stay disabled or marked not connected.
- Keep `PROJECT_STATUS.md`, `PROJECT_MAP.md`, and this prompt updated after the stage.

## Target Backend

- Add `LibraryService`:
  - `summary()` from real `works`, `reader_progress`, `work_files`, and `work_tags`.
  - `search(q, page, per_page, sort, read_status, source, tag_ids)` with SQL-backed pagination.
  - `recent_added(limit)`, `recent_read(limit)`, and `continue_reading(limit)` from real tables.
  - `tag_filters(q, limit)` from `work_tags` joined to `remote_tags` and `local_tag_dictionary`.
- Add APIs:
  - `GET /api/library/summary`
  - `GET /api/library/search`
  - `GET /api/library/recent-added`
  - `GET /api/library/recent-read`
  - `GET /api/library/continue-reading`
  - `GET /api/library/tag-filters`
- Keep `/api/works` for compatibility, but new library UI should use `/api/library/search`.

## Target Frontend

- Rebuild `LibraryPage` against `design/库.png`:
  - editorial title area
  - real summary strip
  - search/filter/sort toolbar
  - paginated cover wall/list
  - selected work inspector
  - continue reading/recent sections only when real rows exist
- Add tag filter selector backed by `/api/library/tag-filters`; display Chinese dictionary names when available.
- Add pagination/per-page controls; no infinite full render.
- Work cards keep the current NH Archive visual language: warm paper, black title, terracotta primary action, thin separators, no fake module windows.

## Verification

- `PYTHONPATH=backend pytest backend/tests -q`
- `npm run build`
- Static scan for fake work/tag/history/stat arrays.
- Manual flow:
  - empty library shows 0 real stats
  - imported works appear in paginated search
  - reading progress filters work
  - dictionary tag filter returns only works linked through real `work_tags`
  - continue reading opens local reader and preserves progress
