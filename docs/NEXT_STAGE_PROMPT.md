# Next Stage Prompt: Post-Closure QA And Polish

Use this prompt after the feature-complete local loop remains green (`pytest` + `npm run build`). The latest closure baseline is 222 backend tests plus the route-split frontend build; the 2026-07-16 visual baseline covers 10 core entries at 1440×1000 and 390×844, 10 core interaction paths, reduced-motion behavior, and the TaskDock slow-response regression.

## Required Reading Order

1. `docs/AGENT_MAP.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_MAP.md`
4. `docs/DEVELOPMENT_RULES.md`
5. The relevant active demo module and formal component listed by the agent map.

## What Already Exists

- Run the complete development stack with root `npm run dev`; do not require users to manage separate API/Web terminals. `npm run dev -- --check` is the non-starting environment check.
- Deployable code lives in `apps/api/` and `apps/web/`; runtime state belongs in root `.local-data/`. Do not restore top-level `backend/` / `frontend/` folders or place user archives inside either app.
- The same SQLite may cross host and Compose runtimes. Preserve startup rebasing for legacy `.local-data/...` and container `/data/...` paths, and never rewrite a managed path unless its target exists under the active data root.
- Keep `apps/api/tests/conftest.py` test-data isolation. A plain pytest run must not initialize, migrate or rebase the Compose database under root `.local-data/`.
- Backend startup is split by responsibility: `main.py` creates the app, `container.py` assembles dependencies, `api/<domain>.py` owns HTTP routes, and `services/` owns behavior. Extend the matching domain router instead of rebuilding a monolithic entrypoint.
- Shared frontend metric entries, pagination, tag scrolling, and work shelves live in `components/folio/ui/`; shared presentation formatting and job rules live in `lib/format.ts` and `lib/jobs.ts`. Feature folders are not cross-feature utility buckets.
- All primary modules are real pages: discover, library, reader, history, governance, dictionary, export, files, tasks, settings, and workbench.
- Governance supports single-work metadata decisions, metadata machine-translation suggestions, ComicInfo write-back, batch fill-missing metadata, batch ComicInfo write-back, source Web backfill, and batch confirmation of existing dictionary `review/conflict` terms.
- Library batch metadata refresh is preview-before-apply. Preserve its exact-ID/ComicInfo-Web/manual-ID priority, fuzzy thresholds (92 confidence, 7-point margin, page match unless confidence is 97), duplicate-link rejection, server-side apply re-ranking, fresh detail fetch, stale remote-tag replacement, local source ownership, and manual metadata decisions. Never trust browser-supplied confidence or auto-apply an ambiguous candidate.
- Governance queue totals mean actionable works, not library size; language completeness honors real language tags unless an explicit metadata decision overrides them. Opening a work must never stage a source-value change by itself.
- Export supports immediate browser downloads for single/small batches and `bulk_export` task-center jobs for selections over `EXPORT_SYNC_THRESHOLD`.
- Bulk-export artifacts are temporary: written as `.zip`, available from the task inspector, deleted after download, and swept after 24h.
- Library scan jobs, import jobs, and bulk-export jobs all route through the real task center.
- No fake works, fake jobs, fake metrics, fake covers, or adult sample assets should be added for QA.

## Next Work

- Use `components/folio/` as the production-neutral visual system and `/demo` as its visual regression surface. Never import `components/demo/` from a formal route.
- All formal routes, including gallery detail, history, and both readers, are directly migrated and browser-verified. Keep feature-local structure/CSS; do not restore legacy-shell adapters or import demo state.
- The globally orphaned legacy shell/page selectors are removed, `app.css` is base-only, and formal routes already load through route-level lazy boundaries with honest Folio/reader fallbacks. Preserve that split and do not raise warning thresholds.
- Browser QA against real or user-provided data after each route migration; compare the formal route with `/demo` at desktop and mobile sizes.
- Operational-page migration must preserve task state-machine controls, export download semantics, file-deletion previews/confirmations, and current real-data empty states.
- File operations have one owner: keep delete/cleanup/scan async state in `files/useFilesState.ts`; deletion must remain preview → viewport-level confirmation, work metadata may be removed only after its managed files are successfully deleted, and scan enqueue must submit the exact paths from the visible preview rather than recomputing targets.
- Preserve the simplified flows now verified in production: discover is grid-only, its tag picker defaults to content tags with author/work metadata in a separate scope, selected tags stay first with one clear-all action, continuous reader progress is derived from the actual reader scroller, reader info retains grouped local metadata tags and the gallery link, saved cover blur updates `ArchiveApp` immediately, and file rows are directly selectable with desktop-side/mobile-drawer actions.
- Preserve native link semantics for every formal tag surface through `tagSearchHref()`: ordinary left click may filter in place, but middle/modifier click must open discover search in a new tab. Keep shared library/workbench shelves press-draggable, the reader page index horizontally clipped, the gallery lightbox ratio-constrained, and the fixed five related works free of orphan rows.
- Mobile layout polish only where screenshots show concrete overlap, wrapping, density, or touch-reachability problems.
- Use `FolioMetricGrid` for cross-route KPI/status summaries. Keep genuine record tables and compact inspector facts in their owning feature; do not recreate joined spreadsheet cells for read-only top-level summaries.
- Long-list performance checks for library/export/governance queues; route splitting is complete, so optimize measured render/fetch bottlenecks rather than reorganizing chunks speculatively.
- Dictionary candidate matching must keep separate indexed joins for direct remote ID, normalized name and normalized slug. The audited real baseline is p50 11.3ms / p95 12.4ms at 5313 remote tags; the 55313-tag isolation baseline is p95 112ms for the ordinary first page, 34ms for configured filtering and 69ms for a local keyword scan.
- Preserve the 2026-07-15 measured backend baseline: workbench overview about 31ms, export summary about 7ms, full export queue about 13ms, file inventory about 10ms and job list about 5ms on the current 23-work/967-page local library. Re-profile before adding caching or query abstractions.
- Preserve startup recovery semantics: queued/running work is failed as retryable after process restart, cancelling becomes cancelled, and paused remains resumable. Remote-import enqueue must stay idempotent per gallery.
- Preserve the accessible control model: segmented filters are button groups with `aria-pressed`, custom Folio selects return focus to their trigger, and animated feedback wrappers must keep alert/status/ARIA attributes. The global TaskDock must continue showing paused and cancelling work; its initial poll must remain StrictMode-safe, non-overlapping, hidden while paused, and covered by `apps/web/e2e/taskdock.spec.ts`.
- Small user-feedback fixes. Keep them scoped and covered by the smallest relevant test.

## Verification

- `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`
- `cd apps/web && npm run build`
- `git diff --check`
- Static scan touched files for mock/sample/random hardcoded records.
- For visual work, run browser screenshot QA with real local data and include screenshots in the status update.
