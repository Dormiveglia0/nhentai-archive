# NH Archive Project Status

## Current Version

Feature-complete local loop after Phase 7 task center and final governance/export closure.

Current real slice:

`NH API Key settings -> remote discover/search/detail -> dictionary mapping -> remote reader or import job -> real task center status/pause/resume/cancel/log/retry -> local CBZ/work_tags -> library summary/search/filter/shelves/history -> local reader -> progress save -> per-work/bulk governance queue/metadata/dictionary confirmation -> export preview/rename/download CBZ (single, sync .zip, or temporary bulk-export task artifact) to the user`

## Completed

- 最终闭环收尾:治理批量新增「确认现有词典译名」动作,复用 `POST /api/governance/bulk/preview|apply`,只确认所选作品关联的 `review/conflict` 且未忽略/未锁定/有中文名的词典项,同一词条多作品引用时只更新一次,跳过项按真实原因回显。前端治理批量条新增对应复选项,预览/结果显示确认与跳过词条数。长时批量导出已闭环为 `ExportJobService` + `bulk_export` job:超过 `EXPORT_SYNC_THRESHOLD=5` 的选择进入任务中心后台打包,产物写入临时 export-jobs 目录,24h 过期、下载即删;导出页与库批量托盘共用该阈值和 `/api/exports/bulk-jobs`。验证覆盖治理批量确认、后台导出任务 API/下载/过期/重试/取消。
- 机翻接入 + 设置页全量重构:新增 `TranslationService`(provider 适配器,stdlib `urllib` 无新依赖):`google_free`(谷歌免费翻译,无需 key)与 `deepl`(REST,key 存 `mt.deepl_api_key`),配置存 `settings` 表 `mt.*`,`public_config()` 不回显 key,`verify()` 跑样例翻译并记 `mt.last_verify`。词典接入:`DictionaryService.translate_text()`(单条按需)与 `generate_suggestions()`(批量译未配置远端 tag→可复核 `status='suggested'` 行,source `machine`;绝不覆盖人工/锁定项,确认前绝不关联 `work_tags`);新增 `POST /api/dictionary/translate`、`/suggest-batch`、`/api/settings/translation/verify`;`SettingsService` 暴露 `machine_translation` 配置块并处理 patch。前端:设置页拆分为 `useSettingsState` + 连接/机翻/隐私阅读/存储四分区组件(左栏导航真实切换、`Presence` 淡入),新增机翻配置卡(provider 卡片选择、DeepL key 保存/清除/套餐、测试机翻);词典编辑器「机器建议」改为真实「机翻填充中文名」按钮,候选区新增「批量机翻未配置项」按钮。验证:`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿(99 passed,新增 `test_translation.py` 9 项,覆盖 provider 解析/选择/无 key 报错/不泄漏 key/verify 与词典单条/批量/不覆盖人工/无服务报错);`cd frontend && npm run build` 通过;静态扫描 touched 文件无假数据、机器建议「未接入」占位已移除。沙箱无出网,真实机翻需用户在设置填 key 后自测。
- 工作台聚合面板:`#workbench` 从占位边界页替换为真实每日仪表盘,通过 `GET /api/workbench/overview` 聚合 library/governance/jobs/files/exports 的真实摘要数据,无健康分、无虚假聚合数。页面由四部分构成:馆藏作品/待治理/失败任务/缺失源文件四格真实指标条(`WorkbenchMetricStrip`)、治理/任务/文件/导出四张跳转模块卡(`WorkbenchModuleCards`,分别跳至 `#governance`/`#tasks`/`#files`/`#export`)、复用 `ContinueReadingRow` 渲染的继续阅读书架、以及复用同组件的最近导入书架;两条书架均在无真实数据时自动折叠,`blurCovers` 隐私开关贯穿全页。新增 `WorkbenchService`(只读聚合器,从现有 `LibraryService`/`GovernanceService`/`JobService`/`FileService`/`ExportService` 取数,绝不调 NH API)与前端 `components/workbench/`(`WorkbenchPage`、`useWorkbenchState`、`WorkbenchMetricStrip`、`WorkbenchModuleCards`、`workbenchHelpers`)。新增 `backend/tests/test_workbench_service.py`(3 项)与 `backend/tests/test_workbench_api.py`(1 项)。验证:`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿(90 passed);`cd frontend && npm run build` 通过。
- Phase 7 任务中心: `#tasks` 从边界页替换为真实 `TasksPage`,只读取和操作现有 `/api/jobs` 数据,不造假任务。后端新增 `job_logs` 表与真实控制 API:`GET /api/jobs/{id}/logs`、`POST /api/jobs/{id}/pause`、`POST /api/jobs/{id}/resume`、`POST /api/jobs/{id}/cancel`;`JobService` 记录创建/阶段/完成/失败/暂停/恢复/取消/重试日志,并提供 `checkpoint()` 让导入线程在安全阶段边界协作暂停/取消(下载阶段取消会在下个 checkpoint 停止并清理 tmp CBZ)。页面按 `design/任务中心.png` 的结构落地:hero + 5 张真实指标卡(`running/queued/failed/completed` 与今日更新吞吐量)、完整状态 tab(`all/running/paused/queued/failed/completed/cancelled`)、搜索、紧凑任务表、右侧任务详情检查器。失败的 `remote_import` 且带 `gallery_id` 的任务可重试;运行/等待任务可暂停;暂停任务可恢复;运行/等待/暂停任务可取消;日志区显示后端持久日志;复制任务 ID 为真实剪贴板操作。新增 `components/tasks/`(状态 hook、summary strip、列表、检查器、helper 标签/时间格式化),`Job` 前端类型补 `created_at` 与 `paused/cancelled`,新增 `JobLog` 类型;新增 `backend/tests/test_job_service.py` 和 `backend/tests/test_jobs_api.py` 覆盖状态机、日志、控制路由与 retry payload。验证:`cd frontend && npm run build` 通过;`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿;静态扫描 touched task files 无假数据命中。
- Phase 6 文件管理:新增 `FileMaintenanceService`(本地文件系统 + SQLite,绝不调 NH API)与 API `GET /api/files/overview`、`GET /api/files/inventory`、`POST /api/files/preview-delete`、`POST /api/files/delete`。文件清单统一展示三类条目:作品(源 CBZ + 封面聚合为一个单元,状态 ok/missing_source/missing_cover,体积不符标 size_mismatch)、孤立文件(library/covers 下无 DB 引用)、临时残留(tmp/exports)。`work_files.path`/`works.cover_path` 的绝对/相对混用统一归一化为 `.resolve()` 绝对路径后再判定。删除是唯一动盘操作:删除作品经 SQLite `ON DELETE CASCADE` 级联清空 works/work_files/work_pages/work_tags/work_metadata/reader_progress/reading_history 并删源 CBZ + 封面;孤立/临时仅 unlink;受管目录外路径一律拒绝(穿越防护);CBZ 字节从不被修改,只整体删除。删除前强制 preview(展开级联影响、可回收字节、阅读进度/治理警告)。前端 `#files` 边界页替换为真实 `FilesPage`,并按 `design/文件管理.png` 视觉对齐:hairline 细数字指标条(`.files-summary`,沿用 dict-metric 语言)、多列文件表(文件名/路径/类型/大小/状态,可多选+选中高亮+聚焦左条)、底部封面详情面板(`FileDetailPanel`,真实封面缩略+4 格统计,封面遵循 `blurCovers` 隐私模糊)、右栏 `FileHealthRail`(健康度=真实 overview;重复检测=诚实「未接入」边界,不显示假重复数;清理工具=预览→二次确认→执行→刷新,删除结果回显成功/错误)。验证:`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿(新增 test_file_service.py 12 项 + test_files_api.py 3 项);`cd frontend && npm run build` 通过;静态扫描无假数据;临时数据目录手验 overview/preview/级联删除符合真实状态;Playwright(bundled chromium)在 `#files` 桌面 1440 与移动 390 截图核对真实 6 作品数据下的指标条/文件表/封面详情/健康度侧栏渲染正常、无控制台报错(仅 favicon 404)。
- 导出中心下载选项与检查器重构:后端 `ExportService.preview/build_cbz/build_bundle` 新增 `write_comicinfo`、`keep_json`、`compress` 选项，预览会反映将写入/保留内容，单文件下载和批量 `.zip` 下载都会传递同一组选项；新增测试覆盖不写 ComicInfo、去除 JSON、无压缩打包和预览选项回显。前端导出页从 summary/table/preset/preview 旧分区调整为 `ExportToolbar` + `ExportWorkList` + `ExportInspector`：支持搜索、状态筛选、点击作品聚焦/选择、检查器内改输出名、切换 ComicInfo/JSON/压缩、刷新预览、下载所选或仅下载当前作品；删除旧 `ExportSummary`、`ExportQueueTable`、`ExportPresetBar`、`ExportPreviewPanel`。验证：`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 52 passed；`cd frontend && npm run build` passed；Playwright Chromium QA on `http://127.0.0.1:5174/#export` desktop 1440x1000 and mobile 390x844 verified page identity, nonblank render, no framework overlay, no console warnings/errors, search empty-state interaction, and screenshots saved under `/tmp/nh-export-*.png`.
- 导出语义改造（导出 = 下载给用户，而非写到服务器目录）:按用户预期重定向了导出功能。后端新增 `ExportService.build_cbz()`（在内存中打包带 `ComicInfo.xml` 的单个 CBZ 字节）与 `build_bundle()`（多选打包为一个 `.zip`），新增下载路由 `GET /api/works/{id}/export/download` 与 `POST /api/exports/download`（均以 `Content-Disposition: attachment` 流式返回）。删除了服务器侧写盘逻辑（`generate`/`generate_many`/`history`/输出目录解析）与 `export_records` 表及其迁移；导出不再保留任何记录。前端 `api.downloadExport` / `downloadExportBundle` 以 blob 拉取并触发浏览器下载；`useExportState` 的 `downloadSelected`（单选下单文件 / 多选下 `.zip`）与 `downloadOne` 取代了旧的批量生成；移除了输出目录卡片/编辑、`导出完成后打开输出目录` 复选框与“最近导出记录”区块（删 `ExportHistory.tsx`）；表头按钮 `移除选中`→`移除当前`。`storage.export_dir` 设置项保留但已不再被导出流程使用。后端 `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 50 passed；`cd frontend && npm run build` 零错误。原始 CBZ 始终只读、不被修改。
- 导出中心早期 Phase 5 实现（历史）:曾实现服务器输出目录、`export_records`、生成历史、导出预设条和表格式队列；这些能力已被当前“浏览器下载、不写服务器目录、不保留记录”的导出语义改造替代。保留的核心是本地源 CBZ 只读、治理元数据驱动 ComicInfo、`#export` / `#export/{workId}` 真实路由，以及从真实 SQLite/archive 状态计算预览、阻塞与警告。
- 作品详情页 · 氛围横幅重构(`GalleryDetailPage`):解决了「不同封面比例 + 不同标签数量导致两列高度参差、翻书布局抖动」的根因。hero 改为一整块固定高度横幅(同图模糊奶油色洗白底 + 恒定尺寸封面卡槽,封面按高度约束不裁剪、不留白);标签移出 hero 改为整宽面板、每组独占一行(内容标签横向铺宽不顶高,少标签组无留白);相关作品改为居中固定宽卡片并展示词典中文内容标签。后端 `discover_service.gallery()` 的相关作品改走 feed 富化路径(`_tags_for_items` + `_with_import_state`)以解析 `tag_ids → tags(含 display)`+入库状态;`GallerySummary.tags` 类型补 `display?`。设计见 `docs/superpowers/specs/2026-06-19-gallery-detail-atmosphere-band-design.md`。
- Phase 4 governance center: implemented the first real single-work governance loop. Added `work_metadata` for field-level final metadata decisions, `GovernanceService` for local-only queue/aggregate/apply, and APIs `GET /api/governance/queue`, `GET /api/works/{id}/governance`, `POST /api/works/{id}/governance/apply`. Governance queue reasons are computed from real SQLite/archive state: missing metadata, untagged works, dictionary review/conflict tags, missing ComicInfo, and missing cover. Aggregate reads `works`, `work_files`, `work_tags`, `remote_galleries.payload_json`, `local_tag_dictionary`, and real CBZ `ComicInfo.xml` / JSON members. Frontend now supports `#governance` and `#governance/{workId}`, with queue, work header, metadata diff editor, tag governance board, right quality/actions column, and real navigation from library/reader. No bulk governance, machine translation, export generation, or CBZ write-back in this phase. Design/plan docs: `docs/superpowers/specs/2026-06-18-phase4-governance-center-design.md` and `docs/superpowers/plans/2026-06-18-phase4-governance-center.md`.
- 阶段 4 dictionary/settings:完成动画视觉线剩余范围。词典摘要逐项进场、候选行按筛选/翻页结果集 `key` 重播、编辑器按词条 key 淡入切换、应用预览空态/内容态淡入且关联作品逐项进场、批量导入 modal 接入 `Presence`。设置页三栏错峰进场,设置卡片逐项进场,保存/错误 notice keyed 淡入。仅用 `lib/motion` 原语,不改 API/数据逻辑;新增 `.candidate-row-motion`、`.settings-card-motion` 等极小透传类。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage4-dictionary-settings-animation*`。
- 阶段 3 reader:单页翻页新页轻柔淡入(FadeIn keyed by page)、连续滚动模式页面进入窗口时淡入、打开/切换作品时三栏(章节侧栏/阅读区/详情栏)进场(keyed by sourceKey)。统一用 FadeIn 挂载淡入(规避内部滚动容器的 whileInView 与图片尺寸不一的重叠风险);新增 `.reader-page-cell` 撑满列宽居中。保留方向键/章节跳转/滚动自动翻页/隐私遮罩等全部交互。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage3-reader-animation*`。
- 阶段 2 library:全面动画——主卡片墙逐项进场(结果集 `key` 重播)、「继续阅读/最近添加」两条书架行逐项进场、`WorkInspector` 选中切换淡入(按 work.id keyed)。新增 `.library-card-cell`(grid 等高保护)、`.shelf-cell`(横向轨道防压缩)透传类;保留全部现有视觉/hover/横向滚动。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage2-library-animation*`。
- motion 打包瘦身:全局改用 `LazyMotion`+`m`+`domAnimation`(strict),JS 由 gzip 115→101 kB;Provider 在 `lib/motion/MotionProvider.tsx`,后续若需 layout/drag 改 `domMax`。
- 阶段 1 discover 卡片墙:接入逐项进场动画(淡入+轻微上移),翻页/筛选/切视图(grid↔list)时按结果集 `key` 重播;完整保留卡片现有 hover 与等高行,新增 `.discover-card-cell` 透传类保护等高。仅改 `DiscoverFeed.tsx` + 一条 CSS。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage1-discover-cardwall-animation*`。
- 阶段 0 动画基础设施:接入 motion + Tailwind v4(方案 A:关 Preflight、不加前缀、token 映射,现有 `app.css` 零影响),建立 `lib/motion/` 动画原语层与 `components/effects/` 效果接入规范;magicui/react-bits 仅作效果素材,改造进现有设计语言后落地。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage0-animation-foundation*`。后续 discover/library/reader/dictionary/settings 各页面动画改造为独立阶段。
- Restored code baseline to `5a85959` and removed the previous incomplete dictionary/settings/library UI stack.
- Kept project/product documentation as the development memory layer.
- Added real settings APIs:
  - `GET /api/settings`
  - `PATCH /api/settings`
  - `POST /api/settings/nhentai/verify`
- Added runtime NH API Key update:
  - Environment variable key has priority.
  - DB key can be saved/cleared from the UI.
  - API key text is never returned to the frontend.
- Rebuilt settings page against `design/设置.png` as a minimal real settings surface.
- Rebuilt discover page against `design/搜索导入.png`, with a later design decision recorded in `docs/superpowers/specs/2026-06-14-discover-popular-fan-design.md`:
  - structure is now title area + discovery controls/results
  - 今日热门 is a title-side image-first sunset fan driven by scroll progress
  - unified discovery feed instead of separate latest/popular/random pages
  - current-page dynamic loading only; remote `total/num_pages` is pagination metadata
  - real feed/search/tagged routing for latest-like browsing, language/type/sort, keyword, and single/multiple remote tags
  - real popular fan uses `/api/discover/popular`, shows real covers, respects cover blur, and does not poll
  - popular fan visual correction: no bordered/shadowed window container, no large cover-obscuring title/action blocks, no fade-only or scale-only animation; covers follow a rightward semicircle arc and clip out on down-scroll, then reverse on up-scroll
  - mobile popular fan stays visible and supports touch drag as a circular carousel so each real popular work can move into the center position
  - random, Gallery ID, and card detail modal previews with backdrop/Escape close
  - detail modal is information/actions only; `阅读` routes to the full reader page
  - remote read-only reader route `#reader/remote/{gallery_id}` uses real gallery page URLs when available and does not save local progress
  - single keyword/Gallery ID input; removed redundant remote search and Gallery ID tabs
  - grid/list switching
  - icon-only first/previous/page input/next/last pagination
  - unimported-only filtering
  - real import queue action
