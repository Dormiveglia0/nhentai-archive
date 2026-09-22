# NH Archive Agent Map

## 2026-09-22 · 治理与词典主体重构

治理改为紧凑顶部作品身份栏、字段导航与主比较区；标题/简介采用上下对照，中文建议收进可展开入口。无修改且未勾选回写时保存栏随正文排列，修改后才固定。词典删除双列大卡片与侧边分类大按钮，改为原文/中文译文/影响/状态对齐清单及顶部类型筛选；桌面来源编辑改为右侧面板，手机全屏，保留来源动画和焦点归还。沿用真实数据与原编辑状态，不修改后端。

验证：Web build 通过；首轮 6 项关联回归通过，最终 5 项草稿、保存栏、来源转移与焦点回归通过。1440、2560、390 实页截图无横向溢出和 pageerror；未保存测试草稿或写回源文件。前阶段 f4ea840 已推送 codex/rhine-frontend；整站尚未完成与部署，下一步首页、发现、登录及二级页面和整体性能动效验收。


## 2026-09-22 · 自主实施阶段留档：库、队列、文件、导出

本阶段准备提交至 codex/rhine-frontend，不合并 main，线上部署仍为 94e5364。文件页以实际体积条、紧凑分类与清单为主体；未选中时不显示禁用批量操作。导出桌面同时显示选择与配置，手机两步流程保留同一表单节点；输出名先于下载，ComicInfo 可展开。FileStorage.css、ExportWorkflow.css 重写，沿用原 API 与删除预览/导出业务。没有新增依赖或假数据。

验证：构建通过；库页 7 项、队列相关 9 项（其中导航两项修正等待条件后复测）、文件导出相关 13 项通过，最终微调后 3 项定向复测通过。1440、2560、390 三尺寸截图无横向溢出与 pageerror。使用 Playwright（Browser plugin not available）。验收未执行真实删除或下载；任务测试数据只有一条已完成记录。后续还需首页、发现、治理、词典、登录与二级页面的重构/审核，以及整站动效、性能与部署验收，不能标记总目标完成。


## 2026-09-22 · 自主实施中：队列主体替换

队列删除 TaskBoard 巨型状态卡与筛选后搬到侧边的布局，使用紧凑固定状态栏。桌面任务清单与详情并排、手机沿用 FolioSheet 独立详情和来源焦点恢复；现有 API、轮询日志与任务操作保留。TaskLedger.css 已重写，TaskInspector 采用直线进度并把操作前置。实际隔离数据目前只有一条已完成任务：三尺寸截图无溢出/页面异常，计数筛选、日志刷新和手机关闭焦点测试通过；运行中多任务的视觉效果尚缺实际数据验证，不添加假任务。其余页面与整体动效仍待推进；尚未部署。


## 2026-09-22 · 自主实施中：库页首轮

用户已授权自主迭代、实施与验收，之前“只规划”约束已结束。当前工作树开始替换被否定的 94e5364；尚未部署或认定整站完成。库页改为续读与作品列表同时呈现、固定阅读状态筛选，桌面续读资料突出实际标签，手机隐藏独立资料区和重复标题。复用原生链接与拖动处理。共享 useGridColumns 修复 StrictMode 清理后 ResizeObserver 没有重新连接的问题，窗口跨断点可更新列数。构建与七项库页交互测试通过（包括续读实际标签筛选）；仍需后续设计迭代、其他页面实现及整体验收，再提交推送部署。不把局部通过作为整站完成。


## 2026-09-22 · 用户否定上一轮设计，退回规划阶段

用户要求先整理、规划并推理 UI 布局，再实施。`94e5364` 不能作为已认可视觉基准；仅设置页、阅读器底部控件和库详情来源浮层保留。当前只新增 [前端设计规划](FRONTEND_DESIGN_PLAN.md)，不修改页面或部署。下一步先完成布局、首屏比例和动效关键帧设计，不能直接重复大型分类卡/倾斜卡片方案。


