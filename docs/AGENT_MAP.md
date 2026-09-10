# NH Archive Agent Map

Use this file as the first frontend navigation index. Read only the row for the module being changed; do not load the former monolithic demo files into context.

## Active Frontend Contract

- Visual source of truth: `http://127.0.0.1:5173/demo`, shared system `apps/web/src/components/folio/`, and demo-only bodies in `apps/web/src/components/demo/modules/`.
- Formal application: `components/auth/AuthGate.tsx` authenticates before `apps/web/src/App.tsx` mounts any hash route; real data calls live in `apps/web/src/lib/api.ts`.
- Dependency direction: `demo -> folio` and `formal feature -> folio`. `folio` must never import `demo`; formal routes must never import demo modules or demo state.
- Migration rule: rewrite each formal page structure with Folio components while retaining its existing real state hook/API flow. Do not skin legacy DOM with cross-page override CSS. Do not copy demo-only state or invent works, tasks, metrics, tag candidates, paths, or covers.
- Product copy names user actions and results; do not expose implementation notes or “真实数据” guarantees as page content. Login is an independent paper surface with no pre-auth page silhouettes or content. Preserve focus feedback and the measured field-edge → responsive topbar scan, followed by app reveal; no welcome slogans.
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
| 首页（#workbench） | `demo/modules/WorkbenchDemo.tsx` | `folio/ui/HomeHero.tsx` | `folio/ui/HomeHero.css`, `workbench/WorkbenchPage.css` | `workbench/WorkbenchPage.tsx` | `api.librarySummary()`, `api.libraryStatistics(30)`, `api.librarySearch({ per_page: 36, sort: "recent_added" })` |
| 我的库 | `demo/modules/LibraryDemo.tsx` | `folio/scenes/LibraryScene.tsx` | `library/LibraryPage.css`, shared shelf/control rules in `folio/styles/library-discover.css`, scene prefix `folio-scene-library-*` | `library/LibraryPage.tsx`, `useLibraryState.ts`, `LibraryBatchTray.tsx`, shared `folio/ui/ContinueReadingRow.tsx` and feature components | `api.librarySummary/search/continueReading/recentAdded/tagFilters/setWorkFavorite/metadataRefreshPreview/metadataRefreshApply` |
| 发现 | `demo/modules/DiscoverDemo.tsx` | `folio/scenes/DiscoverScene.tsx` | `discover/DiscoverPage.css`, shared controls in `folio/styles/library-discover.css`, scene prefix `folio-scene-discover-*`, backdrop prefix `folio-radar-*` | `discover/DiscoverPage.tsx`, `useDiscoverState.ts`, `TagFilterSelector.tsx` and feature components | `api.feed/popular/random/dictionaryCandidates/dictionaryAutocomplete/importGallery` |
| 治理 | `demo/modules/GovernanceDemo.tsx` | `folio/scenes/GovernanceScene.tsx` | `governance/GovernancePage.css`, `GovernanceEditor.css`, shared controls in `folio/styles/governance-dictionary.css`, scene prefix `folio-scene-edit-*` | `governance/GovernancePage.tsx`, `useGovernanceState.ts`, `GovernanceReviewPanel.tsx`, `GovernanceTranslationPanel.tsx`, `GovernanceTagBoard.tsx` / `GovernanceTagItem.tsx` and queue/source/action components | `api.governanceQueue/workGovernance/apply/review/translate/bulk*` |
| 词典 | `demo/modules/DictionaryDemo.tsx` | `folio/scenes/DictionaryScene.tsx` | `dictionary/DictionaryPage.css`, `DictionaryEditor.css`, shared controls in `folio/styles/governance-dictionary.css`, scene prefix `folio-scene-dictionary-*` | `dictionary/DictionaryPage.tsx`, `useDictionaryState.ts` and feature components | `api.dictionarySummary/candidates/evidence/preview/apply/*` |
| 队列 | `demo/modules/TasksDemo.tsx` | `folio/scenes/TasksScene.tsx` | `tasks/TasksPage.css`, shared controls in `folio/styles/tasks-export-files.css`, scene prefix `folio-scene-queue-*` | `tasks/TasksPage.tsx`, `useTasksState.ts` and feature components | `api.jobs/jobLogs/pause/resume/cancel/retry/delete/clear` |
| 导出 | `demo/modules/ExportDemo.tsx` | `folio/scenes/ExportScene.tsx` | `export/ExportPage.css`, shared controls in `folio/styles/tasks-export-files.css`, scene prefix `folio-scene-export-*` | `export/ExportPage.tsx`, `useExportState.ts` and feature components | `api.exportQueue/preview/download/bundle/enqueueBulkExport` |
| 文件 | `demo/modules/FilesDemo.tsx` | `folio/scenes/FilesScene.tsx` | `files/FilesPage.css`, shared controls in `folio/styles/tasks-export-files.css`, scene prefix `folio-scene-files-*` | `files/FilesPage.tsx`, `useFilesState.ts`, `FileList.tsx`, `FileDetailPanel.tsx`, `FileDeleteDialog.tsx` | `api.filesOverview/inventory/duplicates/previewDelete/deleteFiles/scanLibraryPreview/enqueueLibraryScan` |
| 设置 | `demo/modules/SettingsDemo.tsx` | `folio/scenes/SettingsScene.tsx` | `settings/SettingsPage.css`, shared controls in `folio/styles/settings.css`, scene prefix `folio-scene-settings-*` | `settings/SettingsPage.tsx`, `useSettingsState.ts`, `DataSection.tsx`, `ReadingStatisticsReport.tsx` and other section components | `api.settings/updateSettings/verify*/authChangePassword/runtime/librarySummary/libraryStatistics/filesOverview` |

