# NH Archive Project Status

## 2026-09-23 · 首页、热门、登录与二级页面收尾

首页使用真实30天日期阵列、连续路径与邻近抬升，展开保留节点身份，秒级记录不再显示为0分钟；后台、滚动及减少动态效果暂停装饰运动。热门采用五封面连续展示，显式按钮/键盘切换，取消指针路过换选，大屏封面高度限制390px，手机原生横向滚动。登录删除重复巨大标识和外层卡片，单入口居中，保留测量输入框至顶栏的成功过渡。历史修正封面列宽不一致、重复百分比，记录补充月日；远端详情无关联作品时隐藏对应入口，删除标签/关联标题下说明。

验证：Web build 与36项跨页面回归通过；二级页面2项检查通过（首次测试误读详情接口为result已修正）。登录7项覆盖短屏、四尺寸过渡落位及减少动态效果；历史/详情1440、2560、390截图无横向溢出与pageerror。手机续读无独立tag区，桌面tag筛选保留。性能采样与正式部署结果另记，不把开发环境通过当作线上验收。无API/schema变更，无假作品或统计。设置、阅读器底部控件、库详情来源浮层保留。

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

验证：Web 生产构建通过；24 项原有功能回归和 1 项新增来源节点/三维命中/反向焦点检查通过。阅读信息层、远端详情和导出也完成三尺寸检查，无运行时错误。已完成 1440×1000、2560×1440、390×844 布局及连续反向操作检查；动画录像在本地 `/tmp/nh-spatial-video/`。不把这些检查表述为用户认可、参考项目还原或整站重构完成。其他页面的前轮结构仍为待复核稿，后续不能仅靠同色按钮与淡入作为设计交付。

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


## Current Version

Feature-complete local loop after Phase 7 task center and final governance/export closure.

Current real slice:

`NH API Key settings -> remote discover/search/detail -> dictionary mapping -> remote reader or import job -> real task center status/pause/resume/cancel/log/retry -> local CBZ/work_tags -> library summary/search/filter/shelves/history/favorites -> local reader -> progress + visible-time session save -> settings statistics/report -> per-work/bulk governance queue/metadata/dictionary confirmation -> export preview/rename/download CBZ (single, sync .zip, or temporary bulk-export task artifact) to the user`

## Completed

- 互动封面首页（2026-09-08）：按用户选择组合“封面墙漫游”和“立体翻阅台”，使用最多36部真实作品及现有512px缩略图。默认展开为错落封面墙，拖动带惯性，滚轮/方向按钮/键盘也可移动；点选作品通过同一组元素的空间过渡进入立体翻阅，支持左右滑动/方向键、返回漫游与复位。移除首页统计、书架及旧状态钩子，不添加欢迎词或重复导航。7项互动首页/我的库回归通过，桌面1440/2560与手机390、空集/单本/三本子集、减少动态效果与控制台验证通过。无新增依赖或API/数据库变更。另验证844×390横屏封面、标题及控制条不重叠；首页关闭被遮挡的背景光动画，漫游使用平面合成和实体书边阴影。无头Chromium大屏压力测试仍有掉帧，不能据此宣称全程60fps；后续性能排查应保留真实设备对照。

- 首页密度与措辞修订（2026-09-07，覆盖品牌首屏方案）：移除巨大字标、装饰扇形和重复导航按钮；首页改为紧凑标题/作品数、最近导入、继续阅读和底部作品概览，两个展示行共用原有可拖动书架，作品宽度165–280px。清理正式页、演示页、搜索占位与无障碍标签中的“馆藏/入藏”，移除品牌下的 local collection。6项书架回归通过，1440/390/2560尺寸检查与阅读入口验证通过。

- 展示首页、站点图标及场景重构（2026-09-07）：工作台导航改为首页，保留 #workbench 链接兼容；首屏使用真实最近入藏封面、NH Archive 字标、实际馆藏数与阅读入口，下接继续阅读/最近导入，管理状态收到底部。移除所有标准页面标题下的解释，删除旧首页场景及管理账本。队列改为文件流经处理环，治理改为零散条目依次归档，均保留9秒节奏和减少动态效果。新增朱红 NH SVG 网站图标并接入 favicon/首页。14项登录/书架/场景回归通过，首页1440/390/2560宽度、真实封面阅读入口及0/1/2入藏子集、减少动态效果和图标响应验证通过；无API或数据库变更。

- 九页标题动画复查（2026-09-07，替代设置面板方案）：设置改为无外框的开放滑轨与齿轮，保留9秒依次调节节奏。队列箭头改用与列相同坐标系的路径，固定居中并按流转阶段点亮；完成标记等待任务卡淡出。词典文字条使用自身缩放原点并跟随书页运动；发现匹配框围绕自身缩放，缩短放大镜手柄及垂直行程以防越出标题区。构建及新增完整周期定位回归通过，九个正式页在1440、390、2560宽度共27个状态检查通过；设置演示/正式页运动、离屏暂停、减少动态效果与控制台验证通过。无业务/API/数据结构变更。

- 设置页标题场景重构（2026-09-07）：将三图标轮播替换为旋钮、刻度滑轨和开关组成的纸色调节面板，9秒周期依次校准、调整、落定再复位；仅使用局部 transform 动画，沿用离屏暂停和减少动态效果。构建通过；Playwright（Browser插件未提供）验证正式页1440×1000、390×844、2560×1440及演示页导航，动画运行、离屏暂停、减少动态效果和控制台检查通过。无设置业务、API或数据结构变更。

- 竖向封面贴边修复（2026-09-07，覆盖上轮热门高度上限）：撤销热门媒体单独封顶高度，恢复五张封面按真实比例铺满展示区，避免强制变宽后出现侧边底色。发现作品卡与共享书架在图片加载后按自然尺寸判定方向，竖向图片等比铺满固定卡框（比例不同会轻微裁边），横向图片继续完整展示；库作品卡本就使用 cover，详情与阅读器的完整画面模式不变。桌面2560×1440和手机390×844验证实际方向、object-fit及图片/容器尺寸，不再仅依赖隐藏图片的截图判断封面适配。构建及12项布局/书架回归通过，无后端或数据结构变更。

- 大屏布局与持续卡顿复查（2026-09-07，覆盖上轮热门尺寸限制）：今日热门五张作品铺满桌面展示区，封面高度使用 clamp(300px, 40dvh, 560px)，保留完整画面与手机两张＋三张布局。发现网格取消全体行等高，真实响应截取25项验证9／8／8排列及各行独立高度，消除第一行标签后的拉伸留白。纸面光影限制为局部径向光晕；滚动期间暂停装饰背景，停止150ms后恢复。切页使用视窗范围的原生动画，取消旧页退场等待及两层整屏背景同时缩放，保留导航弹簧、卡片入场和模块动效。书架与库作品卡使用512px异步解码封面；新增可选 cover?w=64…1024，复用原有原子缩略图缓存和重新导入失效机制，不依赖CBZ仍在场，原图接口和数据库结构不变。数字计数仅在显示文本改变时写DOM；共享减少动态效果检测改用媒体查询订阅，已挂载动画能实时响应。构建、7项归档/缩略图测试、23项前端回归、正式/demo共36个页面状态与2560×1440/390×844截图检查通过，零页面错误；图片在截图中隐藏。最终同环境生产构建、2560×1440、同一隔离真实馆藏测试：5秒滚动中超过32ms的帧111/185→45/255（60%→18%），六次来回切页P95帧间隔166.7ms→66.7ms。滚动P95仍为33.4ms，测试仍能观察到掉帧，不代表所有设备完全流畅。Browser插件不可用，使用项目现有Playwright验证；未生成设计图。

- 卡顿、登录时序和布局回归修正（2026-09-07）：登录改为独立纸色入口，移除后方页面轮廓；验证文字保持单行。成功后按表单退场 → 实测输入框底边扫描至响应式顶栏 → 页面挂载淡入执行，取消整页永久 transform 和重复子层唤醒动画，并保留输入聚焦、错误反馈、数字与导航弹簧、逐项入场。外层使用 overflow:clip，发现翻页只滚动正文，修复顶栏被挤出视口。滚动进度条改用 transform；列表累计延迟限制在320ms。书架增加朱红外描边、轻微上浮与标题变色；稀疏网格保留正常列数，均衡行放大不超过正常列宽约1.25倍；热门封面最高240px并居中；下拉选中背景填至菜单边缘。构建、E2E 类型检查、21项针对性 Chromium 用例和正式/演示36个桌面/手机状态通过，无控制台或布局问题。两轮同条件生产构建、1920×1080、同一85部测试馆藏的4秒滚动对比：P95帧间隔33.4ms → 16.7–16.8ms，超过32ms的帧37–42 → 0–1；该结果仅代表当前测试环境。无后端/API/数据库结构变更。

- 原有动效恢复与验收修正（2026-09-07）：恢复登录聚焦配准、朱红下划线、按钮填色、错误位移、扫描线向顶栏收束及页面渐亮唤醒；还原数字弹簧计数、50ms 列表逐项入场和页面横向切换，并启用 `domMax` 让导航共享指示器的弹簧位移实际生效。保留点击修复、手机可见标签、慢速验证反馈、初始化返回修改、焦点隔离和文案清理；书架不恢复遮挡封面的阅读浮层。修复 reduced-motion 切换后计数可能归零及禁用按钮在收束动画中残留文字的问题。前端构建、E2E 类型检查、15 项相关 Chromium 用例通过；新增逐帧断言检查扫描线位置/宽度、页面渐亮及数字中间值，另完成正式与 demo 共 36 个桌面/手机页面状态检查，无应用错误或横向溢出，并录制完整登录动效。

