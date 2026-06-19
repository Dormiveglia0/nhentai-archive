# 导出中心页面重构设计 v2 (Export Center Full Redesign)

- **日期**: 2026-06-19
- **范围**: 仅前端 `frontend/src/components/export/` + `app.css` 中 `.export-*` 样式块
- **不动**: 后端 `export_service.py` 及其 API、`test_export_service.py` / `test_export_api.py`
- **关系**: 取代上一版 `2026-06-19-export-page-refactor-design.md`（那版以 `design/导出中心.png` 为硬参考逐项还原，验收后用户仍不满意）。

## 1. 背景与问题

上一轮的几次提交都在对着 `design/导出中心.png` 还原，但用户对四个方面同时不满意:
整体布局结构、视觉精致度、交互流程、信息密度。经确认: **本次为完整重新设计,不再受设计稿束缚。**

当前页面 (`ExportPage.tsx` 组合 `ExportSummary` / `ExportQueueTable` / `ExportPreviewPanel` /
`ExportOptionsBar`) 的结构性问题:

1. **"待导出队列" 框架本身不对** — 大 hero + 5 个指标卡 (待导出/就绪/已选/警告/阻塞) 把页面框成一个
   "待办队列",占用大量竖向空间却没在帮用户干活。用户明确: **页面不应有"待导出"之类的提示。**
2. **找不到作品** — 作品多时没有搜索,无法快速定位。
3. **选择器交互冲突** — 每行有两个点击目标: 勾选框切换 `selectedIds`(批量选择),点击行体切换
   `focusId`(单项预览)。两个语义抢同一行,易误操作。
4. **选项与动作脱节** — `导出选项`(写 ComicInfo / 保留 JSON / 压缩) 是独立面板且排在表格下方,
   与右侧"下载"按钮在视觉上分离,"怎么导出"和"导出"不在一起。
5. **表格观感** — 6 列(含内联重命名输入框)的电子表格观感,对"挑选可视内容"这件事过于事务化。

## 2. 目标

把页面从"待办队列管理"重构为 **"浏览作品 → 挑选 → 配置 → 下载"** 的单屏工作台:

- 去掉 hero 与指标卡;顶部只保留标题 + 搜索 + 状态筛选。
- 左侧可搜索/可筛选的作品列表;**单击卡片 = 选中 + 预览**(一次动作完成两件事)。
- 右侧大检查器,把"当前作品详情 + ComicInfo 预览 + 全局选项 + 下载动作"收拢在一列。
- 保持后端能力与下载逻辑(单项 CBZ / 多选 .zip 打包)完全不变。

非目标(YAGNI): 后端改动;"最近导出记录"历史(当前页面未渲染,本次不新增);新的预设管理 UI。

## 3. 布局骨架

```
导出中心
[🔍 搜索作品…              ]   [全部 · 就绪 · 警告 · 阻塞]   [全选就绪] [清空]
─────────────────────────────────┬─────────────────────────────
  作品列表 (可滚动)                │  导出 / 详情 (sticky)
  ◉ 封面  标题…           就绪    │  ┌────┐  标题
  ○ 封面  标题…           阻塞    │  │封面│  输出名 [____________]
  ◉ 封面  标题…           ⚠ 警告  │  └────┘  就绪
  …                              │  ── ComicInfo.xml 预览 ──
                                 │   Series / Writer / …
                                 │  ── 警告/阻塞(若有) ──
                                 │ ┌─ 操作区 (sticky 底) ──────┐
                                 │ │ ◉ComicInfo ◉保留JSON ◉压缩 │
                                 │ │ 已选 8 项 · 240MB          │
                                 │ │ [⬇ 下载所选 8 项 (.zip)]   │
                                 │ │  仅下载当前作品            │
                                 │ └───────────────────────────┘
```

宽屏: 左列表 + 右检查器两栏(检查器 sticky)。窄屏(≤960px): 检查器堆叠到列表下方,
操作区变成 sticky 底部 dock(取代当前 `export-mobile-dock`)。

## 4. 顶部工具条 (`ExportToolbar`)

- 标题 `导出中心` + 一行说明。**无指标卡。**
- 搜索框: 实时过滤,匹配 `workTitle(work)` 与 `remote_gallery_id`,大小写不敏感。
- 状态筛选 chip: `全部 / 就绪 / 警告 / 阻塞`,单选,**不显示计数**(用户明确要求)。
  - 就绪 = `blockers.length === 0 && warnings.length === 0`
  - 警告 = `blockers.length === 0 && warnings.length > 0`
  - 阻塞 = `blockers.length > 0`
- 批量动作: `全选就绪`(选中全部 `blockers.length===0` 项)、`清空`(清空选择)。

