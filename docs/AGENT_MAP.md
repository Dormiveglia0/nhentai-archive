# NH Archive Agent Map

当前工作：`codex/site-layout-refinement`，页面布局、订阅与交互完善。实施与验收记录见 [SITE_LAYOUT_REFINEMENT.md](SITE_LAYOUT_REFINEMENT.md)。上一版已部署的阅读与媒体库更新见 [READER_MEDIA_EXPERIENCE_UPDATE.md](READER_MEDIA_EXPERIENCE_UPDATE.md)。状态以 [PROJECT_STATUS.md](PROJECT_STATUS.md) 为准。

前端修改先读本文件，再读对应组件；不要把历史原型当成当前设计。

## 当前约定

- 正式应用是 React + FastAPI + SQLite，先经 `auth/AuthGate.tsx` 再挂载路由。真实 API 统一在 `src/lib/api.ts`。
- 视觉基线为 `components/folio/` 与正式组件；`/demo` 只演示控件和排版。依赖方向为 `demo -> folio`、`formal -> folio`，正式应用不得导入 demo。
- 保留 NH 原标志、独立黑红 favicon、纸墨朱红与直角线条。度量卡可保留小圆角。语言标签省略显示，完整内容放在 title。
- 页头不重复顶部导航。各页直接组织首屏内容；`ModuleBackdrop` 的有限 SVG 绘制不占布局空间。
- 跨项跳转只移动指示条并挂载目标页，不能加载途经页面。减少动态效果立即提交；后台、离屏、阅读器打开时暂停轮播和无用轮询。
- 不添加假作品、任务、统计、标签候选或成人示例素材。页面文字只解释用户需要的动作和结果。

## 页面定位

以下路径相对 `apps/web/src/components/`。

| 页面 | 正式组件与状态 | 样式与实际数据 |
| --- | --- | --- |
| 首页 `#workbench` | `workbench/WorkbenchPage.tsx`、`HomeActivity.tsx`、`folio/ui/HomeHero.tsx` | 对应 CSS；`librarySearch`、`libraryContinueReading`、`latest`、订阅、媒体库和任务；最多6部真实本地作品轮播及6部最新远端作品 |
| 我的库 | `library/LibraryPage.tsx`、`useLibraryState.ts`、`LibraryToolbar.tsx`、`LibraryBatchTray.tsx` | `LibraryPage.css`、`folio/styles/library-discover.css`；库摘要、筛选、标签、收藏、导入；范围按媒体库，旧 source API 保留兼容 |
| 本地详情 | `library/WorkInspector.tsx`、`MetadataScrapePanel.tsx`、`ReaderBridgeControl.tsx` | `folio/ui/WorkDetail.css`、`MetadataScrapePanel.css`；原生悬浮弹窗、自然封面、阅读/编辑/导出/删除、刮削与双来源 |
| 发现 | `discover/DiscoverPage.tsx`、`useDiscoverState.ts`、`DiscoverToolbar.tsx`、`DiscoverFeed.tsx`、`PopularFan.tsx` | `DiscoverPage.css` 与共享发现规则；真实最新/热门/筛选、阅读、导入；作品与订阅旁常驻更新区 |
| 远端详情 `#gallery/{id}` | `discover/GalleryDetailPage.tsx`、`gallery/useGalleryDetail.ts`、`gallery/*` | `gallery/*.css`；作品信息、标签、预览和相关推荐；保留独立详情构图 |
| 订阅与更新 | `subscriptions/CreatorSubscribeButton.tsx`、`SubscriptionsPanel.tsx`、`SubscriptionUpdates.tsx`、`UpdatesIndicator.tsx`、`useSubscriptionUpdates.ts` | `settings/NotificationSection.css`；作者/社团订阅、4部近期作品、未读、已读；同一 gallery 合并跨订阅更新，原始日文标题精确匹配才折叠预览中的语言版本 |
| 整理 | `governance/GovernancePage.tsx`、`useGovernanceState.ts`、`Governance*Panel.tsx`、`GovernanceSourceRail.tsx` | `GovernancePage.css`、`GovernanceEditor.css`、共享治理规则；字段、标签、翻译、核对与源文件回写 |
| 词典 | `dictionary/DictionaryPage.tsx`、`useDictionaryState.ts`、其子组件 | `DictionaryPage.css`、`DictionaryEditor.css` 与共享规则；搜索、候选、影响预览、应用、批量处理 |
| 队列 | `tasks/TasksPage.tsx`、`useTasksState.ts`、其子组件 | `TasksPage.css`、共享任务规则；状态筛选、日志、暂停/恢复/取消/重试/删除 |
| 文件 | `files/FilesPage.tsx`、`useFilesState.ts`、`FileList.tsx`、`FileDetailPanel.tsx`、`FileDeleteDialog.tsx`、`MigrationPanel.tsx` | `FilesPage.css`；媒体库/清单/迁移三个视图；选择与目标分区、复制/移动、冲突处理、预览和迁移任务 |
| 设置 | `settings/SettingsPage.tsx`、`useSettingsState.ts`、对应 `*Section.tsx` | `SettingsPage.css`、`folio/styles/settings.css`；连接、翻译、访问/阅读、导出默认、统计、存储、邮件 |
| 目录与缓存 | `settings/MediaLibrariesSection.tsx`、`MediaLibraryEditor.tsx`、`ReadingCacheSection.tsx`、`StorageSection.tsx` | `StorageSection.css`；实际目录选择、监控/补偿、扫描、阅读缓存与用量；目录配置在文件页 |
| 阅读器 | `reader/ReaderPage.tsx`、`ReaderViewport.tsx`、`WebtoonView.tsx`、`ReaderToolbar.tsx`、`ReaderScrubber.tsx`、`ReaderInfoPanel.tsx`、其状态 hooks | `ReaderPage.css`、`ReaderToolbar.css`、`ReaderPanels.css`；本地/远端阅读、进度与会话、直接阅读、版本恢复、双来源交接；控件覆盖图片 |
| 阅读历史 | `history/HistoryPage.tsx`、`useHistoryState.ts`、`historyHelpers.ts` | `HistoryPage.css`；阅读记录、日期与真实会话 |
| 导出 | `export/ExportAction.tsx`、`ExportDialog.tsx`、`useExportState.ts`、`LegacyExportEntry.tsx` | `ExportDialog.css`；预览后下载，保留旧 `#export` 链接兼容 |