- 书架交互与登录/全站动效升级（2026-09-06）：在共享 `ContinueReadingRow` 修复 pointerdown 提前捕获指针导致链接点击丢失的问题，覆盖我的库和工作台的四组书架；保留鼠标拖动、原生触屏滚动、键盘及中键/修饰键导航，补充书架翻页按钮，悬停只改变细边框，不再用阅读按钮遮挡或旋转封面。登录页沿用站内纸色、品牌栏、细线与朱红，改为一体化横向输入区，删除欢迎词、书本插画及页面中的开发说明，保留真实鉴权，完善密码显隐、初始化确认返回、离线重试、验证中反馈和进入应用后的焦点；删除闲置旧登录样式。同步修复本地标签中键误跳发现页、移动菜单点击当前页不关闭、拖动后键盘标签激活受阻，以及 Motion/React ref 警告；移动菜单隔离后台并约束焦点。数字摘要直接显示真实值，列表入场等待封顶 180ms，页头装饰离屏暂停，动效遵循 reduced-motion。生产构建、相关 E2E TypeScript 检查、14 项 Chromium 交互用例通过；隔离真实库副本上完成正式与 demo 共 36 个桌面/手机页面状态检查，无应用错误或横向溢出（主动开启 reduced-motion 时仅有 Motion 预期开发提示）。无 API/schema 变更，未生成设计图，未改写原始用户库。

