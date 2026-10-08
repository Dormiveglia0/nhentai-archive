# 独立设计复核：2026-10-08

当前结论：本轮独立发现的 D01–D17 已全部按真实操作与新截图关闭。常用路径的作品入口、动作承接、固定工具条与锐利纸墨风格形成了一致的秩序；首页有明确阅读用途。这个结论覆盖本报告实测的布局与只读交互，不把截图复查冒充所有业务写入或性能指标均已通过。

审查人没有修改产品源码。使用隔离真实库 http://127.0.0.1:5181，桌面 1440×1000、手机 390×844、窄屏 320×740、首页横屏 844×390。每张本文引用的截图都在本轮捕获并实际打开查看，封面和阅读画面用 CSS 模糊保护。修改前的 docs/UI_AUDIT.md、修改前报告、构建成功和其他代理的测试通过数没有充当本报告的通过证据。

最终整理与导出定点复核入口资源为 /assets/index-D99C43UL.js，采集前后资源一致，pageerror 为 0，Chromium 已关闭。词典最后定点图来自 DsfV7DnF，此后该页没有修改。更早的本轮 after 图证明未被后续定点修改的页面；首页、库、文件、任务、阅读器等主体在对应采集后保持不变。报告分别标明最终定点图与较早 after 图，不把所有截图说成同一构建瞬间。

## 美观与用途的独立判断

首页这次有了清楚的用途：继续当前作品、看清页码与进度、直接打开近期作品。作品封面与阅读按钮构成主视觉，宣传巨字、左右宣传栏和无用线框已移除。桌面三部近期作品有稳定秩序和一致的下沿，手机是可辨认的原生横向作品栏；横屏没有强行复用窄屏单列。相比修改前，视觉权重终于给了要阅读的对象。纸墨黑红、细边线和克制定位红线是连贯的；不能从保护后的模糊画面声称作品艺术本身“惊艳”。

正常操作控件、选项卡、浮层、输入框和跳页窗保持直线边角，原 NH 菱形标志保留。少量统计摘要圆角属于用户已经允许的例外，没有出现选项卡内外套圆角。可见信息以作品、页数、真实状态、实际操作为主；必要的字段来源、文件影响和写入预览状态帮助判断操作，不属于用页面文字写代码注释。

评价不只看无横向溢出：首屏是否出现真实对象、真实输入是否完整处在固定栏上方、点选后能否看见编辑结果，都是本次实际发现并推动修正的问题。最后一轮整理与导出新图也完成了这一标准，见 D14 与 D17。

## 修改前 D01–D12 的复核

