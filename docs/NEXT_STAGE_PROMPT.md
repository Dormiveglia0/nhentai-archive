# Next Stage Prompt: Phase 2 Dictionary Foundation

Use this prompt after Phase 1.2 unified discover feed is accepted.

## Required Reading Order

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md`
5. `design/词典.png`
6. `design/搜索导入.png`
7. `design/库.png`

## Task

Implement the complete dictionary foundation. This is not just remote tag autocomplete. Build local dictionary creation/editing, bulk import, remote tag mapping, alias support, preview/apply, and real `work_tags` links.

Current discover state to preserve:

- `/api/discover/feed` dynamically loads one page at a time and switches between latest/search/tagged based on real filters.
- Discover has a real cached/remote multi-select tag selector and tag chip boundary.
- Remote API calls are quota-protected in `NhentaiClient`: use existing client/service boundaries, do not call NH API directly, and do not add page-level polling or screenshot loops that bypass cache/cooldown.
- `TagScroller.defaultDisplayTag()` is the current display resolver seam; Phase 2 should extend it with dictionary/alias display names rather than rewriting every card.
- Random and Gallery ID use modal preview; Gallery ID is triggered from the single keyword input when the query is numeric.
- Card details use the same modal pattern for metadata/actions only. Do not put a reader tab or page-turning UI inside the modal.
- Reading routes to `ReaderPage`: local `#reader/{work_id}` persists progress, remote `#reader/remote/{gallery_id}` uses gallery `pages[].url` and does not save local progress.
- Popular design baseline is implemented in `components/discover/PopularFan.tsx`; preserve `docs/superpowers/specs/2026-06-14-discover-popular-fan-design.md`.
- Popular is an unframed title-side image-first five-cover sunset fan. It is visible beside the `发现 / 导入` title on first load, then scroll progress moves covers along a rightward semicircle arc until they clip out, and reverses the same arc on up-scroll. It must respect cover blur.
- Do not restore separate latest/popular/random pages.
- Do not implement popular as a permanent middle section, horizontal mini-list, right-side drawer, manual-only hidden popover, closeable modal, or bordered/shadowed window panel.
- Do not add large text/action blocks over popular covers; primary inspection belongs in the existing detail modal.
- Do not replace the semicircle path with linear translate/scale animation.
- Discover filters use custom menus, not native select controls.
- Discover layout should be title area + discovery controls/results, with popular embedded in the title area as the sunset fan.

## Hard Rules

- Do not add fake works, fake tags, fake candidate rows, fake impact counts, or fake task rows.
- Do not introduce uncached NH API request loops. Any remote dictionary/tag lookup must reuse `NhentaiClient` cache/cooldown behavior and prefer `remote_tags` cache before remote search.
- Empty dictionary data must render an empty state or import/create prompt.
- Bulk import must preview parsed rows before writing.
- Apply must show affected real works/tags before writing.
- Unimplemented machine translation and complex multi-tag AND/OR/NOT must remain disabled or clearly marked not connected.
- Update `PROJECT_STATUS.md`, `PROJECT_MAP.md`, and this prompt after the stage.

## Target Backend

- Add tables:
  - `local_tag_dictionary`
  - `tag_aliases`
  - `work_tags`
- Add `DictionaryService`:
  - `autocomplete(q, limit)` from local dictionary, aliases, cached remote tags, and real remote tag search.
  - `candidates(limit)` from real cached `remote_tags` and imported gallery tags.
  - `preview_apply(payload)` with real affected `work_tags`/works and conflicts, no writes.
  - `apply(payload)` writes dictionary and aliases, then updates real `work_tags`.
  - `preview_bulk_import(rows)` parses user-provided terms and reports duplicates/conflicts.
  - `bulk_import(rows)` writes accepted rows only.
- Import flow must cache gallery tags and link imported works to `work_tags`.

## Target Frontend

- Build `DictionaryPage` against `design/词典.png`:
  - candidate term pool
  - editor
  - evidence panel
  - apply preview tray
  - bulk import drawer or panel
- Add reusable `TagSelector`:
  - Chinese input
  - local dictionary hits
  - alias hits
  - remote tag hits when configured
  - no fake candidates
- Discover page may use mapped tag search; preserve multi-select semantics.
- Discover page tag rendering must map English/remote tags to dictionary display names when the dictionary has a match, while preserving the original remote tag for API queries.
- Discover page tag picker should keep its current open panel + search behavior and replace the display/source resolver with dictionary-aware results.
- Library page may expose a basic dictionary tag filter only if backed by real `work_tags`.
- The remote reader should keep its import queue action available, but dictionary work must not fake local progress for remote-only reading.

## Verification

- `PYTHONPATH=backend pytest backend/tests -q`
- `npm run build`
- Static scan for fake work/tag/job arrays.
- Manual visual review against `design/词典.png`.
- Manual flow:
  - create local dictionary term
  - import a small dictionary list with preview
  - map a cached remote tag
  - preview apply
  - apply and verify `work_tags` changes
