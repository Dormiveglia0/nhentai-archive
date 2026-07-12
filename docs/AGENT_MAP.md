# NH Archive Agent Map

Use this file as the first frontend navigation index. Read only the row for the module being changed; do not load the former monolithic demo files into context.

## Active Frontend Contract

- Visual source of truth: `http://127.0.0.1:5173/demo` and `frontend/src/components/demo/`.
- Formal application: hash routes composed by `frontend/src/App.tsx` and backed by real APIs in `frontend/src/lib/api.ts`.
- Migration rule: move the demo visual system onto the existing formal data/state components. Do not copy demo-only state into production and do not invent works, tasks, metrics, tag candidates, paths, or covers.
- Shared motion comes from `frontend/src/lib/motion/`; module scenes may use CSS keyframes but must respect `prefers-reduced-motion`.

## Demo Dependency Map

```text
FrontendDemo.tsx
  -> config.ts
  -> shell/FolioChrome.tsx
       -> shell/PageNavigation.tsx
       -> shell/PageHeading.tsx -> scenes/ModuleScene.tsx -> scenes/*Scene.tsx
       -> shell/ModuleBackdrop.tsx
  -> modules/DemoPage.tsx -> modules/*Demo.tsx
  -> ui/DemoCommandBar.tsx
  -> FrontendDemo.css -> styles/*.css (ordered imports)
```

`FrontendDemo.tsx` owns only demo navigation, privacy state, notices, and settings reset. If a change concerns layout, animation, a control, or a page body, edit its owner below instead of adding code to the entry file.

## Module Locator

| Module | Demo page body | Header scene | Primary CSS | Formal page/state | Real API entry |
| --- | --- | --- | --- | --- | --- |
| 工作台 | `demo/modules/WorkbenchDemo.tsx` | `demo/scenes/WorkbenchScene.tsx` | `demo/styles/workbench.css`, `scenes.css` prefix `folio-scene-hub-*` | `workbench/WorkbenchPage.tsx`, `useWorkbenchState.ts` | `api.workbenchOverview()` |
| 我的库 | `demo/modules/LibraryDemo.tsx` | `demo/scenes/LibraryScene.tsx` | `demo/styles/library-discover.css`, `scenes.css` prefix `folio-scene-library-*` | `library/LibraryPage.tsx` and feature components | `api.librarySummary/search/continueReading/recentAdded/tagFilters` |
| 发现 | `demo/modules/DiscoverDemo.tsx` | `demo/scenes/DiscoverScene.tsx` | `demo/styles/library-discover.css`, `scenes.css` prefix `folio-scene-discover-*`, backdrop prefix `folio-demo-radar-*` | `discover/DiscoverPage.tsx`, `DiscoverToolbar.tsx`, `TagFilterSelector.tsx` | `api.feed/search/tagged/popular/gallery/tagAutocomplete/importGallery` |
| 治理 | `demo/modules/GovernanceDemo.tsx` | `demo/scenes/GovernanceScene.tsx` | `demo/styles/governance-dictionary.css`, `scenes.css` prefix `folio-scene-governance-*` | `governance/GovernancePage.tsx`, `useGovernanceState.ts` | `api.governanceQueue/workGovernance/apply/bulk*` |
| 词典 | `demo/modules/DictionaryDemo.tsx` | `demo/scenes/DictionaryScene.tsx` | `demo/styles/governance-dictionary.css`, `scenes.css` prefix `folio-scene-dictionary-*` | `dictionary/DictionaryPage.tsx` and feature components | `api.dictionarySummary/candidates/evidence/preview/apply/*` |
| 队列 | `demo/modules/TasksDemo.tsx` | `demo/scenes/TasksScene.tsx` | `demo/styles/tasks-export-files.css`, `scenes.css` prefix `folio-scene-task-*` | `tasks/TasksPage.tsx`, `useTasksState.ts` | `api.jobs/jobLogs/pause/resume/cancel/retry/delete/clear` |
| 导出 | `demo/modules/ExportDemo.tsx` | `demo/scenes/ExportScene.tsx` | `demo/styles/tasks-export-files.css`, `scenes.css` prefix `folio-scene-export-*` | `export/ExportPage.tsx`, `useExportState.ts` | `api.exportQueue/preview/download/bundle/enqueueBulkExport` |
| 文件 | `demo/modules/FilesDemo.tsx` | `demo/scenes/FilesScene.tsx` | `demo/styles/tasks-export-files.css`, `scenes.css` prefix `folio-scene-files-*` | `files/FilesPage.tsx`, `useFilesState.ts` | `api.filesOverview/inventory/duplicates/previewDelete/deleteFiles` |
| 设置 | `demo/modules/SettingsDemo.tsx` | `demo/scenes/SettingsScene.tsx` | `demo/styles/settings.css`, `scenes.css` prefix `folio-scene-settings-*` | `settings/SettingsPage.tsx`, `useSettingsState.ts`, section components | `api.settings/updateSettings/verify*/runtime/scan*` |

