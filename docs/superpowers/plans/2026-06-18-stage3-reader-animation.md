# 阶段 3 · Reader 页动画 Implementation Plan

> 用 superpowers:executing-plans 逐任务执行。

**Goal:** reader 单页翻页轻柔淡入、滚动模式页面淡入、三栏进场,保留全部交互与布局。

**Architecture:** 仅改 `ReaderPage.tsx`(逐页 FadeIn + 三栏内层 FadeIn)+ `app.css` 一条 `.reader-page-cell`。全部基于阶段 0 `FadeIn`。

**Tech Stack:** React 18, motion 12(`lib/motion`)。

## Global Constraints

- 不改任何交互(方向键、章节跳转、滚动 `onLoad` 自动翻页、隐私遮罩)与三栏栅格。
- 时长/缓动只用原语;验证 = `cd /opt/nhentai/frontend && npm run build` 通过;视觉由用户 `npm run dev` 验收。
- commit message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

---

### Task 1: 阅读区单元 CSS

**Files:** Modify `frontend/src/styles/app.css`

- [ ] **Step 1:** 在 `.reader-page img { ... }` 规则之后追加:
```css
/* FadeIn 包裹层:撑满列宽并居中页面图片 */
.reader-page-cell {
  width: 100%;
  display: flex;
  justify-content: center;
}
```

- [ ] **Step 2:** Commit
```bash
cd /opt/nhentai && git add frontend/src/styles/app.css
git commit -m "style(reader): 新增页面 FadeIn 包裹层单元类"
```

---

### Task 2: 阅读区逐页淡入

**Files:** Modify `frontend/src/components/reader/ReaderPage.tsx`
**Interfaces:** Consumes `FadeIn` from `../../lib/motion`。

- [ ] **Step 1:** 加 import(放在 navigation import 下):
```tsx
import { FadeIn } from "../../lib/motion";
```

- [ ] **Step 2:** 将 `.page-stage` 内的图片映射
```tsx
{visiblePages.map((page) => (
  <img
    key={page.key}
    src={page.src}
    alt={`Page ${page.pageIndex}`}
    loading={mode === "scroll" ? "lazy" : "eager"}
    onLoad={() => {
      if (mode === "scroll" && page.pageIndex > pageIndex) void setPage(page.pageIndex);
    }}
  />
))}
```
改为:
```tsx
{visiblePages.map((page) => (
  <FadeIn key={page.key} className="reader-page-cell" y={10}>
    <img
      src={page.src}
      alt={`Page ${page.pageIndex}`}
      loading={mode === "scroll" ? "lazy" : "eager"}
      onLoad={() => {
        if (mode === "scroll" && page.pageIndex > pageIndex) void setPage(page.pageIndex);
      }}
    />
  </FadeIn>
))}
```
(`key` 移到 FadeIn;`<img>` 其余属性与 `onLoad` 不变。)

- [ ] **Step 3:** Build
Run: `cd /opt/nhentai/frontend && npm run build` — Expected: PASS。

- [ ] **Step 4:** Commit
```bash
cd /opt/nhentai && git add frontend/src/components/reader/ReaderPage.tsx
git commit -m "feat(reader): 单页翻页轻柔淡入 + 滚动页淡入"
```

---

### Task 3: 三栏进场

**Files:** Modify `frontend/src/components/reader/ReaderPage.tsx`

- [ ] **Step 1:** 侧栏——在 `<aside className="reader-sidebar">` 内紧接一层 `<FadeIn key={sourceKey} x={-12}>` 包裹其全部子节点(back-button / reader-work / chapter-list),`</FadeIn>` 置于 `</aside>` 前。栏的 className 不动。

- [ ] **Step 2:** 阅读区——在 `<div className="reader-main">` 内包一层 `<FadeIn key={sourceKey} y={8}>`,包裹 reader-toolbar、notice、page-stage 全部内容,`</FadeIn>` 置于该 `</div>` 前。(其内的逐页 FadeIn 保持不变,嵌套无碍。)

- [ ] **Step 3:** 详情栏——在 `<aside className="reader-inspector">` 内包一层 `<FadeIn key={sourceKey} x={12}>`,包裹 reader-tabs、reader-info,`</FadeIn>` 置于 `</aside>` 前。

- [ ] **Step 4:** Build
Run: `cd /opt/nhentai/frontend && npm run build` — Expected: PASS。

- [ ] **Step 5:** Commit
```bash
cd /opt/nhentai && git add frontend/src/components/reader/ReaderPage.tsx
git commit -m "feat(reader): 三栏进场动画(切换作品重播)"
```

---

### Task 4: 文档同步

**Files:** Modify `docs/PROJECT_STATUS.md`

- [ ] **Step 1:** 在 `## Completed` 顶部追加阶段 3 条目(翻页淡入 + 滚动淡入 + 三栏进场),引用本阶段 spec/plan。
- [ ] **Step 2:** Commit
```bash
cd /opt/nhentai && git add docs/PROJECT_STATUS.md
git commit -m "docs: 记录阶段 3 reader 动画"
```

## 用户验收
`npm run dev` 打开任一作品:单页翻页新页轻柔淡入;切到连续滚动,下滑时新页淡入;切换/打开作品三栏进场;方向键/章节跳转/滚动自动翻页/隐私遮罩不回归;图片不溢出;reduced-motion 仅淡入。
