# 阶段 2 · Library 页动画 Implementation Plan

> 用 superpowers:executing-plans 逐任务执行。

**Goal:** library 主卡片墙逐项进场(结果变化重播)、两条书架行进场、详情面板淡入切换,保留现有视觉/hover/布局。

**Architecture:** 复用阶段 0 原语。改 `LibraryPage.tsx`(主墙 Stagger)、`ContinueReadingRow.tsx`(书架 Stagger)、`WorkInspector.tsx`(FadeIn)+ `app.css` 两条透传类。

**Tech Stack:** React 18, motion 12(`lib/motion`)。

## Global Constraints

- 不改卡片/面板视觉与现有 hover;时长/缓动只用原语,禁止魔法数。
- 验证 = `cd /opt/nhentai/frontend && npm run build` 通过;视觉由用户 `npm run dev` 验收。
- commit message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

### Task 1: CSS 透传类

**Files:** Modify `frontend/src/styles/app.css`

- [ ] **Step 1:** 在 `.library-list` 规则之后追加:
```css
/* Stagger 包裹层:grid 等高行保护 */
.library-card-cell {
  display: flex;
}
/* Stagger 包裹层:横向书架轨道防压缩 */
.shelf-cell {
  flex: 0 0 auto;
}
```

- [ ] **Step 2:** Commit
```bash
cd /opt/nhentai && git add frontend/src/styles/app.css
git commit -m "style(library): 新增 Stagger 包裹层透传类"
```

---

### Task 2: 主卡片墙 Stagger

**Files:** Modify `frontend/src/components/library/LibraryPage.tsx`
**Interfaces:** Consumes `Stagger`, `StaggerItem` from `../../lib/motion`。

- [ ] **Step 1:** 加 import(与现有 import 区一致):
```tsx
import { Stagger, StaggerItem } from "../../lib/motion";
```

- [ ] **Step 2:** 将主墙容器
```tsx
<div className={view === "grid" ? "library-grid" : "library-list"}>
  {works.map((work) => (
    <WorkCard key={work.id} ... />
  ))}
</div>
```
改为:
```tsx
<Stagger
  key={`${view}:${page}:${works.length}:${works[0]?.id ?? "none"}`}
  className={view === "grid" ? "library-grid" : "library-list"}
>
  {works.map((work) => (
    <StaggerItem key={work.id} className="library-card-cell">
      <WorkCard
        work={work}
        view={view}
        blurCovers={blurCovers}
        selected={selected?.id === work.id}
        onSelect={() => setSelected(work)}
        onPickTag={pickTag}
      />
    </StaggerItem>
  ))}
</Stagger>
```

- [ ] **Step 3:** Build
Run: `cd /opt/nhentai/frontend && npm run build` — Expected: PASS。

- [ ] **Step 4:** Commit
```bash
cd /opt/nhentai && git add frontend/src/components/library/LibraryPage.tsx
git commit -m "feat(library): 主卡片墙逐项进场动画(结果变化重播)"
```

---

### Task 3: 书架行 Stagger

**Files:** Modify `frontend/src/components/library/ContinueReadingRow.tsx`
**Interfaces:** Consumes `Stagger`, `StaggerItem` from `../../lib/motion`。

- [ ] **Step 1:** 加 import:
```tsx
import { Stagger, StaggerItem } from "../../lib/motion";
```

- [ ] **Step 2:** 将 `.library-shelf-track` 容器
```tsx
<div className="library-shelf-track">
  {works.map((work) => (
    <button key={work.id} type="button" className="shelf-item" onClick={...}>
      ...
    </button>
  ))}
</div>
```
改为用 `Stagger` 作容器,每个 button 包 `StaggerItem className="shelf-cell"`(button 及其内部结构保持不动):
```tsx
<Stagger className="library-shelf-track">
  {works.map((work) => (
    <StaggerItem key={work.id} className="shelf-cell">
      <button type="button" className="shelf-item" onClick={() => navigate({ name: "reader", workId: work.id })}>
        <div className="shelf-cover">
          {work.cover_path ? (
            <img className={blurCovers ? "blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" loading="lazy" />
          ) : (
            <span className="cover-fallback">NO COVER</span>
          )}
          {(work.progress_percent ?? 0) > 0 ? (
            <span className="shelf-progress" style={{ width: `${work.progress_percent}%` }} />
          ) : null}
        </div>
        <strong title={workTitle(work)}>{workTitle(work)}</strong>
        <small>{work.completed ? "已读" : `${work.progress_percent ?? 0}%`}</small>
      </button>
    </StaggerItem>
  ))}
</Stagger>
```

- [ ] **Step 3:** Build
Run: `cd /opt/nhentai/frontend && npm run build` — Expected: PASS。

- [ ] **Step 4:** Commit
```bash
cd /opt/nhentai && git add frontend/src/components/library/ContinueReadingRow.tsx
git commit -m "feat(library): 书架行逐项进场动画"
```

---

### Task 4: 详情面板淡入

**Files:** Modify `frontend/src/components/library/WorkInspector.tsx`
**Interfaces:** Consumes `FadeIn` from `../../lib/motion`。

- [ ] **Step 1:** 加 import:
```tsx
import { FadeIn } from "../../lib/motion";
```

- [ ] **Step 2:** 空状态分支:把 `<aside>` 内的 `.empty-state` 包进 FadeIn:
```tsx
return (
  <aside className="work-inspector">
    <FadeIn key="empty" y={8}>
      <div className="empty-state compact">
        <Info size={20} />
        <strong>作品详情</strong>
        <p>选择封面后显示文件信息、标签与阅读进度。</p>
      </div>
    </FadeIn>
  </aside>
);
```

- [ ] **Step 3:** 有作品分支:把 `<aside>` 内全部内容包进单个 FadeIn(键为 work.id):
```tsx
return (
  <aside className="work-inspector">
    <FadeIn key={work.id} y={8}>
      <div className="inspector-head">
        {/* ...原有 head/cover/h2/dl/tags/buttons 全部内容,原样移入,不改 ... */}
      </div>
      {/* 其余原有元素 */}
    </FadeIn>
  </aside>
);
```
(仅在 `.work-inspector` 与原内容之间插入一层 `FadeIn`,内部 JSX 不改。)

- [ ] **Step 4:** Build
Run: `cd /opt/nhentai/frontend && npm run build` — Expected: PASS。

- [ ] **Step 5:** Commit
```bash
cd /opt/nhentai && git add frontend/src/components/library/WorkInspector.tsx
git commit -m "feat(library): 详情面板选中切换淡入"
```

---

### Task 5: 文档同步

**Files:** Modify `docs/PROJECT_STATUS.md`

- [ ] **Step 1:** 在 `## Completed` 顶部追加阶段 2 条目(主墙+书架行+详情面板动画),引用本阶段 spec/plan。
- [ ] **Step 2:** Commit
```bash
cd /opt/nhentai && git add docs/PROJECT_STATUS.md
git commit -m "docs: 记录阶段 2 library 动画"
```

## 用户验收
`npm run dev`:主墙翻页/筛选/切视图逐项浮现;两条书架行进场;点选不同封面详情淡入;hover/等高/横向滚动不回归;reduced-motion 仅淡入。