| 编号 / 优先级 | 普通用户复核步骤与现状 | 结论与新证据 |
| --- | --- | --- |
| D01 / P1 首页权重 | 打开首页，查看当前作品、页码、继续阅读与近期作品，再切四种尺寸。巨字与宣传栏已移除；对象与动作连为一组，作品顺序稳定。 | 关闭。[1440](/tmp/nh-ui-redesign/audit-oct08-designer/after/home-1440x1000.png)、[390](/tmp/nh-ui-redesign/audit-oct08-designer/after/home-390x844.png)、[320](/tmp/nh-ui-redesign/audit-oct08-designer/after/home-320x740.png)、[横屏](/tmp/nh-ui-redesign/audit-oct08-designer/after/home-844x390.png)。 |
| D02 / P1 手机库与多标签 | 手机打开库页，查看默认首屏，展开筛选，逐次选择实际标签，再在 390/320 选择七项。搜索保持添加标签右侧，标签在同一行原生横滚；默认高级筛选折叠。 | 关闭。[默认](/tmp/nh-ui-redesign/audit-oct08-designer/after/library-390-initial.png)、[390 七标签](/tmp/nh-ui-redesign/audit-oct08-designer/after/library-390-seven-tags-final.png)、[320 七标签](/tmp/nh-ui-redesign/audit-oct08-designer/after/library-320-seven-tags-final.png)。48px 行高；320 搜索图标宽48px，标签计数完整为“标签 7”，清空为有可访问名称的 X。 |
| D03 / P1 队列切换溢出 | 队列外层先滚动240px，依次切空的“正在运行”、长“已完成”、再“全部”，逐帧读取标签组和滑块。 | 关闭。[滚动切换后](/tmp/nh-ui-redesign/audit-oct08-designer/after/tasks-1440-after-scroll-tabs.png)。各组采样高度均52px，scrollHeight-clientHeight 最大0，滑块相对 y 始终1。此证据证明溢出问题修复，不冒充 FPS 基准。 |
| D04 / P1 手机任务详情 | 手机点第一条任务详情，滚到详情底部，然后 Esc。详情现在是原生模态弹窗，背景列表原位保留，Esc 后焦点回入口。 | 关闭。[打开](/tmp/nh-ui-redesign/audit-oct08-designer/after/tasks-390-details.png)、[详情内滚动](/tmp/nh-ui-redesign/audit-oct08-designer/after/tasks-390-details-scrolled.png)。弹窗高度812px，390×844 保留上下16px。 |
| D05 / P1 手机导出承接 | 单部导出打开列表，点第二部真实作品，等只读预览完成。现在自动到预览，有作品、文件名、选项与动作；没有误跳到空面板。 | 关闭。[有效预览](/tmp/nh-ui-redesign/audit-oct08-designer/after/export-390-valid-selected-inspector.png)。inspectorTop126；预览标题1、错误提示0。单部预览计数的独立文案余项见 D17。 |
| D06 / P1 手机热门可辨认 | 打开发现热门，横向滚到最后一项，再打开作品详情。模糊封面下仍有两行真实作品名，原生横滚保留全部作品入口。 | 关闭。[起点](/tmp/nh-ui-redesign/audit-oct08-designer/after/discover-390-popular.png)、[末项](/tmp/nh-ui-redesign/audit-oct08-designer/after/discover-390-popular-end.png)。编号没有替代名称。 |
| D07 / P2 手机文件首屏 | 打开文件页默认列表。摘要被压成紧凑信息，首个真实文件开始进入首屏，筛选与文件之间不再插入大块说明。 | 关闭。[手机文件](/tmp/nh-ui-redesign/audit-oct08-designer/after/files-390-inventory.png)。第一文件 y760；这是入口可见，未夸称整条文件在844px内完全展示。 |
| D08 / P2 固定工具条 | 手机整理和词典看底栏，再查看320尺寸。整理主保存与三个次操作同排；词典状态、预览与写入形成两层。 | 关闭。[整理390](/tmp/nh-ui-redesign/audit-oct08-designer/after/governance-390-complete-input-final.png)、[词典320](/tmp/nh-ui-redesign/audit-oct08-designer/after/dictionary-320-ready-editor.png)。整理72px、词典96px；没有以前的三行160px整理栏。 |
| D09 / P2 历史百分比 | 打开历史看真实记录与再次阅读入口。每条只保留一个进度百分比，日期与对象层级清楚。 | 关闭。[手机历史](/tmp/nh-ui-redesign/audit-oct08-designer/after/history-390.png)、[桌面历史](/tmp/nh-ui-redesign/audit-oct08-designer/after/history-1440-current.png)。 |
| D10 / P2 设置重复同步 | 打开设置的配置、统计和存储章节。header 同步章移除；配置保留有关同步状态，统计/存储没有无关写配置工具条。 | 关闭。[统计](/tmp/nh-ui-redesign/audit-oct08-designer/after/settings-390-统计-current.png)、[存储](/tmp/nh-ui-redesign/audit-oct08-designer/after/settings-390-存储-current.png)。两只读章节写栏数量均0。 |
| D11 / P2 可见术语一致性 | 查看库、发现作品、文件、导出到整理的入口和实际操作。现为“编辑信息”“整理”“删除”等普通动作，与导航一致。 | 关闭。[发现详情](/tmp/nh-ui-redesign/audit-oct08-designer/after/gallery-557444-1440-current.png)、[文件详情](/tmp/nh-ui-redesign/audit-oct08-designer/after/files-390-details.png)。最新上述功能源全目录 rg 未检出“治理/馆藏/入藏/级联”；内部模块名保留不影响产品文字。 |
| D12 / P2 长浮层关闭头 | 手机打开文件详情/阅读器信息，向内滚到下方，仍能看见关闭头；文件 Esc 后回入口。 | 关闭。[文件稳定复查](/tmp/nh-ui-redesign/audit-oct08-designer/after/files-390-details-scrolled-confirmed.png)、[阅读器信息滚动](/tmp/nh-ui-redesign/audit-oct08-designer/after/reader-390-info-scrolled.png)。文件 header 的 y102.28 在内滚前后不变，阅读器 header y129/h72。 |

