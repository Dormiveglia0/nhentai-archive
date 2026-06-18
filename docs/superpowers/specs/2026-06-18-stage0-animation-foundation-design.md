# 阶段 0 · 动画与效果基础设施接入 — 设计文档

日期:2026-06-18
分支:codex-nh-archive-local-web
作者:Claude + huangzhe005

## 背景与目标

NH Archive 当前前端为 React 18 + TypeScript + Vite 6,样式为**单个 70KB 手写全局 `app.css`**,**无 Tailwind**,动画几乎为零——这是项目当前最欠缺的部分。

本阶段(阶段 0)是「全面动画改造」的**地基**,只交付基础设施与规范,不改造具体页面。后续 discover / library / reader / dictionary / settings 各页面动画改造各自走独立 spec → plan → 实现循环,均依赖本阶段定下的规范与原语层。

## 指导原则(硬性,约束后续所有阶段)

> **库只作为动画/效果的来源,不作为 UI 模板。** 任何从 magicui / react-bits 引入的组件,必须改造进现有设计语言(配色、间距、圆角、字体走 `app.css` 既有 token);**禁止**整段套用库的模板化 UI 布局。动画可以套模板,UI 设计不套模板。目标是「优化美化现有设计」,而非「打碎重组」。

## 涉及的库

| 库 | 版本/形态 | 定位 |
|---|---|---|
| motion | `^12.40.0`(已装,需从仓库根迁移到 `frontend/`) | 主动画引擎,React 入口 `motion/react`,与样式无关 |
| Tailwind v4 | `tailwindcss` + `@tailwindcss/vite` | 仅作为**启用层**,让 Tailwind-based 效果组件可原样落地;不作为设计系统 |
| magicui | shadcn 式复制粘贴(Tailwind) | 效果素材来源(文字特效、shine 边框、粒子/光效背景等) |
| react-bits | 复制粘贴(CSS / Tailwind 双变体) | 效果素材来源,优先取 CSS 变体或改造为 token 版 |

## 关键决策:Tailwind 与现有 CSS 共存(方案 A)

真正风险是 Tailwind 的 **Preflight(全局 reset)**会穿透影响现有所有页面观感,而非类名冲突(已 grep `app.css` 确认无 `.flex/.grid/.p-*` 等同名工具类)。

采用 **方案 A:关闭 Preflight + 不加前缀 + 按层导入**:
- 不加前缀 → magicui/react-bits 效果可原样粘贴,改造成本最低,契合「原样接入」。
- 关闭 Preflight → 拒绝库强加的 reset/模板观感,现有手工 UI 视觉**原封不动**,符合 AGENTS.md「保持现有 CSS 体系」。
- 已否决方案 B(标准 Preflight,会把模板味灌进全站、需审计 70KB CSS)与方案 C(`tw:` 前缀,隔离最强但破坏效果原样粘贴)。

## 架构(三层地基)

1. **样式底座** — Tailwind v4 按方案 A 接入,复用现有 token。
2. **动画原语层** `src/lib/motion/` — 基于 motion 的可复用封装 + 全局动画规范常量 + reduced-motion。
3. **效果素材接入规范** — `components/effects/` 收纳目录 + README 接入清单。

## 目录结构(新增/改动)

```
frontend/
  package.json              # + motion(从仓库根迁入);+ tailwindcss, @tailwindcss/vite
  vite.config.ts            # + @tailwindcss/vite 插件
  src/
    main.tsx                # 先引入 tailwind-entry.css,再引入 app.css
    styles/
      app.css               # 既有内容不动
      tailwind-entry.css     # 新增:layer 声明 + theme/utilities 导入(省略 preflight)+ .fx-scope box-sizing + @theme token 映射
    lib/motion/
      index.ts              # 统一出口
      tokens.ts             # duration / ease / stagger 常量
      primitives.tsx        # FadeIn / SlideIn / Stagger / StaggerItem / Reveal / Presence
      useReducedMotion.ts   # 包装 motion 的 reduced-motion
    components/effects/
      README.md             # 效果接入规范清单
      <两个示例效果组件>      # 验证三套库链路
```

仓库根的 `package.json` / `package-lock.json` 中的 `motion` 声明在迁移后移除,避免依赖错位。

