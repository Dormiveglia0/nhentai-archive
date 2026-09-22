# NH Archive Project Map

## 2026-09-23 · 首页、热门、登录与二级页面收尾

首页使用真实30天日期阵列、连续路径与邻近抬升，展开保留节点身份，秒级记录不再显示为0分钟；后台、滚动及减少动态效果暂停装饰运动。热门采用五封面连续展示，显式按钮/键盘切换，取消指针路过换选，大屏封面高度限制390px，手机原生横向滚动。登录删除重复巨大标识和外层卡片，单入口居中，保留测量输入框至顶栏的成功过渡。历史修正封面列宽不一致、重复百分比，记录补充月日；远端详情无关联作品时隐藏对应入口，删除标签/关联标题下说明。

验证：Web build 与36项跨页面回归通过；二级页面2项检查通过（首次测试误读详情接口为result已修正）。登录7项覆盖短屏、四尺寸过渡落位及减少动态效果；历史/详情1440、2560、390截图无横向溢出与pageerror。手机续读无独立tag区，桌面tag筛选保留。性能采样与正式部署结果另记，不把开发环境通过当作线上验收。无API/schema变更，无假作品或统计。设置、阅读器底部控件、库详情来源浮层保留。

## 2026-09-22 · 治理与词典主体重构

治理改为紧凑顶部作品身份栏、字段导航与主比较区；标题/简介采用上下对照，中文建议收进可展开入口。无修改且未勾选回写时保存栏随正文排列，修改后才固定。词典删除双列大卡片与侧边分类大按钮，改为原文/中文译文/影响/状态对齐清单及顶部类型筛选；桌面来源编辑改为右侧面板，手机全屏，保留来源动画和焦点归还。沿用真实数据与原编辑状态，不修改后端。

验证：Web build 通过；首轮 6 项关联回归通过，最终 5 项草稿、保存栏、来源转移与焦点回归通过。1440、2560、390 实页截图无横向溢出和 pageerror；未保存测试草稿或写回源文件。前阶段 f4ea840 已推送 codex/rhine-frontend；整站尚未完成与部署，下一步首页、发现、登录及二级页面和整体性能动效验收。


## 2026-09-22 · 自主实施阶段留档：库、队列、文件、导出

本阶段准备提交至 codex/rhine-frontend，不合并 main，线上部署仍为 94e5364。文件页以实际体积条、紧凑分类与清单为主体；未选中时不显示禁用批量操作。导出桌面同时显示选择与配置，手机两步流程保留同一表单节点；输出名先于下载，ComicInfo 可展开。FileStorage.css、ExportWorkflow.css 重写，沿用原 API 与删除预览/导出业务。没有新增依赖或假数据。

验证：构建通过；库页 7 项、队列相关 9 项（其中导航两项修正等待条件后复测）、文件导出相关 13 项通过，最终微调后 3 项定向复测通过。1440、2560、390 三尺寸截图无横向溢出与 pageerror。使用 Playwright（Browser plugin not available）。验收未执行真实删除或下载；任务测试数据只有一条已完成记录。后续还需首页、发现、治理、词典、登录与二级页面的重构/审核，以及整站动效、性能与部署验收，不能标记总目标完成。


## 2026-09-22 · 队列组件边界调整（工作树实施中）

`TasksPage` 直接组合固定状态筛选、`TaskList` 和 `TaskInspector`，桌面内联详情，900px 以下使用 `FolioSheet`；删除仅被此页使用的 `TaskBoard.tsx`。`useTasksState` 继续拥有真实任务状态及日志请求，未改后端接口。`TaskLedger.css` 为新布局所有者。库页 `ContinueReadingRow` 增加桌面实际标签资料，手机不展示此区域；`useGridColumns` 修复严格模式重连。


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


## 2026-09-15 · 页面结构重设计（替换前轮结构）

用户明确：保留功能，界面整体重新设计；特别认可阅读器底部悬浮控制和库详情浮层，二者保留。设计规划在 `docs/FRONTEND_REDESIGN.md`。以下内容取代本文件此前阶段的正式 UI 基线，旧记录仅供历史追溯。

- 正式导航恢复完整内容宽度，水平单层导航；通用标题/独立 ModuleScene 页头不再出现在正式页面。Demo 仍保留历史场景。
- 首页使用真实30天阅读活动的环形时间图、日期控制、阅读合计和作品状态；日期选择联动数字与刻度，后台/离屏/减少动态效果暂停待机运动。登录为独立深色访问界面，几何 NH 标识与输入/验证反馈联动，未认证不挂载业务内容。
- 库将阅读状态统计改为可筛选索引，检索置顶、附加筛选收放；全部/继续阅读/最近添加一次显示一个区域。作品使用开放封面与底部注记。原位展开的详情浮层、真实标签链接与拖动阅读契约保留。
- 发现热门改为五个各自包含封面、排名、信息和导入动作的完整条目，手机横向浏览；平台条目取消外包卡框。远端详情改为作品资料与内容索引共同打开的布局；历史日期直接与记录组并排。
- 设置六个模块默认收起，点击直接展开内部配置。退出时保留动画内容，旧内容 inert；草稿继续存在 `useSettingsState`，保存浮条仅在有修改时显示。
- 词典改为全宽词条索引，候选选择/新建打开原生编辑浮层，将映射、证据和应用确认集中到同一对象。任务列表改为全宽记录，真实状态筛选、任务详情与日志浮层。文件主列表全宽，桌面与手机统一详情浮层，实际容量分布替代重复统计卡。
- 导出改为选择作品→配置与下载两步，单选焦点与批量选择计数分别正确；输出名称/选项/预览控制保持挂载。治理默认显示审核文档，作品队列按需打开，来源信息折叠；切换作品立即移除旧草稿并在显示新数据前初始化字段，避免异步覆盖输入。
- 已删除无调用的 TaskFlow、SettingsDirectory、LibrarySummaryStrip、DictionarySummaryStrip，功能状态/hooks/API继续复用，无新增依赖、无 API/schema 变更、无生成图片或虚构记录。
- 当前仍在 `codex/rhine-frontend`，不合并 main。旧版远端留档 `2b4fbef201ff6140e3ed7d0878fb5ddbeb60901d`，前轮本地提交 `b553195`。公开仓库推送曾被自动审批拒绝，仍需用户明确授权具体公开目的地，不能把设计任务中的“继续”当作该授权。


## 2026-09-15 · 连续交互与业务状态联动

本阶段针对此前只改布局与配色的不足，改造六个实际操作过程，不以测试通过代替设计验收，也不宣称全站设计已最终完成。

- 我的库：`WorkInspector` 改为封面与内容并列的聚焦视图；`WorkCard` 传入实际点击位置。封面从原位置展开，信息随后进入，关闭沿原位置返回；中途反向从当前画面接续。删除确认仍是嵌套原生 dialog，关闭后恢复原按钮焦点。
- 共享 `FolioSheet` 继续负责模态生命周期；新增可选 origin/anchor 动画，用同一份已缓存封面连接两种状态。普通词典/文件侧板也修正为从实际位移继续关闭。没有引入另一套 modal 或全局逐帧 React 状态。
- 设置：`SettingsDirectory` 替换旧目录与独立页头场景。六个可选控制模块保留邻项响应，显示实际连接、翻译、阅读和导出配置；摘要跟随未保存草稿。表单、保存与密码语义保持原有接口。
- 队列：`TaskFlow` 替换独立装饰页头，按等待、进行中、需处理、已结束展示实际任务；编号保持 shared layout 身份，进度条跟随真实百分比。分组筛选覆盖组内全部状态，运行提示仅在真实任务运行时动效启动。
- 导出：`ExportPackage` 将 ComicInfo/JSON/压缩控件改为直接操作包内组成的数据层，选项变化重排层的位置；保留真实预览、阻塞条件和下载语义，不把组合示意当成最终打包成功。
- 词典：原文与中文名直接形成可编辑映射，机翻动作位于二者之间，保留预览再写入。治理：当前值、来源值与最终草稿并列，采用来源和待保存状态直接反馈在对应字段。
- 验证：Web 构建与 diff 检查通过；continuous-interactions/workspace-rebuild/shelf-navigation 共 15 项通过；六个改造页面在 1440×1000、2560×1440、390×844 共 18 个状态检查无横向溢出或页面错误。录制实际操作用于查看动效，未使用生成图。Docker 已重新部署为 healthy，入口 `http://38.58.176.50:4349/`。
- 本阶段无 API/schema 变更、无新依赖、无生成图片、无虚构任务/作品/统计。浏览器插件未提供，使用项目 Playwright 与隔离真实数据；截图隐藏封面，不修改正式数据。
- 旧版 `2b4fbef201ff6140e3ed7d0878fb5ddbeb60901d` 与上一阶段 `db5ffb6` 均保留。继续使用 `codex/rhine-frontend`，不合并 main；公开仓库推送仍受此前自动审批拒绝约束，尚未获得明确公开发布授权。