## 2026-09-22 · 以设置页为基准的主要页面重设计

用户目前仅认可设置页；本轮保留 SettingsPage/SettingsModules 原实现，不将其他页面标记为已获认可。延续真实 API、阅读器底部控件与库详情来源展开；未修改后端、schema 或引入新依赖。

- 首页：ReadingHome 移除重复日期卡片阵列，改为每日阅读时长柱形构图，日期选择、相邻响应、透视展开、统计与最近作品联动。数据稀少时保持实际读数，不填充假数据。
- 库：阅读状态对象直接驱动筛选，选中后收拢到侧边，作品区接续展开；“全部”恢复总览。库详情和阅读入口保持原语义。
- 发现：PopularFan 五张封面的选择与右侧作品资料联动，原生链接、导入和键盘选择保留；手机使用原生横向滚动。
- 队列：TaskBoard 四个状态对象展示真实计数和最多一条任务，选择状态后收拢为索引，完整任务记录占据主区。无运行任务时不播放运行符号动画。
- 文件：FileOverviewStrip 的三类文件夹直接驱动清单筛选，选中后收拢；删除预览、扫描清理和详情流程不变。删除 FileToolbar 重复分类控件。
- 词典：类型索引与词条配对页片组成编辑入口，真实筛选、来源浮层、批量导入和编辑流程保留。
- 治理：作品信息与三类编辑入口组成左侧索引，右侧为核对文档，草稿仍由原状态层持有。
- 导出：步骤对象在左侧，右侧承载选择与打包；原表单节点持续挂载，不因切换清空配置。
- 登录：独立浅纸色入口与左右构图，短屏自适应；输入验证、错误反馈与输入框至顶栏的扫描顺序保持。无登录前内容露出。

验证：Web build 通过；30 项 Playwright 回归全部通过，包含新增桌面/手机分类收拢、真实请求筛选、焦点保持检查。首轮手机书架滑动一次失败，单独复现正常，停止编辑后的最终完整回归通过。主要页面三尺寸（1440、2560、390）截图和选中态检查无横向溢出、无 pageerror；登录另查 660×390。此结论不是用户设备性能测量，也不是视觉验收。二级历史/远端作品详情本轮未重写。

当前分支 codex/rhine-frontend，不合并 main。上轮 87ab120 已推送，此前文档的“待公开仓库授权”描述属于历史状态；原始远端留档 2b4fbef 保留。本轮部署入口仍为 http://38.58.176.50:4349/ 。


## 2026-09-16 · 队列、词典、治理主体与来源动效

本轮已重新部署本机 Docker，入口 `http://38.58.176.50:4349/`；容器 healthy。公网登录入口、健康接口及已修复的治理 CSS 均已核验。旧镜像保留为 `nh-archive:rollback-20260916-before-ops`。补充修正了旧封面框固定高度造成的标题遮挡，三尺寸几何检查和 3 项定向回归通过。远端推送仍受此前公开仓库目的地授权审核阻拦，尚未执行。

- 队列由 TaskBoard 展示等待、运行、需处理和已结束的真实任务，完整记录与操作仍在 TaskList。状态卡或列表项展开为任务文档，源对象与 TaskInspector 的任务卡片通过现有 FolioSheet 来源动画连接；关闭途中仍维持模态隔离与来源焦点。没有加入假任务。
- 词典候选改为原文与译文的成对索引，词条标题从被选原文位置展开；DictionaryEditor、证据、预览和写入仍沿用真实状态。新建词条不沿用上一个词条的来源位置。
- 治理将作品资料放到侧边，核对文档占据主体；当前值、解析来源、本地最终值并排展示。采用来源/恢复当前的值转移动效可被再次操作或手动输入接管，离开组件时清理，不延迟草稿更新。
- 修复任务日志只在切换 ID 时刷新的问题：队列刷新/轮询后同步读取当前任务日志，同一任务后台刷新保留旧日志，切换任务时才显示加载状态。

