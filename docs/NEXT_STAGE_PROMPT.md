# Next Stage Prompt: Phase 4 Governance Center

Use this prompt only after the Phase 3 library enhancement is accepted and remains green (`pytest` + `npm run build`).

## Required Reading Order

1. `docs/PROJECT_STATUS.md`
2. `docs/PROJECT_MAP.md`
3. `docs/DEVELOPMENT_RULES.md`
4. `design/nh_archive_product_design_flow.md` (chapter 9 治理中心, plus 4.4 阅读到治理闭环)
5. `design/元数据.png`
6. `design/库.png` (governance state surfaced back into the library)
7. `design/词典.png` (reuse dictionary apply/preview, do not fork it)

## What Already Exists (do not rebuild)

- Dictionary foundation: `local_tag_dictionary`, `tag_aliases`, `work_tags`, `DictionaryService` apply/preview/evidence/bulk-import, and `DictionaryService.link_work_tags()`.
- Library (Phase 3): `LibraryService` + `/api/library/*`, `LibraryPage` and its components. The library already reads real `work_tags`, reading state, and source-CBZ size, and shows a 待补标签 proxy (works with zero `work_tags`).
- Import flow links imported works to real gallery tags after CBZ ingest.
- Archive ingest caches the source CBZ; remote galleries/tags are cached in `remote_galleries` / `remote_tags`.

## Task

Build the governance center (作品治理) so metadata, ComicInfo, and tag conflicts become a continuous, real, per-work processing queue. Do not rewrite discover, popular fan, settings, dictionary, or library unless a governance integration needs a small typed boundary change.

## Hard Rules

- No fabricated completeness, fake diffs, fake conflicts, fake recommended actions, or fake metadata sources. Every field’s current/source/suggested value and dirty state must come from real data (`works`, `work_files`, `work_tags`, `remote_galleries` cached payload, `local_tag_dictionary`, ComicInfo/meta parsed from the real CBZ when present).
- If a source value is unknown (e.g. no ComicInfo.xml in the archive), say so explicitly; do not invent one.
- Machine-translation suggestions stay disabled until a real suggestion source exists, exactly as the dictionary editor already does.
- Reuse `DictionaryService.preview_apply()` / `apply()` for tag/dictionary writes from governance. Do not duplicate dictionary write logic.
- Governance writes go to local final data only; never mutate the original CBZ in this phase (export center owns new-file generation in Phase 5).
- Keep `/api/works` and `/api/library/*` working; the library must keep loading.
- Keep `PROJECT_STATUS.md`, `PROJECT_MAP.md`, and this prompt updated after the stage; write the Phase 5 prompt here when done.

## Target Backend

- Add `GovernanceService` (`backend/app/services/governance_service.py`), SQLite + real-file backed:
  - `queue(filters)`: works needing attention, grouped by real reasons — missing metadata, untagged, tag conflicts (e.g. a `work_tags` row whose `remote_tag_id` maps to a dictionary term in `review`/conflict), missing ComicInfo, missing cover. Counts must be real `COUNT`s.
  - `work_governance(work_id)`: the aggregate in design-flow §9.3 — `work`, `files`, `metadata` (original/working/diff with per-field source + dirty), `tags` (groups + summary confirmed/pending/conflicts), `dictionary` (matched/pending/conflicts), `exports` (empty until Phase 5), `recommended_actions`.
  - `apply(work_id, payload)`: persist confirmed metadata/working values and tag decisions to local final data (decide and document the storage: a new `work_metadata` / `work_governance` table, or columns on `works`). Reuse dictionary apply for tag→dictionary writes.
  - Add ComicInfo/meta parsing helpers (read `ComicInfo.xml` / `*.json` members from the stored CBZ) so metadata source values are real.
- Add a migration in `database.py` for any new governance tables/columns following the existing `_migrate_legacy_schema` pattern; never drop user data.
- Add APIs (mirror existing thin-route style in `main.py`, wrap remote-free logic without `_remote`):
  - `GET /api/governance/queue`
  - `GET /api/works/{id}/governance`
  - `POST /api/works/{id}/governance/apply`
  - (optional, only after single-work apply is solid) `POST /api/governance/bulk-preview`, `POST /api/governance/bulk-apply`

## Target Frontend

- Rebuild the `governance` boundary page in `App.tsx` into a real page against `design/元数据.png`:
  - governance queue (reasons with real counts; selecting a work opens its governance view)
  - work header (cover, title, ID, source, files, pages, size, real completeness)
  - ComicInfo diff editor (current vs source vs suggestion, dirty markers, adopt-source / revert; machine suggestion visibly disabled)
  - tag governance board grouped by type, reusing dictionary apply/preview boundaries
  - bottom action bar (save changes, apply dictionary; reparse/export stay disabled until their phases)
- Keep page files thin; put logic in small feature components under `components/governance/`.
- Add typed API methods/types in `lib/api.ts` (do not route governance through the discover session cache).
- Surface a real governance-completeness signal back into the library inspector/summary, replacing the 待补标签 proxy if the richer state covers it.
- Add `governance` navigation/routing wiring already exists (boundary today); upgrade in place. Add a “从阅读器进入治理” entry only if it routes to the real governance page.

## Verification

- `PYTHONPATH=backend pytest backend/tests -q` (add real `test_governance_service.py`: queue counts, aggregate shape from a real ingested CBZ with/without ComicInfo, apply persistence, dictionary-reuse on tag apply).
- `npm run build`.
- Static scan for fake metadata/diff/conflict/recommended-action/stat arrays.
- In-process API smoke (TestClient needs `httpx`; otherwise call route functions directly as in Phase 3): empty governance queue is real-empty; after importing a real CBZ, the aggregate reports real files/tags/metadata; apply persists and re-reads; library still loads.
- Manual flow (browser QA is local-data only and safe to rerun): import a CBZ → open 治理 → confirm header/diff/tags are real → apply → library reflects the updated governance state → reader still opens and preserves progress.

## Notes For Stability

- Decide the metadata persistence model early and write it into `PROJECT_MAP.md`; an ambiguous “working metadata” store is the main risk for this phase.
- Prefer extending existing tables/services over new parallel systems; the dictionary and library already own tags and reading/file state.
- If a design detail in `元数据.png` conflicts with real data availability, follow `DEVELOPMENT_RULES.md` + design-flow §0.2 priority (real data > design fidelity) and record the deviation in `PROJECT_STATUS.md`.