- 远端阅读统计与返回体验收口（2026-07-30）：发现卡片同时提供直接在线阅读与入库/本地阅读入口；远端阅读用独立 `remote_reading_sessions` 保存缓存画廊快照和可见前台时长，绝不写本地阅读进度或 `reading_history`。共享 `reading_session_events` 在画廊后续入库时动态归并到同一作品，避免“触达作品”重复计数，并让作品排行、最近足迹和本地馆藏分布保持一致口径；统计查询只按视图已解析的本地 ID 关联作品，不保留冗余双索引分支。阅读器打开时保留后台路由以恢复滚动位置，同时卸载任务浮层轮询、用原生 `inert` 隔离后台交互并把焦点移入阅读器；仅返回同一来源页时恢复入口焦点，跳往展示页、治理或 Tag 检索不会抢回旧焦点。完整后端 `234 passed`、前端生产构建、全部 E2E TypeScript 静态检查、35 项 Playwright Chromium 端到端回归与 `git diff --check` 已通过；2026-07-31 又在隔离 SQLite 副本和生产预览上完成 1440×1000 / 390×844 两档 28 个页面状态、18 条真实交互及登录/登出回归，零框架错误层、横向溢出、重复 ID、未标注控件、console/page/HTTP error。移动馆藏 Tag 的最小高度由 22px 收口为 24px，相关作品标题链接也由 20px 补到 24px，针对性小目标复扫为零；深层回归改为从最近会话验证远端时长，并按 API 真实尺寸验证热门封面布局，避免把前六榜单截断或第三方 CDN 短时断连误报为应用失败。远端阅读器仅观察到非当前页预加载被上游 ORB 或路由切换中止，当前页渲染与直接媒体探针均可加载，因此不增加无证据的代理层。
- 阅读器入口兼容与阅读图谱重构（2026-07-18）：保留 `works.favorite` 与远端热度字段分离的本地收藏，库检查器动作层级固定为“阅读主动作 → 治理/导出 → 收藏/删除同排”。阅读会话 key 在安全上下文使用 `randomUUID`，普通 HTTP 环境降级到 `getRandomValues`，不再因浏览器缺少 `randomUUID` 而在渲染阶段崩溃。设置“统计”升级为 7/30/90/365 天真实周期、等长上期对比、逐日活动、星期/时段节奏、时长/次数作品排行、最近足迹及全馆藏作者/Tag 分布；作者与 Tag 均按本地作品数和馆藏占比排列，不再从收藏作品推测“喜爱 Tag”，点击后使用精确本地 Tag 筛选而不是跳到发现。浏览器时区继续决定本地日期，旧数据不补造时长；该阶段尚未采集远端阅读，已由上方 2026-07-30 远端会话实现取代。针对性 15 项 reader/library 服务测试、前端生产构建与 `git diff --check` 已通过；用户授权后又在隔离 SQLite 环境用 Playwright Chromium 完成 1440×1000 与 390×844 两档真实流程验收：库检查器收藏/删除同排、库作品进入阅读器且普通 HTTP 无 `randomUUID` 时只创建一次会话、统计周期切换、作者中键打开本地筛选、桌面/移动响应式与可读字号均通过，零横向溢出及 console/page error。该轮环境内的裸 `TestClient` 曾在 export API 门户处挂起；本轮确认这是沙箱跨线程唤醒限制，沙箱外完整回归已通过。
- 原生返回、批量重试、排除 Tag 与字节级下载进度（2026-07-18）：详情、阅读历史、治理返回入口和阅读器返回统一调用 `window.history.back()`，不再通过新 hash 跳转制造“返回后再按浏览器返回又进入原页”的循环；连续阅读任一失败图片的“重试全部”会只唤醒当前所有失败项。发现 Tag 选择器增加清晰的“包含所选 / 排除所选”关系，负向条件以真实 namespace 生成 `-tag:"..."` / `-artist:"..."` 远端查询并随历史状态恢复。远端 CBZ 下载不再固定停在 60%，任务记录按响应字节持续更新 15–90% 下载段，并在浮层、列表和检查器显示已下载/总大小与真实页数。前端生产构建、21 项针对性 pytest 和相关 Playwright 返回/批量重试/Tag/任务进度回归通过。
- 自适应整行分页与单密码访问认证（2026-07-17）：馆藏与发现不再按视口宽度猜列数，而用 `ResizeObserver` 读取实际 CSS grid 轨道后再请求数据；馆藏以 24 为最低目标向上补齐完整行，因此 5 列时请求 25、2 列时请求 24，发现按实测列数请求 4 个完整行，消除因固定 24/错误移动端数量造成的孤项或拉伸。新增无用户名的首次密码创建/后续登录门禁，所有正式路由、阅读器和 `/demo` 都在认证完成前不挂载；除健康检查与认证引导外的 `/api` 统一受保护。密码允许任意非空内容且不限制字符组合，仅保存带随机盐的 `scrypt` verifier；设置“访问与阅读”支持校验当前密码后修改，成功时撤销全部旧会话并为当前浏览器签发替代会话。浏览器使用 90 天 HttpOnly + SameSite=Strict cookie，数据库只存会话令牌哈希与到期时间。认证 4 项专项 pytest、前端生产构建及真实 Uvicorn + Playwright 桌面/390px 流程通过：单字符首次设密、密码修改、Cookie 轮换、其他设备 401、旧密码拒绝、新密码登录均已验证；完整 pytest 在当前环境的裸 FastAPI `TestClient`/anyio 门户处挂起，因此未误记为全量通过。
- 发现、移动端与容器路径闭环（2026-07-16，取代下方旧绝对路径恢复策略）：热门作品重构为桌面 5 张纵向海报的一行编辑架，标题和指标位于封面下方；移动端为 01–05 五封面同屏列且无横向滚动，快捷导入收进独立紧凑栏。热门、详情 hero 与阅读器信息槽统一使用 `AmbientCover`：前景原图绝对约束在框内并始终 `contain`，同源模糊暗化副本仅填充比例空隙，不再用裁剪主图消除留白。移动端馆藏/发现作品卡恢复真实 Tag 且文字双轴居中；馆藏卡 Tag 栏严格只显示 `type=tag` 的内容词，移动端固定两列三行展示五个重点词与余量，作者/社团/语言不再重复；语言选择忽略 `translated` 标记并优先显示同时存在的具体语言，语言筛选项同样排除该标记。Tag + 语言 + 类型组合查询保留真实 namespace，例如 `artist:"..." language:... category:manga|doujinshi`；详情 Tag 的装饰箭头脱离排版流，移动端文字中心实测偏差不超过 1px。`work_files.path` / `works.cover_path` 不再写宿主或容器绝对路径，而持久化 `library/...` / `covers/...` 并按当前数据根解析，消除 `/opt/nhentai/.local-data` 与 `/data` 启动顺序造成的“缺失源”；现有 31 个源与 31 个封面已迁移，文件概览为缺失源 0、缺失封面 0、孤立 0。Compose 增加本地 `build: .`，`docker compose up -d --build` 会实际包含当前改动。本轮生产构建及筛选服务 17 项测试通过；真实浏览器首轮 6 项中 5 项通过并捕获前景固有尺寸导致的隐性裁剪，修正后构建通过，但受会话浏览器额度限制尚待复跑该 6 项。
- 容器数据恢复与可见首屏优化（2026-07-16）：确认旧本地下载的 23 个 CBZ（约 316MB）与 23 个封面早已位于 Compose 挂载的根 `.local-data/`，无需重复复制；将数据库受管路径恢复为 `/data/library` 与 `/data/covers` 后，文件概览稳定为缺失源 0、缺失封面 0、孤立 0。进一步定位到 pytest 收集阶段会在未设置 `NH_ARCHIVE_DATA_DIR` 时加载真实根数据库并把容器路径改回宿主路径，新增 `apps/api/tests/conftest.py` 以 stdlib 临时目录隔离整套测试启动；完整 `222 passed` 后生产数据库仍保持 `/data/...`，封面接口为 200。前端将全站真实指标改为互相分离的浅纸面信息块，压缩治理/词典/任务/导出/文件/设置等操作型页面标题区，并把 390px 馆藏六项摘要从三行收为两行，使文件清单和馆藏操作在首屏明显前移。新镜像已在 `:4349` 重建运行；10 个正式入口的 20 个桌面/移动状态与 10 条核心交互均为零横向溢出、零未标注/过小控件、零 console/page/request/4xx/5xx。
- 全面产品审计与性能复测（2026-07-16）：使用隔离数据和用户授权的 Playwright Chromium 对工作台、我的库、发现、治理、词典、任务、导出、文件、设置、历史共 10 个正式入口做 1440×1000 / 390×844 双视口审计，并实际走通馆藏检索/视图/详情、发现到作品页、本地阅读器两类面板、设置章节、文件详情、治理选择、任务检查器、导出多选、词典检索和移动导航。最终 20 个路由状态与 10 条核心交互均为单一 `main`、零未标注/过小可见控件、零横向溢出、零 console/page error、零失败请求和 4xx/5xx。修复 Docker `/data` 与宿主数据目录切换后受管路径失效、上游重复图片扩展名、远端详情优先请求不稳定封面、四处嵌套 `main`、卡片一次暴露 22 个标签以及桌面文件选中后详情落在首屏下方的问题。后端 15 个只读端点各 80 次顺序基线加 4 个热点 8 并发复测后，只改造被证实最慢的词典候选关联：真实 5313 标签库 p50 `56.9ms → 11.3ms`、p95 `61.2ms → 12.4ms`；55313 标签隔离扩容库普通首屏 p95 112ms、已配置筛选 34ms、关键词扫描 69ms。完整后端 `222 passed`（仅重复 ZIP member 预期 warning），前端生产构建与 `git diff --check` 通过。
- Docker / Compose 发布基线（2026-07-16）：新增单一多阶段镜像，Node 只参与 Web 构建，运行层由 FastAPI 同源提供静态页面与 `/api`；构建上下文排除 `.local-data`、依赖缓存、测试产物和凭据。`compose.yaml` 固定映射 `4349:8000`，将宿主 `./.local-data` 直接挂载到 `/data`：SQLite 持久化 API Key 与应用配置，`library/` 同时作为远端下载落盘目录和本地 CBZ 导入扫描目录。入口进程按挂载目录所有者降权运行，并保留只读根文件系统、临时 `/tmp`、无新增权限、最小 capability 与健康检查。
- 应用结构与远端元数据刷新（2026-07-16）：仓库从练手式 `frontend/` / `backend/` 顶层拆分改为 `apps/web/` 与 `apps/api/`，真实运行数据迁到根 `.local-data/`；启动会兼容迁移旧数据目录并重写仍指向旧目录的受管文件、封面和导出路径。我的库批量托盘新增“拉取远端元数据”：按已有 gallery ID、ComicInfo `Web`、人工指定 ID、标题模糊搜索的顺序只读预览；模糊结果必须达到 92% 置信度、领先第二候选 7 个百分点，并满足页数一致（标题达到 97% 时可豁免），否则强制人工指定 ID 后重新预览。应用阶段会重新搜索并由后端独立计算候选排名，且绕过陈旧详情缓存，刷新远端标题、media 标识与标签并删除失效远端标签，同时保留本地导入来源、CBZ、页数和所有人工元数据决定；单部失败不阻断整批。设置数据页“馆藏规模”改为透明纸面，移除突兀渐变。172 项非 TestClient 后端回归、根生产构建、开发环境检查和 `git diff --check` 通过；Playwright Chromium 在 1440×1000 与 390×844 验证透明背景、低置信度阻断、指定 ID 后解锁、零横向溢出/控制台错误/真实写请求。
- 全站数据摘要视觉收口（2026-07-16）：针对用户指出的“只读统计伪装成表格”完成同类根因扫描，新增共享 `FolioMetricGrid`，将工作台、我的库、阅读历史、词典、任务、导出、文件以及设置连接/运行态/磁盘共 10 类摘要统一为有间距、带语义状态色和细节层级的档案指标条；指标使用独立浅纸面、无阴影、无悬浮反馈，以留白、细线、宋体层级和朱红点题融入 Folio 视觉系统。设置“来源分布”改为真实比例条，作品详情 facts、词典影响预览与批量导入摘要也去除连体单元格。设置章节切换会回到章节起点，避免移动端沿用上一章滚动位置。Playwright Chromium 使用真实本地数据在 1440×1000 与 390×844 复验，所有目标组件和页面 `scrollWidth === clientWidth`，零 console/page error；`npm run build` 与 `git diff --check` 通过。
- 成熟度与性能审计（2026-07-15）：在不改技术栈、不加依赖的前提下完成后端数据边界、高频查询、任务恢复与前端缓存一致性收口。SQLite 启用 WAL、5 秒 busy timeout、NORMAL synchronous，并补齐文件、标签、历史、任务/日志外键与排序索引；任务列表、发现入库态、文件源文件/标签改为批量查询，导出 queue/summary 改为一次聚合查询并仅在字段缺失时读取 CBZ 元数据。真实 23 部/967 页本地库复测中，工作台约 `126ms → 31ms`、导出摘要 `91ms → 7ms`，完整导出队列约 13ms、文件清单约 10ms、任务列表约 5ms。启动时会把进程所有的 queued/running/cancelling 任务恢复为可解释终态并保留 paused；重复远端导入复用活动任务，已入库请求幂等完成，失败下载清理 partial tmp。归档复制、封面与缩略图写入改为唯一临时文件后原子替换，重导入清除旧缩略图，索引页面时不再按页重复打开 ZIP；首次复制失败会回滚占位作品，避免后续误判为已入库。远端 JSON/网络错误、损坏任务 payload、异常 CBZ 元数据与越界导出产物路径均有明确降级。前端 TaskDock 轮询等待上次请求完成并持续展示 paused/cancelling，discover/detail/tag 会在导入完成、删除、词典/治理变更后失效本地缓存。筛选条和定制下拉不再声明未实现的 tab/listbox 模型，改用原生按钮组与 `aria-pressed`；异步错误/成功消息补齐 alert/status，选择下拉项后焦点回到触发器。后端 `212 passed`（仅保留重复 ZIP member 的预期 warning），前端生产构建通过，入口包 `281.93 kB / gzip 91.79 kB`。
- 产品化审计浏览器验收（2026-07-16）：经用户授权使用 Playwright Chromium，以 1440×1000 与 390×844 两档检查 `/demo`、工作台、库、发现、治理、词典、任务、导出、文件和设置共 20 个页面状态，并完成发现标签范围、文件定制下拉、任务/导出状态筛选、设置机翻控件和移动导航 6 条交互。真实发现结果另等待卡片落稳后复验；所有页面均无框架错误层、文档横向溢出、越界 fixed 元素、未命名可见按钮、console/page error 或失败响应，减少动态效果模式下无长时运行动画。慢速 `/api/jobs` 探针发现并修复 React StrictMode 探索挂载造成的 TaskDock 双请求：首次轮询现在以可清理的零延时定时器启动，最大并发稳定为 1，隐藏期间停轮询、恢复可见后立即继续；新增 `apps/web/e2e/taskdock.spec.ts` 回归并通过。
- 单命令开发启动：根目录新增 `npm run dev`，由无第三方依赖的 `scripts/dev.py` 同时启动 FastAPI `:8001` 与 Vite `:5173`，统一设置代理目标，并在任一端退出、`Ctrl+C` 或 `SIGTERM` 时清理两个进程组；`--check` 会在不启动服务时检查 `.venv`、npm 与前端依赖。临时端口实测后端健康接口、Vite 页面、Vite→FastAPI `/api` 代理均通过，退出后无残留监听进程；README 中旧 `:8000` 说明已修正。
- 整体架构与目录收口：后端将 793 行 `main.py` 拆为小型应用工厂、`container.py` composition root、`api/schemas.py` 请求边界及按 discover/dictionary/library/governance/exports/files/works/jobs/settings/system 划分的原生 `APIRouter`；既有 `/api` 路径和业务服务语义保持不变，API 测试改为替换统一服务注册表。前端把跨功能复用的分页、标签滚动、作品书架移入 `folio/ui/`，字节/作品标题格式化与任务展示规则移入 `lib/`，并删除重复格式化实现及 feature-to-feature 工具依赖。后端 196 项测试与前端生产构建通过。
- 文档与设计资产收口：当前视觉真相源统一为 `components/folio/`、`/demo` 与正式路由 feature-local CSS；删除已完成阶段的 34 份 spec/plan/handoff、两份旧长篇设计文档、九张静态设计图和一份临时 QA 记录，核心导航集中在 `docs/AGENT_MAP.md`、`PROJECT_MAP.md`、`PROJECT_STATUS.md` 与 `DEVELOPMENT_RULES.md`。
- 治理页显式审核闭环：`已核对` 不再由“系统未发现问题”冒充。新增 append-only `governance_reviews`，人工确认会记录当前字段、词典、文件状态的快照指纹、时间与可选备注；后续任一相关状态变化会自动转为“内容变化·需重审”，仍有系统提示时必须用备注说明保留/延期原因。队列明确拆为待核对/元数据/词典/文件/已核对/全部并逐项解释范围；元数据自动检查仅负责标题与语言，词典区区分已映射、待复核、冲突、内容词未映射与专名保留原名，文件区区分源 CBZ、封面和 ComicInfo。中文处理改为标题/副标题/简介字段选择 → 原文/建议对照 → 逐项或全部采纳 → 人工保存，作者/社团/标签仍走词典。新增内联未映射词条编辑与待复核译名确认。196 项后端测试、生产构建及 1440×1000/390×844 真实数据浏览器回归通过，零页面横向溢出或控制台错误。
- 最终收尾审计（当轮记录）：按共享壳、九个主模块、历史、作品详情与两类阅读器逐项完成设计/交互/响应式审查。右上角重复的隐私模式按钮从 demo 与正式壳移除，顶栏重新平衡；高密度功能页可见文字统一不低于 12px，搜索、定制下拉、文本域与热门封面补齐可访问名称，治理标签触达尺寸加固。任务中心轮询改为前一次请求完成后再安排下一次，避免慢请求重叠；作品文件删除改为磁盘操作成功后才级联移除数据库元数据，失败时保留作品记录并返回可重试错误。正式桌面 12 条、移动端 11 条核心交互全部通过，中键标签搜索验证原页不跳转且新标签页保留完整搜索条件；十个正式路由在桌面/移动/减少动态效果三种环境中无未命名控件、重复 ID、横向页面溢出或控制台错误。该轮 `npm run build` 通过，后端当时 186 项测试通过（仅保留重复 ZIP member 用例的预期 warning）。
- 正式前端重构 · 标签、阅读器与横向交互收口：本地 `GET /api/works/{id}` 统一走 `LibraryService.work()`，阅读器作品信息恢复真实作者/社团、原作/角色、内容、分类/语言分组，同时保留作品展示入口；页码总览在 34 页实测下不再产生横向溢出。作品详情 lightbox 按当前页长宽比收敛舞台宽度，固定五项相关作品在桌面保持同一行、移动端为五条紧凑卡。全站正式 tag 表面统一为真实搜索锚点，支持鼠标中键/修饰键新标签页打开；发现标签选择器默认只显示内容标签，作者等元信息独立分区。库与工作台共用书架加入按压拖动和误触阈值。文件清单补结构化 `tag_items` 以保持同一搜索能力。以上用真实 34 页/16 标签本地作品与真实五项相关数据完成桌面/390px Playwright 验收，零横向溢出、console warning/error。
- 正式前端重构 · 本轮交互收口：连续阅读改为观察真实滚动容器中线，长页滚动会同步页码与底部进度，连续模式隐藏方向切换；作品信息移除重复设置并可返回真实作品展示。作品 lightbox 的图片被硬约束在媒体舞台内。发现页只保留响应式网格，已选真实标签置顶并可一键清空，移动端标签独占一行。设置保存后立即同步封面模糊运行态，不再刷新。文件行无需进入批量模式即可勾选，桌面详情同屏、移动端为底部操作抽屉，并集中阅读/作品/治理/导出/复制路径/删除预览。上述链路已分别在 1440/1280/1180/1024/390/320px 用真实本地数据与安全拦截写请求验收，无横向溢出或 console warning/error。
- 正式前端重构 · 性能与可读性收口：`App.tsx` 现按正式路由拆分工作台、库、历史、发现、详情、治理、词典、任务、导出、文件、设置与两类阅读器，Folio 壳保持常驻，阅读器仍直接渲染；新增分别适配纸面与沉浸视口的无假数据加载态，并支持 reduced-motion。生产入口 JS 从约 538 kB 降至 280.92 kB（gzip 91.49 kB），页面 JS 为 5.75–30.94 kB、页面 CSS 为 4.84–25.98 kB，Vite 大包警告自然消失，未调高阈值。导出/任务/词典/治理/文件的 9–10px 用户文字统一提升到至少 11px。正式 13 路由在 1440/1024/390/320 四视口完成 52 项只读回归，共 448 次 API 请求，仅 GET 与导出只读预览 POST，零意外写入、旧壳节点、横向溢出、console warning/error；五个高密度模块另完成四视口交互回归，任务刷新/整行选择/日志、导出筛选与批选、词典预览、治理差异与批量预览、文件筛选与删除/扫描预览均通过。`/demo` 45 项、14 个设置帧与 4 次雷达时序复测全绿。
- 正式前端重构 · 旧壳收口：按 JSX 所有权审计清除 `app.css` 中旧 topbar/nav/page/card/drawer/preview-modal、默认 pager/tag scroller、TaskDock 与 reader 残留，文件从 1130 行收敛为 73 行基础层，构建 CSS 由 314.41 kB 降至 305.23 kB。`IconPager`/`TagScroller` 改为调用方必须显式提供 feature class，避免无主默认样式；文件详情封面统一使用 Folio 隐私模糊。TaskDock 独立为 Folio 任务动态浮层：标签页隐藏时停轮询、请求具备最新响应保护、原生 progress 改为 ARIA 自绘进度、重试复用任务中心能力边界并有 busy/error 状态，移动端避让固定操作栏。清理后 `/demo` 5 视口 × 9 模块共 45 项、正式 13 路由 × 桌面/390px 共 26 项回归通过；正式烟测 229 次 API 请求只有 GET 与导出只读预览，零意外 mutation、溢出、console warning/error。
- 正式前端重构 · 阅读器：`#reader/{workId}` 与 `#reader/remote/{galleryId}` 使用沉浸式固定视口；连续模式观察真实 `.reader-viewport` 中线，长页滚动会同步页码和底部进度，方向切换仅在单页模式出现。作品信息抽屉移除重复阅读设置并新增真实作品展示入口。实测本地 34 页从第 1 页滚到第 5 页时填充同步到 12.12%，进度 PATCH 被拦截且未写库。
- 正式前端重构 · 作品详情与阅读历史：`#gallery/{id}` 已拆为 gallery model/state、固定封面 hero、整宽标签、页面预览、焦点归还 lightbox 与相关作品；lightbox 图片被绝对约束在媒体区，固有长宽比不会再撑出舞台，1440×1000 与 390×844 均验证完整 `contain`。`#history` 保持真实日期桶时间线并复用 library Folio 上下文。
- 正式前端重构 · 设置：`#settings` 是六章横向工作区，保存栏固定、控件全部使用 Folio 外观。`useSettingsState` 在读取或保存后会同步 `ArchiveApp` 的隐私与封面模糊运行态；拦截 PATCH 验证从设置直接切到我的库只有一次文档加载，封面立即从模糊变为清晰，不再依赖刷新。
- 正式前端重构 · 文件管理：`#files` 每行始终提供独立勾选与整行聚焦，不再要求进入批量模式；桌面/平板把详情与清单同高并列，900px 以下点行打开有边界、可关闭的底部操作抽屉。详情在元数据前提供阅读、作品展示、治理、导出、复制受管路径和删除影响预览；真实 23 项文件在 1440/1024/390/320 四视口通过，零破坏性请求。
- 正式前端重构 · 导出中心：`#export` 已直接迁移为 Folio 的真实队列摘要、搜索/状态索引、批量选择、作品清单和 CBZ 配方检查器；保留“浏览器下载、不写服务器目录、不保留导出历史”的既有语义，单项 CBZ、阈值内同步 ZIP、超阈值真实 `bulk_export` 任务分流均未改。队列加载与配方预览增加最新响应保护，输出名/选项预览做 160ms 防抖，避免逐键请求和旧响应覆盖；三个选项保留语义 checkbox 但完全隐藏原生外观，作品行改为语义按钮。删除旧 `.export-*` 全局规则，新增 `ExportPage.css`。Playwright 使用真实 23 项队列通过 1440×1000、1024×900、390×844、320×568：真实摘要、状态筛选、ComicInfo 只读预览联动、批量选择/全选/清空、移动单栏、可见文字不小于 11px、零原生 select/progress、零溢出、零控制台 warning/error；验收没有触发下载或创建批量任务，Vite 构建通过。
- 正式前端重构 · 任务中心：`#tasks` 已直接迁移为 Folio 的真实指标、状态索引、搜索/刷新、语义化任务列表和右侧运行检查器；桌面为列表—检查器双栏，900px 以下下沉为单栏，手机端任务行重排为完整卡片。原生 `<progress>` 改为保留 ARIA 的自绘进度，任务行从含嵌套按钮的 `role=button` 容器改为独立主按钮＋操作区；运行、等待、失败、完成和今日吞吐均来自真实 `/api/jobs`。轮询在页面隐藏时暂停，任务/日志请求增加最新响应保护；单条删除补不可逆确认，已有清空确认和暂停/恢复/取消/重试边界不变。删除全部旧 `.tasks-*` 全局规则，新增 `TasksPage.css`。Playwright 用真实 16 条本地任务通过 1440×1000、1024×900、390×844、320×568：真实计数、状态切换、任务 ID 搜索、焦点/日志检查器、自绘进度、移动卡片、可见文字不小于 11px、零原生 progress/select、零溢出、零控制台 warning/error；整个验收没有发送任务写请求，Vite 构建通过。
- 正式前端重构 · 词典：`#dictionary` 已直接迁移为 Folio 结构，状态与 API 编排抽到 `useDictionaryState`，页面拆为真实摘要、候选池、术语编辑器、固定命令栏、证据预览和批量导入弹窗。所有类型/状态/页大小控件改用自定义 `FolioSelect`；输入焦点只改变字段边框/底线，不再改变标题文字；命令栏固定在视口底部，320/390px 仍保留预览、写入、忽略、复核、删除。候选与证据请求增加最新响应保护，编辑会立即使旧预览失效，未完成只读预览前禁止写入；机器翻译仍只填编辑器，批量建议仍只生成待人工审核项，删除保留二次确认。移除约 1100 行旧全局词典 CSS、孤立 `FilterMenu` 和其样式。Playwright 用真实本地数据通过 1440×1000、1024×900、390×844、320×568：真实摘要/候选、定制下拉、选择/证据、输入标题焦点颜色、固定命令栏、弹窗 Esc/焦点归还、`preview-apply writes:false`、编辑后预览失效、零原生 select、零溢出、零控制台 warning/error；`/demo` 45 项回归全绿，Vite 构建通过。
- 正式前端重构 · 治理：`#governance` 直接迁移为 Folio 三栏工作台，左栏是真实待编辑队列，中栏保留单部字段/标签治理与批量预览/应用，右栏显示真实来源、文件、词典状态与后端建议；手机端队列改为横向轨道、来源摘要下沉。新增 `GovernancePage.css`、`GovernanceEditor.css` 与 `GovernanceSourceRail`，全部旧 `.governance-*` / `.metadata-*` / bulk 全局规则已删除。保存/ComicInfo 回写操作栏固定在视口底部，不再随内容长短漂移；原生 checkbox 仅保留语义并完全隐藏外观，差异筛选改为自定义 `aria-pressed` 控件。顺手修复重新读取与单 tag 词典确认的未捕获 Promise，并为词典确认增加真实 busy 状态；不可逆单部/批量回写确认未改。Playwright 用真实本地数据通过 1440×1000、1024×900、390×844、320×568：选择切换、差异筛选、未保存编辑回滚、自定义回写开关、批量双选与只读预览、固定操作栏、移动横向队列、零溢出、零控制台 warning/error；Vite 构建通过。
- 正式前端重构 · 发现：`#discover` 保留真实 feed/popular/random/import API，结果收敛为唯一响应式网格，移除列表模式与对应持久化状态。多标签候选将已选项置顶并提供独立清空动作；700px 以下已选标签独占一行。真实词典候选在 1440/390/320 三档通过双标签查询、置顶、清空、几何不重叠和零横向溢出。
- 正式前端重构 · 我的库：`#library` 不再给旧 DOM 套 Folio 外壳，改为 `LibraryPage` 直接组合真实摘要、搜索/自定义下拉、多标签筛选、书架、卡墙/列表、批处理、分页与检查器；数据编排抽到 `useLibraryState`，保留现有 API 并补齐搜索/概览请求失效边界。卡片移除嵌套交互元素，原生进度外观改为语义化自定义进度，移动详情为不透明底纸抽屉。删除 `app.css` 中被替代的旧 `.library-*`、inspector 与 batch 规则，构建 CSS 从 248.42 kB 降至 239.59 kB。Playwright 使用实时本地数据通过 1440×1000、1024×900、390×844、320×568：真实摘要/结果数量、Gallery ID 搜索、阅读状态筛选、标签多选、网格/列表、详情开关、批量选择、零横向溢出、零控制台 warning/error；`/demo` 5 视口 × 9 模块共 45 项回归继续全绿。
- 正式前端重构基线：将 `/demo` 的可复用视觉能力提炼为生产中立的 `components/folio/`（配置、全屏外壳、导航、九个语义场景/背景、共享控件、十层 CSS），依赖严格单向为 `demo -> folio`、`formal feature -> folio`，正式页面禁止导入 demo 内容或用覆盖 CSS 给旧 DOM 套皮。`#workbench` 已作为首个模块直接重写 JSX 与 feature-local CSS，保留 `useWorkbenchState` 和真实 `GET /api/workbench/overview` 数据流，删除被替代的旧 `.workbench-*` 与书架样式。`/demo` 完成 5 个视口 × 9 个模块共 45 项回归（含设置场景采样与发现雷达命中），工作台完成 1440×1000 / 390×844 的真实 API 数值、刷新、无旧 DOM、无横向溢出和控制台检查。
- 前端重构准备：`/demo` 从 1600 行 TSX + 4200 行 CSS 单体拆为配置、共享外壳、九个页面模块、九个语义场景、共享控件与十层有序 CSS；`docs/AGENT_MAP.md` 记录 demo→正式组件→真实 API 的定位关系。拆分前后 Vite 产物哈希一致，未改变视觉与交互。
- 发现 / 导入页筛选工作台 polish:移除 discover 顶部 `mode-tabs` 行,页面固定为真实 feed;随机改为图标按钮并放到 `.view-actions` 查询按钮左侧。标签筛选支持中文译名/别名输入触发 autocomplete,候选按真实 remote tag id 去重,已选标签只在绝对定位弹层内显示,触发器用 `首个 +N` 摘要,不再撑高工具栏。语言筛选走远端语言查询语义(`language:japanese` 等),空查询浏览不再伪造 `pages:>0`,避免“全部”被 search 兜底污染;作品卡语言显示走词典 `display`,并跳过 `translated` 泛标签。结果分页改为按可见列数动态取 4 行,卡片墙保持居中 flex 排列。
- 最终闭环收尾:治理批量新增「确认现有词典译名」动作,复用 `POST /api/governance/bulk/preview|apply`,只确认所选作品关联的 `review/conflict` 且未忽略/未锁定/有中文名的词典项,同一词条多作品引用时只更新一次,跳过项按真实原因回显。前端治理批量条新增对应复选项,预览/结果显示确认与跳过词条数。长时批量导出已闭环为 `ExportJobService` + `bulk_export` job:超过 `EXPORT_SYNC_THRESHOLD=5` 的选择进入任务中心后台打包,产物写入临时 export-jobs 目录,24h 过期、下载即删;导出页与库批量托盘共用该阈值和 `/api/exports/bulk-jobs`。验证覆盖治理批量确认、后台导出任务 API/下载/过期/重试/取消。
- 机翻接入 + 设置页早期分区（历史，旧左栏已由当前 Folio 横向章节替代）:新增 `TranslationService`(provider 适配器,stdlib `urllib` 无新依赖):`google_free`(谷歌免费翻译,无需 key)与 `deepl`(REST,key 存 `mt.deepl_api_key`),配置存 `settings` 表 `mt.*`,`public_config()` 不回显 key,`verify()` 跑样例翻译并记 `mt.last_verify`。词典接入:`DictionaryService.translate_text()`(单条按需)与 `generate_suggestions()`(批量译未配置远端 tag→可复核 `status='suggested'` 行,source `machine`;绝不覆盖人工/锁定项,确认前绝不关联 `work_tags`);新增 `POST /api/dictionary/translate`、`/suggest-batch`、`/api/settings/translation/verify`;`SettingsService` 暴露 `machine_translation` 配置块并处理 patch。前端当时拆分为 `useSettingsState` 与连接/机翻/隐私阅读/存储分区组件，并接入 provider、DeepL key/套餐与测试；当前结构与验收以本节首条“正式前端重构 · 设置”为准。词典编辑器「机器建议」改为真实「机翻填充中文名」按钮,候选区新增「批量机翻未配置项」按钮。验证:`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 全绿(99 passed,新增 `test_translation.py` 9 项,覆盖 provider 解析/选择/无 key 报错/不泄漏 key/verify 与词典单条/批量/不覆盖人工/无服务报错);`cd apps/web && npm run build` 通过;静态扫描 touched 文件无假数据、机器建议「未接入」占位已移除。沙箱无出网,真实机翻需用户在设置填 key 后自测。
- 工作台聚合面板:`#workbench` 从占位边界页替换为真实每日仪表盘,通过 `GET /api/workbench/overview` 聚合 library/governance/jobs/files/exports 的真实摘要数据,无健康分、无虚假聚合数。页面由四部分构成:馆藏作品/待治理/失败任务/缺失源文件四格真实指标条(`WorkbenchMetricStrip`)、治理/任务/文件/导出四张跳转模块卡(`WorkbenchModuleCards`,分别跳至 `#governance`/`#tasks`/`#files`/`#export`)、复用 `ContinueReadingRow` 渲染的继续阅读书架、以及复用同组件的最近导入书架;两条书架均在无真实数据时自动折叠,`blurCovers` 隐私开关贯穿全页。新增 `WorkbenchService`(只读聚合器,从现有 `LibraryService`/`GovernanceService`/`JobService`/`FileService`/`ExportService` 取数,绝不调 NH API)与前端 `components/workbench/`(`WorkbenchPage`、`useWorkbenchState`、`WorkbenchMetricStrip`、`WorkbenchModuleCards`、`workbenchHelpers`)。新增 `apps/api/tests/test_workbench_service.py`(3 项)与 `apps/api/tests/test_workbench_api.py`(1 项)。验证:`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 全绿(90 passed);`cd apps/web && npm run build` 通过。
- Phase 7 任务中心: `#tasks` 从边界页替换为真实 `TasksPage`,只读取和操作现有 `/api/jobs` 数据,不造假任务。后端新增 `job_logs` 表与真实控制 API:`GET /api/jobs/{id}/logs`、`POST /api/jobs/{id}/pause`、`POST /api/jobs/{id}/resume`、`POST /api/jobs/{id}/cancel`;`JobService` 记录创建/阶段/完成/失败/暂停/恢复/取消/重试日志,并提供 `checkpoint()` 让导入线程在安全阶段边界协作暂停/取消(下载阶段取消会在下个 checkpoint 停止并清理 tmp CBZ)。页面结构为 hero + 5 张真实指标卡(`running/queued/failed/completed` 与今日更新吞吐量)、完整状态 tab(`all/running/paused/queued/failed/completed/cancelled`)、搜索、紧凑任务表、右侧任务详情检查器。失败的 `remote_import` 且带 `gallery_id` 的任务可重试;运行/等待任务可暂停;暂停任务可恢复;运行/等待/暂停任务可取消;日志区显示后端持久日志;复制任务 ID 为真实剪贴板操作。新增 `components/tasks/`(状态 hook、summary strip、列表、检查器、helper 标签/时间格式化),`Job` 前端类型补 `created_at` 与 `paused/cancelled`,新增 `JobLog` 类型;新增 `apps/api/tests/test_job_service.py` 和 `apps/api/tests/test_jobs_api.py` 覆盖状态机、日志、控制路由与 retry payload。验证:`cd apps/web && npm run build` 通过;`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 全绿;静态扫描 touched task files 无假数据命中。
- Phase 6 文件管理:新增 `FileMaintenanceService`(本地文件系统 + SQLite,绝不调 NH API)与 API `GET /api/files/overview`、`GET /api/files/inventory`、`POST /api/files/preview-delete`、`POST /api/files/delete`。文件清单统一展示三类条目:作品(源 CBZ + 封面聚合为一个单元,状态 ok/missing_source/missing_cover,体积不符标 size_mismatch)、孤立文件(library/covers 下无 DB 引用)、临时残留(tmp/exports)。`work_files.path`/`works.cover_path` 的绝对/相对混用统一归一化为 `.resolve()` 绝对路径后再判定。删除是唯一动盘操作:删除作品经 SQLite `ON DELETE CASCADE` 级联清空 works/work_files/work_pages/work_tags/work_metadata/reader_progress/reading_history 并删源 CBZ + 封面;孤立/临时仅 unlink;受管目录外路径一律拒绝(穿越防护);CBZ 字节从不被修改,只整体删除。删除前强制 preview(展开级联影响、可回收字节、阅读进度/治理警告)。前端 `#files` 边界页替换为真实 `FilesPage`,采用 hairline 细数字指标条(`.files-summary`,沿用 dict-metric 语言)、多列文件表(文件名/路径/类型/大小/状态,可多选+选中高亮+聚焦左条)、底部封面详情面板(`FileDetailPanel`,真实封面缩略+4 格统计,封面遵循 `blurCovers` 隐私模糊)、右栏 `FileHealthRail`(健康度=真实 overview;重复检测=诚实「未接入」边界,不显示假重复数;清理工具=预览→二次确认→执行→刷新,删除结果回显成功/错误)。验证:`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 全绿(新增 test_file_service.py 12 项 + test_files_api.py 3 项);`cd apps/web && npm run build` 通过;静态扫描无假数据;临时数据目录手验 overview/preview/级联删除符合真实状态;Playwright(bundled chromium)在 `#files` 桌面 1440 与移动 390 截图核对真实 6 作品数据下的指标条/文件表/封面详情/健康度侧栏渲染正常、无控制台报错(仅 favicon 404)。
- 导出中心下载选项与检查器重构:后端 `ExportService.preview/build_cbz/build_bundle` 新增 `write_comicinfo`、`keep_json`、`compress` 选项，预览会反映将写入/保留内容，单文件下载和批量 `.zip` 下载都会传递同一组选项；新增测试覆盖不写 ComicInfo、去除 JSON、无压缩打包和预览选项回显。前端导出页从 summary/table/preset/preview 旧分区调整为 `ExportToolbar` + `ExportWorkList` + `ExportInspector`：支持搜索、状态筛选、点击作品聚焦/选择、检查器内改输出名、切换 ComicInfo/JSON/压缩、刷新预览、下载所选或仅下载当前作品；删除旧 `ExportSummary`、`ExportQueueTable`、`ExportPresetBar`、`ExportPreviewPanel`。验证：`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 52 passed；`cd apps/web && npm run build` passed；Playwright Chromium QA on `http://127.0.0.1:5174/#export` desktop 1440x1000 and mobile 390x844 verified page identity, nonblank render, no framework overlay, no console warnings/errors, search empty-state interaction, and screenshots saved under `/tmp/nh-export-*.png`.
- 导出语义改造（导出 = 下载给用户，而非写到服务器目录）:按用户预期重定向了导出功能。后端新增 `ExportService.build_cbz()`（在内存中打包带 `ComicInfo.xml` 的单个 CBZ 字节）与 `build_bundle()`（多选打包为一个 `.zip`），新增下载路由 `GET /api/works/{id}/export/download` 与 `POST /api/exports/download`（均以 `Content-Disposition: attachment` 流式返回）。删除了服务器侧写盘逻辑（`generate`/`generate_many`/`history`/输出目录解析）与 `export_records` 表及其迁移；导出不再保留任何记录。前端 `api.downloadExport` / `downloadExportBundle` 以 blob 拉取并触发浏览器下载；`useExportState` 的 `downloadSelected`（单选下单文件 / 多选下 `.zip`）与 `downloadOne` 取代了旧的批量生成；移除了输出目录卡片/编辑、`导出完成后打开输出目录` 复选框与“最近导出记录”区块（删 `ExportHistory.tsx`）；表头按钮 `移除选中`→`移除当前`。`storage.export_dir` 设置项保留但已不再被导出流程使用。后端 `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 50 passed；`cd apps/web && npm run build` 零错误。原始 CBZ 始终只读、不被修改。
- 导出中心早期 Phase 5 实现（历史）:曾实现服务器输出目录、`export_records`、生成历史、导出预设条和表格式队列；这些能力已被当前“浏览器下载、不写服务器目录、不保留记录”的导出语义改造替代。保留的核心是本地源 CBZ 只读、治理元数据驱动 ComicInfo、`#export` / `#export/{workId}` 真实路由，以及从真实 SQLite/archive 状态计算预览、阻塞与警告。
- 作品详情页 · 氛围横幅重构(`GalleryDetailPage`):解决了「不同封面比例 + 不同标签数量导致两列高度参差、翻书布局抖动」的根因。hero 改为一整块固定高度横幅(同图模糊奶油色洗白底 + 恒定尺寸封面卡槽,封面按高度约束不裁剪、不留白);标签移出 hero 改为整宽面板、每组独占一行(内容标签横向铺宽不顶高,少标签组无留白);相关作品改为居中固定宽卡片并展示词典中文内容标签。后端 `discover_service.gallery()` 的相关作品改走 feed 富化路径(`_tags_for_items` + `_with_import_state`)以解析 `tag_ids → tags(含 display)`+入库状态;`GallerySummary.tags` 类型补 `display?`。
- Phase 4 governance center: implemented the first real single-work governance loop. Added `work_metadata` for field-level final metadata decisions, `GovernanceService` for local-only queue/aggregate/apply, and APIs `GET /api/governance/queue`, `GET /api/works/{id}/governance`, `POST /api/works/{id}/governance/apply`. Governance queue reasons are computed from real SQLite/archive state: missing metadata, untagged works, dictionary review/conflict tags, missing ComicInfo, and missing cover. Aggregate reads `works`, `work_files`, `work_tags`, `remote_galleries.payload_json`, `local_tag_dictionary`, and real CBZ `ComicInfo.xml` / JSON members. Frontend now supports `#governance` and `#governance/{workId}`, with queue, work header, metadata diff editor, tag governance board, right quality/actions column, and real navigation from library/reader. No bulk governance, machine translation, export generation, or CBZ write-back in this phase.
- 阶段 4 dictionary/settings:完成动画视觉线剩余范围。词典摘要逐项进场、候选行按筛选/翻页结果集 `key` 重播、编辑器按词条 key 淡入切换、应用预览空态/内容态淡入且关联作品逐项进场、批量导入 modal 接入 `Presence`。设置页三栏错峰进场,设置卡片逐项进场,保存/错误 notice keyed 淡入。仅用 `lib/motion` 原语,不改 API/数据逻辑;新增 `.candidate-row-motion`、`.settings-card-motion` 等极小透传类。
- 阶段 3 reader:单页翻页新页轻柔淡入(FadeIn keyed by page)、连续滚动模式页面进入窗口时淡入、打开/切换作品时三栏(章节侧栏/阅读区/详情栏)进场(keyed by sourceKey)。统一用 FadeIn 挂载淡入(规避内部滚动容器的 whileInView 与图片尺寸不一的重叠风险);新增 `.reader-page-cell` 撑满列宽居中。保留方向键/章节跳转/滚动自动翻页/隐私遮罩等全部交互。
- 阶段 2 library:全面动画——主卡片墙逐项进场(结果集 `key` 重播)、「继续阅读/最近添加」两条书架行逐项进场、`WorkInspector` 选中切换淡入(按 work.id keyed)。新增 `.library-card-cell`(grid 等高保护)、`.shelf-cell`(横向轨道防压缩)透传类;保留全部现有视觉/hover/横向滚动。
- motion 打包瘦身:全局改用 `LazyMotion`+`m`+`domAnimation`(strict),JS 由 gzip 115→101 kB;Provider 在 `lib/motion/MotionProvider.tsx`,后续若需 layout/drag 改 `domMax`。
- 阶段 1 discover 卡片墙:接入逐项进场动画(淡入+轻微上移),翻页/筛选/切视图(grid↔list)时按结果集 `key` 重播;完整保留卡片现有 hover 与等高行,新增 `.discover-card-cell` 透传类保护等高。仅改 `DiscoverFeed.tsx` + 一条 CSS。
- 阶段 0 动画基础设施:接入 motion + Tailwind v4(方案 A:关 Preflight、不加前缀、token 映射,现有 `app.css` 零影响),建立 `lib/motion/` 动画原语层与 `components/effects/` 效果接入规范;magicui/react-bits 仅作效果素材,改造进现有设计语言后落地。后续 discover/library/reader/dictionary/settings 各页面动画改造为独立阶段。
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
- Rebuilt settings as a minimal real settings surface.
- Rebuilt discover as a unified real-data feed, with later product decisions:
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
- Discover cards use a cover-first vertical layout, fixed metadata order, and draggable hidden-scrollbar tag rows.
- Discover tag filter uses dictionary-aware autocomplete/display mapping while preserving original remote tag IDs/names for remote queries.
- Discover visual hierarchy was tightened: removed stacked section panels, centered feed cards, custom filter menus, softer import-state chips.
- Task dock no longer stays visible when no running/queued/failed job or job API error exists.
- Added API quota protection after live screenshot QA hit remote rate limits:
  - backend request-key TTL cache for cacheable NH API calls;
  - backend 429 cooldown that stops repeated remote forwarding and can serve stale cached data;
  - frontend discover-session cache and in-flight reuse for feed/popular/detail/tag GET calls.
