# 导出中心页面重构设计 (Export Center Page Refactor)

- **日期**: 2026-06-19
- **范围**: 仅前端 `frontend/src/components/export/` + `app.css` 中 `.export-*` 样式块
- **不动**: 后端 `export_service.py` 及其 API、`test_export_service.py` / `test_export_api.py`
- **硬参考**: `design/导出中心.png`（按 `docs/DEVELOPMENT_RULES.md`，此图为权威 UI 来源）

## 1. 背景与问题

Codex 阶段已写出导出页初版 (`ExportPage.tsx`，812 行单文件) 与完整可用的后端导出能力。
后端无问题（真实 CBZ 生成、ComicInfo 写入、去重、sha256、导出记录）。前端"实际效果不尽人意"，
经确认四个方面都需要改进：

1. **视觉还原度差** — 与 `导出中心.png` 相比间距/密度/层次/配色不到位，hero 草图像贴上去的 PNG。
2. **交互逻辑混乱** — 根因是双选择态：`selectedId`（聚焦单行做预览）与 `selectedIds`（勾选多项做批量）
   并存，点击一行同时改两者；`移除` 与 `清空` 两个按钮都调用 `onClear`；`添加作品` 实际是"全选就绪项"，名不副实。
3. **布局结构问题** — 警告列只显示首条纯文本；每行"使用预设"只有单行；预览"将生成的新文件"是扁平单行 `Rule`。
4. **动效与细节** — Stagger 在长列表偏慢，预览仅按单 id 交叉淡入，缺少 hover/check 等微交互。

## 2. 目标

把导出页提升到与近期重建的治理中心 (`GovernancePage`) 同等的质量基线，精确还原 `导出中心.png`，
并在重写过程中修复全部交互缺陷。

## 3. 架构 / 文件拆分

用户选择"重建 + 拆多文件"（接受与项目单文件页面惯例的偏离，以换取可维护性）。
新的 `frontend/src/components/export/` 目录结构：

| 文件 | 职责 | 依赖 |
|------|------|------|
| `ExportPage.tsx` | 容器：组合各区块；渲染 hero、通知、边界/空状态 | hook + 区块组件 |
| `useExportState.ts` | 全部数据加载与变更逻辑（queue/summary/history/settings 加载、选择集、重命名映射、generate、保存目录、切换预设），返回类型化 view-model | `api` |
| `ExportSummary.tsx` | 5 张指标卡 + hero 草图/题词 | `ExportSummaryStats`、helpers |
| `ExportQueueTable.tsx` | 待导出列表表格（行、勾选框、重命名、警告堆叠、每行预设单元格、表尾、表头操作、每行 ⋮ 菜单） | queue items、选择集 |
| `ExportPresetBar.tsx` | 导出预设事实条 + 输出目录编辑 + "导出完成后打开输出目录" + 保存为新预设 / 开始导出 | settings、preset |
| `ExportPreviewPanel.tsx` | 导出预览侧栏：已选列表 + "将生成的新文件" 2×2 规则网格 + ComicInfo/路径明细 | preview、selected items |
| `ExportHistory.tsx` | 最近导出记录网格 | records |
| `exportHelpers.tsx` | `Cover`、`compactPath` 等共享小件 | — |

约束：

- CSS 仍留在 `app.css`（遵循 `AGENTS.md`：保持现有 CSS 体系）。重写 `.export-*` 整段，不分散。
- API 类型仍取自 `frontend/src/lib/api.ts`，不新增后端字段。
- 每个文件应能独立回答：做什么、怎么用、依赖什么；接口（props）显式且窄。

## 4. 交互模型（核心修复）

- **合并为单一选择集**：删除双态 `selectedId` / `selectedIds`。一个 `Set<number>`（已选作品）同时驱动
  **批量导出**与**预览面板**（预览显示"已选择 N 项作品" + 聚合，与参考一致）。
- **预览聚焦**：点击行主体切换一个轻量 `focusId`，**仅**决定预览面板中哪一项的 ComicInfo/路径明细展开；
  它**不**改变选择集。勾选框 = 选择；行点击 = 聚焦看详情。
- **表头操作（修正）**，三个互不相同的处理函数：
  - `全选就绪` — 选中所有无 blocker 的项
  - `移除选中` — 仅移除已勾选项
  - `清空` — 清空整个选择集
  - `批量调整` — 对已勾选集合打开重命名/应用预设的入口
- **导出按钮门槛**：仍基于 `exportableItems`（已勾选且无 blocker）。

## 5. 视觉还原（逐区块对照 `导出中心.png`）

**Hero。** 左侧黑色编排式标题 `导出中心` + 单行副标题；右侧建筑线稿作为低对比水印，
斜体题词 + `— NH Archive` 署名。修复贴图感：降低草图不透明度、对齐基线网格、题词用衬线斜体暖灰。