- Remote gallery cards now prefer Japanese title and show real cached author/language/tag data when available.
- Discover cards were reworked toward `design/库.png`: cover-first vertical layout, fixed metadata order, and draggable hidden-scrollbar tag rows.
- Discover tag filter uses dictionary-aware autocomplete/display mapping while preserving original remote tag IDs/names for remote queries.
- Discover visual hierarchy was tightened: removed stacked section panels, centered feed cards, custom filter menus, softer import-state chips.
- Task dock no longer stays visible when no running/queued/failed job or job API error exists.
- Added API quota protection after live screenshot QA hit remote rate limits:
  - backend request-key TTL cache for cacheable NH API calls;
  - backend 429 cooldown that stops repeated remote forwarding and can serve stale cached data;
  - frontend discover-session cache and in-flight reuse for feed/popular/detail/tag GET calls.
- Full navigation is visible, but unimplemented modules are explicit boundary screens.
- Implemented and refit Phase 2 dictionary foundation:
  - tables: `local_tag_dictionary`, `tag_aliases`, `work_tags`
  - APIs: `/api/dictionary/summary`, `/api/dictionary/candidates`, `/api/dictionary/evidence`, `/api/dictionary/autocomplete`, `/api/dictionary/preview-apply`, `/api/dictionary/apply`, `/api/dictionary/preview-bulk-import`, `/api/dictionary/bulk-import`, `/api/dictionary/{id}/ignore`, `/api/dictionary/{id}/review`, `DELETE /api/dictionary/{id}`
  - `DictionaryService` supports real summary, local creation/editing, alias lookup, cached remote tag candidates, remote tag search through the existing cached client, evidence lookup, apply preview, apply, status changes, delete, bulk import preview/import, and real `work_tags` linking.
  - Bulk import accepts the minimum row shape `原文, 中文名`; type and aliases are optional. Imported rows automatically map to cached remote tags by normalized original text and type when possible.
  - Import flow links imported works to real gallery tags after CBZ ingestion.
  - Discover cards/tag selector render dictionary `display` names when mapped, without using Chinese names as remote API query tokens.
  - `DictionaryPage` was refit against `design/词典.png`: top summary strip, table-like candidate pool, editor with aliases/scope chips and disabled machine suggestion state, evidence tabs, expandable apply preview, and row-level bulk import preview.
  - Dictionary UI polish pass (post Phase 3): title area uses the standard clean hero (removed the invented decorative quote/art blocks); summary strip is big-number metric cards with semantic tone colors; candidate pool has color-coded localized type badges, red impact emphasis, and per-status color tones.
  - Dictionary UI second pass (per user feedback on the live page): removed the 置信度 (confidence) editor field — the planned integration is machine translation, not AI scoring, so confidence has no UI meaning (the DB column stays, defaulting to 80, no longer user-editable). Flattened all modules to hairline-bordered, transparent panels (no background-color fill, no shadow) so modules no longer "pop" via background color. Made the three workspace columns equal-height and top-aligned by moving the 新建本地词条 action into the editor header (it was floating above the editor and pushing that column down) and stretching panes. Fixed action buttons wrapping mid-character (white-space: nowrap + flex-wrap so they wrap as whole units). Removed dead `dictionary-hero/quote/stats/grid/column/filter-row/editor-stack/new-term-button` CSS. No data/logic change — still real-only.
  - Dictionary UI third pass (user picked a design via an inline visual mockup: minimal base + Chinese tinted type tags + terracotta selected bar): summary strip is boxless light-weight large numbers, with terracotta only on 未配置 as the focal accent; all inputs/selects/filters are underline-style (零填充·细线), textareas are minimal hairline boxes, focus turns the underline terracotta; candidate type tags are Chinese tinted chips; the selected candidate row uses a terracotta left bar + subtle tint.
  - Dictionary UI fourth pass (layout + polish per live feedback): summary strip is full-width even distribution with vertical hairline dividers (A-style) instead of left-packed; candidate status is color-coded text (B-style: 已配置 green / 待复核 amber / others muted), no dot; candidate table got a slim custom scrollbar; buttons restyled to solid `--surface-solid` fill (not muddy translucency), 8px radius, real hover states, primary = solid terracotta, danger = ghost.
  - Dictionary UI fifth pass (user-directed layout, current baseline): top workspace is two columns `候选术语池 | 术语编辑器` (`.dictionary-workspace` grid `minmax(360px,1fr) minmax(420px,1.04fr)`, **`align-items: start`** — do NOT stretch, it made columns 1.5 screens tall). Candidate table is capped (`max-height: 400px`, scrolls) so the pool stays ~one screen and the panel below is visible. 批量导入 is a small button in the candidate-pool header that opens a modal (`.dictionary-modal`, reuses `.preview-backdrop`, Escape/backdrop close). Deleted `DictionaryApplyPreview.tsx`.
  - The merged panel below the workspace is titled **应用预览** (`DictionaryEvidencePanel`, `.preview-pane`). It is NOT tabbed — it is a single split layout: metrics row (将更新标签/将影响作品/潜在冲突/忽略项) + a `.preview-split` section grid (标签更新对比 / 常见搭配 / 冲突项 / 远端信息) + a full-width `.preview-works` 关联作品 cover row. Everything is visible at once (user explicitly rejected tab-switching here; wants a split like the old preview). Keep this layout: two-column top (pool|editor, not stretched), single split 应用预览 panel below, bulk import as a modal.
