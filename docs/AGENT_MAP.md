# NH Archive Agent Map

当前源码与自动发布以 `main` 为准，开发目录 `nhentai-dev`，正式 Compose 在 `/opt/nhentai` 使用发布镜像和独立数据卷。正式发布与当前验收以 [PROJECT_STATUS.md](PROJECT_STATUS.md) 为准；[SITE_LAYOUT_REFINEMENT.md](SITE_LAYOUT_REFINEMENT.md) 保留历史发布记录，其侧栏、顶部更新入口与视觉结论已撤回。上一版阅读与媒体库更新见 [READER_MEDIA_EXPERIENCE_UPDATE.md](READER_MEDIA_EXPERIENCE_UPDATE.md)。

前端修改先读本文件，再读对应组件；不要把历史原型当成当前设计。

## 当前约定

- 正式应用是 React + FastAPI + SQLite，先经 `auth/AuthGate.tsx` 再挂载路由。真实 API 统一在 `src/lib/api.ts`。
- 视觉基线为 `components/folio/` 与正式组件；`/demo` 只演示控件和排版。依赖方向为 `demo -> folio`、`formal -> folio`，正式应用不得导入 demo。
- 保留 NH 原标志、独立黑红 favicon、纸墨朱红与直角线条。度量卡可保留小圆角。语言标签省略显示，完整内容放在 title。
- 页头不重复顶部导航。搜索、操作、紧凑摘要与工作区组成首屏；不要删除页头后机械上移旧内容。额外的边角 SVG 已删除，保留原标志和控件线稿。
- 跨项跳转只移动指示条并挂载目标页，不能加载途经页面。减少动态效果立即提交；后台、离屏、阅读器打开时暂停轮播和无用轮询。
- 不添加假作品、任务、统计、标签候选或成人示例素材。页面文字只解释用户需要的动作和结果。

## 页面定位

以下路径相对 `apps/web/src/components/`。

| 页面 | 正式组件与状态 | 样式与实际数据 |
| --- | --- | --- |
| 首页 `#workbench` | `workbench/WorkbenchPage.tsx`、`HomeActivity.tsx`、`folio/ui/HomeHero.tsx` | 对应 CSS；最多6部真实本地作品，4秒单步轮播；右下方4部实际最新作品。封面直接阅读，返回刷新进度并保持作品ID |
| 我的库 | `library/LibraryPage.tsx`、`useLibraryState.ts`、`LibraryToolbar.tsx`、`LibraryBatchTray.tsx` | `LibraryPage.css`、`folio/styles/library-discover.css`；库摘要、筛选、标签、收藏、导入；范围按媒体库，旧 source API 保留兼容 |
| 本地详情 | `library/WorkInspector.tsx`、`MetadataScrapePanel.tsx`、`ReaderBridgeControl.tsx` | `folio/ui/WorkDetail.css`、`MetadataScrapePanel.css`；原生悬浮弹窗、自然封面、阅读/编辑/导出/删除、刮削与双来源 |
| 发现 | `discover/DiscoverPage.tsx`、`useDiscoverState.ts`、`discoverState.ts`、`DiscoverToolbar.tsx`、`DiscoverFeed.tsx`、`PopularFan.tsx` | `DiscoverPage.css` 与共享发现规则；作品/更新/订阅三项常驻；作品全宽展示，无更新侧栏。筛选保存不能覆盖更新或订阅链接 |
| 远端详情 `#gallery/{id}` | `discover/GalleryDetailPage.tsx`、`gallery/useGalleryDetail.ts`、`gallery/*` | `gallery/*.css`；作品信息、标签、预览和相关推荐；保留独立详情构图 |
| 订阅与更新 | `subscriptions/CreatorSubscribeButton.tsx`、`SubscriptionsPanel.tsx`、`SubscriptionUpdates.tsx`、`useSubscriptionUpdates.ts` | `settings/NotificationSection.css`；作者/社团订阅、4部近期作品、未读、已读；发现页更新标签附未读数量，顶部无额外入口。保留原始日文标题精确匹配的语言预览折叠 |
| 整理 | `governance/GovernancePage.tsx`、`useGovernanceState.ts`、`Governance*Panel.tsx`、`GovernanceSourceRail.tsx` | `GovernancePage.css`、`GovernanceEditor.css`、共享治理规则；字段、标签、翻译、核对与源文件回写 |
| 词典 | `dictionary/DictionaryPage.tsx`、`useDictionaryState.ts`、其子组件 | `DictionaryPage.css`、`DictionaryEditor.css` 与共享规则；搜索、候选、影响预览、应用、批量处理 |
| 队列 | `tasks/TasksPage.tsx`、`useTasksState.ts`、其子组件 | `TasksPage.css`、共享任务规则；状态筛选、日志、暂停/恢复/取消/重试/删除 |
| 文件 | `files/FilesPage.tsx`、`useFilesState.ts`、`FileList.tsx`、`FileDetailPanel.tsx`、`FileDeleteDialog.tsx`、`MetadataPanel.tsx`、`DerivedFilesPanel.tsx`、`MigrationPanel.tsx` | `FilesPage.css`、`MetadataPanel.css`；媒体库/文件/元数据/派生文件/迁移五个视图；本地资料查看与导出、恢复/清理预览、实际派生文件查看/下载、本页全选与批量清理，以及复制/移动迁移 |
| 设置 | `settings/SettingsPage.tsx`、`useSettingsState.ts`、对应 `*Section.tsx` | `SettingsPage.css`、`folio/styles/settings.css`；连接、翻译、访问/阅读、导出默认、统计、存储、邮件 |
| 目录与缓存 | `settings/MediaLibrariesSection.tsx`、`MediaLibraryEditor.tsx`、`ReadingCacheSection.tsx`、`StorageSection.tsx` | `StorageSection.css`；实际目录选择、监控/补偿、扫描、阅读缓存与用量；目录配置在文件页 |
| 阅读器 | `reader/ReaderPage.tsx`、`ReaderViewport.tsx`、`WebtoonView.tsx`、`ReaderToolbar.tsx`、`ReaderScrubber.tsx`、`ReaderInfoPanel.tsx`、其状态 hooks | `ReaderPage.css`、`ReaderToolbar.css`、`ReaderPanels.css`；本地/远端阅读、进度与会话、直接阅读、版本恢复、双来源交接；控件覆盖图片 |
| 阅读历史 | `history/HistoryPage.tsx`、`useHistoryState.ts`、`historyHelpers.ts` | `HistoryPage.css`；阅读记录、日期与真实会话 |
| 导出 | `export/ExportAction.tsx`、`ExportDialog.tsx`、`useExportState.ts`、`LegacyExportEntry.tsx` | `ExportDialog.css`；预览后下载，保留旧 `#export` 链接兼容 |

