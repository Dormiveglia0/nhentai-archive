# Discover Filter Workbench Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the discover/import filter bar stable, dictionary-aware, and honest about remote query behavior.

**Architecture:** Keep the existing discover feed and CSS system. Fix backend query construction at `DiscoverService`, keep tag search on dictionary-backed APIs, and make selected tags live inside the popover instead of the page flow.

**Tech Stack:** FastAPI service tests with pytest; React + TypeScript; existing `app.css`; lucide icons.

---

### Task 1: Backend Query Semantics

**Files:**
- Modify: `backend/app/services/discover_service.py`
- Modify: `backend/tests/test_settings_and_discover.py`

- [x] **Step 1: Write the failing test**

```python
def test_discover_feed_without_filters_ignores_sort_fallback_and_uses_latest(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    service.feed(page=2, per_page=24, sort="popular")

    assert client.calls == [("latest", 2, 24)]
```

- [x] **Step 2: Verify red**

Run:

```bash
PYTHONPATH=backend .venv/bin/pytest backend/tests/test_settings_and_discover.py::test_discover_feed_without_filters_ignores_sort_fallback_and_uses_latest -q
```

Expected before implementation: fails because the old code calls `search("pages:>0", ...)`.

- [x] **Step 3: Implement minimal backend change**

Remove the `pages:>0` fallback. `feed()` calls search only when `build_search_query()` returns a real query.

- [x] **Step 4: Verify green**

Run:

```bash
PYTHONPATH=backend .venv/bin/pytest backend/tests/test_settings_and_discover.py::test_discover_feed_without_filters_ignores_sort_fallback_and_uses_latest backend/tests/test_settings_and_discover.py::test_discover_search_query_adds_real_remote_filters -q
```

### Task 2: Tag Picker Layout

**Files:**
- Modify: `frontend/src/components/discover/TagFilterSelector.tsx`
- Modify: `frontend/src/styles/app.css`

- [x] **Step 1: Move selected tags out of normal document flow**

Remove the selected-chip row rendered below the tag trigger. Show selected tags only in the absolute-positioned `.tag-picker` popover.

- [x] **Step 2: Keep trigger compact**

Show `first selected tag +N` inside the trigger. No selected state may change `.discover-toolbar` height.

- [x] **Step 3: Keep keyboard behavior**

The picker is inside the toolbar form, so the picker search must be a `div` plus `onKeyDown` for Enter, not a nested `<form>`.

- [x] **Step 4: Verify in browser**

Run Playwright against `#discover`, select a tag, compare `.discover-toolbar` height before/after, and require no console warnings.

### Task 3: Search Row And Language Display

**Files:**
- Modify: `frontend/src/components/discover/DiscoverToolbar.tsx`
- Modify: `frontend/src/components/discover/DiscoverCard.tsx`
- Modify: `frontend/src/styles/app.css`

- [x] **Step 1: Random button**

Place the icon-only random button in `.view-actions`, immediately to the left of the submit/query button. Use `aria-label` and `title`; no visible “随机” text.

- [x] **Step 2: Remove remote query notice**

Do not show raw backend query strings such as `远端查询：pages:>0` in the feed notice area.

- [x] **Step 3: Language label priority**

Use tag `display` for author/language labels. For language tags, ignore `translated`; if no concrete language tag exists, show `语言未缓存`.

### Task 4: Verification

- [x] **Step 1: Focused backend tests**

```bash
PYTHONPATH=backend .venv/bin/pytest backend/tests/test_settings_and_discover.py backend/tests/test_dictionary_service.py -q
```

- [x] **Step 2: Full backend tests**

```bash
PYTHONPATH=backend .venv/bin/pytest backend/tests -q
```

- [x] **Step 3: Frontend build**

```bash
cd frontend && npm run build
```

- [x] **Step 4: Diff and static scan**

```bash
git diff --check
rg -n "mock|fake|sample|random|placeholder|hardcoded" <touched files>
```