- Implemented Phase 3 “我的库” enhancement against `design/库.png`, all data from SQLite only:
  - Added `LibraryService` (`backend/app/services/library_service.py`): `summary`, `search`, `recent_added`, `recent_read`, `continue_reading`, `tag_filters`. It only queries `works`, `reader_progress`, `work_files`, `work_tags`, `local_tag_dictionary`; it never calls the NH API.
  - Added APIs: `/api/library/summary`, `/api/library/search`, `/api/library/recent-added`, `/api/library/recent-read`, `/api/library/continue-reading`, `/api/library/tag-filters`. Kept `/api/works` for compatibility.
  - `search` supports SQL-backed pagination (per_page capped at 100), keyword (title/japanese/pretty/gallery-id/joined tag text), read-state filter (unread/reading/completed), source filter (remote/local), language filter (via `work_tags` language type), multi-tag AND filter (work must carry every selected remote tag), and whitelisted sorts (recent_updated/added/read, title, pages_desc/asc).
  - Rebuilt `LibraryPage` as orchestration plus thin components: `LibrarySummaryStrip`, `LibraryToolbar`, `LibraryTagFilter`, `WorkCard`, `WorkInspector`, `ContinueReadingRow`, `libraryHelpers`. Reuses discover `FilterMenu`, `IconPager`, and `TagScroller`.
  - Summary strip shows only real metrics (总收藏/已读/阅读中/未读/待补标签/占用容量); “待补标签” = works with zero `work_tags`. Phase 4 later adds a dedicated governance page, while the library summary still avoids fabricating aggregate 待治理 counts.
  - Continue-reading and recent-added shelves render only when real rows exist and only when no filter/search is active.
  - Tag filter selector is backed by `/api/library/tag-filters` and shows dictionary Chinese display names; selecting a tag on a card or in the inspector adds it to the filter (AND).
  - Inspector exposes real file size/pages/source/ID/language/progress, routes 继续阅读 to the local reader, and keeps 进入治理/导出 CBZ disabled with 未接入 labels.
  - Empty library and empty filtered result are distinct real empty states; pagination uses the icon pager so large libraries never render every work at once.
  - Removed the orphaned legacy library CSS (`.filter-ribbon`, `.stats`, old `.work-card*`) replaced by the new `.library-*` system; retargeted the shared progress rule to `.library-card`.