**指标行（5 卡）。** 等宽；图标置于圆角暖色方块（terracotta 着色）；大数字、标签、说明。
第 5 卡（输出目录）以文本为主：紧凑路径为主值，`可用空间 1.24 TB / 1.82 TB` 为说明，内联 `更改`。
色调：批量导出 = 绿色强调，失败重试 = 琥珀强调。收紧纵向节奏与图标方块尺寸，避免像超大按钮。

**待导出列表表格。** 列：☑ · 作品（cover 40px + 标题 + 副标题）· 输出名称(预览)（内联可编辑，未聚焦时弱化）·
状态（就绪/阻塞 胶囊）· 警告（堆叠的琥珀行，每行 `△ message`，最多 2 行 + "+N"）·
使用预设（多行：预设名 / 写入规则 / 版本）。选中行 = terracotta 左边框 + 淡色底纹。
表尾：左 `已选择 N 项 · 预计大小 X`，右 `总计 N 项`。表头操作见第 4 节；每行加 `⋮` 菜单（重命名 / 单独导出 / 移除）。

**导出预设条。** 横向事实条：命名规则 · ComicInfo 写入规则 · meta.json 保留规则 · 压缩方式 · 输出目录（可编辑）。
其下：复选框 `导出完成后打开输出目录`，然后 `保存为新预设`（次级）+ `开始导出`（terracotta 主操作，右对齐）。
标题显示 `当前：默认预设 v2` + 预设 `<select>`。

> 注：`导出完成后打开输出目录` 复选框为纯前端 UI 状态（参考图含此项）。已确认 `SettingsSummary.export`
> 仅含 `active_preset_id` + `presets`，后端无对应持久化字段、也无"打开系统目录"能力。
> 因此该复选框为**仅本地组件状态、不持久化、不触发任何后端行为**——既忠实于参考图的视觉，又不发明后端能力。
> 若未来后端补上该字段再升级为持久化。

**导出预览面板。** 标题 `导出预览` + 关闭/刷新。`已选择 N 项作品` 然后已选列表
（cover + 标题 + 副标题 + 大小，上限约 4，超出显示 "+N more"）。然后 **将生成的新文件** 为 **2×2 网格**，
每格 = 绿色对勾 + 加粗规则 + 灰色副说明：

- 将生成新 CBZ / 不会覆盖原文件
- 将写入 ComicInfo.xml / 补充与修正元数据
- 默认保留 meta.json / 不覆盖原 meta.json
- 不会修改原始 CBZ / 原文件保持不变

规则由真实 `preview` 数据驱动（如 meta.json 格反映 `will_keep` 是否含 `meta.json`，无则文案降级为"未检测到 meta.json"）。
其下保留可折叠 `路径明细` + `ComicInfo.xml` 明细（沿用现状）。blockers/warnings 内联呈现。

**最近导出记录。** 右上 `查看全部记录 ›` 链接。卡片：cover + `标题 等 N 项` + `使用预设 …` + 日期 + 大小 +
状态徽章（绿色 导出完成 / 琥珀 部分失败）。一行 4 张。

## 6. 动效与微交互

- 区块挂载用现有 `FadeIn` 淡入/位移；表格行用 `Stagger`/`StaggerItem`——保留，但减小 stagger 延迟，
  并在约 8 行后封顶 stagger，避免长列表显得迟钝。
- Hover：行浮起淡底纹；按钮沿用既有 terracotta hover。勾选框对勾在切换时 scale-in。
- 预览面板按"选择集签名"（而非单一 id）做交叉淡入，改变勾选集合时也会动画。
- 状态：显式 skeleton/`正在读取…` 加载态；真实空状态（`暂无可导出作品` 边界面板）；
  API 错误走既有 `.notice error`——不造假内容（遵循 `DEVELOPMENT_RULES.md`）。
- 尊重 `prefers-reduced-motion`（沿用 motion 助手既有行为）。

## 7. 测试 / 验证

- **后端**：不改动，因此 `test_export_service.py` / `test_export_api.py` 必须仍通过——作为回归门禁运行
  `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`。
- **前端**：`cd frontend && npm run build`（tsc + vite）须零错误通过——按测试指南为主门禁。
- **视觉**：对照 `导出中心.png` 对五个区块做浏览器/截图检查；验证三个表头操作、单选择集驱动预览、
  重命名、切换预设、以及一次真实导出闭环。
- 不新增 mock 数据，不加成人样张。

## 8. 不做（YAGNI）

- 不改后端、不加新 API 字段、不引入"打开系统目录"等后端能力。
- 不引入新的动画库或全局 CSS 重构；仅重写 `.export-*` 块。
- 不做与导出无关的重构。

## 9. 文档

实现完成后按 `AGENTS.md` 更新 `docs/PROJECT_STATUS.md`（阶段进度）与 `docs/PROJECT_MAP.md`
（导出组件文件结构变化）。