手机多标签曾在中间 after 构建出现计数字样截断和清空文字残留，不能用旧六标签图宣称通过。最终七标签两图重新验证：计数字宽与容器均56px，没有截断；清空 DOM 文字为空，保留 aria-label“清空标签”。390 搜索 x294/w76，320 搜索 x252/w48。连续选择时外层列表短暂变长会影响整体滚动坐标，按钮与添加标签始终同一行，不能把全页移动误判为搜索被标签挤走。

## 复核追加发现 D13–D17

| 编号 / 优先级 | 操作、判断与最小改进 | 最终证据 / 状态 |
| --- | --- | --- |
| D13 / P1 词典首屏没有可操作候选 | 390/320 打开词典默认页。第一次手机“压缩”仍使首行在 y703，390 被底栏盖7px，320 整行在底栏下。当前搜索常显，类型/状态/生成建议收在原生“筛选与翻译”；摘要三项/两项，候选标题与批量导入同排。 | 关闭。最新 [390 默认](/tmp/nh-ui-redesign/audit-oct08-designer/after/dictionary-390-ready-first.png)、[320 默认](/tmp/nh-ui-redesign/audit-oct08-designer/after/dictionary-320-ready-first.png)：首行底641，底栏分别748/644，完整真实候选可见。320 仅3px余量，属于紧凑布局，并非有遮挡。 |
| D14 / P1 整理真实输入被前置内容埋住 | 桌面打开整理默认单部编辑。原先检查与三个188px“通过”卡占据编辑字段前；现在字段→标签→检查，去重副标题，检查卡80px，中文建议52px原生 details 默认收起。中间构建仍遮首输入21px，最后只压紧作品头部与字段标题间距，取得34px，不删除功能。 | 关闭。最终 [桌面字段](/tmp/nh-ui-redesign/audit-oct08-designer/after/governance-1440-complete-input-final.png)：首 textarea top863/bottom909，底栏top922，完整且余13px，满足输入底部+8px的要求。[紧凑核对卡](/tmp/nh-ui-redesign/audit-oct08-designer/after/governance-1440-compact-checks-final.png) 保留字段后检查的证据。 |
| D15 / P1 词典点选没有编辑承接 | 手机默认点首个真实词条。以前选中颜色改变但 outerScroll0，editorTop1089；当前只在手机单项点选后原生滚到编辑容器，原文、中文名和类型直接可编辑。 | 关闭。最新 [390 点选](/tmp/nh-ui-redesign/audit-oct08-designer/after/dictionary-390-ready-editor.png)、[320 点选](/tmp/nh-ui-redesign/audit-oct08-designer/after/dictionary-320-ready-editor.png)：editorTop64，首 inputTop265，outerScroll1025。未写入或删除词典。 |
| D16 / P1 整理点作品没有编辑承接 | 手机单部编辑点队列第二部。以前只变选中/作品标题，outerScroll0、首输入top1380.56。当前原生滚到常驻编辑容器，选中作品的字段进入视野；批量选择继续留在列表。 | 关闭。最新 [手机点第二部](/tmp/nh-ui-redesign/audit-oct08-designer/after/governance-390-complete-input-final.png)：editorTop64.38，outerScroll523；实际首输入 top700.38/bottom746.38，底栏772，完整且余25.62px。未保存、生成翻译或回写。 |
| D17 / P3 导出单部计数不一致 | 单部预览已显示对象且“下载此作品”可用，中间构建仍“已选0项·0B”，把批量集合暴露给单部用户。当前源显式使用已有 multiSelect 区分单部/批量，单部显示当前作品真实大小，批量继续显示数量/体积。 | 关闭。最终 [桌面单部预览](/tmp/nh-ui-redesign/audit-oct08-designer/after/export-1440-single-summary-final.png) 显示“当前作品 · 16.0 MB”，预览标题1、错误0、主动作启用。只读操作未执行下载；批量仅剩1项/全取消的请求目标功能验证由主代理另行完成。 |

