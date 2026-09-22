# Next Stage Prompt: Post-Closure QA And Polish

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


Use this prompt after the feature-complete local loop remains green (`pytest` + `npm run build`). The latest closure baseline is 234 backend tests plus the route-split frontend build; the 2026-07-31 production-preview baseline covers 14 distinct entries at 1440×1000 and 390×844 (28 page states), 18 real interaction paths, authentication setup/login/logout, reader background isolation and focus restoration, responsive layout, reduced-motion behavior, and TaskDock suspension inside readers.

The 2026-09-07 interaction revision keeps native links in all four library/workbench shelves. Hover uses a clear vermilion ring, a small lift and title color, with no action-label overlay or rotation. Pointer capture begins only after a real mouse drag; touch, keyboard and modifier links remain native. Login is an independent paper surface: do not restore the decorative page silhouette behind the password field. The form exits, a measured field-edge scan aligns with the actual 78/68/64px topbar, then the app mounts and fades in. Keep pending text on one line, setup/error/retry controls, lazy-route focus restoration and reduced-motion support. The auth shell uses overflow:clip and no persistent transform on its app wrapper; discover pagination scrolls only .folio-scroll. Keep number/nav springs, bounded list staggering (50ms maximum interval, 320ms total delay), viewport-sized native horizontal page transitions (no exit wait or whole long-page moving layer) and offscreen scene pause. Sparse result rows must not expand works beyond 1.25× their measured normal column width; dense discover rows size independently rather than sharing 1fr height. Popular cards fill the desktop track at each cover’s real aspect ratio; do not impose an independent media height cap, which creates side bands, or restore a tiny centered shelf. Ordinary discover cards and shared shelves use is-fill-portrait: loaded portrait images fill their frame with object-fit:cover; landscape images remain contained. Paper-light motion is limited to a small radial glow; decorative background motion pauses while scrolling and resumes after 150ms idle. Page background changes do not scale two full-screen layers simultaneously. Library cards and shared shelves request /api/works/{id}/cover?w=512 with asynchronous image decoding; the optional width reuses the existing atomic thumbnail cache and reimport invalidation. Select-menu row backgrounds meet the menu border. Product copy must describe reader actions, never development guarantees or welcome slogans. Verify intermediate animation frames and actual pagination, not only screenshots. Run auth-gate, auth-wake-demo, shelf-navigation and layout-regressions E2E suites with an isolated real archive via E2E_BASE_URL and E2E_STORAGE_STATE.

## Required Reading Order

1. `docs/AGENT_MAP.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_MAP.md`
4. `docs/DEVELOPMENT_RULES.md`
5. The relevant active demo module and formal component listed by the agent map.

## What Already Exists

- Run the complete development stack with root `npm run dev`; do not require users to manage separate API/Web terminals. `npm run dev -- --check` is the non-starting environment check.
- Deployable code lives in `apps/api/` and `apps/web/`; runtime state belongs in root `.local-data/`. Do not restore top-level `backend/` / `frontend/` folders or place user archives inside either app.
- The same SQLite may cross host and Compose runtimes. Keep source/cover paths portable in SQLite (`library/...`, `covers/...`), resolve them against the active data root at read time, and preserve startup conversion of legacy `.local-data/...` / `/data/...` absolute values. Never reintroduce environment-bound managed paths.
- Keep `apps/api/tests/conftest.py` test-data isolation. A plain pytest run must not initialize, migrate or rebase the Compose database under root `.local-data/`.
- Preserve the single-password boundary: `AuthGate` must resolve before application routes mount; only `/api/health`, auth status/setup/login/logout are public, while `/api/auth/change` requires an active session and the current password. Accept any non-empty password without character-combination rules; keep salted `scrypt`, HttpOnly/SameSite cookies, server-side token hashes, other-session revocation on password change, and no usernames or localStorage auth tokens.
- Backend startup is split by responsibility: `main.py` creates the app, `container.py` assembles dependencies, `api/<domain>.py` owns HTTP routes, and `services/` owns behavior. Extend the matching domain router instead of rebuilding a monolithic entrypoint.
- Shared frontend metric entries, pagination, tag scrolling, and work shelves live in `components/folio/ui/`; shared presentation formatting and job rules live in `lib/format.ts` and `lib/jobs.ts`. Feature folders are not cross-feature utility buckets.
- All primary modules are real pages: discover, library, reader, history, governance, dictionary, export, files, tasks, settings, and workbench.
- Governance supports single-work metadata decisions, metadata machine-translation suggestions, ComicInfo write-back, batch fill-missing metadata, batch ComicInfo write-back, source Web backfill, and batch confirmation of existing dictionary `review/conflict` terms.
- Library batch metadata refresh is preview-before-apply. Preserve its exact-ID/ComicInfo-Web/manual-ID priority, fuzzy thresholds (92 confidence, 7-point margin, page match unless confidence is 97), duplicate-link rejection, server-side apply re-ranking, fresh detail fetch, stale remote-tag replacement, local source ownership, and manual metadata decisions. Never trust browser-supplied confidence or auto-apply an ambiguous candidate.
- Governance queue totals mean actionable works, not library size; language completeness honors real language tags unless an explicit metadata decision overrides them. Opening a work must never stage a source-value change by itself.
- Export supports immediate browser downloads for single/small batches and `bulk_export` task-center jobs for selections over `EXPORT_SYNC_THRESHOLD`.
- Bulk-export artifacts are temporary: written as `.zip`, available from the task inspector, deleted after download, and swept after 24h.
- Library scan jobs, import jobs, and bulk-export jobs all route through the real task center.
- No fake works, fake jobs, fake metrics, fake covers, or adult sample assets should be added for QA.