## 2026-09-14 · 全功能工作区重构（接续 b4d709a）

- 上一阶段 `b4d709a` 主要完成首页、登录和共享外壳；本阶段重新组织正式业务页的内容、操作位置和选择动效。
- 我的库：固定筛选栏、可切换的继续阅读/最近添加书架、原生详情侧板。发现：五封面联动选择与作品信息，竖封面贴边，大屏使用完整展示宽度。
- 设置：目录与编辑区分离，快速换章保留未保存值。治理：顶部问题队列、元数据/标签/复核分区及手机精简操作栏。词典：候选、编辑、证据并列，候选窄栏改为两行完整信息。
- 队列：可筛选状态汇总、任务卡、进度和日志。文件：清单/维护分区，桌面详情与手机原生侧板。导出：真实打包内容预览，选项变化不重建名称输入框。
- 作品详情：独立封面与内容分区；历史：日期索引；阅读器：顶部身份栏和底部操作栏。保留真实 API、删除预览/确认、阅读与任务状态机，未引入新依赖或修改 API/schema。
- 共用 `SectionSwitch`（弹簧指示器）、`SelectionStage`（可打断局部过渡）、`FolioSheet`（原生 dialog、嵌套取消与焦点恢复）。取消轮询/选项变化触发的整块重挂载及大面积模糊；原页头场景、导航和登录动画继续保留。
- 验证：25 项登录/书架/首页/工作区 E2E 通过；最后的词典布局修正后 6 项工作区回归再次通过。九个主页面在 1440×1000、2560×1440、390×844 下检查无横向溢出或页面错误。详情/阅读器另有三种尺寸下的内容切换、底部控件和页面索引检查通过，无运行时错误。任务进度和日志使用隔离库实际扫描任务验证，无虚构数据、正式库删除或设置写入。
- Web 构建和 diff 检查通过，Docker 镜像 `1390ba868a02` 已重新部署为 healthy；对外入口 `http://38.58.176.50:4349/`。
- 留档 `2b4fbef201ff6140e3ed7d0878fb5ddbeb60901d` 已核实存在远程 `codex/login-and-shelf-fixes`。当前分支 `codex/rhine-frontend`，不合并 main。新版公开推送仍等待针对 `Dormiveglia0/nhentai-archive` 的明确授权（此前自动审批拦截）。
- 后续维护按正式页面结构检查，不恢复整块退出等待/轮询重挂载；业务交互回归见 `apps/web/e2e/workspace-rebuild.spec.ts`。服务器 Chromium 检查不能等同于用户设备帧率保证。


## 2026-09-14 · 前阶段：首页、登录与共享外壳

- 留档：`2b4fbef` 已推送至 `codex/login-and-shelf-fixes`；重构在 `codex/rhine-frontend`，不合并 main。
- 用户已解除原风格限制。新基线为灰白、石墨与琥珀，固定侧栏/顶栏、紧凑标题及统一无衬线字体。主题页头动画保留，整页背景循环移除。
- 默认首页为 `ReadingHome.tsx` / `.css`，真实30天阅读时长切片与日期滑块、每日读数联动；默认最近活跃日，待机轻微起伏，可暂停且尊重减少动态效果。原查询参数预览保留。
- 登录独立构图，输入聚焦/验证/完成都有对应状态；扫描线从实测输入框位置到64px顶栏，完成事件触发应用显示。固定计时器曾在掉帧时提前进入，已移除。
- 所有正式业务页面使用新的共享配色/字体；修复侧栏引入后的热门背景宽度、设置底部操作栏边界；竖向封面隐藏无用模糊层，去掉图片全局阴影。
- 参考：https://github.com/LBEILC/RhineLabUI （DESIGN.md、motion.ts、ui-transitions.ts、document-decryption.ts 与仓库实录）。在线演示暂停，本地源码可运行，但服务器软件GPU截图超时；视觉参考使用仓库实录，未声称完成上游实机性能评估。
- 无新增依赖，无API/schema改动，无生成图片素材。正式验证使用Playwright（Browser插件不可用）、构建及1440/2560/390截图。
- 验证结果：Web构建与diff检查通过；auth-gate、auth-wake-demo、shelf-navigation、reading-home共19项通过。九个主页面在1440×1000、2560×1440、390×844的布局/顶栏/操作栏检查通过。Docker构建成功并已重新部署为健康状态；不将服务器浏览器检查等同于用户设备帧率保证。


## Current Slice

Implemented loop:

`discover remote gallery -> dictionary display/mapping -> detail modal -> remote reader or create import job -> download CBZ -> index local archive/work_tags -> local reader -> save progress -> governance metadata/tag review -> export preview/rename/download CBZ (single or .zip bundle) to the user`

This stage also implements real NH API Key settings and rewrites the discover page into a unified Folio feed. No fake works, fake jobs, fake file counts, or adult sample assets are seeded.

Read order for future AI work:

1. `docs/AGENT_MAP.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_MAP.md`
4. `docs/DEVELOPMENT_RULES.md`
5. The relevant formal component and feature-local CSS from the agent map.

## Development Entry

- Root `npm run dev` delegates to `scripts/dev.py`.
- The stdlib launcher starts the API app on port 8001 and Web app on port 5173, preserves `PYTHONPATH`/`VITE_API_PROXY_TARGET`, and terminates both process groups when either side exits or the user presses `Ctrl+C`. `NH_ARCHIVE_API_PORT` and `NH_ARCHIVE_WEB_PORT` provide temporary QA ports.
- `npm run dev -- --check` validates the local API executable, npm, and Web dependencies without starting servers.
- Runtime state lives at repository-root `.local-data/`, outside both deployable apps. Managed source/cover paths are stored portably as `library/...` and `covers/...`; each runtime resolves them against its active data root. Startup migrates legacy absolute values to that portable form, so the same SQLite can cross the Compose `/data` and host `.local-data` boundary without path flipping.
- `Dockerfile` builds the Web app in a Node stage, then ships only FastAPI and the compiled assets. `compose.yaml` declares `build: .` so `docker compose up -d --build` includes the current checkout, and binds host `./.local-data` to `/data`; its entrypoint runs as that directory's owner while retaining only startup UID/GID-switch capabilities. `/api/health` provides container health.

## API App Map

Root: `apps/api/app/`

- `config.py`
  - `Settings`: resolves local data paths, `NHENTAI_API_KEY`, base URL, user agent, timeout.
  - Environment API key has priority over DB-stored API key.
- `database.py`
  - Tables: `works`, `work_files`, `work_pages`, `remote_galleries`, `remote_tags`, `local_tag_dictionary`, `tag_aliases`, `work_tags`, `work_metadata`, `governance_reviews`, `reader_progress`, `reading_history`, `reading_sessions`, `remote_reading_sessions`, `jobs`, `settings`. `works.favorite` is the local favorite flag; the two reading-session tables store idempotent local/remote visits with cumulative foreground seconds and feed the shared `reading_session_events` view. `governance_reviews` is an append-only human-review ledger with snapshot hashes; export remains a stream-to-browser download and keeps no records. (The legacy `export_records` table is no longer created or used — existing databases may still carry an unused copy.)
  - Legacy migrations include dictionary/work tag shape upgrades.
  - Connections enforce foreign keys, a 5-second busy timeout and NORMAL synchronous mode; schema initialization enables WAL. Query indexes are created only after legacy migrations and cover work files/tags, dictionary references, reading history, task status/order and task logs.
  - Startup path migration recognizes legacy repository `.local-data/...` and Compose `/data/...` values, persists only `library/...` / `covers/...`, and resolves returned path fields against the current runtime root.
- `container.py`
  - Composition root for settings, SQLite, the remote client, and service instances. API modules share this single mutable registry; tests replace registry members instead of patching route modules.
- `api/`
  - Domain routers for auth, discover, dictionary, library, governance, exports, files, works/reader state, jobs, settings, and system/workbench endpoints.
  - `auth.py` owns first-run setup, login, password change, logout and status. `schemas.py` owns HTTP request models; `shared.py` owns remote API error translation and the router-wide authentication dependency. Business logic remains in `services/`.
- `services/auth_service.py`
  - Single-password access without accounts or users. Any non-empty password is accepted without character-combination rules, then stored as a salted stdlib `scrypt` verifier; only SHA-256-derived session keys are persisted in the existing `settings` table.
  - Sessions last 90 days and survive process/container restarts. Password change verifies the current password, revokes every old session, and issues one replacement session to the current browser. Five failed login/change attempts within five minutes temporarily rate-limit that client.