## 共用实现

- `folio/config.ts`：8个主导航、设置章节与图标。
- `folio/shell/FolioChrome.tsx`：顶部导航、手机菜单、滚动恢复、进度；`ArchiveShell.tsx` 接入全站更新提示，阅读器绕过 chrome。
- `folio/shell/PageNavigation.tsx`：NH 原标志与导航线稿图标。`public/icon.svg` 只负责网页 favicon。
- `lib/motion/SlidingIndicator.tsx`：实际容器坐标内450ms连续移动，支持滚动、打断与减少动态效果。
- `lib/motion/pageTransition.ts`：目标页只提交一次；主页面/设置/文件/队列/发现使用原生 View Transitions，详情使用轻淡入和12px位移。快速导航取消过期回调。
- `App.tsx`：详情入口先准备真实数据与懒加载模块，再在过渡截图后卸载旧弹窗；阅读器同步提交，保留前一页面和焦点。
- `lib/useNativeDialog.ts`：原生 dialog 焦点、Escape/背景关闭与短时进出动画。`WorkInspector` 仅在进入阅读器时即时关闭，普通详情跳转等待页面卸载。
- `folio/ui/`：控件、度量卡、封面、分页、标签滚动、继续阅读行与删除动作；优先复用。
- `lib/navigation.ts`：原生 href 与 tag/本地标签范围；保留键盘、修饰键和新窗口行为。
- `lib/format.ts` / `lib/jobs.ts`：格式化与任务规则，不把通用函数放到 feature 文件夹。

## CSS 顺序

`Folio.css` 按顺序加载 `base`、`chrome`、`workbench`、`library-discover`、`governance-dictionary`、`tasks-export-files`、`settings`、`feedback-motion`、`responsive`。功能页局部 CSS 按所属组件加载。改一个模块时不要叠加跨页覆盖规则。旧 PageHeading、scenes 目录和首页原型已退役。

## 验证

```bash
npm --prefix apps/web run build
git diff --check
PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q
```

前端使用隔离真实副本与 `E2E_BASE_URL` / `E2E_STORAGE_STATE`。1440×1000、390×844 必验，320及横屏针对布局边界复验。新目标用 `e2e/site-layout-refinement.spec.ts`；全站滑动用 `site-audit.spec.ts`；边角 SVG 用 `scene-motion.spec.ts`。检查动画中间帧、可见性、焦点、滚动、控制台与性能，不能只验构建。