- Full navigation and every primary/secondary route are backed by real pages; the direct Folio migration is complete, with both immersive reader routes intentionally rendered outside the shared chrome.
- Implemented and refit Phase 2 dictionary foundation:
  - tables: `local_tag_dictionary`, `tag_aliases`, `work_tags`
  - APIs: `/api/dictionary/summary`, `/api/dictionary/candidates`, `/api/dictionary/evidence`, `/api/dictionary/autocomplete`, `/api/dictionary/preview-apply`, `/api/dictionary/apply`, `/api/dictionary/preview-bulk-import`, `/api/dictionary/bulk-import`, `/api/dictionary/{id}/ignore`, `/api/dictionary/{id}/review`, `DELETE /api/dictionary/{id}`
  - `DictionaryService` supports real summary, local creation/editing, alias lookup, cached remote tag candidates, remote tag search through the existing cached client, evidence lookup, apply preview, apply, status changes, delete, bulk import preview/import, and real `work_tags` linking.
  - Bulk import accepts the minimum row shape `原文, 中文名`; type and aliases are optional. Imported rows automatically map to cached remote tags by normalized original text and type when possible.
  - Import flow links imported works to real gallery tags after CBZ ingestion.
  - Discover cards/tag selector render dictionary `display` names when mapped, without using Chinese names as remote API query tokens.
  - The earlier Phase 2 UI structure was superseded by the direct Folio migration recorded at the top of this file.
  - Dictionary UI polish pass (post Phase 3): title area uses the standard clean hero (removed the invented decorative quote/art blocks); summary strip is big-number metric cards with semantic tone colors; candidate pool has color-coded localized type badges, red impact emphasis, and per-status color tones.
  - Dictionary UI second pass (per user feedback on the live page): removed the 置信度 (confidence) editor field — the planned integration is machine translation, not AI scoring, so confidence has no UI meaning (the DB column stays, defaulting to 80, no longer user-editable). Flattened all modules to hairline-bordered, transparent panels (no background-color fill, no shadow) so modules no longer "pop" via background color. Made the three workspace columns equal-height and top-aligned by moving the 新建本地词条 action into the editor header (it was floating above the editor and pushing that column down) and stretching panes. Fixed action buttons wrapping mid-character (white-space: nowrap + flex-wrap so they wrap as whole units). Removed dead `dictionary-hero/quote/stats/grid/column/filter-row/editor-stack/new-term-button` CSS. No data/logic change — still real-only.
  - Dictionary UI third pass (user picked a design via an inline visual mockup: minimal base + Chinese tinted type tags + terracotta selected bar): summary strip is boxless light-weight large numbers, with terracotta only on 未配置 as the focal accent; all inputs/selects/filters are underline-style (零填充·细线), textareas are minimal hairline boxes, focus turns the underline terracotta; candidate type tags are Chinese tinted chips; the selected candidate row uses a terracotta left bar + subtle tint.
  - Dictionary UI fourth pass (layout + polish per live feedback): summary strip is full-width even distribution with vertical hairline dividers (A-style) instead of left-packed; candidate status is color-coded text (B-style: 已配置 green / 待复核 amber / others muted), no dot; candidate table got a slim custom scrollbar; buttons restyled to solid `--surface-solid` fill (not muddy translucency), 8px radius, real hover states, primary = solid terracotta, danger = ghost.
  - Dictionary UI fifth pass established the still-valid product structure: top workspace is `候选术语池 | 术语编辑器`, the candidate table is capped, and bulk import opens in a modal. Its old `.dictionary-*` implementation was replaced by feature-owned `.folio-dictionary-*` structure in the current migration.
  - The merged panel below the workspace remains a single visible split ledger, not tabs: impact metrics + 标签更新对比 / 常见搭配 / 冲突项 / 远端信息 + a full-width related-work row. Current owners are `DictionaryEvidencePanel` and `DictionaryPage.css`.