- `services/nhentai_client.py`
  - Remote API wrapper: `latest`, `popular`, `random`, `search`, `tagged`, `gallery`, `tag_search`, `tags_by_ids`, `download_url`, `download_file`, `user`.
  - `media_url()` resolves CDN paths through `/api/v2/cdn`, normalizes duplicate upstream image suffixes such as `.webp.webp`, and leaves the frontend free of URL guessing.
  - `normalize_remote_error()` standardizes 401/404/422/429.
  - Network failures, invalid JSON/Unicode responses and non-object error payloads are normalized to `NhentaiApiError`; nested thumbnail payloads keep a scalar `thumbnail.path`.
  - API quota protection:
    - caches cacheable remote GET/selected tag-search calls by request key;
    - uses longer TTLs for CDN/tag/detail/popular responses and short TTLs for feed/search pages;
    - enters a local cooldown window after 429 and does not keep forwarding remote requests during cooldown;
    - may serve stale cached data during a 429 cooldown when available.
- `services/discover_service.py`
  - `latest/popular/random/feed/tagged/search/gallery/tag_autocomplete/cached_tags`.
  - `feed()` is the unified discovery entry:
    - no filters: current page only through `/api/v2/galleries`;
    - language/type/query: real `/api/v2/search` query;
    - empty query: current latest feed, never the old `pages:>0` search fallback;
    - single remote tag: `/api/v2/galleries/tagged`.
  - Adds local `imported/work_id` state to remote gallery summaries.
  - Feed and related-card import state is resolved in one batched `works` query per result set, not one query per card.
  - `build_search_query()` appends confirmed remote filters such as `language:japanese`, `category:doujinshi`, and `category:manga`; selected remote tags retain their real quoted namespace (`artist:"..."`, `tag:"..."`, `parody:"..."`, etc.) and excluded terms retain the signed form (`-tag:"..."`).
  - Enriches cards with real `remote_tags` via `/api/v2/tags/ids` and caches those tags.
  - `cached_tags()` exposes real cached tags for the discover selector; it does not fabricate defaults.
  - Joins `local_tag_dictionary` by `remote_tag_id` to emit dictionary `display` names for discover tags when mappings exist.
- `services/dictionary_service.py`
  - `summary()`: counts unconfigured/configured/ignored/review/suggested terms from real tables.
  - `autocomplete(q, limit)`: local dictionary, aliases, cached `remote_tags`, then real remote tag search only when no local/cache hit exists.
  - `candidates(q, status, limit, offset, tag_type)`: real remote tag candidate pool with impact count and configured/ignored state; searches original text, slug, Chinese name, and aliases; also exposes local-only dictionary rows so bad imports can be selected and removed. Direct remote-id, normalized-name and normalized-slug dictionary matches use separate indexed joins, avoiding the former `OR` join's N×M fallback scan.
  - `evidence(remote_tag_id, dictionary_id)`: real related works, co-tags, remote tag info, and local status history.
  - `preview_apply(payload)`: calculates conflicts, affected real works, samples, and tag update counts without writes.
  - `apply(payload)`: writes/updates `local_tag_dictionary`, `tag_aliases`, remote mapping, and related `work_tags`; if `remote_tag_id` is omitted it resolves a cached remote tag by normalized original text and type.
  - `ignore(id)` / `mark_review(id)` / `delete(id)`: real status transitions and deletion; delete removes aliases and unlinks `work_tags.dictionary_id` without deleting remote tags or works.
  - `preview_bulk_import(rows)` / `bulk_import(rows)`: parse user rows, report valid/duplicate/conflict/invalid rows, write only valid rows. Minimum row shape is `原文, 中文名`; type and aliases are optional.
  - `link_work_tags(work_id, tags)`: links imported works to real gallery tags and existing dictionary mappings.
  - `translate_text(text)`: single on-demand machine translation via the injected `TranslationService`.
  - `generate_suggestions(limit)`: machine-translates the top unconfigured remote tags and upserts reviewable `status='suggested'` rows (source `machine`); never overwrites a human-configured/locked entry and never links `work_tags` before confirmation.
- `services/translation_service.py`
  - Provider-adapter machine translation over the local `settings` table; uses stdlib `urllib` (no new deps). Two providers: `google_free` (unofficial endpoint, no key) and `deepl` (REST, auth key in `mt.deepl_api_key`). Config under `mt.*` keys.
  - `translate()` / `translate_one()`: EN→ZH (provider-selected); `verify()` runs a sample translate and records `mt.last_verify`; `public_config()` reports provider/plan/configured state and never echoes the DeepL key. Module-level `_http_get_json` / `_http_post_form` are the monkeypatch seams for tests.
- `services/settings_service.py`
  - `get()`: safe settings summary; never returns API key text; includes a `machine_translation` block from `TranslationService.public_config()`.
  - `patch()`: saves DB key, UI preferences, storage export directory, persisted export preset state, and machine-translation config (`mt.provider` / `mt.deepl_api_key` / `mt.deepl_plan`, plus clear); immediately updates runtime `NhentaiClient.api_key` and clears runtime remote cache when the effective key changes.
  - `verify_nhentai()`: verifies current effective key through an authenticated remote request.
- `services/import_service.py`
  - `enqueue_remote_import()`, `run_remote_import()`, `retry_job()`.
  - Enqueue is idempotent: an active job for the same gallery is reused, and a gallery already in the library returns an immediately completed job instead of leaving an orphaned queued record.
  - Caches imported gallery and real gallery tags before downloading/indexing CBZ.
  - Calls `DictionaryService.link_work_tags()` after ingest so imported works gain real `work_tags`.
  - Partial download files are removed on success, cancellation and failure; a process crash remains visible as a stale managed tmp file for file maintenance. CBZ transfer reports real downloaded/total bytes into the job row and maps that transfer across the 15–90% progress segment before indexing.
- `services/archive_service.py`
  - `ingest_cbz()`, `list_works()`, `get_work()`, `list_pages()`, `read_page()`.
  - Archive copies, covers and generated thumbnails use unique same-directory temporary files plus atomic replace. Re-ingest invalidates page thumbnails/stale covers, and page member sizes are indexed from one ZIP directory read rather than reopening the archive for every page. A failed first ingest removes its placeholder work so import idempotency cannot mistake a fileless row for success.
- `services/reader_service.py`
  - `get_state()`, `update_state()` persist page progress without incrementing visit counts.
  - `start_session()` creates one idempotent local-reader visit and one `reading_history` open; `update_session()` accepts only monotonic cumulative visible-time totals, the latest bounded page, and an optional finished marker.
  - `start_remote_session()` snapshots one cached gallery into an idempotent remote visit; `update_remote_session()` applies the same monotonic visible-time and bounded-page rules without creating local progress or history.
- `services/library_service.py`
  - Local-only library reads; queries only `works`, `reader_progress`, `work_files`, `work_tags`, `local_tag_dictionary`. Never calls NH API.
  - `work(work_id)`: one full local work record through the same `WORK_COLUMNS`/`WORK_JOINS` and `_attach_tags()` path as library search. The reader therefore receives real author/group/parody/character/content/category/language tags without a remote lookup.
  - `summary()`: real total/favorite/reading/completed/unread/untagged counts, total pages, total source-CBZ bytes, source breakdown, and language facets (from `work_tags` type `language`, dictionary `display` when mapped); generic `translated`/`translate*` markers are excluded because they are not languages.
  - `search(q, page, per_page, sort, read_status, source, language, tag_ids, favorite_only)`: SQL-backed pagination. Keyword matches title/japanese/pretty/gallery-id and joined tag names/zh. `tag_ids` is AND semantics (work must carry every selected remote tag). Sort keys are whitelisted in `SORT_ORDERS`; favorite-only is a real `works.favorite` predicate.
  - `set_favorite(work_id, favorite)`: updates only the local flag and returns the same full local work shape used by the library and reader.
  - `statistics(days, timezone_offset_minutes, limit)`: real local + remote reading overview, filled daily activity and most-read works by time/visits; author/tag affinity and collection shares remain local-library-only. It reads session starts in the browser's local-day boundary, attributes a session to its start day, resolves pre-import remote sessions to the later local work, and never fabricates historical time before tracking existed.
  - `recent_added(limit)`, `recent_read(limit)`, `continue_reading(limit)`: real shelves from `works`/`reader_progress`; empty when no real rows.
  - `tag_filters(q, limit)`: distinct used remote tags joined to dictionary `zh_name`, ranked by work count; excludes `language` type (language has its own facet).
  - Internals: `WORK_COLUMNS`/`WORK_JOINS` shared select (adds progress, source-CBZ size, tag_count), `_build_filters()`, `_top()`, `_attach_tags()` (one batched tag query per result page, sorted by `CARD_TAG_TYPES` priority).
- `services/metadata_refresh_service.py`
  - Read-only preview then explicit apply for up to 50 selected local works. Matching priority is existing remote gallery ID, ComicInfo `Web`, manually supplied gallery ID, then normalized fuzzy title search.
  - Fuzzy auto-apply requires at least 92% title confidence, a 7-point lead over the next candidate, and matching page count unless title confidence is at least 97%. Ambiguous rows stay review-only until a gallery ID is supplied and previewed again.
  - Apply fetches fresh remote detail and independently reruns fuzzy candidate ranking on the server; it never trusts confidence/margin values from the browser. It updates remote titles/media identity, replaces stale remote tags, preserves local source ownership and every manual `work_metadata` decision, and isolates failures per work.