## 5. 作品列表 (`ExportWorkList`,取代 `ExportQueueTable`)

- 封面优先的行: 缩略图(选中时角标打勾) + 标题 + 来源/ID + 单个状态 pill(就绪/警告/阻塞)。
- **单击行 = `pickItem(id)`**: 切换该项选择态,并把该项设为右侧检查器焦点。
  - 已选中且为焦点时再次单击 → 取消选择(仍保持为焦点,以便继续阅读详情)。
  - **阻塞项**: 不可加入选择,但可点击设为焦点(以便阅读阻塞原因)。
- 渲染 `visibleItems`(经搜索 + 筛选)。保留现有 `Stagger`/`StaggerItem` 动效,超过阈值时退化为普通列表。
- 空态: 列表为空且无搜索 → "暂无可导出作品"(沿用现有 boundary 文案);搜索/筛选无结果 → "没有匹配的作品"。

## 6. 检查器 (`ExportInspector`,合并 `ExportPreviewPanel` + `ExportOptionsBar`)

把"怎么导出"和"导出"收拢到一列,修掉选项与动作脱节的问题。自上而下:

1. **焦点头**: 封面 + 标题 + 内联 `输出名` 重命名输入 + 状态 pill。
2. **ComicInfo.xml 预览卡**: 随选项实时更新(沿用现有 `comic_info` / `will_write` 展示逻辑)。
3. **问题区**: 焦点项的 blockers/warnings(若有)。
4. **已选作品条**(多选且 >1 时): 缩略图横条 + `+N`。
5. **sticky 操作区**(底部):
   - 3 个全局选项开关: 写入 ComicInfo / 保留 JSON / 标准压缩(沿用 `OptionToggle`,改为更紧凑的横排)。
     标注"作用于本次全部导出"。
   - 选择摘要: `已选 N 项 · 大小`。
   - 主按钮: 选中 1 项 → `下载此作品`;选中多项 → `下载所选 N 项 (.zip)`。
   - 次按钮: 选中多项且焦点为可下载项时 → `仅下载当前作品`。
- 无焦点态: 安静提示"点击左侧任一作品查看详情。"

## 7. 状态层改动 (`useExportState`)

增量、低风险:

- 新增 `query: string`、`statusFilter: 'all'|'ready'|'warning'|'blocked'` 两个 state 与对应 setter。
- 派生 `visibleItems`: 在现有 `items` 上先按 `statusFilter` 再按 `query` 过滤。
- 新增 `pickItem(id)`: 合并"切换选择 + 设为焦点"。阻塞项只设焦点不加入选择。
  保留现有 `toggleSelected` / `focusItem` 作为底层(或由 `pickItem` 直接调用 setter)。
- **保持不变**: `downloadOne` / `downloadSelected` / `refreshPreview` / 预览副作用 / 重命名 / `selectReady` / `clearSelected`。
- 视图模型新增导出: `query`、`statusFilter`、`visibleItems`、`pickItem`、`setQuery`、`setStatusFilter`。

## 8. 文件计划

- **重写**: `ExportPage.tsx`(新组合: Toolbar + 两栏 workspace)、`useExportState.ts`(搜索/筛选/picker)。
- **新增**: `ExportToolbar.tsx`、`ExportWorkList.tsx`、`ExportInspector.tsx`。
- **删除**: `ExportSummary.tsx`、`ExportQueueTable.tsx`、`ExportPreviewPanel.tsx`、`ExportOptionsBar.tsx`;
  移除 `export-hero-sketch` 资源的引用(资源文件可保留,不再 import)。
- **保留**: `exportHelpers.tsx`(`Cover` / `formatBytes` 等)。
- **CSS**: 重写 `app.css` 中 `.export-*` 样式块以匹配新骨架。

## 9. 视觉方向

沿用全站"纸与墨"体系(`--paper #f7f1e7`、`--ink`、`--accent #b92d1e`、`--green`、`--warn`、`--line`)。
检查器与列表使用 `--surface` 卡面 + `--line` 描边 + `var(--shadow)`;状态 pill 用 green/warn/accent 区分;
操作区主按钮用 accent 实心。避免再出现"贴图式"的 hero 草图。

## 10. 测试与验收

- 前端无单测基建(见 memory `dev-environment`);以 `npm run build` 通过 TypeScript 编译为门槛。
- 后端测试不应受影响(未改后端);若 `app.css` 选择器名变更,确认无前端引用残留(grep `export-`)。
- 人工核对: 搜索过滤、状态筛选、单击选中+预览、阻塞项不可选、单项下载、多项 .zip 下载、窄屏 dock。