- 治理 ComicInfo 回写源 CBZ：新增共享模块 `comicinfo.py`（ComicInfo 字段生成/XML/zip 重封，ExportService 与回写共用，保证导出下载与源回写产出一致）。`GovernanceService.write_back_comicinfo` 把治理后的 ComicInfo 就地原子写进源 CBZ：写同目录 tmp → fsync → `os.replace`，无备份；只换 ComicInfo.xml，页面图像字节不变；回写后重算并更新 `work_files.sha256`/`size_bytes`。API `POST /api/works/{id}/governance/apply` 增 `write_back` 开关（默认关），metadata 写入成功后回写失败不回滚、以 `write_back.error` 回显。前端应用面板加默认关闭的「同时回写源文件」复选框 + 风险提示 + 二次确认。
- 轻量收尾阶段：① 文件管理 `#files` 清单补真实分页翻页器（复用 IconPager，后端 `inventory` 早已支持 page/per_page）；② 新增阅读历史专属页 `#history`：`LibraryService.reading_history` 按 (作品, 日期) 聚合 `reading_history`（当天最近时间/阅读次数/最远页 + 当前总进度），`GET /api/library/reading-history` 分页，前端按「今天/昨天/本周/更早」日期桶分组时间线，点击进本地阅读器，遵守 blurCovers；③ 治理批量：`GovernanceService.bulk_preview/bulk_apply` 对多选作品执行统一动作——批量补全缺失元数据（只填空、绝不覆盖已有值、来源 comicinfo>json>remote）与批量回写 ComicInfo（沿用单作品 opt-in/原子/无备份/哈希同步/失败隔离），API `POST /api/governance/bulk/preview|apply`，治理队列加多选 + 批量条（预览/应用/结果回显 + 回写二次确认）。验证：`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿（128 passed，含 reading_history 4 项 + governance_bulk 5 项）；`cd frontend && npm run build` 通过。

- 轻量收尾第二轮：① 文件清单 `#files` 加体积排序（后端 `inventory` 新增 `sort` default/size_desc/size_asc，过滤后分页前对整列表排序）+ 补齐 `size_mismatch` 状态筛选（状态匹配改为 `status==e.status or status in e.flags`，使 flag-only 条件可筛）；② 我的库 `#library` 多选 + 批量托盘 `LibraryBatchTray`，只复用现有端点：导出下载合集、批量补全缺失元数据（`governanceBulkApply` fill-missing）、删除所选（`previewFileDelete`→二次确认→`deleteFiles` 级联）；③ 治理元数据机翻：只读 `GovernanceService.translate_metadata`（title/title_japanese/summary，source=auto，绝不写库）产出可复核建议，`POST /api/works/{id}/governance/translate`，前端「机翻填充中文」按钮把建议预填编辑框（source=manual），人工保存才落地；`TranslationService` DeepL 支持 source=auto。设计见 `docs/superpowers/specs/2026-06-23-lightweight-finishing-round2-design.md`。验证：`pytest backend/tests -q` 全绿（134 passed，新增 file_service 2 项 + governance_translate 4 项）；`npm run build` 通过。