- `services/governance_service.py`
  - Local-only governance reads/writes; never calls the NH API.
  - `queue()`: real queue items, explicit human-review state and automatic reason counts from `works`, `work_files`, `work_tags`, `local_tag_dictionary`, source CBZ ComicInfo presence, and cover file existence. `summary.total` is the unreviewed/stale backlog, not the automatic-issue count.
  - `work_governance(work_id)`: aggregate with work header, files, metadata field diffs, tag groups, dictionary summary, automatic check groups, recommended actions, and current review state/history.
  - Reads source metadata from real stored CBZ members (`ComicInfo.xml` and the first JSON metadata file when present) plus cached `remote_galleries.payload_json`.
  - `apply(work_id, payload)`: persists final metadata decisions into `work_metadata`; optional dictionary apply delegates to `DictionaryService.apply()`. It does not mutate source CBZ files.
  - `review(work_id, action, note)`: appends approve/reopen events. Approval hashes the current work/metadata/tag/dictionary/file snapshot; any later change makes that approval stale. Open automatic issues require an explanatory note.
  - `translate_metadata(work_id, fields)`: read-only suggestions for title/subtitle/summary; never writes or auto-adopts output.
  - `bulk_preview()` / `bulk_apply()`: selected-work batch actions for fill-missing metadata, opt-in ComicInfo write-back, source Web backfill, and confirming existing dictionary `review/conflict` terms when they are unlocked, not ignored, and already have a Chinese name.
- `services/export_service.py`
  - Local-only export preview/packaging for **browser download**; never calls the NH API, never mutates source CBZ files, and never writes a second copy to the server. No export records are kept.
  - `queue()` / `summary()`: one aggregate SQLite query resolves real source state, metadata/tag presence and dictionary warnings; CBZ metadata is opened only for still-missing fields. `summary()` returns only the queue counts (`total`/`ready`/`blocked`/`warnings`) and shares the exact same state derivation as the full queue.
  - `preview(work_id, options)`: uses `GovernanceService.work_governance()` so final metadata values come from `work_metadata` when present, then current/source values. Returns source file state, output name, ComicInfo fields, resolved export options, members to keep/write, blockers, and warnings. `options.output_name` is sanitized and forced to `.cbz`; `write_comicinfo` / `keep_json` / `compress` control the preview. No server output path is involved.
  - `build_cbz(work_id, options)`: packages a single work into CBZ **bytes** in memory, honoring `write_comicinfo`, `keep_json`, and `compress`, and returns `(filename, bytes)`; raises `ValueError` when the work has blockers. The original archive is never touched.
  - `build_bundle(items, options)`: packages multiple works into one `.zip` of CBZs (bytes) for a single download, applying shared export options, deduping member names, skipping blocked items, and raising when none can be exported.
- `services/export_job_service.py`
  - Long-running bulk export owner for `bulk_export` jobs. Selections over `EXPORT_SYNC_THRESHOLD` are packaged in a daemon worker, using `JobService` progress/log/control and `ExportService.build_cbz()`.
  - Artifacts are temporary `.zip` files under the export-jobs directory, deleted after download and swept after 24h; download/deletion accepts only the exact job-owned path, and source CBZ files remain immutable.
- `services/file_service.py`
  - Local-only file inventory + deletion over the managed data dir; never calls the NH API.
  - `overview()`: real metrics — work count, source bytes, cover ok/missing, missing source, orphan/stale counts + bytes, reclaimable bytes.
  - `inventory(category, q, status, page, per_page)`: unified file entries — `work` (source CBZ + cover aggregated, status ok/missing_source/missing_cover, size_mismatch flag), `orphan` (loose files in library/covers with no DB reference), `stale` (tmp/exports leftovers). Source rows are preloaded once and visible-work tags are fetched in one batch. Work entries expose structured `tag_items`; portable DB paths arrive already resolved against the active data root, and `_abs()` normalizes them before filesystem checks.
  - `preview_delete(targets)`: read-only; expands `work` targets to all cascaded DB rows (work_tags count, has_progress, has_governance) + source/cover files; reports files_to_delete/works_to_remove/reclaim_bytes + warnings (has_progress/has_governance/already_gone/forbidden_path).
  - `delete(targets)`: deletion is the only disk-touching op. `work` target deletes the works row (SQLite `ON DELETE CASCADE` clears work_files/work_pages/work_tags/work_metadata/governance_reviews/reader_progress/reading_history/reading_sessions) + unlinks source CBZ + cover; `orphan`/`stale` unlink the single file. Paths outside managed roots rejected (`_within_managed`). CBZ bytes never modified.
- `services/job_service.py`
  - `create/list/get/mark_running/update_progress/complete/fail/retry/pause/resume/cancel/logs/checkpoint`.
  - `list()` batch-loads work/gallery presentation metadata and tolerates corrupt/non-object `target_json`; startup recovery closes process-owned queued/running/cancelling states while leaving paused jobs resumable.
  - Job payloads include `created_at` / `updated_at`; statuses include `queued/running/paused/completed/failed/cancelled`.
  - Writes durable `job_logs` for creation, stage changes, completion, failures, pause/resume/cancel, and retry.
- `services/import_service.py`
  - Remote import jobs call `JobService.checkpoint()` between safe stages so pause/cancel is real and cooperative. Cancelling after a temporary CBZ download removes the tmp file before returning.
- `services/library_scan_service.py` / `services/library_scan_job_service.py`
  - Local library scan preview and background ingestion for already-present CBZ files under the managed library directory, routed through the task center as `library_scan` jobs.
- `services/workbench_service.py`
  - Read-only aggregator composing library/governance/jobs/files/exports summaries; never calls the NH API; one method `overview()` returning `{library, governance, files, exports, jobs, continue_reading, recent_added}` from real existing module services.
- `main.py`
  - Small FastAPI application factory: lifespan (interrupted-job recovery and export-artifact sweep), CORS, static Web mounting, and authentication enforcement for `/api` except health/auth bootstrap endpoints.

## API Status

Implemented:

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/change`
- `POST /api/auth/logout`
- `GET /api/discover/latest`
- `GET /api/discover/feed?page=&per_page=&q=&sort=&language=&type=&tag_id=&tag_names=&unimported_only=`
- `GET /api/discover/tagged?tag_id=&page=&per_page=&sort=&unimported_only=`
- `GET /api/discover/popular`
- `GET /api/discover/random`
- `GET /api/discover/search?q=&page=&per_page=&sort=&language=&type=&unimported_only=`
- `GET /api/discover/galleries/{gallery_id}`
  - Detail payload includes `pages[]` with resolved `url` values when the remote API returns page paths. These URLs are consumed only by the remote reader route, not by the detail modal.
- `POST /api/discover/galleries/{gallery_id}/import`
- `POST /api/discover/galleries/{gallery_id}/reading-sessions`
- `PATCH /api/discover/galleries/{gallery_id}/reading-sessions/{session_id}`
- `GET /api/discover/tags/autocomplete`
- `GET /api/discover/tags/cached`
- `GET /api/dictionary/summary`
- `GET /api/dictionary/candidates?q=&type=&status=&limit=&offset=`
- `GET /api/dictionary/evidence?remote_tag_id=&dictionary_id=`
- `GET /api/dictionary/autocomplete?q=&limit=`
- `POST /api/dictionary/preview-apply`
- `POST /api/dictionary/apply`
- `POST /api/dictionary/preview-bulk-import`
- `POST /api/dictionary/bulk-import`
- `POST /api/dictionary/translate` (single on-demand machine translation of one term)
- `POST /api/dictionary/suggest-batch` (machine-translate top unconfigured remote tags into reviewable `status='suggested'` rows; does not link `work_tags`)
- `POST /api/dictionary/{id}/ignore`
- `POST /api/dictionary/{id}/review`
- `DELETE /api/dictionary/{id}`
- `GET /api/library/summary`
- `GET /api/library/search?q=&page=&per_page=&sort=&read_status=&source=&language=&tag_ids=&favorite_only=`
  - `tag_ids` is a comma-separated remote tag id list; non-numeric tokens are ignored. AND semantics.
- `GET /api/library/recent-added?limit=`
- `GET /api/library/recent-read?limit=`
- `GET /api/library/continue-reading?limit=`
- `GET /api/library/reading-history?page=&per_page=`
- `GET /api/library/statistics?days=&timezone_offset_minutes=`
- `GET /api/library/tag-filters?q=&limit=`
- `POST /api/library/scan/preview`
- `POST /api/library/scan`
- `GET /api/governance/queue`
- `GET /api/works/{work_id}/governance`
- `POST /api/works/{work_id}/governance/apply`
- `POST /api/works/{work_id}/governance/translate`
- `POST /api/governance/bulk/preview`
- `POST /api/governance/bulk/apply`
- `POST /api/governance/metadata-refresh/preview`
- `POST /api/governance/metadata-refresh/apply`
- `GET /api/exports/queue`
- `GET /api/exports/summary`
- `GET /api/works/{work_id}/export-preview`
- `POST /api/works/{work_id}/export-preview`
- `GET /api/works/{work_id}/export/download` (streams a single CBZ as a download)
- `POST /api/exports/download` (streams a `.zip` bundle of selected CBZs as a download)
- `POST /api/exports/bulk-jobs` (creates a temporary-artifact `bulk_export` job)
- `GET /api/jobs/{job_id}/export/download` (downloads a completed bulk-export artifact once, then deletes it)
- `GET /api/files/overview`
- `GET /api/files/inventory?category=&q=&status=&sort=&page=&per_page=`
- `POST /api/files/preview-delete`
- `POST /api/files/delete`
- `GET /api/works`
- `GET /api/works/{work_id}` (full local library work, progress, file facts, and structured real tags)
- `GET /api/works/{work_id}/cover`
- `GET /api/works/{work_id}/pages`
- `GET /api/works/{work_id}/pages/{page_index}`
- `GET /api/works/{work_id}/reader-state`
- `PATCH /api/works/{work_id}/reader-state`
- `PATCH /api/works/{work_id}/favorite`
- `POST /api/works/{work_id}/reading-sessions`
- `PATCH /api/works/{work_id}/reading-sessions/{session_id}`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `GET /api/jobs/{job_id}/logs`
- `POST /api/jobs/{job_id}/pause`
- `POST /api/jobs/{job_id}/resume`
- `POST /api/jobs/{job_id}/cancel`
- `POST /api/jobs/{job_id}/retry`
- `POST /api/jobs/clear`
- `DELETE /api/jobs/{job_id}`
- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/nhentai/verify`
- `POST /api/settings/translation/verify`
- `GET /api/workbench/overview`

