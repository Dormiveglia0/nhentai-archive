# 阶段 2 · Library 页动画 — 设计文档

日期:2026-06-18
分支:codex-nh-archive-local-web
依赖:阶段 0(`lib/motion/` 原语层)、阶段 1(discover 卡片墙模式)

## 目标

为「我的库」全面加进场/过渡动画:主卡片墙逐项进场、两条横向书架行进场、选中作品时右侧详情面板淡入切换。沿用阶段 0 原语与既有设计语言,**不改卡片/面板本身的视觉与现有 hover**。

## 现状(已勘查)

- 主卡片墙:`LibraryPage.tsx` 的 `.library-grid`(CSS grid,等高行)/ `.library-list` 映射 `WorkCard`;`setWorks(payload.result)` 整批替换(翻页/筛选/排序/切视图)。
- 两条书架行:`ContinueReadingRow`(`.library-shelf-track` 横向 flex 滚动,`.shelf-item` `flex:0 0 132px`);仅在 `!emptyLibrary && !filtersActive` 时渲染。
- 详情面板:`WorkInspector` 随 `selected` 切换内容;`.work-inspector` 为块级容器(非 flex),包裹一层 div 不影响布局。

## 方案

### 1. 主卡片墙(同阶段 1 模式)
`.library-grid`/`.library-list` 容器换 `<Stagger>`,每张 `WorkCard` 包 `<StaggerItem className="library-card-cell">`;key 随结果集变化重播:`${view}:${page}:${works.length}:${works[0]?.id ?? "none"}`。
新增 CSS `.library-card-cell { display: flex; }` 保护 grid 等高行。

### 2. 书架行
`ContinueReadingRow` 的 `.library-shelf-track` 换 `<Stagger>`,每个 `.shelf-item` 包 `<StaggerItem className="shelf-cell">` 逐项进场。
新增 CSS `.shelf-cell { flex: 0 0 auto; }`,防止横向 flex 轨道压缩固定宽条目。行仅加载一次,挂载即播;筛选切换导致重挂载时自然重播。

### 3. 详情面板
`WorkInspector` 内容用 `<FadeIn key={work?.id ?? "empty"} y={8}>` 包裹,选中切换(含空↔有、有↔有)时淡入。`.work-inspector` 非 flex,单 div 包裹零布局风险。

### 无障碍
全部基于阶段 0 原语,reduced-motion 自动降级(位移归零、仅淡入)。

## 不在范围
- 顶部 hero / summary strip / toolbar 动画。
- 不引入 magicui/react-bits 组件。

## 验证
- `cd frontend && npm run build` 通过。
- 用户 `npm run dev` 验收:翻页/筛选/切视图主墙逐项浮现;两条书架行进场;点选不同封面详情面板淡入切换;hover/等高/横向滚动不回归;reduced-motion 仅淡入。
