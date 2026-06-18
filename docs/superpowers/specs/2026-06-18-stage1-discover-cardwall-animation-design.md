# 阶段 1 · Discover 卡片墙进场动画 — 设计文档

日期:2026-06-18
分支:codex-nh-archive-local-web
依赖:阶段 0(`lib/motion/` 原语层、Tailwind 方案 A)

## 目标

为 discover 卡片墙加**逐项进场动画**(淡入 + 轻微上移),让翻页/筛选/切视图时卡片优雅地依次浮现,替代当前「瞬间弹出」的生硬感。**不改卡片本身的设计与现有 hover 交互**,只做进场。

## 现状(已勘查)

- 卡片墙:`DiscoverFeed.tsx` 中 `.discover-card-grid`(flex-wrap,固定 224px 卡)/ `.discover-card-list`(grid)映射 `DiscoverCard`。
- 卡片**已有讲究的 CSS hover**:`translateY(-3px)` + 阴影加深 + 封面 `scale(1.03)` —— **完整保留**。
- `DiscoverPage` 每次拉取 `setItems(payload.result)` 整批替换,翻页/筛选/搜索都走此路径;加载时保留旧数据直到新数据到达。
- 缺口:卡片无进场动画。

## 方案

用阶段 0 原语,**最小侵入、只动 `DiscoverFeed`**:
- 卡片容器由普通 `div` 换成 `<Stagger>`(渲染 `motion.div`,沿用原 grid/list className)。
- 每张卡片包一层 `<StaggerItem className="discover-card-cell">`。
- **触发:每次结果变化都重放**(首屏 + 翻页 + 筛选 + 切视图)。实现为给 `Stagger` 加 `key`,签名随结果集变化:`${viewMode}:${page}:${items.length}:${firstGalleryId}`。key 变 → 重挂载 → 重播。

### 等高行保护
现有 `.discover-card-grid` 为 `align-items: stretch` 的等高行。插入包裹层后,新增 CSS:
```css
.discover-card-cell { display: flex; }
```
使被拉伸的包裹层把卡片撑满,等高效果不回归。

### 无障碍
`StaggerItem` 已内置 reduced-motion:开启「减少动态」时位移归零,仅保留交错淡入。无需额外处理。

## 不在范围
- `PopularFan`(滚动扇)、`DiscoverToolbar`、`DiscoverCard` 内部、弹窗 —— 后续按需。
- 不引入任何 magicui/react-bits 组件(本阶段只用 motion 原语)。

## 验证
- `cd frontend && npm run build` 通过。
- 用户 `npm run dev` 验收:翻页/换筛选/切 grid↔list 时卡片逐项浮现;hover 行为不变;等高行不乱;reduced-motion 下仅淡入无位移。
