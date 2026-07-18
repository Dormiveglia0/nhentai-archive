# NH Archive Agent Map

Use this file as the first frontend navigation index. Read only the row for the module being changed; do not load the former monolithic demo files into context.

## Active Frontend Contract

- Visual source of truth: `http://127.0.0.1:5173/demo`, shared system `apps/web/src/components/folio/`, and demo-only bodies in `apps/web/src/components/demo/modules/`.
- Formal application: `components/auth/AuthGate.tsx` authenticates before `apps/web/src/App.tsx` mounts any hash route; real data calls live in `apps/web/src/lib/api.ts`.
- Dependency direction: `demo -> folio` and `formal feature -> folio`. `folio` must never import `demo`; formal routes must never import demo modules or demo state.
- Migration rule: rewrite each formal page structure with Folio components while retaining its existing real state hook/API flow. Do not skin legacy DOM with cross-page override CSS. Do not copy demo-only state or invent works, tasks, metrics, tag candidates, paths, or covers.
- Shared motion comes from `apps/web/src/lib/motion/`; module scenes may use CSS keyframes but must respect `prefers-reduced-motion`.

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

`FrontendDemo.tsx` owns only demo navigation, notices, and settings reset. `components/folio/` owns reusable visual structure. `components/demo/` owns only public-preview content and must not become a production dependency.

## Module Locator

| Module | Demo page body | Header scene | Primary CSS | Formal page/state | Real API entry |
| --- | --- | --- | --- | --- | --- |
| 工作台 | `demo/modules/WorkbenchDemo.tsx` | `folio/scenes/WorkbenchScene.tsx` | `folio/styles/workbench.css`, `scenes.css` prefix `folio-scene-hub-*` | `workbench/WorkbenchPage.tsx`, `useWorkbenchState.ts` | `api.workbenchOverview()` |
| 我的库 | `demo/modules/LibraryDemo.tsx` | `folio/scenes/LibraryScene.tsx` | `library/LibraryPage.css`, shared shelf/control rules in `folio/styles/library-discover.css`, scene prefix `folio-scene-library-*` | `library/LibraryPage.tsx`, `useLibraryState.ts`, `LibraryBatchTray.tsx`, shared `folio/ui/ContinueReadingRow.tsx` and feature components | `api.librarySummary/search/continueReading/recentAdded/tagFilters/metadataRefreshPreview/metadataRefreshApply` |
| 发现 | `demo/modules/DiscoverDemo.tsx` | `folio/scenes/DiscoverScene.tsx` | `discover/DiscoverPage.css`, shared controls in `folio/styles/library-discover.css`, scene prefix `folio-scene-discover-*`, backdrop prefix `folio-radar-*` | `discover/DiscoverPage.tsx`, `useDiscoverState.ts`, `TagFilterSelector.tsx` and feature components | `api.feed/popular/random/dictionaryCandidates/dictionaryAutocomplete/importGallery` |
| 治理 | `demo/modules/GovernanceDemo.tsx` | `folio/scenes/GovernanceScene.tsx` | `governance/GovernancePage.css`, `GovernanceEditor.css`, shared controls in `folio/styles/governance-dictionary.css`, scene prefix `folio-scene-governance-*` | `governance/GovernancePage.tsx`, `useGovernanceState.ts`, `GovernanceReviewPanel.tsx`, `GovernanceTranslationPanel.tsx`, `GovernanceTagBoard.tsx` / `GovernanceTagItem.tsx` and queue/source/action components | `api.governanceQueue/workGovernance/apply/review/translate/bulk*` |
| 词典 | `demo/modules/DictionaryDemo.tsx` | `folio/scenes/DictionaryScene.tsx` | `dictionary/DictionaryPage.css`, `DictionaryEditor.css`, shared controls in `folio/styles/governance-dictionary.css`, scene prefix `folio-scene-dictionary-*` | `dictionary/DictionaryPage.tsx`, `useDictionaryState.ts` and feature components | `api.dictionarySummary/candidates/evidence/preview/apply/*` |
| 队列 | `demo/modules/TasksDemo.tsx` | `folio/scenes/TasksScene.tsx` | `tasks/TasksPage.css`, shared controls in `folio/styles/tasks-export-files.css`, scene prefix `folio-scene-task-*` | `tasks/TasksPage.tsx`, `useTasksState.ts` and feature components | `api.jobs/jobLogs/pause/resume/cancel/retry/delete/clear` |
| 导出 | `demo/modules/ExportDemo.tsx` | `folio/scenes/ExportScene.tsx` | `export/ExportPage.css`, shared controls in `folio/styles/tasks-export-files.css`, scene prefix `folio-scene-export-*` | `export/ExportPage.tsx`, `useExportState.ts` and feature components | `api.exportQueue/preview/download/bundle/enqueueBulkExport` |
| 文件 | `demo/modules/FilesDemo.tsx` | `folio/scenes/FilesScene.tsx` | `files/FilesPage.css`, shared controls in `folio/styles/tasks-export-files.css`, scene prefix `folio-scene-files-*` | `files/FilesPage.tsx`, `useFilesState.ts`, `FileList.tsx`, `FileDetailPanel.tsx`, `FileDeleteDialog.tsx` | `api.filesOverview/inventory/duplicates/previewDelete/deleteFiles/scanLibraryPreview/enqueueLibraryScan` |
| 设置 | `demo/modules/SettingsDemo.tsx` | `folio/scenes/SettingsScene.tsx` | `settings/SettingsPage.css`, shared controls in `folio/styles/settings.css`, scene prefix `folio-scene-settings-*` | `settings/SettingsPage.tsx`, `useSettingsState.ts`, section components | `api.settings/updateSettings/verify*/authChangePassword/runtime/librarySummary/filesOverview` |