## Web App Map

Root: `apps/web/src/`

- `docs/AGENT_MAP.md`
  - Fast locator for the active demo visual contract, nine module bodies/scenes, ordered CSS layers, formal page owners, and real API entry points. Read this before loading frontend files.
- `components/folio/`
  - Production-neutral full-screen visual system: page configuration, shell, navigation, animated module scenes/backdrops, shared controls, and ordered CSS layers.
  - Dependency direction is `demo -> folio` and `formal feature -> folio`; this directory must never import `components/demo/`.
- `components/demo/`
  - Public `/demo` content only: preview navigation/state, nine demo page bodies, and the demo command bar. Formal routes must not import this directory.

- `App.tsx`
  - `AuthGate` resolves access before hash route composition or route-level `React.lazy` boundaries mount. `ArchiveShell` stays in the initial shell while every primary/secondary page, both readers, and `/demo` load as independent chunks.
  - All primary and secondary routes are real pages: discover/gallery/library/history/readers/governance/dictionary/export/files/tasks/settings/workbench. No route remains a boundary screen.
  - Local and remote readers render directly as immersive viewports; all other routes render through `ArchiveShell`.
- `components/auth/AuthGate.tsx` → `AuthWakeDemo.tsx` / `AuthWakeDemo.css`
  - Shared production/preview login uses an independent paper surface: no page silhouettes or content before entry. Focus lines, password underline, button fill and error movement remain. On success the form fades first, a transform-only scan travels from the measured field edge to the responsive topbar (78/68/64px), then the actual app mounts and fades in. Native labels, single-line pending text, setup confirmation/back, offline retry and lazy-route focus restoration remain. The gate uses overflow:clip and never leaves a transform on the app wrapper, so scrolling cannot displace the fixed shell. The unused `AuthGate.css` remains deleted.
  - First visit creates any non-empty access password without character-combination rules; later visits accept that password and retain a 90-day HttpOnly/SameSite session. App content only mounts after successful authentication, and any protected-request 401 returns the surface to login.
  - The top-right lock action revokes the current session. No username, account list, localStorage token, password recovery flow, or auth dependency is introduced.
- `lib/useGridColumns.ts`
  - A `ResizeObserver` counts the actual computed CSS grid tracks instead of guessing card width from `window.innerWidth`. Page sizes are derived only after measurement and remain divisible by the active column count.
- `lib/navigation.ts`
  - Hash route parser, `navigate()`, `tagSearchHref()` for remote discovery, plus `libraryTagHref()` / `librarySearchHref()` for local-library drill-down anchors.
  - Routes include local `#reader/{work_id}`, remote `#reader/remote/{gallery_id}`, `#governance`, and `#governance/{work_id}`.
  - Formal tag surfaces keep native anchor semantics: discovery/remote-reader contexts use `tagSearchHref()`, while library/statistics contexts use `libraryTagHref()` so middle/modifier click preserves the owning data scope in a new tab.
- `lib/motion/`
  - `MotionProvider` uses `domMax` for the shared navigation layout spring and respects user reduced-motion settings. Lists stagger at up to 50ms per item with a 320ms total delay budget; pages retain shorter horizontal entrance/exit and header scenes pause offscreen. Binding progress uses transform instead of top/height animations. Do not remove visible animations as a performance shortcut.
  - 阶段 0 动画原语层。`tokens.ts`(时长/缓动/stagger 常量,全站统一节奏)、`primitives.tsx`(`FadeIn`/`Stagger`/`StaggerItem`/`Reveal`/`Presence`,基于 `motion/react`)、`useReducedMotion.ts`（通过 useSyncExternalStore 订阅媒体查询，系统设置改变时同步已挂载组件）、`index.ts` 出口。`FadeIn` 透传合法 div/ARIA 属性，因此消息的 `role`、`aria-label` 等语义不会被动画包装层吞掉。后续页面动画一律从此取用,优先复用共享 token。
- `components/effects/NumberTicker.tsx`
  - Restores the original spring count-up when entering the viewport and settles on the actual formatted value. Under reduced motion, jump both spring and source to the actual value so switching the preference back cannot reset the display to zero.
- `components/effects/`
  - 从 magicui/react-bits 引入并改造后的效果组件落地处。`README.md` 为硬性接入规范(库只作效果来源、token 改造、`.fx-scope` 隔离、reduced-motion 降级)。当前含 `StaggerDemo`、`ShineBorder` 两个验证示例。
- `styles/tailwind-entry.css`
  - Tailwind v4 入口(方案 A:省略 Preflight、不加前缀、按层导入),`@theme` 将 `app.css` 设计 token 映射为 `--color-*`。在 `main.tsx` 中先于 `app.css` 引入。
- `lib/api.ts`
  - Typed API wrapper for implemented backend endpoints.
  - Discover GET calls use a short in-browser cache and in-flight request reuse to avoid duplicate feed/popular/detail/tag requests within one UI session. Import/library-scan completion, file deletion and dictionary/governance mutations invalidate cached local import/display state so remote cards cannot remain stale after local writes.
  - Dictionary API types and helpers live here: candidates, autocomplete, preview/apply, preview/import bulk rows.
  - Library API types/helpers: `LibrarySummary`, `LibraryWork`, `LibraryTagFilter`, `LibrarySearchParams`, and `library*` request methods (summary/search/recent-added/recent-read/continue-reading/tag-filters). Library calls are not run through the discover session cache.
  - Governance API types/helpers: queue, aggregate, explicit review approve/reopen, metadata translation suggestions, bulk preview/apply (fill missing metadata, write-back, confirm dictionary terms), remote metadata refresh preview/apply, and apply payload/result. Remote refresh invalidates discover cache only after a successful write.
  - Export API types/helpers: queue, preview, `downloadExport` / `downloadExportBundle` (blob fetch + browser save), `enqueueBulkExport` for task-center bulk artifacts, and persisted preset settings. Export calls are local-only and not run through the discover session cache.
  - Job API type/helpers: `Job` (including `created_at` / `updated_at`, `paused/cancelled/cancelling` statuses and bulk-export target fields), `JobLog`, `jobs()`, `jobLogs()`, `pauseJob()`, `resumeJob()`, `cancelJob()`, `retryJob()`, delete/clear, and bulk-export download URL.
  - Reader-session helpers cover both local works and cached remote galleries; both send monotonic visible foreground time, while only local sessions have reader progress/history APIs.
- `vite.config.ts`
  - Dev proxy defaults `/api` to `http://127.0.0.1:8001`.
  - Set `VITE_API_PROXY_TARGET=http://127.0.0.1:<port>` when verifying against a temporary backend port.
- `components/layout/ArchiveShell.tsx`
  - Folio-only shell for every non-reader route. History reuses the library module context with its own heading; gallery detail reuses discover context while suppressing the repeated page heading. `scrollKey` selects each route/detail scroll position. FolioChrome animates only the visible scroll viewport with native Web Animations; rapid navigation cancels the previous animation and reduced motion skips it. The initial authenticated mount uses only the login reveal. Background paper glow is bounded to 760×560px rather than a full-screen animated texture; decorative background animations pause during scroll and resume 150ms after it stops. Background changes fade in without simultaneously scaling two full-screen layers. `TaskDock` remains outside the chrome.
