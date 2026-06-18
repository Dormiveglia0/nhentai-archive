# 阶段 0 · 动画与效果基础设施接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NH Archive 前端接入 motion + Tailwind v4 + magicui/react-bits(方案 A),建立可复用的动画原语层与效果接入规范,作为后续全站动画改造的地基。

**Architecture:** Tailwind v4 以「关 Preflight + 不加前缀 + 按层导入」方式与现有 70KB `app.css` 共存(零全局 reset);`src/lib/motion/` 提供基于 `motion/react` 的薄封装原语与全局动画规范常量;magicui/react-bits 仅作效果素材,经 token 改造后落入 `src/components/effects/`。

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, motion 12.40, Tailwind CSS v4 (`@tailwindcss/vite`).

## Global Constraints

- **指导原则(硬性):** 库只作动画/效果来源,不作 UI 模板。引入的效果组件必须改造进现有设计语言,禁止套用库的模板化布局/配色。
- **设计 token(必须复用,禁止引入库默认 slate/blue/紫渐变):** `--paper #f7f1e7`、`--surface`、`--surface-solid`、`--ink #181411`、`--muted`、`--line`、`--line-strong`、`--accent #b92d1e`、`--accent-dark`、`--green`、`--warn`、`--shadow`。
- **Tailwind 方案 A:** 省略 `preflight.css`;不加前缀;`tailwind-entry.css` 在 `app.css` **之前**引入。
- **无障碍(硬性):** 所有动画原语内置 `prefers-reduced-motion` 降级。
- **验证方式:** 本项目前端无 JS 测试框架。每个任务的「测试」= `cd frontend && npm run build`(`tsc -b && vite build`)通过 + 指定可观察结果。视觉/动效由用户 `npm run dev` 验收。
- **依赖位置:** motion 必须声明在 `frontend/package.json`;完成后移除仓库根 `package.json`/`package-lock.json` 的 motion 声明。
- **commit:** 每个任务末尾提交;commit message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

### Task 1: 依赖迁移与 Tailwind 安装

**Files:**
- Modify: `frontend/package.json`(dependencies 加 `motion`、`tailwindcss`;devDependencies 加 `@tailwindcss/vite`)
- Modify: `package.json`(仓库根,移除 `motion`)
- Modify: `package-lock.json`(仓库根,随安装更新/清理)

**Interfaces:**
- Produces: `frontend/node_modules` 中可用的 `motion`、`tailwindcss`、`@tailwindcss/vite`。

- [ ] **Step 1: 在 frontend 安装依赖**

```bash
cd /opt/nhentai/frontend
npm install motion@^12.40.0 tailwindcss@^4 && npm install -D @tailwindcss/vite@^4
```
Expected: `frontend/package.json` 出现三个依赖,`frontend/package-lock.json` 更新,无报错。

- [ ] **Step 2: 移除仓库根的 motion 声明**

编辑 `/opt/nhentai/package.json`,删除 `dependencies.motion`(若删后 dependencies 为空则保留 `{}`)。然后:
```bash
cd /opt/nhentai && rm -rf node_modules && npm install
```
Expected: 根 `package-lock.json` 不再含 motion;根 `node_modules` 不再有 `motion`/`framer-motion`。

- [ ] **Step 3: 验证构建仍通过**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS(tsc + vite build 成功,无新增报错)。

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai && git add frontend/package.json frontend/package-lock.json package.json package-lock.json
git commit -m "chore: 迁移 motion 至 frontend 并安装 Tailwind v4"
```

---

### Task 2: Tailwind 入口样式(方案 A)

**Files:**
- Modify: `frontend/vite.config.ts`(加 `@tailwindcss/vite` 插件)
- Create: `frontend/src/styles/tailwind-entry.css`
- Modify: `frontend/src/main.tsx`(在 `app.css` 之前引入 tailwind-entry.css)

**Interfaces:**
- Produces: 全局可用的 Tailwind 工具类(无前缀、无 preflight);`.fx-scope` 作用域类;`--color-*` 主题变量映射到现有 token。

- [ ] **Step 1: 配置 Vite 插件**

编辑 `frontend/vite.config.ts`,引入并注册插件(保留现有 `@vitejs/plugin-react`):
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ...保留现有 server/proxy 等配置不动
});
```