Paths in the table are relative to `apps/web/src/components/` unless stated otherwise.

## Secondary Route Locator

| Route | Composition owner | State/model owner | CSS owner | Real API entry |
| --- | --- | --- | --- | --- |
| `#history` | `history/HistoryPage.tsx` | `history/useHistoryState.ts`, `history/historyHelpers.ts` | `history/HistoryPage.css` | `api.libraryReadingHistory()` |
| `#gallery/{id}` | `discover/GalleryDetailPage.tsx`, `discover/gallery/GalleryHero.tsx`, `GalleryTags.tsx`, `GalleryPagePreview.tsx`, `GalleryLightbox.tsx`, `GalleryRelated.tsx` | `discover/gallery/useGalleryDetail.ts`, `galleryDetailModel.ts` | feature-local files under `discover/gallery/` | `api.gallery/related/importGallery()` |
| `#reader/{workId}`, `#reader/remote/{galleryId}` | `reader/ReaderPage.tsx`, `ReaderViewport.tsx`, `WebtoonView.tsx`, `ReaderToolbar.tsx`, `ReaderScrubber.tsx`, `ReaderInfoPanel.tsx` | `reader/useReaderData.ts`, `useReadingSession.ts`, `useReaderChrome.ts`, `useReaderPrefs.ts`, `readerHelpers.ts` | `reader/ReaderPage.css`, `ReaderToolbar.css`, `ReaderPanels.css` | `api.work` (full local tags), `pages/readerState/updateReaderState/startReadingSession/updateReadingSession/startRemoteReadingSession/updateRemoteReadingSession/setWorkFavorite/gallery/importGallery()` |

Gallery/history render inside `FolioChrome`. Both readers intentionally bypass the application chrome and own an immersive fixed viewport; do not reintroduce the old shell underneath them.

## Shared Owners

| Concern | Owner |
| --- | --- |
| Page ids, labels, descriptions, icons, settings section definitions | `folio/config.ts` |
| Full-screen grid, topbar, mobile drawer, viewport-sized native page transition, scroll reset/progress | `folio/shell/FolioChrome.tsx` |
| Top navigation item animation | `folio/shell/PageNavigation.tsx` + `styles/chrome.css`; Motion layout spring indicator with `domMax`, keyboard-contained mobile navigation in `FolioChrome.tsx` |
| Standard title composition (no explanatory subtitle) and scene placement; homepage owns its hero | `folio/shell/PageHeading.tsx`; pauses decorative scene animations when the heading is outside the viewport |
| Large background atmosphere and discover radar hits | `folio/shell/ModuleBackdrop.tsx` + `folio/styles/base.css` |
| Scene routing only | `folio/scenes/ModuleScene.tsx` |
| Search field, custom select, field, toggle, empty state, panel heading | `folio/ui/FolioPrimitives.tsx` |
| Formal summary/status metric entries and semantic tones | `folio/ui/FolioMetricGrid.tsx` + `folio/styles/workbench.css` |
| Shared pagination, tag scroller, work shelf, and cover frame (portrait fill on cards/shelves; full-image contain on detail/reader) | `folio/ui/IconPager.tsx`, `TagScroller.tsx`, `ContinueReadingRow.tsx`, `AmbientCover.tsx` |
| Shared byte and work-title formatting | `lib/format.ts` |
| Shared job labels, status rules, and action predicates | `lib/jobs.ts` |
| Fixed demo action bar | `demo/ui/DemoCommandBar.tsx` |
| Demo page dispatch | `demo/modules/DemoPage.tsx` |
| Live task overlay outside reader routes | `layout/TaskDock.tsx` + `layout/TaskDock.css` |
| Single-password gate, persistent session, change-password flow, and lock action | `auth/AuthGate.tsx` delegates to `auth/AuthWakeDemo.tsx` + `auth/AuthWakeDemo.css`; `settings/PreferencesSection.tsx` + `useSettingsState.ts`; `App.tsx` keeps every formal/demo route behind it |
| Hash dispatch and route-level code splitting | `App.tsx` |
| Folio/immersive-reader loading states | `layout/RouteFallback.tsx` + `layout/RouteFallback.css` |
| Tag-search URL + middle/modifier-click contract | `lib/navigation.ts::tagSearchHref()` for remote discovery and `libraryTagHref()` for local-library drill-downs; each owner must render a native anchor |
| Back-button history contract | `lib/navigation.ts::goBack()`; visible “返回” controls pop browser history and must not synthesize a destination entry |
| Reader failed-image retry fan-out | `reader/ReaderViewport.tsx` owns the shared retry token; `ReaderImage.tsx` retries only instances currently in an error state |
| Actual grid-track measurement, whole-row page sizes and sparse-row size limits | `lib/useGridColumns.ts`; library rounds its 24-item target up to a full row, discover requests four measured rows |
| Local favorites | `works.favorite`; library `WorkCard`/`WorkInspector` and reader `ReaderInfoPanel` mutate it through `api.setWorkFavorite()`; it is intentionally distinct from the remote gallery metric named `favorites` |
| Reading-time sessions and reports | `reader/useReadingSession.ts` records visible foreground time for local and cached remote galleries with secure-context fallbacks; local sessions also create reading history while remote sessions never write local progress. `settings/ReadingStatisticsReport.tsx` renders their shared period/activity/ranking view plus local-only collection distribution from `api.libraryStatistics()` |

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
- Change tag navigation: update the matching `lib/navigation.ts` builder (`tagSearchHref()` for discovery, `libraryTagHref()` for local-library scope), then preserve native `<a>` semantics in the feature owner; pointer-drag code may suppress only a completed primary-mouse drag; capture after movement exceeds the threshold, preserve keyboard/modifier clicks, and use native touch scrolling.
- Migrate one real page: keep its existing hook/service, rewrite its JSX with Folio structure, add feature-local CSS, delete only the old selectors that page no longer uses, and never fetch in scene components.