验证：Web 构建通过；28 项功能回归通过，新增检查覆盖真实任务分组、刷新日志、两个来源浮层的中途关闭与焦点归还、编辑接管动效。Browser plugin not available，使用本地 Playwright + 隔离真实数据；1440×1000、2560×1440、390×844 截图与录屏检查。旧版远端留档 2b4fbef、本轮之前的本地留档 5ef4ad8 均保留，不合并 main。设计仍需用户实际体验评价，测试通过不等于视觉设计已获认可。


## 2026-09-16 · 视觉方案重新校准（未部署）

用户否定了环形首页与六行折叠设置的视觉结果，本轮不将这组截图作为已通过设计。首页已改为真实日期记录的三维阵列，原节点在总览、选中与展开间保留，邻近记录跟随选择抬升；展开时整体取景转正，背景记录退到选中表面之后。设置改为六个配置对象的选择区，选择对象移入编辑区，草稿继续由原状态层维护。全局导航改为与画布连续的浅色表面。

已完成 1440×1000、2560×1440、390×844 布局及连续反向操作检查；动画录像在本地 `/tmp/nh-spatial-video/`。不把这些检查表述为用户认可、参考项目还原或整站重构完成。其他页面的前轮结构仍为待复核稿，后续不能仅靠同色按钮与淡入作为设计交付。

保留阅读器底部悬浮控件与库详情的封面展开。原始远端留档 `2b4fbef201ff6140e3ed7d0878fb5ddbeb60901d`，当前线上仍为 `b553195`；未合并 main。公开远端推送因既有自动审核限制仍未执行。


Use this file as the first frontend navigation index. Read only the row for the module being changed; do not load the former monolithic demo files into context.

## Current visual contract · 2026-09-15 replacement

Read `docs/FRONTEND_REDESIGN.md` for the active screen and motion plan. The user rejected the previous incremental redesign. Formal routes now own their complete page structure; no generic scene heading. Keep the accepted bottom reader controls and cover-origin library detail dialog.

New owners: SettingsPage + SettingsModules.css (expandable modules); TasksPage/TaskList + TaskLedger.css (ledger + modal detail); DictionaryPage (index + modal editor); FilesPage/FileOverviewStrip + FileStorage.css (full-width inventory + modal detail); ExportPage/ExportInspector + ExportWorkflow.css (two-step selection/output); GovernancePage + GovernanceDocument.css (document + queue dialog); ReadingHome (radial date activity). SettingsDirectory, TaskFlow and the two obsolete summary strips were deleted. Older descriptions below are history where they conflict.

## Active Frontend Contract

- Before 2026-09-14, visual source of truth: `http://127.0.0.1:5173/demo`, shared system `apps/web/src/components/folio/`, and demo-only bodies in `apps/web/src/components/demo/modules/`.
- Formal application: `components/auth/AuthGate.tsx` authenticates before `apps/web/src/App.tsx` mounts any hash route; real data calls live in `apps/web/src/lib/api.ts`.
- Dependency direction: `demo -> folio` and `formal feature -> folio`. `folio` must never import `demo`; formal routes must never import demo modules or demo state.
- Migration rule: rewrite each formal page structure with Folio components while retaining its existing real state hook/API flow. Do not skin legacy DOM with cross-page override CSS. Do not copy demo-only state or invent works, tasks, metrics, tag candidates, paths, or covers.
- Product copy names user actions and results; do not expose implementation notes or “真实数据” guarantees as page content. Login is an independent surface with no pre-auth page silhouettes or content. Preserve focus feedback and the measured field-edge → responsive topbar scan, followed by app reveal; no welcome slogans.
- Current visual baseline (2026-09-14): formal routes with the rebuilt gray-white/graphite/amber Folio shell; default homepage uses `workbench/ReadingHome.tsx` and `.css`. Previous homepage query previews remain historical alternatives.
- Shared motion comes from `apps/web/src/lib/motion/`; module scenes may use CSS keyframes but must respect `prefers-reduced-motion`.