- [ ] **Step 2: 创建 tailwind-entry.css**

Create `frontend/src/styles/tailwind-entry.css`:
```css
@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
/* 故意省略 tailwindcss/preflight.css —— 不引入全局 reset,保护现有 app.css */

/* shadcn/magicui 效果组件岛依赖 border-box,scoped 到 .fx-scope,不污染全站 */
.fx-scope,
.fx-scope * {
  box-sizing: border-box;
}

/* 把现有 app.css 设计 token 映射进 Tailwind theme,使工具类也能用品牌色 */
@theme {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-surface-solid: var(--surface-solid);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-accent: var(--accent);
  --color-accent-dark: var(--accent-dark);
  --color-green: var(--green);
  --color-warn: var(--warn);
}
```

- [ ] **Step 3: 在 main.tsx 中按顺序引入**

编辑 `frontend/src/main.tsx`,使 tailwind-entry 在 app.css **之前**:
```tsx
import "./styles/tailwind-entry.css";
import "./styles/app.css";
```
(原本只有 `import "./styles/app.css";`,在其上方加一行。)

- [ ] **Step 4: 验证构建通过**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS。`dist` 产物中出现 Tailwind utilities,但无 preflight reset 规则(如无 `*,::before,::after{box-sizing:border-box}` 全局规则,仅有 `.fx-scope` 版)。

- [ ] **Step 5: Commit**

```bash
cd /opt/nhentai && git add frontend/vite.config.ts frontend/src/styles/tailwind-entry.css frontend/src/main.tsx
git commit -m "feat: 接入 Tailwind v4(关 Preflight + 不加前缀 + token 映射)"
```

---

### Task 3: 动画规范常量与 reduced-motion 钩子

**Files:**
- Create: `frontend/src/lib/motion/tokens.ts`
- Create: `frontend/src/lib/motion/useReducedMotion.ts`

**Interfaces:**
- Produces:
  - `duration: { fast: number; base: number; slow: number }`
  - `ease: { standard: number[]; exit: number[]; spring: { type: "spring"; stiffness: number; damping: number } }`
  - `stagger: { base: number }`
  - `usePrefersReducedMotion(): boolean`

- [ ] **Step 1: 创建 tokens.ts**

Create `frontend/src/lib/motion/tokens.ts`:
```ts
export const duration = { fast: 0.18, base: 0.28, slow: 0.5 } as const;

export const ease = {
  standard: [0.4, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  spring: { type: "spring", stiffness: 320, damping: 30 },
} as const;

export const stagger = { base: 0.05 } as const;
```

- [ ] **Step 2: 创建 useReducedMotion.ts**

Create `frontend/src/lib/motion/useReducedMotion.ts`:
```ts
import { useReducedMotion } from "motion/react";

/** 系统开启「减少动态」时返回 true;原语据此降级。 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
```

- [ ] **Step 3: 验证构建通过**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS(tsc 通过,确认 `motion/react` 类型解析正常)。

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai && git add frontend/src/lib/motion/tokens.ts frontend/src/lib/motion/useReducedMotion.ts
git commit -m "feat: 添加动画规范常量与 reduced-motion 钩子"
```

---

### Task 4: 动画原语组件

**Files:**
- Create: `frontend/src/lib/motion/primitives.tsx`
- Create: `frontend/src/lib/motion/index.ts`

**Interfaces:**
- Consumes: `duration`, `ease`, `stagger`(Task 3);`usePrefersReducedMotion`(Task 3);`motion`, `AnimatePresence` from `motion/react`。
- Produces:
  - `<FadeIn x?={number} y?={number} delay?={number} className?={string}>`
  - `<Stagger className?={string}>` / `<StaggerItem className?={string}>`
  - `<Reveal y?={number} className?={string}>`
  - `<Presence>`(包装 AnimatePresence)
  - `index.ts` re-export 上述 + tokens + `usePrefersReducedMotion`。

- [ ] **Step 1: 创建 primitives.tsx**

Create `frontend/src/lib/motion/primitives.tsx`:
```tsx
import { motion, AnimatePresence, type Variants } from "motion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { duration, ease, stagger } from "./tokens";
import { usePrefersReducedMotion } from "./useReducedMotion";