## Next Work

- Use `components/folio/` as the production-neutral visual system and `/demo` as its visual regression surface. Never import `components/demo/` from a formal route.
- All formal routes, including gallery detail, history, and both readers, are directly migrated and browser-verified. Keep feature-local structure/CSS; do not restore legacy-shell adapters or import demo state.
- The globally orphaned legacy shell/page selectors are removed, `app.css` is base-only, and formal routes already load through route-level lazy boundaries with honest Folio/reader fallbacks. Preserve that split and do not raise warning thresholds.
- Browser QA against real or user-provided data after each route migration; compare the formal route with `/demo` at desktop and mobile sizes.
- Operational-page migration must preserve task state-machine controls, export download semantics, file-deletion previews/confirmations, and current real-data empty states.
- File operations have one owner: keep delete/cleanup/scan async state in `files/useFilesState.ts`; deletion must remain preview → viewport-level confirmation, work metadata may be removed only after its managed files are successfully deleted, and scan enqueue must submit the exact paths from the visible preview rather than recomputing targets.
- Preserve the simplified flows now verified in production: discover is grid-only, its five popular works remain one five-poster shelf on desktop and all five stay simultaneously visible without horizontal scrolling on mobile, every primary popular/detail/reader cover keeps the full artwork over a decorative same-image ambient layer, its tag picker defaults to content tags with author/work metadata in a separate scope, selected tags stay first with one clear-all action, library card Tag rows contain only `type=tag` content terms and never treat `translated` as a language, continuous reader progress is derived from the actual reader scroller, reader info retains grouped local metadata tags and the gallery link, saved cover blur updates `ArchiveApp` immediately, and file rows are directly selectable with desktop-side/mobile-drawer actions.
- Preserve native link semantics for every formal tag surface: discovery/remote-reader contexts use `tagSearchHref()`, while library/statistics contexts use `libraryTagHref()` and must stay inside the local index. Ordinary left click may filter in place; middle/modifier click must open the same data scope in a new tab. Keep shared library/workbench shelves press-draggable, the reader page index horizontally clipped, the gallery lightbox ratio-constrained, and the fixed five related works free of orphan rows.
- Preserve local favorites as `works.favorite`, separate from the remote gallery popularity field also named `favorites`; every library/reader favorite control must converge on `api.setWorkFavorite()` and favorite-only search must remain server-backed.
- Preserve reader accounting boundaries: progress writes never create visits; one idempotent local `reading_sessions` row creates one `reading_history` open, while one idempotent `remote_reading_sessions` row records a cached remote gallery without local progress/history. Both accumulate only visible foreground time monotonically; hidden/background time is excluded and no historical time is fabricated. If a remotely read gallery is later imported, shared statistics resolve both sources to one work. Session-key generation must work outside secure contexts. Statistics use the browser timezone for local calendar days, compare equal-length periods, keep local collection author/Tag distributions independent from favorites, and may attribute a session to its start day until a demonstrated need justifies midnight splitting.
- Visible return controls must use `lib/navigation.ts::goBack()` so they behave like the browser Back button instead of adding a replacement destination. Discover Tag conditions support both include and exclude; keep signed namespace clauses intact. Remote import progress must retain byte-level download updates and may not fall back to a fixed 60% stage marker.
- Keep result page sizes tied to actual computed grid tracks through `lib/useGridColumns.ts`; never restore viewport/card-width guesses or a fixed count that leaves an incomplete row. Library rounds its 24-item target upward (five columns means 25), while discover keeps four complete measured rows.
- Mobile layout polish only where screenshots show concrete overlap, wrapping, density, or touch-reachability problems.
- Use `FolioMetricGrid` for cross-route KPI/status summaries. Keep genuine record tables and compact inspector facts in their owning feature; do not recreate joined spreadsheet cells for read-only top-level summaries.
- Long-list performance checks for library/export/governance queues; route splitting is complete, so optimize measured render/fetch bottlenecks rather than reorganizing chunks speculatively.
- Dictionary candidate matching must keep separate indexed joins for direct remote ID, normalized name and normalized slug. The audited real baseline is p50 11.3ms / p95 12.4ms at 5313 remote tags; the 55313-tag isolation baseline is p95 112ms for the ordinary first page, 34ms for configured filtering and 69ms for a local keyword scan.
- Preserve the 2026-07-15 measured backend baseline: workbench overview about 31ms, export summary about 7ms, full export queue about 13ms, file inventory about 10ms and job list about 5ms on the current 23-work/967-page local library. Re-profile before adding caching or query abstractions.
- Preserve startup recovery semantics: queued/running work is failed as retryable after process restart, cancelling becomes cancelled, and paused remains resumable. Remote-import enqueue must stay idempotent per gallery.
- Preserve the accessible control model: segmented filters are button groups with `aria-pressed`, custom Folio selects return focus to their trigger, and animated feedback wrappers must keep alert/status/ARIA attributes. The global TaskDock must continue showing paused and cancelling work; its initial poll must remain StrictMode-safe, non-overlapping, hidden while paused, and covered by `apps/web/e2e/taskdock.spec.ts`.
- Small user-feedback fixes. Keep them scoped and covered by the smallest relevant test.