## Not Implemented Yet

- 无已知功能闭环缺口。后续进入真实数据下的视觉 QA、性能/体验 polish、以及用户反馈驱动的小范围增强。

## Next Plan

功能闭环已落地。下一阶段只做真实数据验收:任务中心/治理/导出/文件管理的浏览器截图 QA、移动端细节、长列表性能与文案 polish。

## Risks And Decisions

- Decision: 工作台只聚合真实模块摘要,不造健康分、不造假聚合数;隐私开关沿用全局,不在工作台重复。
- Decision: 文件管理是管理库内全部文件,不只异常清理;清单含健康作品,所有行可删。
- Decision: 删除健康作品的源 CBZ = 级联整体移除该作品(works 及全部引用表 + 封面文件)。
- Decision: 删除是文件管理唯一会动盘的操作;CBZ 永不被修改,只能整体删除;受管目录(library/covers/tmp/exports)之外的任何路径一律拒绝(目录穿越防护)。
- Decision: 治理 ComicInfo 回写是唯一受认可的源 CBZ 改写（仅 ComicInfo、原子替换、无备份、显式 opt-in、默认关）；导出仍永不写源（导出=下载给用户）；文件管理删除仍是另一条独立动盘操作。回写后必须同步 `work_files.sha256`/`size_bytes` 以维持去重/体积检测的真实性。
- Decision: 治理批量只做「逐作品执行统一动作、取值各自解析」:批量补全缺失元数据(只填空、绝不覆盖人工/已有非空值,来源映射 comicinfo→comicinfo / remote→remote / json→remote)+ 批量回写 ComicInfo(沿用单作品 opt-in/原子/无备份/哈希同步/失败隔离;单作品失败记录 error 并继续,不回滚已写 metadata)+ 批量确认现有词典译名(仅 review/conflict 且未忽略/未锁定/有中文名;不批量编辑译名/别名)。
- Decision: 阅读历史按 (作品, 日期) 聚合,前端按日期桶(今天/昨天/本周/更早)分组时间线;高频裸事件(每翻页一行)不展示。历史(完整可分页轨迹)与「继续阅读」(仅在读)、「最近阅读」(Top 12 书架)区分。
- Decision: 文件清单分页为纯前端补翻页器;后端 `FileMaintenanceService.inventory` 早已支持分页。批量导出超过 5 部时接入任务中心,产物为临时 `.zip`:24h 过期、下载即删,不恢复长期导出历史。
- Decision: `work_files.path`/`works.cover_path` 绝对/相对混用,一律归一化为 `.resolve()` 绝对路径后再判定存在/删除/穿越。
- Decision: API Key settings and discover correctness are higher priority than expanding modules.
- Decision: language/type/sort controls must either call real APIs or be disabled; no inert clickable filters.
- Decision: Latest-like browsing uses `/api/discover/feed`; it switches to search/tagged only when filters require remote search semantics.
- Decision: Popular is a progressive title-side image-first sunset fan, not a permanent section, not a horizontal mini-list, not a framed panel, and not a manual-only hidden popover.
- Decision: Gallery ID is handled by the main keyword input when the query is pure numeric; no separate Gallery ID tab.
- Decision: Type filtering is limited to confirmed UI options `doujinshi` and `manga` until broader remote type semantics are verified.
- Decision: Card details use a modal, not a right-side drawer; no discovery layout space is reserved for details.
- Decision: Multiple selected tags use search query `tag:"..."` terms; single tag without other filters may use `/api/discover/tagged`.
- Decision: all future remote-backed modules must use cached service/client boundaries and must not call NH API directly from page-level loops or screenshot scripts.
- Decision: dictionary autocomplete only calls remote tag search when local dictionary/cache has no hit, reducing API quota pressure.
- Decision: local-only dictionary terms can be created, but discover remote filtering only selects terms mapped to real remote tag IDs.
- Decision: machine suggestions are now backed by a real machine-translation source (`google_free` / `deepl`, provider-selectable in settings). Machine output is written only as reviewable `status='suggested'` dictionary rows (source `machine`); it must be human-confirmed before it links `work_tags`, never overwrites a human-configured/locked entry, and is never auto-applied. The DeepL key is stored server-side and never echoed to the frontend.
- Decision: dictionary candidate/evidence/preview metrics are computed from SQLite tables only.
- Decision: unimplemented modules stay boundary screens.
- Decision: 任务中心只展示与操作真实 `/api/jobs`;只有失败的 `remote_import` + `gallery_id` 可重试。暂停/恢复/取消通过后端状态机与导入线程 checkpoint 协作,不做前端假控制。
- Decision: library is local-only; `LibraryService` must never call the NH API and library pages must not re-query remote tags. Tag filters reuse `work_tags` + dictionary mappings only.
- Decision: library multi-tag filtering uses AND semantics (a work must carry every selected remote tag).
- Decision: library summary shows only real metrics and still does not fabricate a broad 待治理 count. 待补标签 (works with zero `work_tags`) remains the honest library-level proxy; richer governance detail lives in `GovernanceService`.
- Decision: library shelves (继续阅读/最近添加) only render with real rows and only in the unfiltered default view; filtering switches to the paginated result wall.
- Decision: library language filter and language facets derive from `work_tags` rows of type `language` (with dictionary display), not the unused `works.language` column.
- Decision: governance metadata decisions live in `work_metadata`, not additional `works` columns and not a JSON blob. Original CBZ files stay read-only except for the sanctioned governance ComicInfo write-back (opt-in, default off, ComicInfo-only, atomic replace; see the write-back decision above); Phase 5 export creates new CBZ files under the export directory instead of writing back to source archives.
- Decision: governance queue and completeness use real local state only. Missing values are shown as missing/unknown; no fake diffs, fake conflicts, or fake recommended actions.
- Decision: 全站页面内显示的 tag 一律走词典转换名(`display`,即 `zh_name → name → slug`),英文 `name`/`slug` 仅作无词典项时兜底;英文原文只用于后端 NH API 请求等操作,不直接显示给用户。
- Decision: 作品详情 hero 的封面按**固定高度**约束(放进恒定尺寸卡槽),绝不按长宽比框死,也不裁剪;空余由同图模糊底填充。标签等数量不定的内容**不得**与封面同列并排,须移到独立整宽区域,避免两列高度互相参差、翻书布局抖动。
- Risk: tag enrichment calls `/api/v2/tags/ids`; if remote rate limits, cards may show cached/empty tags rather than invented labels.
- Risk: search query syntax follows the compact API doc and should be manually checked against live API behavior.

