# effects/ — 动画/视觉效果组件

本目录收纳从 magicui / react-bits 引入并**改造后**的效果组件。

## 硬性原则
库只作效果来源,不作 UI 模板。动画可套模板,UI 设计不套模板。

## 引入任何效果时必须满足
1. **只取效果不取布局** —— 仅迁移产生动效/视觉的最小代码(canvas/SVG/keyframes/motion 逻辑),丢弃演示用容器、文案、定价卡等模板结构。
2. **token 改造** —— 颜色/圆角/间距/阴影改引现有 token(`var(--accent)`/`var(--paper)`/`var(--shadow)` 等),禁止保留库自带 slate/blue/紫渐变模板色。
3. **作用域隔离** —— 组件根节点挂 `className="fx-scope"`;Tailwind 工具类仅限该子树。
4. **归位 + 溯源** —— 文件头注释标注:来源库、原始链接、「已按本规范改造」。
5. **降级** —— 重特效(粒子/光效)需在 `prefers-reduced-motion` 下提供静态回退(可用 `usePrefersReducedMotion`)。

## 动画规范
时长/缓动一律引用 `src/lib/motion/tokens.ts`,禁止写魔法数。