- `components/layout/RouteFallback.tsx`
  - Honest, data-free loading surfaces for lazy formal routes and the immersive reader. `RouteFallback.css` owns the paper-sheet loop and reduced-motion fallback; it must not duplicate page titles, metrics, or fake content.
- `components/layout/TaskDock.tsx`
  - Polls real `/api/jobs` only while the document is visible and schedules the next poll only after the previous request settles. The initial poll also uses a clearable zero-delay timer so React StrictMode can dispose its exploratory mount without issuing a duplicate request. It renders running/queued/paused/cancelling jobs, retryable failures, or a polling error so resumable/in-flight work cannot disappear from the global surface; `apps/web/e2e/taskdock.spec.ts` protects non-overlap plus hidden/visible behavior against a deliberately slow real response.
  - `TaskDock.css` owns its compact Folio live ledger, custom ARIA progress, responsive position above fixed action bars, and reduced-motion behavior. Retriable failures reuse the same `canRetry` boundary as the task center and expose guarded busy/error state.
- `components/folio/ui/FolioPrimitives.tsx`
  - Shared Folio search, field, toggle, empty-state and custom-select controls. The select popup is a native button group with `aria-pressed` state rather than an incomplete listbox implementation; Escape and selection both restore focus to the trigger.
- `components/folio/ui/FolioMetricGrid.tsx`
  - Shared real-data summary/status entries for formal routes. It owns icon/value/detail composition, semantic status tones, staggered entry and responsive layout; entries use separated light-paper panels without hover or shadow, while joined cells stay reserved for genuine record tables. The six-item library summary becomes a compact 3×2 grid at 560px and below.
- `styles/app.css`
  - Base-only root tokens/reset/form inheritance/shared spin/reduced-motion layer. The former legacy topbar, navigation, page, card, drawer, preview-modal, default pager/tag scroller, TaskDock and reader selectors have been removed or moved to direct component owners.
- `components/discover/DiscoverPage.tsx`
  - Direct Folio composition for `#discover`: real popular band, combined keyword/tag query, custom filters, one responsive card grid, notices and pager. It imports no demo code and contains no API orchestration.
  - Card/random/popular selection navigates to the real gallery detail route; import actions enqueue the existing real import flow.
- `components/discover/useDiscoverState.ts`
  - Owns restored query/filter/page/scroll state, current `.folio-scroll` persistence, measured four-row page sizing, stale feed-request invalidation, one-shot StrictMode-safe popular loading, remote search, random navigation and import actions.
  - Multiple tags retain their original remote names/ids/types; a single tag-only query uses `tag_id`, while combined keyword/tag filters preserve the remote namespace (`artist:`, `tag:`, `parody:`, etc.). A missing remote `total` remains explicit instead of being fabricated.
- `components/discover/DiscoverPage.css`
  - Production-only ranked editorial wall, query composer, custom filter row, result card grid/pager and four-viewport responsive layout. Desktop popular works form one five-poster shelf with titles below the artwork; mobile uses five fully visible compact poster columns with no horizontal scrolling. Replaced legacy discover/tag-picker/popular-fan selectors were removed from `styles/app.css`.
- `components/discover/DiscoverToolbar.tsx`
  - Keyword/Gallery ID input plus visible multi-tag chips, icon-only random action, equal-height query action, custom Folio language/type/sort menus and unimported toggle. Discover has no duplicate list-view mode; upload/scan are not toolbar modes.
- `components/discover/DiscoverFeed.tsx`
  - Result count, empty/error/notice states, dynamic current-page cards, icon pager.
- `components/discover/DiscoverCard.tsx`
  - Cover-first Folio card: title, author/group, page/language/ID, draggable tag row. Author/language labels use dictionary `display`; language skips generic `translated`.
- `components/discover/TagFilterSelector.tsx`
  - Real cached multi-select tag picker plus dictionary-aware autocomplete; Chinese input can search immediately, duplicate matches are collapsed by remote tag id, selected options stay at the top, and one fixed clear action removes all selected tags. It opens on content `tag` results only; author/group/parody/character/category/language live in a separate “作者与作品信息” scope. Mobile gives selected chips their own full-width row so the first chip cannot sit under the trigger.
  - Candidate scopes and the files/tasks/export segmented filters are filter button groups with `aria-pressed`; they are not tabs because they do not own tab panels.
  - Only terms with real remote tag IDs can be selected for discover remote filtering.
- `components/folio/ui/TagScroller.tsx`
  - Pointer-drag horizontal tag row with hidden scrollbar and click-to-filter support. Summary cards expose at most six native search anchors plus a non-interactive remainder count; drag suppression applies only to the primary pointer so middle/modifier navigation remains intact.
  - Local `WorkCard` supplies `hrefForTag={libraryTagHref}` so middle/modifier clicks preserve the library search scope; remote callers use the default discover link. Touch scrolling and keyboard activation remain native after a drag.
  - Uses `tag.display || tag.name || tag.slug || id`, so dictionary display names flow without rewriting card logic.
- `components/folio/ui/AmbientCover.tsx`
  - Shared primary-cover frame for popular, gallery hero, and reader info. The default foreground uses `contain`; a non-semantic duplicate supplies blurred/dimmed ambient fill. Discover cards and shared shelves opt into `is-fill-portrait`: natural image dimensions recorded on load select portrait `cover` sizing so narrow portrait covers do not expose bands inside fixed frames. Landscape covers, gallery heroes and reader info remain contained.
- `components/discover/PopularFan.tsx`
  - Real `/api/discover/popular` five-item ranked editorial showcase between the Folio heading and search workbench. It has no viewport state, drag state or fabricated entries; every cover, title, count, import state and action comes from the real payload.
  - Desktop fills the available track with five frames and copy below the image; media keeps each image’s real aspect ratio without an independent height cap, and the artwork remains contained. Mobile keeps all five visible in the existing two-plus-three arrangement. Dense discover rows have independent natural heights, avoiding stretched tag/action gaps.
  - Cards expose only real title/page/favorite/import state and never fabricate badges or statistics.
- `components/discover/GalleryDetailPage.tsx` + `components/discover/gallery/`
  - Direct route-local gallery composition split into real data/model, fixed-slot hero, full-width tag ledger, initial page preview, keyboard/focus-restoring lightbox, and related works. It imports no demo state.
  - The hero cover slot uses `AmbientCover`: the meaningful foreground stays `contain`, while the same-image ambient layer fills ratio gaps without losing edge content. The page lightbox remains `contain` and derives a clamped width from the active page ratio. Variable tag counts never share the cover column. Related results are capped at five and render as one five-column desktop row / five compact mobile rows, so the fixed five-item payload cannot orphan its last card. Import state has latest-request/unmount protection and a fixed-width busy/queued action.
- `components/discover/IconPager.tsx`
  - Icon-only first/previous/input/next/last pagination.
- `components/settings/` — refactored settings module:
  - `SettingsPage.tsx` — direct Folio composition with six horizontal chapters, unique section headings, animated chapter transitions, real sync/dirty state, inline feedback, and a viewport-fixed reload/save rail. It imports no demo state and has no left navigation.
  - `SettingsPage.css` — production-only settings layout, metrics, manifests, storage paths, fixed action rail, 1024/390/320 responsive rules, and reduced-motion fallback. Replaced settings deck/rail/form/export-recipe rules were removed from `styles/app.css`.
  - `useSettingsState.ts` — all real config state/actions, password-change drafts/action, latest-request and unmount protection, complete dirty comparison, secret-draft reset, and load/save/verify/clear flows. Hydration also synchronizes saved privacy/cover defaults into `ArchiveApp`, so cover blur changes apply to other routes without a reload. Validation actions only run against saved config.
  - `ConnectionSection` / `TranslationSection` / `PreferencesSection` / `ExportDefaultsSection` / `DataSection` / `StorageSection` — shared Folio fields/selects/toggles over real settings, auth, runtime, library, and file APIs. `PreferencesSection` owns the current/new/confirmation password controls; data/storage fetch only when their chapter is active. `ReadingStatisticsReport` owns period comparison, activity/rhythm, local work/session rankings and collection distributions without fabricating pre-tracking data. `settingsHelpers` owns only `StatusDot`.
- `components/dictionary/DictionaryPage.tsx`
  - Direct Folio composition for `#dictionary`: real summary, candidate pool, editor, evidence/preview ledger, fixed viewport command bar, and accessible bulk-import modal. It imports no demo code and contains no API orchestration.
- `components/dictionary/useDictionaryState.ts`
  - Owns all real summary/candidate/evidence/preview/mutation flow, latest-request invalidation, selection/form state, machine translation, review/ignore/delete, and batch suggestions. Editing invalidates the current preview; apply remains disabled until the current form has a read-only preview.