## Verification Record

- `PYTHONPATH=backend pytest backend/tests -q`: passed, 28 tests (5 new in `test_library_service.py` covering summary, search filters/pagination, read-status, recent/continue shelves, and dictionary-aware tag filters).
- `npm run build`: passed (`tsc -b && vite build`).
- `git diff --check`: passed.
- In-process API smoke (route functions called directly before `httpx` was added): empty library → real zero states; after ingesting one real CBZ and linking real tags → correct summary/sources/language facet, keyword + `tag_ids="7,8"` + language search returns the work with real tags and size, malformed `tag_ids` tokens are ignored, `tag-filters` excludes language type, recent-added returns the real row.
- Static fake-data scan over `library_service.py` and `components/library/` + `lib/api.ts`: no mock/fake/placeholder/random data; only SQL parameter placeholders and the pre-existing dictionary `samples` field matched.
- Browser screenshot QA NOT run: no browser/Playwright/chromium is installed in this environment. The library page is local-data only (no NH API), so visual QA is safe to rerun by the user: start backend (`PYTHONPATH=backend uvicorn app.main:app --port 8001`) + `npm run dev`, import a CBZ, then open `#library`.
- 详情页氛围横幅重构后复测:`PYTHONPATH=backend python3 -m pytest backend/tests -q` 35 passed;`cd frontend && npm run build` 通过;`git diff --check` 干净。后端 related 富化为数据路径改动,需用户重启后端 + 硬刷新后在 `#gallery/{id}` 验收(封面/标签/相关卡)。
- Phase 5 export download/options slice: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 52 passed; `cd frontend && npm run build` passed. Tests cover preview without writes, generated CBZ containing generated `ComicInfo.xml`, real `meta.json` preservation, option-controlled omission of ComicInfo/JSON and stored compression, custom output-name export, missing-source blockers, bundle member-name dedupe, blocked-item bundle skipping, queue ready/blocked/warning summary counts, source CBZ byte preservation, and FastAPI export route success/error mapping through `TestClient`. Playwright Chromium QA on `http://127.0.0.1:5174/#export` verified desktop/mobile render, search empty-state interaction, no framework overlay, no console warnings/errors, and screenshots at `/tmp/nh-export-desktop.png` and `/tmp/nh-export-mobile.png`.