## 逐页审美与交互判断

1. 首页：本轮最清楚的改善是对象与阅读动作成为主线。[手机近期作品](/tmp/nh-ui-redesign/audit-oct08-designer/after/home-390x844-recent.png) 有真实名称和稳定次序，没有拖动洗牌。四尺寸都没有横向页面溢出。
2. 我的库：输入、添加标签、搜索的关系稳定，筛选采用原生展开，标签是水平带。桌面作品密度正常，[库详情](/tmp/nh-ui-redesign/audit-oct08-designer/after/library-1440-detail-current.png) 保留发现详情式原比例封面，无白底衬；阅读/收藏主动作与编辑/导出/删除次动作分组，删除只写“删除”。
3. 发现及作品详情：手机热门有标题可选，独立作品详情保留原有结构。[发现详情](/tmp/nh-ui-redesign/audit-oct08-designer/after/gallery-557444-1440-current.png) 的作品、真实四项数据和标签层级清楚，不再强行套库弹窗。
4. 阅读器：暗底把注意力留给画面，顶部/底部控件覆盖阅读视口；纸面设置、作品信息和跳页与站点同色。[控件](/tmp/nh-ui-redesign/audit-oct08-designer/after/reader-390-chrome-pinned.png)、[阅读设置](/tmp/nh-ui-redesign/audit-oct08-designer/after/reader-390-options-current.png)、[跳页](/tmp/nh-ui-redesign/audit-oct08-designer/after/reader-390-jump-current.png) 实际查看：左右按钮的前/后页关系正确，单页/连续在设置里，跳页是方角红线纸面。隐藏归档页面实际 CSS 动画运行数量0。
5. 队列：桌面列表与右侧任务信息分工清楚，手机原生详情保持背景上下文；直线 tabs 无内外圆角。滚动240后的空/长切换尺寸稳态和动画采样均52px。
6. 文件：手机默认页与库的密度节奏接近，固定操作条没有额外说明撑高。原生模态详情在长内容时关闭头可达，Esc 不丢入口焦点。
7. 导出：单部手机选择→有效预览已接通，作品/文件/打包选项有目的，按钮方正。D17 的摘要文案已在最后一轮修正，不从预览有内容推出实际文件打包成功。
8. 历史：日期组、真实封面、页码/单个进度与再次阅读清楚，不需要额外摘要副标题。
9. 统计：统计值、时间段、趋势与排行能对应使用记录，不再附与内容无关的“同步”章。只检查当前真实图表，没有编造空态或零数据图。
10. 词典：桌面候选与编辑双栏成立，手机原生折叠承载辅助筛选/翻译，搜索与候选主线始终可见。点选后的编辑区有明确标题和真实原文，没有只改变颜色。
11. 整理：字段优先、核对摘要后置和小“通过”卡比修改前有用；手机选择承接已改善。最终桌面实际输入完整高于操作栏13px，手机高于25.62px，真实编辑字段终于成为首屏可用内容。
12. 设置：六章纸面/直线节奏一致，状态不重复；统计、存储只读页面少了无用写操作条。未保存 API 设置，未输出任何密钥。
13. 手机导航：[九项导航](/tmp/nh-ui-redesign/audit-oct08-designer/after/mobile-navigation-current.png) 名称与细线图标一致，当前页面有红色标记，原 NH 标志保留；原生背景遮罩降低正文干扰。

