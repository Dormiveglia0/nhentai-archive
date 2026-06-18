# 动画改造交接文档(给 codex)

> 这是与 `docs/NEXT_STAGE_PROMPT.md`(产品功能路线 / 治理中心)**并行的另一条线**:全站动画/视觉美化。两者互不覆盖。本文件让你(codex)能直接接手动画改造的剩余阶段。

## 0. 必读顺序

1. 本文件
2. `docs/PROJECT_STATUS.md`(`## Completed` 顶部即动画各阶段状态)
3. `docs/superpowers/specs/2026-06-18-stage0-animation-foundation-design.md`(地基设计)
4. `docs/superpowers/specs/2026-06-18-stage{1,2,3}-*-design.md`(已完成阶段的设计,作为模式参考)
5. `frontend/src/lib/motion/`(动画原语层,你会一直用它)
6. `frontend/src/components/effects/README.md`(效果素材接入硬规范)

## 1. 不可动摇的指导原则

> **库只作动画/效果的来源,不作 UI 模板。** 引入的任何效果必须改造进现有设计语言(配色/间距/圆角/字体走 `app.css` 既有 token);**禁止**整段套用库的模板化 UI 布局。**动画可以套模板,UI 设计不套模板。** 目标是「优化美化现有设计」,不是「打碎重组」。

设计 token(必须复用,禁止引入库默认 slate/blue/紫渐变):
`--paper #f7f1e7` / `--surface` / `--surface-solid` / `--ink #181411` / `--muted` / `--line` / `--line-strong` / `--accent #b92d1e` / `--accent-dark` / `--green` / `--warn` / `--shadow`。

## 2. 已就位的地基(阶段 0,不要重建)

- **Tailwind v4(方案 A)**:`frontend/src/styles/tailwind-entry.css` —— **省略 Preflight**(不引入全局 reset,保护 70KB 手写 `app.css`)、**不加前缀**、按层导入、`@theme` 把 `app.css` token 映射成 `--color-*`。在 `main.tsx` 中**先于** `app.css` 引入。
- **打包瘦身**:全局用 `LazyMotion` + `m` + `domAnimation`(strict),Provider 在 `frontend/src/lib/motion/MotionProvider.tsx`,已包在 `main.tsx` 根部。
  - ⚠️ **strict 模式下禁止使用 `motion.*`,只能用原语层(内部用 `m`)。** 误用 `motion.*` 会直接报错。
  - ⚠️ 若你的阶段需要 **layout 动画 / drag 手势**,把 `MotionProvider` 里的 `domAnimation` 换成 `domMax`(其余不变)。
- **动画原语层** `frontend/src/lib/motion/`(统一从 `lib/motion` 出口 import):
  - `tokens.ts`:`duration {fast .18, base .28, slow .5}`、`ease {standard, exit, spring}`、`stagger {base .05}`。**所有时长/缓动只引用这里,禁止写魔法数。**
  - `FadeIn({ x?, y?, delay?, className? })` —— 进场淡入,可选位移。
  - `Stagger({ className? })` + `StaggerItem({ className? })` —— 列表/网格逐项进场。
  - `Reveal({ y?, className? })` —— `whileInView` 滚动揭示(⚠️ 仅在元素随**窗口**滚动时可靠;**内部 `overflow:auto` 容器内不要用 Reveal**,改用 `FadeIn` 挂载淡入)。
  - `Presence` —— 包装 `AnimatePresence`,用于路由/弹窗进出场。
  - `usePrefersReducedMotion()` —— 所有原语已内置 reduced-motion 降级,你**无需重复处理**。

## 3. 每个阶段都必须遵守的落地约定(从阶段 1-3 沉淀)

1. **只用原语层**,不直接碰 motion/Tailwind 模板组件。
2. **结果变化重播模式**(卡片墙/列表):容器换 `<Stagger>`,给它一个随结果集变化的 `key`,例:
   `key={`${view}:${page}:${items.length}:${items[0]?.id ?? "none"}`}`,key 变 → 重挂载 → 重播。
