# NH Archive Agent Map

Use this file as the first frontend navigation index. Read only the row for the module being changed; do not load the former monolithic demo files into context.

## Active Frontend Contract

- Visual source of truth: `http://127.0.0.1:5173/demo`, shared system `frontend/src/components/folio/`, and demo-only bodies in `frontend/src/components/demo/modules/`.
- Formal application: hash routes composed by `frontend/src/App.tsx` and backed by real APIs in `frontend/src/lib/api.ts`.
- Dependency direction: `demo -> folio` and `formal feature -> folio`. `folio` must never import `demo`; formal routes must never import demo modules or demo state.
- Migration rule: rewrite each formal page structure with Folio components while retaining its existing real state hook/API flow. Do not skin legacy DOM with cross-page override CSS. Do not copy demo-only state or invent works, tasks, metrics, tag candidates, paths, or covers.
- Shared motion comes from `frontend/src/lib/motion/`; module scenes may use CSS keyframes but must respect `prefers-reduced-motion`.

## Demo Dependency Map

```text
FrontendDemo.tsx
  -> ../folio/config.ts
  -> ../folio/shell/FolioChrome.tsx
       -> ../folio/shell/PageNavigation.tsx
       -> ../folio/shell/PageHeading.tsx -> ../folio/scenes/ModuleScene.tsx -> scenes/*Scene.tsx
       -> ../folio/shell/ModuleBackdrop.tsx
       -> ../folio/Folio.css -> ../folio/styles/*.css
  -> modules/DemoPage.tsx -> modules/*Demo.tsx
       -> ../folio/ui/FolioPrimitives.tsx
  -> ui/DemoCommandBar.tsx
```

`FrontendDemo.tsx` owns only demo navigation, privacy state, notices, and settings reset. `components/folio/` owns reusable visual structure. `components/demo/` owns only public-preview content and must not become a production dependency.

## Module Locator

| Module | Demo page body | Header scene | Primary CSS | Formal page/state | Real API entry |
| --- | --- | --- | --- | --- | --- |
| 工作台 | `demo/modules/WorkbenchDemo.tsx` | `folio/scenes/WorkbenchScene.tsx` | `folio/styles/workbench.css`, `scenes.css` prefix `folio-scene-hub-*` | `workbench/WorkbenchPage.tsx`, `useWorkbenchState.ts` | `api.workbenchOverview()` |
| 我的库 | `demo/modules/LibraryDemo.tsx` | `folio/scenes/LibraryScene.tsx` | `library/LibraryPage.css`, shared shelf/control rules in `folio/styles/library-discover.css`, scene prefix `folio-scene-library-*` | `library/LibraryPage.tsx`, `useLibraryState.ts` and feature components | `api.librarySummary/search/continueReading/recentAdded/tagFilters` |
| 发现 | `demo/modules/DiscoverDemo.tsx` | `folio/scenes/DiscoverScene.tsx` | `discover/DiscoverPage.css`, shared controls in `folio/styles/library-discover.css`, scene prefix `folio-scene-discover-*`, backdrop prefix `folio-radar-*` | `discover/DiscoverPage.tsx`, `useDiscoverState.ts` and feature components | `api.feed/popular/random/dictionaryCandidates/dictionaryAutocomplete/importGallery` |
| 治理 | `demo/modules/GovernanceDemo.tsx` | `folio/scenes/GovernanceScene.tsx` | `governance/GovernancePage.css`, `GovernanceEditor.css`, shared controls in `folio/styles/governance-dictionary.css`, scene prefix `folio-scene-governance-*` | `governance/GovernancePage.tsx`, `useGovernanceState.ts` and feature components | `api.governanceQueue/workGovernance/apply/bulk*` |
| 词典 | `demo/modules/DictionaryDemo.tsx` | `folio/scenes/DictionaryScene.tsx` | `dictionary/DictionaryPage.css`, `DictionaryEditor.css`, shared controls in `folio/styles/governance-dictionary.css`, scene prefix `folio-scene-dictionary-*` | `dictionary/DictionaryPage.tsx`, `useDictionaryState.ts` and feature components | `api.dictionarySummary/candidates/evidence/preview/apply/*` |
| 队列 | `demo/modules/TasksDemo.tsx` | `folio/scenes/TasksScene.tsx` | `folio/styles/tasks-export-files.css`, `scenes.css` prefix `folio-scene-task-*` | `tasks/TasksPage.tsx`, `useTasksState.ts` | `api.jobs/jobLogs/pause/resume/cancel/retry/delete/clear` |
| 导出 | `demo/modules/ExportDemo.tsx` | `folio/scenes/ExportScene.tsx` | `folio/styles/tasks-export-files.css`, `scenes.css` prefix `folio-scene-export-*` | `export/ExportPage.tsx`, `useExportState.ts` | `api.exportQueue/preview/download/bundle/enqueueBulkExport` |
| 文件 | `demo/modules/FilesDemo.tsx` | `folio/scenes/FilesScene.tsx` | `folio/styles/tasks-export-files.css`, `scenes.css` prefix `folio-scene-files-*` | `files/FilesPage.tsx`, `useFilesState.ts` | `api.filesOverview/inventory/duplicates/previewDelete/deleteFiles` |
| 设置 | `demo/modules/SettingsDemo.tsx` | `folio/scenes/SettingsScene.tsx` | `folio/styles/settings.css`, `scenes.css` prefix `folio-scene-settings-*` | `settings/SettingsPage.tsx`, `useSettingsState.ts`, section components | `api.settings/updateSettings/verify*/runtime/scan*` |