- Implemented Phase 3 “我的库” enhancement, all data from SQLite only:
  - Added `LibraryService` (`apps/api/app/services/library_service.py`): `work`, `summary`, `search`, `recent_added`, `recent_read`, `continue_reading`, `tag_filters`. It only queries `works`, `reader_progress`, `work_files`, `work_tags`, `local_tag_dictionary`; it never calls the NH API.
  - Added APIs: `/api/library/summary`, `/api/library/search`, `/api/library/recent-added`, `/api/library/recent-read`, `/api/library/continue-reading`, `/api/library/tag-filters`. Kept `/api/works` for compatibility.
  - `search` supports SQL-backed pagination (per_page capped at 100), keyword (title/japanese/pretty/gallery-id/joined tag text), read-state filter (unread/reading/completed), source filter (remote/local), language filter (via `work_tags` language type), multi-tag AND filter (work must carry every selected remote tag), and whitelisted sorts (recent_updated/added/read, title, pages_desc/asc).
  - Rebuilt `LibraryPage` as orchestration plus thin components: `LibrarySummaryStrip`, `LibraryToolbar`, `LibraryTagFilter`, `WorkCard`, `WorkInspector`, `ContinueReadingRow`, `libraryHelpers`. Current Folio migration uses `FolioSelect` plus the shared `IconPager` and `TagScroller`; the old `FilterMenu` has been removed.
  - Summary strip shows only real metrics (总收藏/已读/阅读中/未读/待补标签/占用容量); “待补标签” = works with zero `work_tags`. Phase 4 later adds a dedicated governance page, while the library summary still avoids fabricating aggregate 待治理 counts.
  - Continue-reading and recent-added shelves render only when real rows exist and only when no filter/search is active.
  - Tag filter selector is backed by `/api/library/tag-filters` and shows dictionary Chinese display names; selecting a tag on a card or in the inspector adds it to the filter (AND).
  - Inspector exposes real file size/pages/source/ID/language/progress and routes directly to the local reader, governance workbench, and export center.
  - Empty library and empty filtered result are distinct real empty states; pagination uses the icon pager so large libraries never render every work at once.
  - Removed the orphaned legacy library CSS (`.filter-ribbon`, `.stats`, old `.work-card*`) replaced by the new `.library-*` system; retargeted the shared progress rule to `.library-card`.