- `components/dictionary/DictionaryPage.css` / `DictionaryEditor.css`
  - Production-only responsive layout, custom focus treatment, candidate table, evidence ledger, modal and fixed command bar. All replaced legacy dictionary selectors and the orphaned `FilterMenu` were removed from `styles/app.css`.
- `components/dictionary/DictionarySummaryStrip.tsx`
  - Real top summary strip for unconfigured/configured/ignored/review/suggestions.
- `components/dictionary/DictionaryCandidatePool.tsx`
  - Table-like candidate pool from `/api/dictionary/candidates`, with custom Folio type/status/page-size selects, pagination, batch import, and review-only machine suggestions.
- `components/dictionary/DictionaryEditor.tsx`
  - Edits original term, Chinese display, aliases, type, scope, and note. The real 机翻填充中文名 action (`/api/dictionary/translate`) only fills `zh_name` for human review; the field labels keep their neutral color during focus.
- `components/dictionary/DictionaryActionBar.tsx`
  - Fixed preview/apply/ignore/review/delete controls. Preview is read-only; delete retains an irreversible-action confirmation; all actions stay available on mobile with compact labels.
- `components/dictionary/DictionaryEvidencePanel.tsx`
  - One visible split ledger for real impact metrics, tag diff, co-tags, conflicts, remote mapping, and related works from `/api/dictionary/evidence` and `/preview-apply`; it does not hide evidence behind tabs.
- `components/dictionary/BulkImportPanel.tsx`
  - Paste-based CSV/TSV/comma import with row-level preview before write.
- `components/library/LibraryPage.tsx`
  - Direct Folio composition for `#library`: real summary, custom filter workbench, optional shelves, result index, batch tray, cards, pager, and inspector. It contains no API orchestration and imports no demo code.
- `components/library/useLibraryState.ts`
  - Owns the existing real summary/shelf/search flow, stale-request invalidation, filters, paging, focused work, and cross-page multi-selection. The grid passes a measured whole-row page size: for example, five columns request 25 rather than the incomplete hardcoded 24. Independent overview requests still run in parallel.
- `components/library/LibraryPage.css`
  - Production-only library layout and responsive behavior. Mobile work details use an opaque bottom sheet with a backdrop; all replaced legacy library/inspector/batch rules were removed from `styles/app.css`.
- `components/library/LibrarySummaryStrip.tsx`
  - Real summary strip: 总收藏 / 已读 / 阅读中 / 未读 / 待补标签 / 占用容量. No broad 待治理 fabrication; 待补标签 = works with zero `work_tags`, while detailed governance state lives in the governance page.
- `components/library/LibraryToolbar.tsx`
  - Search form (submit on Enter), custom Folio language/status/source/sort selects, `LibraryTagFilter`, animated grid/list view toggle, reset, and removable selected-tag chips. Language options come from real summary facets.
- `components/library/LibraryTagFilter.tsx`
  - Multi-select tag picker backed by `/api/library/tag-filters` (local used tags only, debounced search, dictionary display names). Does not call NH API.
- `components/library/WorkCard.tsx`
  - Cover-first card with direct semantic controls: read status, source/language, author/group, page/ID, custom progress, content-only Tag row, and reader action. The Tag row filters strictly to `type=tag`; on mobile it becomes a centered two-column, three-row keyword grid instead of repeating author/language metadata or hiding useful tags. Language display skips generic translation markers and prefers a concrete language tag. Selection buttons are not nested; double-clicking the cover opens the reader.
- `components/library/WorkInspector.tsx`
  - Sticky desktop inspector and mobile bottom sheet for real file size/pages, source/ID, language, reading progress and local tag drill-downs. Its action grid keeps reader full-width, governance/export together, and favorite/delete together on the final row.
- `components/folio/ui/ContinueReadingRow.tsx`
  - Shared real-data shelves for library/workbench. Mouse capture starts after 6px movement; normal/held clicks, keyboard, middle/modifier links remain native. Touch uses browser scrolling; previous/next buttons offer a gesture-free alternative. `AmbientCover` preserves the complete cover and privacy blur; progress and read actions stay visible. Shelves and library cards use the optional 512px cover thumbnail with asynchronous decoding, avoiding full-resolution decoding in small frames.
- `components/library/libraryHelpers.ts`
  - `formatBytes`, title/author/language/read-status derivation, and shared sort/status/source option lists.
- `components/history/`
  - `HistoryPage.tsx` directly composes the real date-bucket timeline, summary, pager and reader links inside the library Folio context; `useHistoryState.ts` owns request invalidation and pagination, while `HistoryPage.css` owns responsive timeline geometry.
  - History shows only aggregated real events from `/api/library/reading-history`; it never expands or invents per-page events.
- `components/reader/ReaderPage.tsx`
  - Immersive fixed-viewport reader outside `ArchiveShell`, with discriminated sources:
    - local `workId`: reads indexed CBZ pages and persists progress;
    - remote `galleryId`: reads remote `pages[].url` from gallery detail, records visible-time sessions without local progress/history, and exposes the import queue action.
  - `useReaderData.ts` owns latest-request/unmount guards, separate load/action feedback, normalized readable remote pages, debounced local progress and guarded import state. `WebtoonView` observes the actual reader scroller through a center band, so tall continuous pages update current-page progress reliably.
  - `ReaderToolbar` hides single-page direction controls in continuous mode; `ReaderScrubber` provides keyboard/touch progress without a native slider. `ReaderInfoPanel` groups real author/group, parody/character, content, category and language tags, retains the real gallery-display link, and contains no duplicate reader settings. `ThumbnailOverlay` clips its own width so large page counts cannot create a document-level horizontal scrollbar. `ThumbnailOverlay` and `ReaderJumpDialog` remain focus-restoring modal surfaces.
- `components/governance/GovernancePage.tsx`
  - Direct Folio composition for `#governance`: real queue rail, single/bulk modebar, automatic-check + human-review panel, metadata document and source-check rail. It imports no demo code and does not adapt legacy DOM.
  - Loads `/api/governance/queue`, auto-selects a real work when available, and loads `/api/works/{id}/governance` through `useGovernanceState`.
  - Empty library/empty queue is an honest empty state; no sample works, fake conflicts, or fake recommendations.
  - Fixed viewport action bar keeps save/write-back visible at every document length and includes real dictionary/export/reload routes. ComicInfo write-back and bulk write-back still require the existing irreversible-action confirmations.
- `components/governance/GovernancePage.css` / `GovernanceEditor.css`
  - Production-only three-column workspace, review/check ledger, work header, source rail, fixed command bar, bulk reports, translation decision cards, field provenance ledger and tag groups. Mobile keeps the real queue as a horizontal track and moves source evidence below the editor; no native checkbox chrome is visible.
- `components/governance/GovernanceReviewPanel.tsx`
  - Separates three automatic check groups (metadata/dictionary/files) from explicit human approval. Shows current/stale/approved state, requires notes for accepted warnings, and exposes reopen without pretending that a clean check equals human review.
- `components/governance/GovernanceTranslationPanel.tsx`
  - Field-scoped Chinese suggestion flow: select title/subtitle/summary, compare original and suggestion, then accept one/all or ignore. Acceptance only updates the editor; the fixed save action remains the sole persistence step.
- `components/governance/GovernanceSourceRail.tsx`
  - Real source type, Gallery ID, page/file facts, tag/dictionary counts and backend-recommended actions. It does not calculate or invent a health score.
- `components/governance/MetadataEditor.tsx`
  - Source/current/final field comparison with auto-growing textareas, adopt/revert actions and animated decision filtering. Source differences and missing required values enter the decision view; translation suggestions remain separate until explicitly accepted. “只看待确认” is an `aria-pressed` custom control, not a native checkbox.
- `components/governance/GovernanceQueueRail.tsx` / `GovernanceBulkBar.tsx`
  - Queue separates pending review, automatic metadata/dictionary/file issues, approved snapshots and all works, with an in-place definition for every filter. Bulk preview/apply remains real and read-only-before-apply; custom checkbox visuals preserve semantic inputs and mutation safeguards.
- `components/export/` — export center (browser-download model), split into focused modules:
  - `ExportPage.tsx` — direct Folio composition for real queue summary, toolbar, local-work list and CBZ recipe inspector. It imports no demo code.
  - `ExportPage.css` — production-only responsive source/recipe layout, custom selection/status controls, metadata ledger and sticky action recipe. Replaced global `.export-*` rules were removed from `styles/app.css`.
  - `useExportState.ts` — all state and data-fetching logic; queue loads and debounced preview requests have latest-response guards, so rapid rename/option/focus changes cannot restore stale previews. `downloadSelected()` still downloads one CBZ, a synchronous `.zip`, or enqueues a real bulk-export job over the existing threshold.
  - `ExportToolbar.tsx` — Folio search, animated status index, batch mode, select-ready, and clear actions.
  - `ExportWorkList.tsx` — semantic selectable work buttons with cover, title, remote ID/source, selection/focus state, and ready/warning/blocked status.
  - `ExportInspector.tsx` — focused-work output rename, ComicInfo preview, blockers/warnings, selected cover strip, semantic hidden-checkbox option switches, refresh, selected download, and current-work download.
  - `exportHelpers.tsx` — shared render utilities: `Cover`, export item status classification, and status labels.
  - Export delivers files to the user via the browser (`api.downloadExport` / `api.downloadExportBundle` fetch a blob and trigger a save); nothing is written to a server output directory and no history is kept. Original CBZs are never modified.