Paths in the table are relative to `frontend/src/components/` unless stated otherwise.

## Shared Owners

| Concern | Owner |
| --- | --- |
| Page ids, labels, descriptions, icons, settings section definitions | `folio/config.ts` |
| Full-screen grid, topbar, mobile drawer, page transition, scroll reset/progress | `folio/shell/FolioChrome.tsx` |
| Top navigation item animation | `folio/shell/PageNavigation.tsx` |
| Standard title composition and scene placement | `folio/shell/PageHeading.tsx` |
| Large background atmosphere and discover radar hits | `folio/shell/ModuleBackdrop.tsx` + `folio/styles/base.css` |
| Scene routing only | `folio/scenes/ModuleScene.tsx` |
| Search field, custom select, field, toggle, empty state, panel heading | `folio/ui/FolioPrimitives.tsx` |
| Fixed demo action bar | `demo/ui/DemoCommandBar.tsx` |
| Demo page dispatch | `demo/modules/DemoPage.tsx` |

## CSS Load Order

`folio/Folio.css` is the ordered import manifest and is loaded by `folio/shell/FolioChrome.tsx`:

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

Preserve this order. Shared Folio structure goes here; production-only feature layout stays beside that feature and must use direct class ownership, not `.folio-formal .legacy-class` adapters.

## Formal Migration Ledger

| Stage | Route | Structure owner | Old CSS deletion boundary | Status |
| --- | --- | --- | --- | --- |
| 1 | `#workbench` | `workbench/WorkbenchPage.tsx` + `WorkbenchPage.css` | old `.workbench-*` and shelf selectors removed after direct Folio rewrite | migrated |
| 2 | `#library` | `library/LibraryPage.tsx` + `useLibraryState.ts` + `LibraryPage.css` | old `.library-*`, inspector and batch selectors removed after direct Folio rewrite | migrated |
| 3 | `#discover` | `discover/DiscoverPage.tsx` + `useDiscoverState.ts` + `DiscoverPage.css` | old discover toolbar/feed/page/tag-picker/popular-fan selectors removed after direct Folio rewrite | migrated |
| 4 | `#governance`, `#dictionary` | feature-local components + state hooks | old governance/dictionary layout selectors and orphaned `FilterMenu` removed | migrated |
| 5 | `#tasks`, `#export`, `#files` | feature-local components | old operational layout selectors replaced per component | pending |
| 6 | `#settings` | `settings/SettingsPage.tsx` + sections | old settings deck/rail selectors and native selects replaced | pending |
| 7 | detail/history/readers | route-local components | old exception selectors replaced only after route QA | pending |

Update one row to `migrated` only when its real page renders Folio structure directly, its old selectors are removed, and desktop/mobile browser QA passes.

## Fast Change Recipes

- Change one page layout: page body + its primary CSS file only.
- Change one header animation: `folio/scenes/{Module}Scene.tsx` + its `folio-scene-{module}-*` rules in `folio/styles/scenes.css`.
- Change top navigation: `folio/config.ts`, `folio/shell/PageNavigation.tsx`, then responsive nav rules.
- Change page background: `folio/shell/ModuleBackdrop.tsx` + matching atmosphere rules in `folio/styles/base.css`.
- Change a select/input/toggle everywhere: `folio/ui/FolioPrimitives.tsx` + the owning shared CSS layer.
- Migrate one real page: keep its existing hook/service, rewrite its JSX with Folio structure, add feature-local CSS, delete only the old selectors that page no longer uses, and never fetch in scene components.

## Verification

```bash
cd frontend && npm run build
git diff --check
```

For rendered changes, verify `/demo` at 1440×1000 plus 390×844, click the changed control, check console errors/warnings, and compare the affected formal hash route when it has been migrated.
