# 阶段 1 · Discover 卡片墙进场动画 Implementation Plan

> **For agentic workers:** 用 superpowers:executing-plans 或 subagent-driven-development 逐任务执行。

**Goal:** 给 discover 卡片墙加逐项进场动画,翻页/筛选/切视图时重播,保留现有 hover 与等高行。

**Architecture:** 仅改 `DiscoverFeed.tsx`(容器换 `Stagger`、卡片包 `StaggerItem`、加结果集 `key`)+ `app.css` 加一条 `.discover-card-cell` 透传类。

**Tech Stack:** React 18, motion 12(阶段 0 原语 `lib/motion`)。

## Global Constraints

- 不改 `DiscoverCard` 内部与现有 hover CSS。
- 动画时长/缓动只用 `lib/motion` 原语,禁止魔法数。
- 验证 = `cd /opt/nhentai/frontend && npm run build` 通过;视觉由用户 `npm run dev` 验收。
- commit message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

### Task 1: 卡片墙接入 Stagger + 等高行保护

**Files:**
- Modify: `frontend/src/components/discover/DiscoverFeed.tsx`
- Modify: `frontend/src/styles/app.css`(新增 `.discover-card-cell`)

**Interfaces:**
- Consumes: `Stagger`, `StaggerItem` from `../../lib/motion`。

- [ ] **Step 1: 加等高行透传类**

在 `app.css` 的 `.discover-card-grid` 规则之后追加:
```css
.discover-card-cell {
  display: flex;
}
```

- [ ] **Step 2: 改 DiscoverFeed 容器与卡片包裹**

`DiscoverFeed.tsx`:
1. 顶部加 `import { Stagger, StaggerItem } from "../../lib/motion";`
2. 将原卡片容器:
```tsx
<div className={viewMode === "grid" ? "discover-card-grid" : "discover-card-list"}>
  {items.map((item) => (
    <DiscoverCard key={item.gallery_id} ... />
  ))}
</div>
```
改为:
```tsx
<Stagger
  key={`${viewMode}:${page}:${items.length}:${items[0]?.gallery_id ?? "none"}`}
  className={viewMode === "grid" ? "discover-card-grid" : "discover-card-list"}
>
  {items.map((item) => (
    <StaggerItem key={item.gallery_id} className="discover-card-cell">
      <DiscoverCard
        item={item}
        blurCovers={blurCovers}
        viewMode={viewMode}
        onOpen={() => onOpen(item.gallery_id)}
        onImport={() => onImport(item.gallery_id)}
        onPickTag={onPickTag}
      />
    </StaggerItem>
  ))}
</Stagger>
```
(empty-state、error/notice、IconPager 等其余结构保持不动。)

- [ ] **Step 3: 验证构建**

Run: `cd /opt/nhentai/frontend && npm run build`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
cd /opt/nhentai && git add frontend/src/components/discover/DiscoverFeed.tsx frontend/src/styles/app.css
git commit -m "feat(discover): 卡片墙逐项进场动画(结果变化重播)"
```

---

### Task 2: 文档同步

**Files:**
- Modify: `docs/PROJECT_STATUS.md`

- [ ] **Step 1: 记录阶段 1**

在 `## Completed` 顶部追加一行,说明 discover 卡片墙已接入逐项进场动画(结果变化重播,保留 hover/等高行),引用本阶段 spec/plan。

- [ ] **Step 2: Commit**

```bash
cd /opt/nhentai && git add docs/PROJECT_STATUS.md
git commit -m "docs: 记录阶段 1 discover 卡片墙动画"
```

## 用户验收

`cd /opt/nhentai/frontend && npm run dev`,确认:翻页/换筛选/切 grid↔list 卡片逐项浮现;hover 不变;等高行正常;reduced-motion 下仅淡入。