## Tailwind 接入细节

`tailwind-entry.css`:
```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
/* 省略 preflight.css —— 关键:不引入全局 reset */

.fx-scope, .fx-scope * { box-sizing: border-box; } /* 补 shadcn/magicui 组件岛依赖的盒模型,scoped */

@theme {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-accent: var(--accent);
  --color-green: var(--green);
  --color-warn: var(--warn);
}
```
`main.tsx` 中 `tailwind-entry.css` 在 `app.css` **之前**引入,使 `app.css` 具体规则优先级更高,兜底防止工具类意外覆盖。

## 动画原语层

### tokens.ts(全站统一节奏,贴合暖纸/克制风格)
```ts
export const duration = { fast: 0.18, base: 0.28, slow: 0.5 };
export const ease = {
  standard: [0.4, 0, 0.2, 1],
  exit:     [0.4, 0, 1, 1],
  spring:   { type: "spring", stiffness: 320, damping: 30 },
} as const;
export const stagger = { base: 0.05 };
```
后续阶段只准引用这些常量,组件内禁止写魔法数。

### primitives.tsx(基于 `motion/react`,只管动不管长相)
- `<FadeIn y? x? delay?>` — 进场淡入(可选位移)
- `<Stagger>` + `<StaggerItem>` — 列表/网格逐项进场
- `<Reveal>` — `whileInView` 滚动揭示
- `<Presence>` — 包装 `AnimatePresence`,用于路由/弹窗进出场

每个原语默认读取 tokens 时长/缓动,并内置 reduced-motion 降级。

### useReducedMotion.ts
包装 motion 的 `useReducedMotion()`;系统开启「减少动态」时,原语自动将位移/缩放降为纯透明度过渡或关闭。硬性规范,内置于所有原语。

## 效果素材接入规范(`components/effects/README.md`)

引入任何 magicui/react-bits 效果时必须:
1. **只取效果不取布局** — 仅迁移产生动效/视觉的最小代码(canvas/SVG/keyframes/motion 逻辑),丢弃演示容器与文案。
2. **token 改造** — 颜色/圆角/间距/阴影改引现有 token,禁止保留库自带 slate/blue/紫渐变模板色。
3. **作用域隔离** — 落地组件根节点挂 `className="fx-scope"`,Tailwind 工具类仅限该子树。
4. **归位 + 溯源** — 放 `components/effects/<Name>.tsx`,文件头注释标注来源库 + 原始链接 + 「已改造」。
5. **降级** — 重特效需在 reduced-motion 下提供静态回退。

## 示例验证组件(只验证管线,不改动现有页面结构)

1. **motion 链路**:用 `<Stagger>` 演示对一组卡片的逐项进场(独立 demo,不接入真实页面)。
2. **Tailwind + 效果改造链路**:从 magicui/react-bits 各挑一个轻量效果(如 shine 边框 / 动画标题),按接入规范改造成暖纸 token 版,放入 `components/effects/`。

## 验证与验收

- **构建**:`cd frontend && npm run build`(tsc -b + vite build)必须通过。
- **依赖**:`frontend/package.json` 含 motion + tailwindcss + @tailwindcss/vite;仓库根不再声明 motion。
- **视觉/动效**:本机无浏览器/Playwright,由用户 `npm run dev` 亲自验收(进场动效、reduced-motion 降级、现有页面观感未变)。
- **现有 UI 不回归**:关 Preflight + no-prefix + app.css 后置,三重保证现有页面像素级不变,由用户运行确认。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Tailwind 工具类覆盖现有样式 | no-prefix 已验证无同名类 + `app.css` 后置加载兜底 |
| 关 Preflight 后 shadcn/magicui 组件盒模型异常 | scoped `.fx-scope` box-sizing |
| 构建体积膨胀 | motion 按需 import,效果组件懒加载 |
| 后续阶段套用库模板 | 指导原则 + effects README 接入清单双重护栏 |

## 不在本阶段范围

- 任何真实页面(discover/library/reader/dictionary/settings)的动画改造 —— 各自后续阶段。
- 引入 shadcn 的成品 UI 组件(button/dialog 等模板)—— 与指导原则冲突,不做。
