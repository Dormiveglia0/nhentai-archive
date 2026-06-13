# Next Stage Prompt: Phase 2 Dictionary Foundation

Use this prompt after Phase 1.1 settings/discover baseline is accepted.

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

## Hard Rules

- Do not add fake works, fake tags, fake candidate rows, fake impact counts, or fake task rows.
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
- Discover page may use single mapped tag search.
- Library page may expose a basic dictionary tag filter only if backed by real `work_tags`.

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