Paths in the table are relative to `frontend/src/components/` unless stated otherwise.

## Shared Owners

| Concern | Owner |
| --- | --- |
| Page ids, labels, descriptions, icons, settings section definitions | `demo/config.ts` |
| Full-screen grid, topbar, mobile drawer, page transition, scroll reset/progress | `demo/shell/FolioChrome.tsx` |
| Top navigation item animation | `demo/shell/PageNavigation.tsx` |
| Standard title composition and scene placement | `demo/shell/PageHeading.tsx` |
| Large background atmosphere and discover radar hits | `demo/shell/ModuleBackdrop.tsx` + `demo/styles/base.css` |
| Scene routing only | `demo/scenes/ModuleScene.tsx` |
| Search field, custom select, field, toggle, empty state, panel heading | `demo/ui/DemoPrimitives.tsx` |
| Fixed demo action bar | `demo/ui/DemoCommandBar.tsx` |
| Demo page dispatch | `demo/modules/DemoPage.tsx` |

## CSS Load Order

`demo/FrontendDemo.css` is an ordered import manifest:

1. `styles/base.css` — paper tokens, atmosphere, binding progress, shared focus.
2. `styles/chrome.css` — topbar, nav, scroll container, page heading.
3. `styles/scenes.css` — nine scene animation systems.
4. `styles/workbench.css` — shared content primitives and workbench.
5. `styles/library-discover.css` — query composer, filters, library/discover surfaces.
6. `styles/governance-dictionary.css` — editor, evidence, modal.
7. `styles/tasks-export-files.css` — operational modules.
8. `styles/settings.css` — settings tabs, form sections, local transitions.
9. `styles/feedback-motion.css` — command bar, notices, keyframes.
10. `styles/responsive.css` — all breakpoints and reduced-motion overrides; keep this last.

Preserve this order. When adding a module-local rule, use the module layer; only cross-module primitives belong in an earlier shared layer.

## Fast Change Recipes

- Change one page layout: page body + its primary CSS file only.
- Change one header animation: that module's `*Scene.tsx` + its `folio-scene-{module}-*` rules in `scenes.css`.
- Change top navigation: `config.ts`, `PageNavigation.tsx`, then responsive nav rules.
- Change page background: `ModuleBackdrop.tsx` + the matching `folio-demo-atmosphere-{module}` rules in `base.css`.
- Change a select/input/toggle everywhere: `DemoPrimitives.tsx` + the owning shared CSS layer.
- Connect a demo module to real data: keep the formal hook/service, replace demo-only page state, and route calls through `lib/api.ts`; never fetch in scene components.

## Verification

```bash
cd frontend && npm run build
git diff --check
```

For rendered changes, verify `/demo` at 1440×1000 plus 390×844, click the changed control, check console errors/warnings, and compare the affected formal hash route when it has been migrated.