Paths in the table are relative to `apps/web/src/components/` unless stated otherwise.

## Secondary Route Locator

| Route | Composition owner | State/model owner | CSS owner | Real API entry |
| --- | --- | --- | --- | --- |
| `#history` | `history/HistoryPage.tsx` | `history/useHistoryState.ts`, `history/historyHelpers.ts` | `history/HistoryPage.css` | `api.libraryReadingHistory()` |
| `#gallery/{id}` | `discover/GalleryDetailPage.tsx`, `discover/gallery/GalleryHero.tsx`, `GalleryTags.tsx`, `GalleryPagePreview.tsx`, `GalleryLightbox.tsx`, `GalleryRelated.tsx` | `discover/gallery/useGalleryDetail.ts`, `galleryDetailModel.ts` | feature-local files under `discover/gallery/` | `api.gallery/related/importGallery()` |
| `#reader/{workId}`, `#reader/remote/{galleryId}` | `reader/ReaderPage.tsx`, `ReaderViewport.tsx`, `WebtoonView.tsx`, `ReaderToolbar.tsx`, `ReaderScrubber.tsx`, `ReaderInfoPanel.tsx` | `reader/useReaderData.ts`, `useReaderChrome.ts`, `useReaderPrefs.ts`, `readerHelpers.ts` | `reader/ReaderPage.css`, `ReaderToolbar.css`, `ReaderPanels.css` | `api.work` (full local tags), `pages/readerState/updateReaderState/gallery/importGallery()` |

