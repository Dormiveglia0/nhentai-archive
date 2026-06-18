# Phase 4 Governance Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real single-work governance loop for metadata and tag review.

**Architecture:** Add a local-only `GovernanceService` that aggregates existing SQLite/archive state and writes final metadata decisions into a new `work_metadata` table. Expose thin FastAPI routes and replace the governance boundary screen with small React components backed by typed API calls.

**Tech Stack:** FastAPI, SQLite, pytest, React, TypeScript, existing CSS/motion primitives.

---

### Task 1: Backend Governance Service

**Files:**
- Modify: `backend/app/database.py`
- Create: `backend/app/services/governance_service.py`
- Test: `backend/tests/test_governance_service.py`

- [ ] Add failing tests for empty queue, missing ComicInfo reasons, ComicInfo parsing, metadata apply persistence, and dictionary review/conflict summaries.
- [ ] Add `work_metadata` schema and non-destructive migration.
- [ ] Implement queue reason calculation from `works`, `work_files`, `work_tags`, `local_tag_dictionary`, cover paths, and CBZ members.
- [ ] Implement aggregate loading from current `works`, persisted `work_metadata`, cached `remote_galleries.payload_json`, and CBZ `ComicInfo.xml` / JSON metadata files.
- [ ] Implement metadata apply writes with `INSERT ... ON CONFLICT`.

### Task 2: API Wiring

**Files:**
- Modify: `backend/app/main.py`

- [ ] Add Pydantic models for governance apply payload.
- [ ] Instantiate `GovernanceService`.
- [ ] Add `GET /api/governance/queue`, `GET /api/works/{work_id}/governance`, and `POST /api/works/{work_id}/governance/apply`.
- [ ] Return 404 for missing works and 422 for invalid apply payloads.

### Task 3: Frontend Governance Page

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/navigation.ts`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/governance/GovernancePage.tsx`
- Create: focused governance child components as needed.

- [ ] Add typed governance API shapes and request helpers.
- [ ] Support `#governance` and `#governance/{workId}`.
- [ ] Replace the boundary page with a real queue and selected-work aggregate view.
- [ ] Implement metadata table editing/adopt-source/revert/save.
- [ ] Implement tag governance groups and dictionary summary from real aggregate data.

### Task 4: Entry Points, Styling, And Docs

**Files:**
- Modify: `frontend/src/components/library/WorkInspector.tsx`
- Modify: `frontend/src/components/reader/ReaderPage.tsx`
- Modify: `frontend/src/styles/app.css`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/PROJECT_MAP.md`
- Modify: `docs/NEXT_STAGE_PROMPT.md`

- [ ] Turn library and reader governance buttons into real navigation.
- [ ] Add scoped governance CSS that follows the existing design system.
- [ ] Update docs with new service, APIs, data model, frontend page, and Phase 5 next-stage prompt.

### Verification

- [ ] `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
- [ ] `cd frontend && npm run build`
- [ ] `git diff --check`
- [ ] Static scan for fake/mock/random/hardcoded governance data and direct remote calls from `GovernanceService`.