## Demo Dependency Map

```text
FrontendDemo.tsx
  -> ../folio/config.ts
  -> ../folio/shell/FolioChrome.tsx
       -> ../folio/shell/PageNavigation.tsx
       -> ../folio/shell/PageHeading.tsx -> ../folio/scenes/ModuleScene.tsx -> scenes/*Scene.tsx
       -> ../folio/Folio.css -> ../folio/styles/*.css
  -> modules/DemoPage.tsx -> modules/*Demo.tsx
       -> ../folio/ui/FolioPrimitives.tsx
  -> ui/DemoCommandBar.tsx
```

`FrontendDemo.tsx` owns only demo navigation, notices, and settings reset. `components/folio/` owns reusable visual structure. `components/demo/` owns only public-preview content and must not become a production dependency.

## Module Locator

| Module | Demo page body | Header scene | Primary CSS | Formal page/state | Real API entry |
| --- | --- | --- | --- | --- | --- |
| 首页（#workbench） | `demo/modules/WorkbenchDemo.tsx` | `workbench/ReadingHome.tsx` | `workbench/ReadingHome.css`, `workbench/WorkbenchPage.css` | `workbench/WorkbenchPage.tsx` | `api.librarySummary()`, `api.libraryStatistics(30)`, `api.librarySearch({ per_page: 3, sort: "recent_added" })` |
| 我的库 | `demo/modules/LibraryDemo.tsx` | `folio/scenes/LibraryScene.tsx` | `library/LibraryPage.css`, shared shelf/control rules in `folio/styles/library-discover.css`, scene prefix `folio-scene-library-*` | `library/LibraryPage.tsx`, `useLibraryState.ts`, `LibraryBatchTray.tsx`, shared `folio/ui/ContinueReadingRow.tsx` and feature components | `api.librarySummary/search/continueReading/recentAdded/tagFilters/setWorkFavorite/metadataRefreshPreview/metadataRefreshApply` |
| 发现 | `demo/modules/DiscoverDemo.tsx` | `folio/scenes/DiscoverScene.tsx` | `discover/DiscoverPage.css`, `discover/PopularFan.css` (five-cover selection), shared controls in `folio/styles/library-discover.css`, scene prefix `folio-scene-discover-*`, backdrop prefix `folio-radar-*` | `discover/DiscoverPage.tsx`, `useDiscoverState.ts`, `TagFilterSelector.tsx` and feature components | `api.feed/popular/random/dictionaryCandidates/dictionaryAutocomplete/importGallery` |
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
| Fixed topbar, desktop side navigation, mobile drawer, interruptible viewport transition, scroll reset/progress | `folio/shell/FolioChrome.tsx` |
| Top navigation item animation | `folio/shell/PageNavigation.tsx` + `styles/chrome.css`; Motion layout spring indicator with `domMax`, keyboard-contained mobile navigation in `FolioChrome.tsx` |
| Standard title composition (no explanatory subtitle) and scene placement; homepage owns its hero | `folio/shell/PageHeading.tsx`; pauses decorative scene animations when the heading is outside the viewport |
| Static canvas and bounded visible-scene motion | `folio/styles/base.css` + feature-local scenes |
| Scene routing only | `folio/scenes/ModuleScene.tsx` |
| Shared section selection / interruptible local content transition | `folio/ui/SectionSwitch.tsx`, `lib/motion/primitives.tsx::SelectionStage`; preserve form state and avoid selection-signature remounts |
| Modal side sheets, native background inertness and focus return | `folio/ui/FolioSheet.tsx`; library inspector uses origin + data-sheet-anchor/surface/content for reversible cover expansion; dictionary import and mobile files use ordinary side sheets |
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