## Verification

```bash
cd apps/web && npm run build
git diff --check
```

For rendered changes, verify `/demo` at 1440×1000 plus 390×844, click the changed control, check console errors/warnings, and verify the affected formal hash route. Reader QA must distinguish remote no-progress-write behavior from intentional local progress persistence.

Homepage uses a paper/ink reading composition: each SVG outline represents one of up to 36 real recent works, its vermilion segment represents reading progress. Drag/arrow keys browse works and synchronize the native reader title link and metadata. Daily activity selection updates reading totals; no geometric mode selector, spread slider or print action. No fake works or counters.

2026-09-08 独立首页静态预览：`/?home-preview=1#workbench` 使用 `workbench/HomeLayoutPreview.tsx` / `.css`，由 WorkbenchPage 按查询参数懒加载；正常首页不替换。复用真实作品/统计，并额外读取 libraryContinueReading(3)。完整封面按原比例显示，原生阅读链接，尊重隐私开关；未使用生图素材或添加展示动效。已验证1440/390/2560尺寸、横竖封面比例、标题占位和阅读链接。此入口用于用户审阅构图，不代表最终设计。

2026-09-09 互动扉页原型：`/?home-preview=play#workbench` 懒加载 `workbench/HomePlayPreview.tsx` / `.css`，独立于正常首页与 `home-preview=1` 静态作品预览。不请求作品或统计，不添加假数据。书签支持拖动实时编排、松手吸附、点击/键盘切换；六个分镜提供形态反馈。复用 Motion 和原生 SVG，轻量 DOM 属性订阅避免每帧 React 重渲染；桌面/窄屏分别排版，减少动态效果取消过渡。验证三种视口、所有分镜、快速往返拖动、触屏、取消手势、键盘及最终布局不重叠。这是供用户评估核心玩法的原型，不代表最终首页设计。


2026-09-10 三种独立首页体验预览：`/?home-preview=encounter#workbench`（偶遇一册）、`/?home-preview=echo#workbench`（阅读回声）、`/?home-preview=imprint#workbench`（私人扉页）。实现位于 `apps/web/src/components/workbench/concepts/`，WorkbenchPage 按查询参数懒加载，原首页与 `1` / `play` 入口保留。
- 偶遇一册：从整个未读结果分页抽取，点击/滑动书签揭晓，收藏、阅读和本次回看均使用真实作品。
- 阅读回声：从最近阅读开始（没有记录时取最近添加），查询真实作者/标签与最近阅读，支持沿作品追溯和返回探索路径；异步关系仅对当前作品生效。
- 私人扉页：近30天阅读数据生成曲线，三个书签可用鼠标、触屏或方向键编排，保存当前构图为1800×1200 PNG。空记录不伪造数据。
- 沿用 Folio 纸/墨/朱红及导航；封面隐私、加载失败重试、减少动态效果和响应式布局保留。无新增依赖，无生成图片素材，无 API/schema 变更。这三个入口供用户体验对比，尚未选定最终首页。
- 验证入口：`apps/web/e2e/home-concepts.spec.ts` 覆盖抽取去重/收藏恢复、关系往返和拖动/键盘/PNG导出；浏览器检查1440×1000、390×844、2560×1440三种尺寸。