## 共用实现

- `folio/config.ts`：8个主导航、设置章节与图标。
- `folio/shell/FolioChrome.tsx`：8项顶部导航、手机菜单、滚动恢复、进度；`ArchiveShell.tsx` 接入正式页面，阅读器绕过 chrome。
- `folio/shell/PageNavigation.tsx`：NH 原标志与导航线稿图标。`public/icon.svg` 只负责网页 favicon。
- `lib/motion/SlidingIndicator.tsx`：实际容器坐标内380ms连续移动，支持滚动、打断与减少动态效果；文字样式不能匹配指示条。
- `lib/motion/pageTransition.ts`：只提交目标页。普通内容220ms轻淡入及12px位移，详情整幅画面先淡出80ms再淡入160ms；禁止分开捕获旧弹窗或让浏览器缩放页面截图。快速导航取消过期回调。
- `App.tsx`：详情入口先准备真实数据与懒加载模块，再在过渡截图后卸载旧弹窗；阅读器同步提交，保留前一页面和焦点。
- `layout/RouteFallback.*`：整页占位只用 `folio-route-loading`；详情等待条只用 `folio-detail-pending`，两者不能共用样式类。组件入场与数字动画在页面过渡截图时直接显示目标状态。
- `lib/useNativeDialog.ts`：原生 dialog 焦点、Escape/背景关闭与短时进出动画。`WorkInspector` 仅在进入阅读器时即时关闭，普通详情跳转等待页面卸载。
- `folio/ui/`：控件、度量卡、封面、分页、标签滚动、继续阅读行与删除动作；优先复用。
- `lib/navigation.ts`：原生 href 与 tag/本地标签范围；保留键盘、修饰键和新窗口行为。
- `lib/format.ts` / `lib/jobs.ts`：格式化与任务规则，不把通用函数放到 feature 文件夹。`api.updateReaderState` 保存成功发出 `nh-reader-state-changed`，首页可见时更新真实进度。
- `reader/WebtoonView.tsx`：连续阅读在布局阶段恢复保存页，原图的未加载/等待/失败页预留尺寸，避免页面高度为零导致全书请求及错误进度。优先用每页真实尺寸，缺失时暂用首个已知尺寸；解码后仍使用自然大小；恢复/跳页期间占位几何不回写进度，目标解码后再次校准位置以应对列表底部滚动限制；用户滚动、触摸、滚动条或键盘操作后解除固定，正常回写。`useReaderData.ts` 必须保留远端返回的页面尺寸。

## CSS 顺序

`Folio.css` 按顺序加载 `base`、`chrome`、`workbench`、`library-discover`、`governance-dictionary`、`tasks-export-files`、`settings`、`feedback-motion`、`responsive`。功能页局部 CSS 按所属组件加载。改一个模块时不要叠加跨页覆盖规则。旧 PageHeading、scenes 目录和首页原型已退役。

## 验证

```bash
npm --prefix apps/web run build
git diff --check
PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q
```

前端使用隔离真实副本与 `E2E_BASE_URL` / `E2E_STORAGE_STATE`。1440×1000、1365×768、390×844 必验，320及横屏针对布局边界复验。核心用 `site-layout-refinement.spec.ts`、`home-gallery.spec.ts`；全站滑动用 `site-audit.spec.ts`；冷加载与快速打断用 `scene-motion.spec.ts`。截图必须等待真实图片解码，并检查动画中间帧、焦点、滚动、控制台与性能。

连续阅读的已保存进度另用 `reader-scroll.spec.ts`：实际长作品从第40页进入，桌面/手机及原图/适宽/适高，延迟前一页图片响应；另用 `E2E_LANDSCAPE_WORK_ID` 检查实际26页横向封面作品第20页和末页的原图恢复，以及图片加载中主动滚动；全过程不得改写为其他页或请求全书。与 `reader.spec.ts`、`reader-bridge.spec.ts` 分组复验。