## 动画与真实性证据

实际 Queue 逐帧记录在 [page-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/page-metrics.json)。只把对应 queue checks 用作高度/溢出证据，文件尾部旧词典行位置属于当时失败状态，不作为最终结果。

最新源中的 transitionTabs 只提交 next 一次，SlidingIndicator 用共享控制组本地坐标的450ms transform 动画。顶栏、设置、队列、文件、导出、库视图/标签范围、阅读模式、统计区间/排行方式等都有共享指示器调用，已经查找站点而非只看用户举例的两处。这个源审查支持“指示器滑过中间位置，不挨个打开中间页面”的实现；本代理没有把每个调用点都伪称完成逐帧性能测试。

截图不是性能基准。Queue 采样帧数受并行自动化和 View Transition 截图流程影响，不用它们推出60 FPS。隐藏阅读归档 CSS 动画确实已暂停；最终路线性能和大规模业务测试由主代理独立提供，不计为本报告的亲自测试。

## 采集修正与排除

- 刚内滚文件详情的一张截图出现瞬时头部空白，复测500ms后头部可见，sticky bbox 前后完全一致；已向主代理更正，不保留为稳定设计缺陷。引用的是 confirmed 图。
- 初次把导出所有 POST 都阻止，连只读 export-preview 也被阻止；“Failed to fetch”与空预览是审查 guard 造成，相关 export-current 三图全部排除。补测仅放行源码确认只读的单作品 export-preview，得到本文引用的真实有效预览，未下载或写文件。
- 阅读器3秒自动隐藏导致一次截图后点信息按钮超时；补测先唤出并聚焦控件固定可见，完成信息/设置/跳页，未当产品功能失败。
- 一次320复用390已展开原生 details 的用户状态，不能作为320默认首屏失败。最后320新默认截图明确 closed=true，首行bottom641；判定采用 ready-first 图。
- 一次手机整理点选后转桌面时，API汇总尚未完成就读取不存在的底栏而发生采集 TypeError，该尾部无效检查不列为产品缺陷。最终闭环脚本等待真实 textarea 与底栏稳定后重新取证。
- 分阶段构建替换时旧 chunk 的失效没有用于验收；词典闭环资源前后均 DsfV7DnF，最终整理/导出前后均 D99C43UL。真实缓存记录数在并行测试过程中变化，截图中的110/100/107等不被当成数据一致性结论。

## 验证范围与文件

本审查只读源与真实界面，允许搜索、切换、打开/关闭/取消、键盘导航和只读预览。导入、删除、保存设置、生成翻译、修改词典、回写 CBZ、实际导出、阅读进度/收藏等写路径不由审查代理执行。完整业务和性能复测另由主代理进行；不能用此报告宣称这些写路径全通过。

真实媒体已模糊，媒体内容/配色本身不在审美结论内；完整 WCAG、真实触摸设备和全平台浏览器也没有只靠截图宣称完成。

最后三图的数据：[final-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/final-metrics.json)；词典与前一轮整理定点数据：[closure-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/closure-metrics.json)；标签：[final-tag-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/final-tag-metrics.json)；首页：[home-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/home-metrics.json)；弹窗与焦点：[control-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/control-metrics.json)；有效导出、阅读器、设置尾部：[tail-metrics.json](/tmp/nh-ui-redesign/audit-oct08-designer/after/tail-metrics.json)。

修改前独立报告 [DESIGNER_AUDIT.md](/tmp/nh-ui-redesign/audit-oct08-designer/DESIGNER_AUDIT.md) 保留为问题基线，没有覆盖为“通过”。本报告已经追加 D99C43UL 的三张最终实图和真实输入/单部摘要数据；没有以中间失败图或构建绿色代替这些验收。