- 治理 ComicInfo 回写源 CBZ：新增共享模块 `comicinfo.py`（ComicInfo 字段生成/XML/zip 重封，ExportService 与回写共用，保证导出下载与源回写产出一致）。`GovernanceService.write_back_comicinfo` 把治理后的 ComicInfo 就地原子写进源 CBZ：写同目录 tmp → fsync → `os.replace`，无备份；只换 ComicInfo.xml，页面图像字节不变；回写后重算并更新 `work_files.sha256`/`size_bytes`。API `POST /api/works/{id}/governance/apply` 增 `write_back` 开关（默认关），metadata 写入成功后回写失败不回滚、以 `write_back.error` 回显。前端应用面板加默认关闭的「同时回写源文件」复选框 + 风险提示 + 二次确认。
- 轻量收尾阶段：① 文件管理 `#files` 清单补真实分页翻页器（复用 IconPager，后端 `inventory` 早已支持 page/per_page）；② 新增阅读历史专属页 `#history`：`LibraryService.reading_history` 按 (作品, 日期) 聚合 `reading_history`（当天最近时间/阅读次数/最远页 + 当前总进度），`GET /api/library/reading-history` 分页，前端按「今天/昨天/本周/更早」日期桶分组时间线，点击进本地阅读器，遵守 blurCovers；③ 治理批量：`GovernanceService.bulk_preview/bulk_apply` 对多选作品执行统一动作——批量补全缺失元数据（只填空、绝不覆盖已有值、来源 comicinfo>json>remote）与批量回写 ComicInfo（沿用单作品 opt-in/原子/无备份/哈希同步/失败隔离），API `POST /api/governance/bulk/preview|apply`，治理队列加多选 + 批量条（预览/应用/结果回显 + 回写二次确认）。验证：`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 全绿（128 passed，含 reading_history 4 项 + governance_bulk 5 项）；`cd apps/web && npm run build` 通过。

- 轻量收尾第二轮：① 文件清单 `#files` 加体积排序（后端 `inventory` 新增 `sort` default/size_desc/size_asc，过滤后分页前对整列表排序）+ 补齐 `size_mismatch` 状态筛选（状态匹配改为 `status==e.status or status in e.flags`，使 flag-only 条件可筛）；② 我的库 `#library` 多选 + 批量托盘 `LibraryBatchTray`，只复用现有端点：导出下载合集、批量补全缺失元数据（`governanceBulkApply` fill-missing）、删除所选（`previewFileDelete`→二次确认→`deleteFiles` 级联）；③ 治理元数据机翻：只读 `GovernanceService.translate_metadata`（title/title_japanese/summary，source=auto，绝不写库）产出可复核建议，`POST /api/works/{id}/governance/translate`，前端「机翻填充中文」按钮把建议预填编辑框（source=manual），人工保存才落地；`TranslationService` DeepL 支持 source=auto。验证：`pytest apps/api/tests -q` 全绿（134 passed，新增 file_service 2 项 + governance_translate 4 项）；`npm run build` 通过。

