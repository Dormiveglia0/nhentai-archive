# Design QA: Task Center

final result: passed

Reference: `design/任务中心.png`
Prototype screenshots:
- `/tmp/nh-tasks-desktop-initial.png`
- `/tmp/nh-tasks-mobile-final.png`
- `/tmp/nh-tasks-mobile-logs.png`

Checked viewport states:
- Desktop 1440x980: hero, five metric cards, status tabs, task table, focused inspector, row actions.
- Mobile 390x900: compact hero, two-column metric cards, scrollable tabs, visible first task row, inspector/log navigation.

Blocking issues fixed:
- Removed the global bottom `TaskDock` from the task-center route so it no longer covers the task table.
- Restored the design's five-card metric strip and kept paused/cancelled in the status tabs.
- Added real row-level actions for pause, resume, cancel, retry, and logs.
- Tightened mobile layout so the first task row appears in the first viewport.
- Made the mobile log action scroll to the inspector/log area.

Verification:
- `cd frontend && npm run build`: passed.
- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`: passed, 76 tests.
- `git diff --check`: passed.
- Playwright: no console errors, no horizontal overflow, task page identity verified, pause/resume/cancel/retry/filter/search/log flows verified.