- `components/files/` — file maintenance module:
  - `FilesPage.tsx` — direct Folio composition for real overview, filters, semantic file list, pager, focused detail, cleanup preview, delete confirmation dialog and directory-scan preview. Desktop selection scrolls the existing side detail into view when it would otherwise sit below the first viewport; mobile keeps the bounded drawer. It imports no demo code.
  - `FilesPage.css` — production-only metric, toolbar, custom scrollbar, list/detail/maintenance rail and four-viewport responsive layout. Desktop keeps detail beside the inventory; 900px and below open focused detail as a bounded bottom operation drawer. Replaced global `.files-*` rules were removed from `styles/app.css`.
  - `useFilesState.ts` — owns one guarded file-operation state for delete preview/cleanup/delete/scan preview/scan enqueue; inventory requests retain latest-filter semantics and clamp invalid pages after deletion. Scan enqueue submits the exact paths from the visible preview instead of recalculating them.
  - `FileDeleteDialog.tsx` — native modal confirmation shared by single, batch and cleanup deletion; it stays viewport-visible, defaults focus to cancel, restores the triggering control, and shows warnings or execution failures in place.
  - `FileToolbar.tsx` — animated category index, Folio search/custom status and sort selects, and an always-present selection summary; there is no prerequisite “batch mode”.
  - `FileList.tsx` — separate always-visible checkbox and full-row focus button with real path/type/size/status, size-mismatch display and styled internal scrolling.
  - `FileDetailPanel.tsx` — focused real cover/path/metadata/structured tag links plus reader, gallery display, governance, export, native path-copy and delete-preview actions; cover respects `blurCovers`.
  - `FileHealthRail.tsx` — presentation-only real index and duplicate counts, cleanup launchers, read-only library-scan preview and guarded scan-task enqueue controls; async ownership stays in `useFilesState.ts`.
  - `fileHelpers.tsx` — byte/kind/status formatting and delete-target conversion.
- `components/tasks/` — task center:
  - `TasksPage.tsx` — direct Folio composition for `#tasks`: real status metrics, animated status index, search/refresh/confirmed clear, semantic task list, and source-of-truth inspector. It imports no demo code.
  - `TasksPage.css` — production-only responsive table/card layout, custom progress visuals, inspector progress ring and logs. The replaced global `.tasks-*` rules were removed from `styles/app.css`; visible operational text stays at 10px or above.
  - `useTasksState.ts` — polls `/api/jobs` every 2.5s only while the document is visible, filters by status/query, tracks focus, loads logs, and calls pause/resume/cancel/retry/delete. Job/log request tokens prevent stale poll or fast-focus responses from overwriting current state; single-record deletion now confirms before mutation.
  - `TaskSummaryStrip.tsx` — counts real queued/running/failed/completed jobs and today's updated jobs in the Folio hairline metric strip.
  - `TaskList.tsx` — semantic task rows with an independent focus button and action region, custom ARIA progress, target/stage/time, real download/retry/pause/resume/cancel/log/delete capabilities; no nested interactive controls or native progress chrome.
  - `TaskInspector.tsx` — focused job target, circular progress, errors/retry-after, bulk-export or scan facts, real controls, copy feedback, and durable job log timeline.
  - `taskHelpers.ts` — known job/stage/status labels, target formatting, retry eligibility, and time formatting.
  - Failed bulk exports and failed `remote_import` jobs with a real `gallery_id` can retry; running/queued jobs can pause/cancel; paused jobs can resume/cancel. Browser visual QA never triggers these mutations.
- `components/workbench/` — presentation homepage:
  - `WorkbenchPage.tsx` — first directly migrated Folio route. Keeps the real overview hook/API flow while owning new semantic page structure; it does not wrap the legacy dashboard or import demo content.
  - `WorkbenchPage.css` — production-only shelves, bottom overview and refresh controls. The replaced `.workbench-*` rules were removed from `styles/app.css`.
  - `WorkbenchPage.tsx` loads librarySummary and libraryStatistics(30) independently, preserving available data and retry on partial failure. HomeHero renders an interactive SVG paper installation and real reading data.
  - The homepage metric strip is removed; existing library/settings statistics retain their owners.
  - `folio/ui/HomeHero.tsx` / `HomeHero.css` — interactive homepage shared with demo: draggable cover wall and spatial carousel share the same real cover elements.
  - Shared byte formatting comes directly from `lib/format.ts`; the old module ledger/helper are removed.
  - Reuses `ContinueReadingRow` (from folio/ui) with direct shared Folio shelf markup for both the 继续阅读 and 最近导入 shelves; shelves render nothing when no real rows exist. `blurCovers` is honored throughout.
- `styles/app.css`
  - Shared NH Archive design system matching warm paper, editorial headings, terracotta actions, right inspectors, and task dock.

## Data Directory

Default: repository-level `.local-data/`

- `archive.db`: SQLite database.
- `library/{work_id}.cbz`: imported source archive.
- `covers/{work_id}.{ext}`: extracted cover.
- `pages/`: reserved page cache.
- `tmp/`: download workspace.
- `exports/`: legacy export directory (still created by config/settings, but no longer written to — export now streams downloads to the browser).

## Verification

`apps/api/tests/conftest.py` assigns a stdlib temporary `NH_ARCHIVE_DATA_DIR` before test modules import the application. Keep this isolation: collecting API tests must never initialize or rebase the root `.local-data/archive.db` used by Compose.

Backend:

```bash
PYTHONPATH=apps/api pytest apps/api/tests -q
```

Frontend:

```bash
cd apps/web
npm run build
```

- Cover thumbnail endpoint: `GET /api/works/{id}/cover?w=512` validates width 64–1024, reads the extracted cover (works even if the CBZ is missing), reuses atomic JPEG caching under `thumbs/`, and follows existing reimport invalidation. Omitting `w` preserves the original file endpoint; no schema changes.

设置标题场景由 `folio/scenes/SettingsScene.tsx` 与 `styles/scenes.css` / `feedback-motion.css` 维护：无外框的三条竖向滑轨与齿轮共享9秒校准节奏，正式页与演示页复用；不读取配置或模拟保存状态。

2026-09-07 首页阶段：导航显示“首页”，保留 #workbench 路由；首屏使用 HomeHero，书架与管理概览在其下方。FolioChrome 首页不再渲染标准标题场景，其他页面标题移除说明段落。队列为文件经过处理环的流转，治理为条目依次归整到档案；动画前缀分别 queue/edit。站点图标为 public/icon.svg（朱红 NH 组合字母），index.html favicon 与首页复用。

最新首页采用紧凑作品展示，HomeHero 不再包含大字品牌、封面扇形或入口按钮；最近导入通过 ContinueReadingRow 与继续阅读复用同一交互。作品概览移除重复管理导航。所有网页“馆藏/入藏”措辞已移除，使用作品、作品列表、作品统计等具体名称。

2026-09-08 互动首页替代此前所有列表首页方案：HomeHero 使用现有 Motion 的拖动、惯性与弹簧，CSS perspective 呈现厚度和前后层次。默认封面墙，点击作品进入翻阅台，拖动/滑动、方向按钮、键盘与复位操作可用。只显示现有作品，不自动跳转阅读；空态不伪造封面。仅封面缩略图，无背景大图或额外包。首页不渲染被遮挡的 ModuleBackdrop。

2026-09-08 当前首页覆盖此前封面方案：纸色、墨线与朱红的 SVG 页片装置；叠页/回环/流线连续变形、拖转、键盘、展开滑杆、印章重排、暂停与复位。左右排版展示真实作品/阅读分布，底部为可交互30天阅读节律。不请求封面，无新包或后端改动。后台及装置离开视口暂停循环动画。

2026-09-08 首页语义修订（优先于上述装置描述）：删除叠页/回环/流线模式面板、展开滑杆与印章动作。HomeHero 的页片一一对应最多36部真实最近作品；墨色加粗与放大表示当前作品，朱红线段仅表示已读进度，不能把未读轮廓全部涂红。拖动/方向键/前后按钮同步右侧真实标题（原生阅读链接）、页数和进度。阅读日期联动时长/作品/会话，点击阅读节律恢复30天汇总。沿用纸墨动效但不再提供纯形态测试控件。数据仍支持局部失败重试；无作品时不伪造页片。

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