## Verification

- `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`
- `cd apps/web && npm run build`
- `git diff --check`
- Static scan touched files for mock/sample/random hardcoded records.
- For visual work, run browser screenshot QA with real local data and include screenshots in the status update.

设置标题动画使用无外框的开放式滑轨与齿轮，依次调节后复位；不要恢复面板外框、图标轮播或整组浮动。保留局部 transform、离屏暂停及 reduced-motion。队列箭头固定于列间中央，用透明度表达阶段；完成标记必须晚于卡片淡出。文字条及匹配框的缩放原点必须相对自身，词典文字跟随书页。运行 scene-motion.spec.ts 检查完整周期定位，并对九页采样检查。

最新首页阶段覆盖旧工作台构图：#workbench 导航名为“首页”，复用 folio/ui/HomeHero，真实最近入藏最多3张封面及馆藏数；不恢复顶部管理账本、标题说明或欢迎词。演示首页使用无馆藏空态，不能伪造作品。标准标题说明统一不渲染。队列/治理场景已完整替换，前缀 queue/edit；删除的 task/governance 旧动画不可复活。站点 SVG icon 在 public/icon.svg；首页使用原生阅读链接和既有缩略图。验证首页0/1/2/3封面、手机/大屏、减少动态效果、登录、四个书架和 scene-motion 回归。

后续首页修订优先级最高：禁止恢复大字品牌首屏、封面扇形、首页重复导航按钮和空旷展示区。保留小标题/作品数，最近导入与继续阅读直接展示作品；两行共用 ContinueReadingRow，宽度165–280px。网页不得出现“馆藏/入藏”及 local collection；不要用宣传、欢迎词填空白。图标仅保留 favicon。

2026-09-08 用户最新方向优先：主页只负责视觉与独特玩法，组合可漫游封面墙和立体翻阅台。不要恢复统计、书架列表、大标题、欢迎词或页面跳转按钮。HomeHero 用同一组最多36张真实封面连续变形，控件仅服务漫游/翻阅；保留拖动防误点、触屏换页、键盘、减少动态效果及空作品状态。运行 home-gallery.spec.ts 与 shelf-navigation.spec.ts；后者现在只覆盖我的库（首页已无书架）。

2026-09-08 最新用户要求覆盖上述封面墙/翻阅台：用户拒绝两种方案，要求大量交互与动效、允许抽象装饰和数据展示，但必须匹配纸色墨线朱红。当前 HomeHero 已更换为三态页片装置与真实统计排版；不能恢复封面墙。数据来自 librarySummary / libraryStatistics(30)，失败显示破折号和重试，不伪造统计。home-gallery.spec.ts 已迁移为装置交互/数据失败用例。

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