3. **包裹层放在元素"内部"而非"外面"**:若容器是 grid/flex 布局,不要在外面套 motion div(会把布局子项换成包裹层)。把 `Stagger`/`FadeIn` 作为容器本身,或放进容器内部包内容。
4. **等高/防压缩透传类**:包裹层破坏原布局时,加一条极小 CSS 透传类修复(已有先例:`.discover-card-cell`/`.library-card-cell` = `display:flex` 保 grid 等高;`.shelf-cell` = `flex:0 0 auto` 防横向轨道压缩;`.reader-page-cell` = `width:100%;display:flex;justify-content:center`)。**先看目标元素的 `app.css` 规则再决定。**
5. **保留全部现有交互与视觉**:hover、键盘、滚动、遮罩、选中态等一律不动;只加进场/过渡。
6. **验证**:本仓前端无 JS 测试框架。每步以 `cd frontend && npm run build`(`tsc -b && vite build`)通过为准;**本机/CI 无浏览器,视觉与动效必须由人跑 `npm run dev` 验收**(在交付说明里写清楚要验收什么)。
7. **流程**:每个页面阶段 = 独立 `docs/superpowers/specs/<date>-stageN-*-design.md` + `docs/superpowers/plans/<date>-stageN-*.md` + 实现 + 更新 `PROJECT_STATUS.md`(+ 必要时 `PROJECT_MAP.md`)。先勘查目标页结构,遇到真正的设计方向取舍(过渡风格/范围)再问人。
8. **commit**:scoped message,结尾加
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## 4. 已完成阶段(模式参考)

| 阶段 | 范围 | 关键改动 |
|---|---|---|
| 0 地基 | Tailwind 方案 A + 原语层 + effects 规范 + 瘦身 | `lib/motion/`、`tailwind-entry.css`、`components/effects/`(`StaggerDemo`/`ShineBorder` 验证示例) |
| 1 discover | 卡片墙逐项进场(结果变化重播) | `DiscoverFeed.tsx` 容器换 `Stagger` + `.discover-card-cell` |
| 2 library | 主墙 + 两条书架行 + 详情面板 | `LibraryPage.tsx`(主墙 Stagger)、`ContinueReadingRow.tsx`(书架 Stagger + `.shelf-cell`)、`WorkInspector.tsx`(`FadeIn` keyed by work.id)、`.library-card-cell` |
| 3 reader | 翻页轻柔淡入 + 滚动页淡入 + 三栏进场 | `ReaderPage.tsx`(逐页 `FadeIn key=page.key` + 三栏内层 `FadeIn key=sourceKey`)、`.reader-page-cell` |

## 5. 剩余阶段 4:dictionary / settings(你的任务)

1. **先勘查**:`frontend/src/components/dictionary/` 与 `frontend/src/components/settings/`,列出可动画面(候选列表/词条网格/预览面板/设置分区等),看清各自的 `app.css` 布局(grid/flex/scroll)。
2. **套用第 3 节模式**:列表/网格 → `Stagger` + 结果变化 `key`;面板切换 → `FadeIn` keyed;按需补透传类。词典若有"预览/应用"结果区,适合结果变化重播。
3. **设计方向问人**:范围(只列表 vs 含面板切换)、过渡风格,若有歧义先问,再落 spec/plan/实现。
4. **注意**:词典模块涉及真实数据写入(apply/preview),**只加视觉动画,绝不改其数据逻辑**;遵守 AGENTS.md「不得加 mock 作品/假任务/随机统计/硬编码 tag 候选」。

## 6. 环境事实

- 前端:`cd frontend && npm install`(node_modules 不入库;离线缓存可用),`npm run build`,`npm run dev`(`vite --host 0.0.0.0`)。
- 后端测试(若触碰边界):`PYTHONPATH=backend /opt/nhentai/.venv/bin/pytest backend/tests -q`。
- 本环境**无浏览器/Playwright**,动效与视觉一律请人验收。
- 分支:`codex-nh-archive-local-web`,已推 `origin`。