Gallery/history render inside `FolioChrome`. Both readers intentionally bypass the application chrome and own an immersive fixed viewport; do not reintroduce the old shell underneath them.

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
| Formal summary/status metric entries and semantic tones | `folio/ui/FolioMetricGrid.tsx` + `folio/styles/workbench.css` |
| Shared pagination, tag scroller, work shelf, and non-cropping cover frame | `folio/ui/IconPager.tsx`, `TagScroller.tsx`, `ContinueReadingRow.tsx`, `AmbientCover.tsx` |
| Shared byte and work-title formatting | `lib/format.ts` |
| Shared job labels, status rules, and action predicates | `lib/jobs.ts` |
| Fixed demo action bar | `demo/ui/DemoCommandBar.tsx` |
| Demo page dispatch | `demo/modules/DemoPage.tsx` |
| Live task overlay outside reader routes | `layout/TaskDock.tsx` + `layout/TaskDock.css` |
| Single-password gate, persistent session, change-password flow, and lock action | `auth/AuthGate.tsx` + `auth/AuthGate.css`; `settings/PreferencesSection.tsx` + `useSettingsState.ts`; `App.tsx` keeps every formal/demo route behind it |
| Hash dispatch and route-level code splitting | `App.tsx` |
| Folio/immersive-reader loading states | `layout/RouteFallback.tsx` + `layout/RouteFallback.css` |
| Tag-search URL + middle/modifier-click contract | `lib/navigation.ts::tagSearchHref()`; each formal tag owner must render a native anchor |
| Back-button history contract | `lib/navigation.ts::goBack()`; visible “返回” controls pop browser history and must not synthesize a destination entry |
| Reader failed-image retry fan-out | `reader/ReaderViewport.tsx` owns the shared retry token; `ReaderImage.tsx` retries only instances currently in an error state |
| Actual grid-track measurement and whole-row page sizes | `lib/useGridColumns.ts`; library rounds its 24-item target up to a full row, discover requests four measured rows |

`apps/web/src/styles/app.css` is now a base-only file (root tokens, reset, form inheritance, shared spin utility, reduced-motion override). Do not put feature or shell selectors back into it.

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
| 5 | `#tasks`, `#export`, `#files` | feature-local components | old operational layout selectors replaced per component | migrated |
| 6 | `#settings` | `settings/SettingsPage.tsx` + `useSettingsState.ts` + section components + `SettingsPage.css` | old settings deck/rail/form/export-recipe selectors and native selects removed | migrated |
| 7 | detail/history/readers | `discover/gallery/*`, `history/*`, `reader/*` | old gallery and reader global selectors removed after route QA | migrated |
| 8 | all routes | `App.tsx` + `layout/RouteFallback.*` | orphaned global shell CSS removed; each formal page/CSS loads on demand | migrated |

Update one row to `migrated` only when its real page renders Folio structure directly, its old selectors are removed, and desktop/mobile browser QA passes.

## Fast Change Recipes

- Change one page layout: page body + its primary CSS file only.
- Change one header animation: `folio/scenes/{Module}Scene.tsx` + its `folio-scene-{module}-*` rules in `folio/styles/scenes.css`.
- Change top navigation: `folio/config.ts`, `folio/shell/PageNavigation.tsx`, then responsive nav rules.
- Change page background: `folio/shell/ModuleBackdrop.tsx` + matching atmosphere rules in `folio/styles/base.css`.
- Change a select/input/toggle everywhere: `folio/ui/FolioPrimitives.tsx` + the owning shared CSS layer.
- Change route loading or split boundaries: `App.tsx` + `layout/RouteFallback.*`; keep `ArchiveShell` eager and readers outside it.
- Change tag navigation: update `lib/navigation.ts::tagSearchHref()` once, then preserve native `<a>` semantics in the feature owner; pointer-drag code may suppress only a completed primary-pointer drag.
- Migrate one real page: keep its existing hook/service, rewrite its JSX with Folio structure, add feature-local CSS, delete only the old selectors that page no longer uses, and never fetch in scene components.

## Verification

```bash
cd apps/web && npm run build
git diff --check
```

For rendered changes, verify `/demo` at 1440×1000 plus 390×844, click the changed control, check console errors/warnings, and verify the affected formal hash route. Reader QA must distinguish remote no-progress-write behavior from intentional local progress persistence.