type DivMotionProps = PropsWithChildren<{ className?: string; delay?: number }>;

/** 进场淡入,可选位移。reduced-motion 下退化为纯淡入。 */
export function FadeIn({
  children,
  className,
  delay = 0,
  x = 0,
  y = 0,
}: DivMotionProps & { x?: number; y?: number }) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: reduce ? 0 : x, y: reduce ? 0 : y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: duration.base, ease: ease.standard, delay }}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.base } },
};

/** 列表/网格容器,子项用 <StaggerItem> 逐项进场。 */
export function Stagger({ children, className }: DivMotionProps) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** Stagger 的子项。 */
export function StaggerItem({ children, className }: DivMotionProps) {
  const reduce = usePrefersReducedMotion();
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } },
  };
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

/** 滚动进入视口时揭示。 */
export function Reveal({
  children,
  className,
  y = 16,
}: DivMotionProps & { y?: number }) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: duration.base, ease: ease.standard }}
    >
      {children}
    </motion.div>
  );
}

/** 路由/弹窗进出场。包装 AnimatePresence。 */
export function Presence({ children }: { children: ReactNode }) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
}
```

- [ ] **Step 2: 创建 index.ts 统一出口**

Create `frontend/src/lib/motion/index.ts`:
```ts
export { FadeIn, Stagger, StaggerItem, Reveal, Presence } from "./primitives";
export { duration, ease, stagger } from "./tokens";
export { usePrefersReducedMotion } from "./useReducedMotion";
```

- [ ] **Step 3: 验证构建通过**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS(tsc 对 motion 组件与 Variants 类型校验通过)。

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai && git add frontend/src/lib/motion/primitives.tsx frontend/src/lib/motion/index.ts
git commit -m "feat: 添加 motion 动画原语(FadeIn/Stagger/Reveal/Presence)"
```

---

### Task 5: 效果接入规范文档

**Files:**
- Create: `frontend/src/components/effects/README.md`

**Interfaces:**
- Produces: 后续阶段引入 magicui/react-bits 效果时遵循的检查清单。

- [ ] **Step 1: 创建 README.md**

Create `frontend/src/components/effects/README.md`:
```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd /opt/nhentai && git add frontend/src/components/effects/README.md
git commit -m "docs: 添加 effects 接入规范"
```

---

### Task 6: 示例 1 — motion 原语链路(Stagger demo)

**Files:**
- Create: `frontend/src/components/effects/StaggerDemo.tsx`

**Interfaces:**
- Consumes: `Stagger`, `StaggerItem` from `../../lib/motion`。
- Produces: `<StaggerDemo>` —— 独立 demo 组件,逐项淡入一组占位卡片;不接入真实页面。

- [ ] **Step 1: 创建 StaggerDemo.tsx**

Create `frontend/src/components/effects/StaggerDemo.tsx`:
```tsx
// 示例组件:验证 motion 原语链路(逐项进场)。仅用于阶段 0 验收,不接入真实页面。
import { Stagger, StaggerItem } from "../../lib/motion";

const SAMPLE = ["其一", "其二", "其三", "其四"];

export function StaggerDemo() {
  return (
    <Stagger className="fx-scope">
      {SAMPLE.map((label) => (
        <StaggerItem key={label}>
          <div
            style={{
              padding: "16px 20px",
              marginBottom: 8,
              background: "var(--surface-solid)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--ink)",
              boxShadow: "var(--shadow)",
            }}
          >
            {label}
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
```