1. `styles/base.css` — gray-white/graphite/amber tokens, atmosphere, binding progress, shared focus.
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
- Change page background: the static canvas in `folio/styles/base.css`; decorative animation stays in visible feature scenes.
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


2026-09-10 三种独立首页体验预览：`/?home-preview=encounter#workbench`（方案1）、`/?home-preview=echo#workbench`（方案2）、`/?home-preview=imprint#workbench`（方案3）。实现位于 `apps/web/src/components/workbench/concepts/`，WorkbenchPage 按查询参数懒加载，原首页与 `1` / `play` 入口保留。
- 方案1：从整个未读结果分页抽取，点击/滑动书签揭晓，收藏、阅读和本次回看均使用真实作品。
- 方案2：从最近阅读开始（没有记录时取最近添加），查询真实作者/标签与最近阅读，支持沿作品追溯和返回探索路径；异步关系仅对当前作品生效。
- 方案3：近30天阅读数据生成曲线，三个书签可用鼠标、触屏或方向键编排，保存当前构图为1800×1200 PNG。空记录不伪造数据。
- 沿用 Folio 纸/墨/朱红及导航；封面隐私、加载失败重试、减少动态效果和响应式布局保留。无新增依赖，无生成图片素材，无 API/schema 变更。这三个入口供用户体验对比，尚未选定最终首页。
- 验证入口：`apps/web/e2e/home-concepts.spec.ts` 覆盖抽取去重/收藏恢复、关系往返和拖动/键盘/PNG导出；浏览器检查1440×1000、390×844、2560×1440三种尺寸。


2026-09-13 三方案视觉修订：页面取消自创名称和标题，预览入口仍使用 encounter / echo / imprint。方案1恢复贯穿抽取页片的朱红轨迹、边线层次和本次查看记录；方案2改为真实阅读记录、当前作品及作者/标签分支组成的开放关系图，封面缩为小型注记；方案3重做为三组短线簇、局部页形、四点拖动和日期联动，保留完整1800×1200 PNG导出，手机单独裁定视域，导出仍含完整构图。读数由现有API提供，未添加样例数据、生成图片素材或依赖。

共享交互修复：原 `.folio button:active` 直接覆盖 transform，导致依赖 translate 定位的关系节点和拖动点在按下时跳开。按压反馈改用独立 translate / scale 属性，保留原定位与动效。`.folio-scroll` 作为路由焦点落点不显示整圈浏览器默认黑框，按钮/链接保留焦点提示。验证应覆盖三方案、原书签原型与书架导航，不能仅以构建通过代替视觉检查。


2026-09-13 方案2交互修订：`?home-preview=echo#workbench` 保持独立预览。EchoPreview 固定左侧真实阅读记录顺序，显示月日/时分、作品标题与进度；中间封面及右侧关联封面随视口放大。关系按同作者/同系列/同角色及较低频的共享标签查询，排除原创作为系列，最多显示三个非空分组并跨组去重。标签频次取现有 tag-filters（最多200项），未覆盖的低频标签由搜索验证，不等同语义推荐；每个类型最多取一个标签、主题最多两个。底部重复时间轴移除，探索路径自然换行。切换使用 Motion 选中指示/封面过渡，最多缓存20部本次关系结果；细线与节点待机动效离屏/后台暂停，尊重减少动态效果。无新依赖/API/schema变更。回归覆盖关系往返、记录顺序、空分类隐藏和失败重试，配合1440/390/2560浏览器检查。


方案2脉络构图恢复：取消三栏列表/卡片排版，阅读记录错落汇入中央作品，关联作品沿分类枝条展开。新增 `workbench/concepts/EchoConnections.tsx`，ResizeObserver 按真实节点位置绘制连接，绕开中央封面/标题，并提供路径过渡与悬停强调。保留前轮封面尺寸、时间信息、非空分类、缓存及探索路径；窄屏改为紧凑分枝排版。新增端点落位检查，不能只验点击成功而忽略关系图视觉。


