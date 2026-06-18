# 阶段 3 · Reader 页动画 — 设计文档

日期:2026-06-18
分支:codex-nh-archive-local-web
依赖:阶段 0(`lib/motion/` 原语层)

## 目标

为阅读器加三类动画:① 单页模式翻页时新页**轻柔淡入**;② 连续滚动模式页面进入窗口时淡入;③ 打开/切换作品时三栏(章节侧栏 / 阅读区 / 详情栏)进场。保留全部现有交互(方向键、章节跳转、滚动自动翻页、隐私遮罩)与布局。

## 现状(已勘查)

- 布局:`.reader-page` 为 grid `260px / minmax(0,1fr) / 290px`,三栏为 grid items(`.reader-sidebar` / `.reader-main` / `.reader-inspector`)。
- 阅读区:`.page-stage` 为 `overflow:auto` 的**内部滚动容器**(grid、`justify-items:center`),图片受 `.reader-page img { max-width:100%; max-height:78vh }` 约束。
- 模式:`single` 时 `visiblePages` 仅含当前页;`scroll` 时为当前页附近窗口(start..end),图片 `onLoad` 时自动推进 `setPage`。
- 翻页由 `setPage` 统一驱动(方向键/工具栏/章节列表)。

## 方案(全部基于 FadeIn,零布局风险)

**为何不用 whileInView/重叠交叉淡入:** `.page-stage` 是内部滚动容器,`whileInView` 的 IntersectionObserver 默认根为视口,行为不可靠;图片尺寸不一,重叠交叉淡入需绝对定位舞台,风险高。故统一用挂载淡入(`FadeIn`)。

### 1+2. 阅读区翻页 / 滚动淡入
`.page-stage` 内每张图用 `<FadeIn key={page.key} className="reader-page-cell" y={10}>` 包裹(`onLoad` 仍在 `<img>`)。
- `single`:`visiblePages` 单项,`page.key` 随页码变 → FadeIn 重挂载 → 新页淡入(即翻页过渡)。
- `scroll`:各页 `key` 稳定,进入窗口时挂载 → 淡入出现。
新增 CSS `.reader-page-cell { width:100%; display:flex; justify-content:center; }`,使包裹层撑满列宽并居中图片,`max-width:100%` 干净生效。

### 3. 三栏进场
在每栏**内部**包一层 FadeIn(保留栏的 grid 类,不碰栅格),key 为 `sourceKey`(切换作品时重播):
- 侧栏:`<FadeIn key={sourceKey} x={-12}>`(从左)
- 阅读区:`<FadeIn key={sourceKey} y={8}>`(上浮);其内仍含逐页 FadeIn,嵌套无碍
- 详情栏:`<FadeIn key={sourceKey} x={12}>`(从右)

### 无障碍
全部 FadeIn,reduced-motion 自动去位移、仅淡入。

## 不在范围
- 翻页方向滑动 / 交叉淡入(已评估为高布局风险,放弃)。
- 工具栏按钮微交互、进度条动画。
- 不引入 magicui/react-bits 组件。

## 验证
- `cd frontend && npm run build` 通过。
- 用户 `npm run dev` 验收:单页翻页新页轻柔淡入;滚动模式页面淡入出现;打开/切换作品三栏进场;方向键/章节跳转/滚动自动翻页/隐私遮罩均不回归;图片不溢出;reduced-motion 仅淡入。
