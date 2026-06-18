# Phase 4 Governance Center Design

## Summary

Phase 4 turns the governance navigation boundary into a real, local-first workbench for per-work metadata and tag governance. The first shipped slice is a single-work loop: queue real works that need attention, open one work, compare current/local metadata against real source metadata, save final metadata decisions, and inspect tag/dictionary state.

This phase does not implement bulk governance, machine translation, export generation, or writing metadata back into the source CBZ. Unknown source values remain explicit unknowns.

## Product Behavior

- The governance queue lists only real library works from SQLite.
- Queue reasons are computed from real state: missing metadata, no tags, dictionary review/conflict status, missing ComicInfo, and missing cover.
- A selected work shows a real aggregate: header, files, metadata field diffs, tag groups, dictionary summary, and recommended local actions.
- Metadata fields can adopt a source value, be manually edited, or be cleared. Saving writes local final metadata only.
- Tag governance summarizes existing `work_tags` joined to dictionary rows. Dictionary write actions reuse existing dictionary apply boundaries.
- Original CBZ files are read-only in this phase; export/write-back belongs to Phase 5.

## Data Model

Add `work_metadata` as a field-level final metadata table:

- `work_id`
- `field`
- `value`
- `source`
- `source_value`
- `updated_at`

The table has `UNIQUE(work_id, field)` and references `works(id)` with cascade delete. It stores local governance decisions without bloating the `works` base table or mutating imported files.

## Interfaces

- `GET /api/governance/queue`
- `GET /api/works/{work_id}/governance`
- `POST /api/works/{work_id}/governance/apply`

`GovernanceAggregate` contains `work`, `files`, `metadata.fields`, `tags.groups`, `tags.summary`, `dictionary`, and `recommended_actions`.

`GovernanceApplyPayload` accepts only metadata field writes and optional dictionary apply payloads. Unknown or empty source values are represented as `null`; no fallback values are invented.

## UI Direction

The page follows `design/元数据.png`: queue/selection, work header, ComicInfo diff table, tag governance board, right-side quality summary, and bottom action bar. The visual language stays consistent with the existing warm paper, editorial headings, hairline panels, and terracotta primary actions.

Empty states must be honest. If the library is empty, the governance center says there are no works to govern rather than rendering sample rows.

## Acceptance

- Empty library returns an empty queue.
- A real CBZ without ComicInfo produces real queue reasons.
- A real CBZ with ComicInfo produces source metadata fields.
- Saving metadata persists and survives reload.
- Dictionary review/conflict rows affect tag/dictionary summary.
- Library, reader, dictionary, and settings still build and load.