## Not Implemented Yet

- 无已知功能闭环缺口。真实数据桌面/移动视觉 QA 已完成；后续持续做长列表实测、性能/体验 polish，以及用户反馈驱动的小范围增强。

## Next Plan

正式路由迁移、旧壳清理、路由拆包、四视口只读浏览器回归与后端全量测试均已落地。后续只在真实长列表数据出现可测瓶颈时做针对性性能优化，并继续处理用户反馈驱动的小范围 polish；不再重开旧壳融合或无证据的架构改造。

## Risks And Decisions

- Decision: 保留 Python/FastAPI 后端；当前负载以远端 HTTP、SQLite 与 CBZ 磁盘 I/O 为主，换语言不会解决启动流程，单命令启动由根目录 launcher 处理。只有性能剖析确认 Python CPU/内存/分发方式成为实际瓶颈时才评估 Go 等重写方案。
- Decision: 工作台只聚合真实模块摘要,不造健康分、不造假聚合数;隐私开关沿用全局,不在工作台重复。
- Decision: 文件管理是管理库内全部文件,不只异常清理;清单含健康作品,所有行可删。
- Decision: 删除健康作品的源 CBZ = 级联整体移除该作品(works 及全部引用表 + 封面文件)。
- Decision: 删除是文件管理唯一会动盘的操作;CBZ 永不被修改,只能整体删除;受管目录(library/covers/tmp/exports)之外的任何路径一律拒绝(目录穿越防护)。
- Decision: 治理 ComicInfo 回写是唯一受认可的源 CBZ 改写（仅 ComicInfo、原子替换、无备份、显式 opt-in、默认关）；导出仍永不写源（导出=下载给用户）；文件管理删除仍是另一条独立动盘操作。回写后必须同步 `work_files.sha256`/`size_bytes` 以维持去重/体积检测的真实性。
- Decision: 治理批量只做「逐作品执行统一动作、取值各自解析」:批量补全缺失元数据(只填空、绝不覆盖人工/已有非空值,来源映射 comicinfo→comicinfo / remote→remote / json→remote)+ 批量回写 ComicInfo(沿用单作品 opt-in/原子/无备份/哈希同步/失败隔离;单作品失败记录 error 并继续,不回滚已写 metadata)+ 批量确认现有词典译名(仅 review/conflict 且未忽略/未锁定/有中文名;不批量编辑译名/别名)。
- Decision: 阅读历史按 (作品, 日期) 聚合,前端按日期桶(今天/昨天/本周/更早)分组时间线;高频裸事件(每翻页一行)不展示。历史(完整可分页轨迹)与「继续阅读」(仅在读)、「最近阅读」(Top 12 书架)区分。
- Decision: 一次本地阅读器会话只新增一次 `reading_history` 打开记录；进度保存绝不等同于访问。远端阅读器只记录独立的缓存画廊会话，不写本地进度/历史。两类阅读时长都只累计文档可见的前台时间，并以客户端幂等 key + 单调累计秒数抵抗 StrictMode、重复提交和离页重送；远端画廊入库后统计自动归并到对应本地作品。
- Decision: 本地收藏仅使用 `works.favorite`，与远端作品返回的热度指标 `favorites` 含义不同。统计不回填追踪功能上线前不存在的阅读时长，作者/Tag 排行只聚合真实本地馆藏与会话。
- Decision: 文件清单分页为纯前端补翻页器;后端 `FileMaintenanceService.inventory` 早已支持分页。批量导出超过 5 部时接入任务中心,产物为临时 `.zip`:24h 过期、下载即删,不恢复长期导出历史。
- Decision: `work_files.path` / `works.cover_path` 在 SQLite 中只持久化 `library/...` / `covers/...`；`Database` 返回服务层前按当前 data root 解析为绝对路径。旧 `.local-data/...` 与 `/data/...` 绝对值仅在启动迁移时识别，绝不再回写环境绑定路径。
- Decision: API Key settings and discover correctness are higher priority than expanding modules.
- Decision: language/type/sort controls must either call real APIs or be disabled; no inert clickable filters.
- Decision: Latest-like browsing uses `/api/discover/feed`; it switches to search/tagged only when filters require remote search semantics.
- Decision: Popular is a permanent ranked editorial showcase: desktop five-poster shelf, mobile five simultaneous non-scrolling columns, compact import rail/action, full foreground artwork over a same-image ambient layer, and only real remote metrics.
- Decision: Gallery ID is handled by the main keyword input when the query is pure numeric; no separate Gallery ID tab.
- Decision: Type filtering is limited to confirmed UI options `doujinshi` and `manga` until broader remote type semantics are verified.
- Decision: Card details use a modal, not a right-side drawer; no discovery layout space is reserved for details.
- Decision: Combined tag/language/type search preserves every selected remote tag namespace (`artist:"..."`, `tag:"..."`, `parody:"..."`, etc.); single tag without other filters may use `/api/discover/tagged`.
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
- Decision: 全站正式 tag 交互一律保留原生链接语义并由 `tagSearchHref()` 生成搜索地址；普通左键可由当前模块接管为原地筛选，但鼠标中键或修饰键必须能在新标签页打开对应发现搜索。
- Decision: 作品详情 hero 的封面按**固定高度**约束(放进恒定尺寸卡槽),绝不按长宽比框死,也不裁剪;空余由同图模糊底填充。标签等数量不定的内容**不得**与封面同列并排,须移到独立整宽区域,避免两列高度互相参差、翻书布局抖动。
- Risk: tag enrichment calls `/api/v2/tags/ids`; if remote rate limits, cards may show cached/empty tags rather than invented labels.
- Risk: search query syntax should be manually checked against live remote API behavior.