- [ ] **Step 2: 验证构建通过**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
cd /opt/nhentai && git add frontend/src/components/effects/StaggerDemo.tsx
git commit -m "feat: 添加 Stagger 示例验证 motion 链路"
```

---

### Task 7: 示例 2 — Tailwind + 效果改造链路(ShineBorder)

**Files:**
- Create: `frontend/src/components/effects/ShineBorder.tsx`

**Interfaces:**
- Consumes: Tailwind 工具类(无前缀);现有 CSS token;`usePrefersReducedMotion`。
- Produces: `<ShineBorder>{children}</ShineBorder>` —— 一圈沿边缘流动的高光描边,使用品牌 `--accent`,reduced-motion 下静态。

- [ ] **Step 1: 创建 ShineBorder.tsx**

Create `frontend/src/components/effects/ShineBorder.tsx`:
```tsx
// 效果来源:magicui "Shine Border"(https://magicui.design/docs/components/shine-border)。
// 已按 effects/README.md 改造:仅保留高光描边效果,配色改用现有 --accent token,
// 去除原模板的卡片布局/文案,reduced-motion 下退化为静态描边。
import { useId } from "react";
import { usePrefersReducedMotion } from "../../lib/motion";

export function ShineBorder({ children }: { children: React.ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const id = useId().replace(/:/g, "");
  return (
    <div className="fx-scope" style={{ position: "relative", borderRadius: 14 }}>
      <style>{`
        @keyframes shine-${id} { to { --shine-angle: 360deg; } }
        @property --shine-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        .shine-${id} {
          position: absolute; inset: 0; border-radius: inherit; padding: 1px;
          background: conic-gradient(from var(--shine-angle),
            transparent 0deg, var(--accent) 60deg, transparent 120deg, transparent 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          ${reduce ? "" : `animation: shine-${id} 4s linear infinite;`}
        }
      `}</style>
      <span className={`shine-${id}`} aria-hidden />
      <div style={{ position: "relative", borderRadius: "inherit", background: "var(--surface-solid)" }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建通过**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
cd /opt/nhentai && git add frontend/src/components/effects/ShineBorder.tsx
git commit -m "feat: 添加 ShineBorder 示例验证 Tailwind+效果改造链路"
```

---

### Task 8: 文档同步与终态验证

**Files:**
- Modify: `docs/PROJECT_MAP.md`(若存在:登记 `frontend/src/lib/motion/` 与 `components/effects/`)
- Modify: `docs/PROJECT_STATUS.md`(若存在:记录阶段 0 完成)

**Interfaces:**
- Consumes: 全部前序任务产物。

- [ ] **Step 1: 更新项目文档**

按 AGENTS.md 要求,在 `docs/PROJECT_MAP.md` 中新增条目说明:`frontend/src/lib/motion/`(动画原语层)、`frontend/src/components/effects/`(效果组件 + 接入规范);在 `docs/PROJECT_STATUS.md` 标注「阶段 0 动画基础设施:完成」。(文件不存在则跳过对应项。)

- [ ] **Step 2: 终态构建验证**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS。

- [ ] **Step 3: 确认依赖位置正确**

Run: `cd /opt/nhentai && grep -c '"motion"' frontend/package.json; grep -c '"motion"' package.json`
Expected: 第一行 `1`(frontend 有),第二行 `0`(根没有)。

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai && git add docs/PROJECT_MAP.md docs/PROJECT_STATUS.md
git commit -m "docs: 同步阶段 0 动画基础设施至项目文档"
```

---

## 用户验收(本机无浏览器,需用户手动)

实现完成后,由用户执行:
```bash
cd /opt/nhentai/frontend && npm run dev
```
检查:
1. 临时挂载 `<StaggerDemo />` 与 `<ShineBorder>` 到任一页面,确认逐项进场动效与流动高光描边正常、配色为暖纸/朱红而非库默认色。
2. 浏览现有 discover/library/reader 等页面,确认观感与接入前**像素级一致**(Preflight 未介入)。
3. 系统开启「减少动态」后刷新,确认动效降级为静态/纯淡入。