2026-09-14 RhineLabUI 设计研究与前端重构：用户明确无需保留原风格。独立分支 `codex/rhine-frontend` 从留档提交 `2b4fbef` 创建；原分支 `codex/login-and-shelf-fixes` 已推送，不合并 main。
- 研究上游 DESIGN.md、motion.ts、ui-transitions.ts、document-decryption.ts 及仓库实录；借鉴空间连续性、邻近响应、紧凑排版与完成事件衔接。本站自行实现 SVG/已有 Motion，无上游模型、音频、字体或生成图片资产。
- 正常首页默认 `ReadingHome`：近30天真实阅读数据生成切片，鼠标选择/日期滑块/方向按钮联动读数。默认最近有阅读的日期；零记录不伪造统计。状态分布与最多3部最近添加仅为辅助信息。旧查询预览保持独立。
- FolioChrome 桌面100px侧栏、64px顶栏；窄屏使用原可访问抽屉。原全屏装饰 ModuleBackdrop 已移除，页头主题动画保留。登录扫描线实测输入框中心/下沿，animationend 后挂载页面，不再由600ms计时器抢先切换。
- 配色与字体在各现有CSS所有者内统一；没有叠加第二套皮肤。竖向铺满封面的不可见模糊背景停绘，移除封面全局 drop-shadow，后台/滚动/离屏暂停相关动效。
- 回归入口新增 `e2e/reading-home.spec.ts`；配合 auth-gate、auth-wake-demo 的四尺寸过渡测试与 shelf-navigation。只读接口和隔离真实数据副本，无API/schema变更。

## 2026-09-14 Workspace Structure

- `LibraryPage`: filter rail, switched recent shelf, work grid and modal inspector; native reader links and drag threshold retained.
- `SettingsPage`: sticky directory + editable stage, state stays in `useSettingsState` across section switches.
- `GovernancePage`: horizontal queue, editor sections + source checklist; checklist navigation selects its target section before scrolling.
- `DictionaryPage`: candidate rail + editor/evidence columns; container query keeps narrow candidate rows readable.
- `TasksPage`: status filters, card list and focused progress/log inspector; polling must not remount the list.
- `FilesPage`: inventory/maintenance switch; `matchMedia` selects desktop detail versus mobile `FolioSheet`, without duplicating detail controls.
- `GalleryDetailPage`: preview/tags/related switch. `HistoryPage`: real date index. `ReaderToolbar`: separate identity and control bars in keyed `AnimatePresence` children.
- Checks: `e2e/workspace-rebuild.spec.ts` plus existing auth/shelf/home suites. Keep data mutations isolated and actual source data only.

## 2026-09-15 Interaction Owners

- `library/WorkInspector.tsx` + `WorkInspector.css`: immersive cover/detail composition; `WorkCard` passes its source element via `LibraryPage` to `FolioSheet`. Keep source and return geometry measured; do not replace with a timed exit/remount.
- `settings/SettingsDirectory.tsx` + `.css`: actual configuration summaries and movable module directory; this route owns its own heading.
- `tasks/TaskFlow.tsx` + `.css`: real job groups, shared element movement and focus; `lib/jobs.ts::JOB_STATUS_GROUPS` owns combined status filtering. The tasks route owns its heading, and its old standalone scene is only a demo/history asset.
- `export/ExportPackage.tsx` + `.css`: interactive package composition replaces duplicate option switches; changes continue through `onSetOption`.
- `dictionary/DictionaryEditor.tsx` + `.css`: source/translation mapping controls. `governance/MetadataEditor.tsx` + `GovernanceEditor.css`: source-to-final field comparison.
- Regression: `e2e/continuous-interactions.spec.ts` checks reversal geometry, focus restore, live draft summaries, real task groups and editable mapping/source adoption.