## Verification Record

- 2026-07-15 成熟度审计：`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 为 `212 passed, 1 warning in 5.53s`；warning 仍是重复 ZIP member 保真用例。`cd apps/web && npm run build` 通过且无大包 warning，入口为 `281.90 kB / gzip 91.79 kB`；`git diff --check` 通过。该记录只证明代码、类型、构建与后端行为，外观变化仍须用同视口真实截图单独验收。
- Final closure baseline: `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` passed all 196 tests in 30.21s. The single warning is intentionally produced by `test_reseal_cbz_preserves_duplicate_member_bytes`, which constructs a duplicate `001.png` ZIP member to verify byte preservation; it is not a runtime regression. Frontend production build and `git diff --check` also pass.
- Reader/detail/tag/shelf follow-up: Playwright Chromium used real local work/gallery/file/governance data with neutral intercepted images to verify grouped reader metadata, native middle-click search from reader/gallery/discover/library/files/governance tag surfaces, 34-page index overflow, ratio-constrained lightbox geometry, one-row five-item related layout, content-vs-metadata tag scopes, and press-drag library/workbench shelves at 1440×1000 plus gallery/reader checks at 390×844. Lightbox stage/image widths were 595.63/570.63px, all five desktop related-card tops matched, and the run reported zero console warnings/errors. Production build completed without warnings.
- Legacy-shell cleanup: `/demo` full regression passed 45 route/viewport checks plus 14 settings frames and 4.4s radar timing; formal read-only smoke passed 26 desktop/mobile route checks across all primary, secondary and reader routes. The formal run issued 229 API requests with no mutation beyond the whitelisted read-only export preview, and reported zero overflow, legacy-shell nodes, console warnings or errors.
- Route split/readability closure: 13 formal routes passed 52 checks at 1440×1000, 1024×900, 390×844 and 320×568; 448 API requests contained only GET and the explicitly read-only export preview POST. Lazy Folio/reader fallback timing, five operational-page interaction suites, minimum 11px visible text, no legacy shell, no horizontal overflow and no console warning/error all passed. Production build emits a 280.92 kB entry plus independent 5.75–30.94 kB route chunks with no large-chunk warning.
- Gallery/history/readers migration: gallery at 1440/1024/390px, history at 1440/390px, remote reader at 1440/390px, and local reader at 1024px all passed Playwright Chromium with real API metadata and redacted/intercepted neutral images. Remote reader import was intercepted; local reader QA was deliberately read-only. No unintended backend writes, native select/progress/number controls, horizontal overflow, console warnings, or page errors were observed. `npm run build` and `git diff --check` passed; the former route-splitting warning was resolved by the later route-level split.
- Folio 词典迁移：`cd apps/web && npm run build` 通过；Playwright Chromium 使用真实本地数据完成 4 视口交互/响应式/固定命令栏/只读预览验收；`/demo` 45 项回归、14 个设置场景帧和 4 次 4.4s 雷达动效采样全部通过。先前约 511 kB 的分包警告已由后续统一路由拆包消除。
- `PYTHONPATH=apps/api pytest apps/api/tests -q`: passed, 28 tests (5 new in `test_library_service.py` covering summary, search filters/pagination, read-status, recent/continue shelves, and dictionary-aware tag filters).
- `npm run build`: passed (`tsc -b && vite build`).
- `git diff --check`: passed.
- In-process API smoke (route functions called directly before `httpx` was added): empty library → real zero states; after ingesting one real CBZ and linking real tags → correct summary/sources/language facet, keyword + `tag_ids="7,8"` + language search returns the work with real tags and size, malformed `tag_ids` tokens are ignored, `tag-filters` excludes language type, recent-added returns the real row.
- Static fake-data scan over `library_service.py` and `components/library/` + `lib/api.ts`: no mock/fake/placeholder/random data; only SQL parameter placeholders and the pre-existing dictionary `samples` field matched.
- Earlier Phase 3 browser-QA limitation is superseded by the current Folio migration: bundled Playwright now covers `#library` with real local data at desktop, tablet, mobile, and compact viewports.
- 详情页氛围横幅重构后复测:`PYTHONPATH=apps/api python3 -m pytest apps/api/tests -q` 35 passed;`cd apps/web && npm run build` 通过;`git diff --check` 干净。后端 related 富化为数据路径改动,需用户重启后端 + 硬刷新后在 `#gallery/{id}` 验收(封面/标签/相关卡)。
- Phase 5 export download/options slice: `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q` 52 passed; `cd apps/web && npm run build` passed. Tests cover preview without writes, generated CBZ containing generated `ComicInfo.xml`, real `meta.json` preservation, option-controlled omission of ComicInfo/JSON and stored compression, custom output-name export, missing-source blockers, bundle member-name dedupe, blocked-item bundle skipping, queue ready/blocked/warning summary counts, source CBZ byte preservation, and FastAPI export route success/error mapping through `TestClient`. Playwright Chromium QA on `http://127.0.0.1:5174/#export` verified desktop/mobile render, search empty-state interaction, no framework overlay, no console warnings/errors, and screenshots at `/tmp/nh-export-desktop.png` and `/tmp/nh-export-mobile.png`.

- 2026-09-08 首页新方向（覆盖封面漫游方案）：重做为纸上几何页片装置，叠页/回环/流线、拖转与键盘旋转、展开控制、印章重排、暂停/重置；复用 NumberTicker 呈现真实作品与阅读数据，30天柱条支持触屏/键盘查询。删除封面图层与其请求，不增加依赖。移动端自然滚动，窄屏图表触点44px，减少动态效果、后台/离屏暂停已适配。

  验证：生产构建与7项首页/书架回归通过；1440×1000、390×844、2560×1440浏览器检查无页面错误。无头Chromium 2560×1440 单次采样：待机179帧、形态切换377帧，P95均16.7ms、超过32ms均0；仅代表本轮首页测试，不代表所有设备或全站性能结论。

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

本轮验收：三方案3项E2E、原书签/书架7项回归通过；1440×1000、390×844、2560×1440共9次布局检查无横向溢出和页面异常。手机四点拖动、日期联动、PNG导出、重置、减少动态效果、失败重试和关系点击通过。原模拟图仅作为构图方向参考，未作为素材使用；作品封面截图脱敏，方案3可直接检查完整实际画面。


2026-09-13 方案2交互修订：`?home-preview=echo#workbench` 保持独立预览。EchoPreview 固定左侧真实阅读记录顺序，显示月日/时分、作品标题与进度；中间封面及右侧关联封面随视口放大。关系按同作者/同系列/同角色及较低频的共享标签查询，排除原创作为系列，最多显示三个非空分组并跨组去重。标签频次取现有 tag-filters（最多200项），未覆盖的低频标签由搜索验证，不等同语义推荐；每个类型最多取一个标签、主题最多两个。底部重复时间轴移除，探索路径自然换行。切换使用 Motion 选中指示/封面过渡，最多缓存20部本次关系结果；细线与节点待机动效离屏/后台暂停，尊重减少动态效果。无新依赖/API/schema变更。回归覆盖关系往返、记录顺序、空分类隐藏和失败重试，配合1440/390/2560浏览器检查。


方案2脉络构图恢复：取消三栏列表/卡片排版，阅读记录错落汇入中央作品，关联作品沿分类枝条展开。新增 `workbench/concepts/EchoConnections.tsx`，ResizeObserver 按真实节点位置绘制连接，绕开中央封面/标题，并提供路径过渡与悬停强调。保留前轮封面尺寸、时间信息、非空分类、缓存及探索路径；窄屏改为紧凑分枝排版。新增端点落位检查，不能只验点击成功而忽略关系图视觉。
