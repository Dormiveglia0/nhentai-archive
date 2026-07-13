# Next Stage Prompt: Post-Closure QA And Polish

Use this prompt after the feature-complete local loop remains green (`pytest` + `npm run build`).

## Required Reading Order

1. `docs/AGENT_MAP.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_MAP.md`
4. `docs/DEVELOPMENT_RULES.md`
5. The relevant active demo module and formal component listed by the agent map.

## What Already Exists

- All primary modules are real pages: discover, library, reader, history, governance, dictionary, export, files, tasks, settings, and workbench.
- Governance supports single-work metadata decisions, metadata machine-translation suggestions, ComicInfo write-back, batch fill-missing metadata, batch ComicInfo write-back, source Web backfill, and batch confirmation of existing dictionary `review/conflict` terms.
- Export supports immediate browser downloads for single/small batches and `bulk_export` task-center jobs for selections over `EXPORT_SYNC_THRESHOLD`.
- Bulk-export artifacts are temporary: written as `.zip`, available from the task inspector, deleted after download, and swept after 24h.
- Library scan jobs, import jobs, and bulk-export jobs all route through the real task center.
- No fake works, fake jobs, fake metrics, fake covers, or adult sample assets should be added for QA.

## Next Work

- Use `components/folio/` as the production-neutral visual system and `/demo` as its visual regression surface. Never import `components/demo/` from a formal route.
- All formal routes, including gallery detail, history, and both readers, are directly migrated and browser-verified. Keep feature-local structure/CSS; do not restore legacy-shell adapters or import demo state.
- Remove only globally orphaned legacy shell/page selectors after an `rg` ownership check, then perform route-level lazy loading and a full application regression. Do not hide bundle warnings by raising thresholds.
- Browser QA against real or user-provided data after each route migration; compare the formal route with `/demo` at desktop and mobile sizes.
- Operational-page migration must preserve task state-machine controls, export download semantics, file-deletion previews/confirmations, and current real-data empty states.
- Mobile layout polish only where screenshots show concrete overlap, wrapping, density, or touch-reachability problems.
- Long-list performance checks for library/export/governance queues.
- Small user-feedback fixes. Keep them scoped and covered by the smallest relevant test.

## Verification

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
- `cd frontend && npm run build`
- `git diff --check`
- Static scan touched files for mock/sample/random hardcoded records.
- For visual work, run browser screenshot QA with real local data and include screenshots in the status update.
