# 阅读器页面完全重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 285 行单文件三栏阅读器重写为沉浸全屏、可呼出面板的成熟漫画阅读器（单页 / Webtoon、阅读方向、缩放适配、点击区翻页、缩略图、键盘+全屏），并清理 app.css 中重复的 reader 样式。

**Architecture:** 编排组件 `ReaderPage.tsx` 只负责数据装配与布局；状态逻辑收敛进三个 hooks（`useReaderData` 数据、`useReaderPrefs` 偏好、`useReaderChrome` 自动隐藏）；视图拆成 `SinglePageView` / `WebtoonView`，由 `ReaderViewport` 按模式切换；`ReaderToolbar` / `ThumbnailPanel` / `ReaderInfoPanel` 为浮层 chrome；公共类型/常量/键位映射放 `readerHelpers.ts`。

**Tech Stack:** React 18 + TypeScript（严格模式）、Vite、Tailwind v4、motion、lucide-react。无前端单元测试框架。

## Global Constraints

- **对外接口不变**：`ReaderPage` 的 props 必须保持 `{ source: { kind: "local"; workId: number } | { kind: "remote"; galleryId: number }; privacyMode: boolean }`，App.tsx 不改动。
- **验证门（每个任务）**：本仓库无 vitest/jest，前端无单元测试。每个任务的验证 = `cd frontend && npm run build`（即 `tsc -b` 严格类型检查 + vite build）必须零错误通过。这是本环境唯一可靠的自动化门。
- **浏览器 QA 不可在本环境运行**（dev-environment 记忆）：凡需真实浏览器的视觉/交互验证，写明"待用户/CI 验证"，不要谎称已通过。
- **标签显示规则**：UI 标签一律显示字典 `display`（远端 `GalleryDetail.tags[].display`，回退 `name`）。本地 `api.work` 不含 tags，本地信息面板不显示标签。
- **TDD 适配说明**：由于无 JS 单元运行器，本计划用「实现 → 类型/构建门 → 提交」循环替代红绿测试；纯逻辑（键位/裁剪/偏好序列化）做成纯函数，由最终的 Playwright e2e 任务覆盖行为。
- **commit 规范**：commit message 结尾追加
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012DutvCvk9MrkbgXsT7Exir
  ```
- **数据接口（既有）**：`api.work(id)`、`api.pages(id)→{result:PageInfo[]}`、`api.readerState(id)→ReaderState`、`api.updateReaderState(id, pageIndex, completed=false)`、`api.gallery(id)→GalleryDetail`、`api.importGallery(id)`。本地页面图片 URL `/api/works/${workId}/pages/${pageIndex}`，本地封面 `/api/works/${id}/cover`。
- **导航**：`navigate({ name: "library" | "discover" | "governance", ... })` from `lib/navigation`。

---

## File Structure

新增（`frontend/src/components/reader/`）：

- `readerHelpers.ts` — 类型 `Mode/Direction/Fit/ReaderPanel/ReaderPageItem/ReaderPrefs`、常量、纯函数 `clamp/parsePrefs/serializePrefs/arrowDelta/clickZoneDelta`。
- `useReaderPrefs.ts` — 偏好 hook（localStorage 持久化 mode/direction/fit）。
- `useReaderData.ts` — 数据 hook（加载、归一化、`setPage` 本地防抖持久化 / 远端内存、`importRemote`）。
- `useReaderChrome.ts` — chrome 自动隐藏 hook。
- `SinglePageView.tsx` — 单页视图（适配/缩放/平移 + 点击区）。
- `WebtoonView.tsx` — 连续滚动视图（懒加载 + 当前页观测）。
- `ReaderViewport.tsx` — 按模式切换视图的舞台容器。
- `ReaderToolbar.tsx` — 浮层顶栏。
- `ThumbnailPanel.tsx` — 缩略图抽屉。
- `ReaderInfoPanel.tsx` — 信息 + 动作 + 阅读设置抽屉。

重写：
- `ReaderPage.tsx` — 编排组件。

修改：
- `frontend/src/styles/app.css` — 收敛/清理 `reader-*` 规则。

新增测试（最终任务）：
- `frontend/playwright.config.ts`、`frontend/e2e/reader.spec.ts`。

---

## Task 1: 基础类型、常量与纯函数（readerHelpers.ts）

**Files:**
- Create: `frontend/src/components/reader/readerHelpers.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - 类型 `Mode = "single" | "webtoon"`、`Direction = "ltr" | "rtl"`、`Fit = "width" | "height" | "original"`、`ReaderPanel = "none" | "thumbnails" | "info"`、`ReaderPageItem = { key: string; pageIndex: number; src: string }`、`ReaderPrefs = { mode: Mode; direction: Direction; fit: Fit }`。
  - 常量 `DEFAULT_PREFS`、`PREFS_KEY`、`CHROME_IDLE_MS`、`PERSIST_DEBOUNCE_MS`、`ZOOM_MIN`、`ZOOM_MAX`、`ZOOM_STEP`。
  - 函数 `clamp(value, min, max): number`、`parsePrefs(raw: string | null): ReaderPrefs`、`serializePrefs(prefs: ReaderPrefs): string`、`arrowDelta(key: string, direction: Direction): number`、`clickZoneDelta(zone: "left" | "right", direction: Direction): number`。

- [ ] **Step 1: 创建 readerHelpers.ts**

```ts
export type Mode = "single" | "webtoon";
export type Direction = "ltr" | "rtl";
export type Fit = "width" | "height" | "original";
export type ReaderPanel = "none" | "thumbnails" | "info";

export type ReaderPageItem = {
  key: string;
  pageIndex: number;
  src: string;
};

export type ReaderPrefs = {
  mode: Mode;
  direction: Direction;
  fit: Fit;
};

export const DEFAULT_PREFS: ReaderPrefs = { mode: "single", direction: "rtl", fit: "height" };
export const PREFS_KEY = "nh.reader.prefs";
export const CHROME_IDLE_MS = 2500;
export const PERSIST_DEBOUNCE_MS = 600;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function parsePrefs(raw: string | null): ReaderPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      mode: parsed.mode === "webtoon" ? "webtoon" : "single",
      direction: parsed.direction === "ltr" ? "ltr" : "rtl",
      fit:
        parsed.fit === "width" || parsed.fit === "original" || parsed.fit === "height"
          ? parsed.fit
          : DEFAULT_PREFS.fit,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefs(prefs: ReaderPrefs): string {
  return JSON.stringify(prefs);
}

/** 水平方向键 → 翻页增量（+1 下一页 / -1 上一页 / 0 非翻页键）。rtl 下左键为下一页。 */
export function arrowDelta(key: string, direction: Direction): number {
  if (key === "ArrowLeft") return direction === "rtl" ? 1 : -1;
  if (key === "ArrowRight") return direction === "rtl" ? -1 : 1;
  return 0;
}

/** 点击区 → 翻页增量。rtl 下左侧点击区为下一页。 */
export function clickZoneDelta(zone: "left" | "right", direction: Direction): number {
  if (zone === "left") return direction === "rtl" ? 1 : -1;
  return direction === "rtl" ? -1 : 1;
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功，无 TS 报错。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/readerHelpers.ts
git commit -m "feat(reader): 基础类型/常量/纯函数 helpers"
```

---

## Task 2: 偏好 hook（useReaderPrefs.ts）

**Files:**
- Create: `frontend/src/components/reader/useReaderPrefs.ts`

**Interfaces:**
- Consumes: `ReaderPrefs/Mode/Direction/Fit/parsePrefs/serializePrefs/PREFS_KEY/DEFAULT_PREFS` from `./readerHelpers`。
- Produces: `useReaderPrefs(): { prefs: ReaderPrefs; setMode(m: Mode): void; setDirection(d: Direction): void; setFit(f: Fit): void }`。

- [ ] **Step 1: 创建 useReaderPrefs.ts**

```ts
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_PREFS,
  Direction,
  Fit,
  Mode,
  PREFS_KEY,
  parsePrefs,
  ReaderPrefs,
  serializePrefs,
} from "./readerHelpers";

export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    return parsePrefs(window.localStorage.getItem(PREFS_KEY));
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, serializePrefs(prefs));
    } catch {
      /* localStorage 不可用时静默降级为仅内存 */
    }
  }, [prefs]);

  const setMode = useCallback((mode: Mode) => setPrefs((p) => ({ ...p, mode })), []);
  const setDirection = useCallback((direction: Direction) => setPrefs((p) => ({ ...p, direction })), []);
  const setFit = useCallback((fit: Fit) => setPrefs((p) => ({ ...p, fit })), []);

  return { prefs, setMode, setDirection, setFit };
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/useReaderPrefs.ts
git commit -m "feat(reader): 阅读偏好 hook + localStorage 持久化"
```

---

## Task 3: 数据 hook（useReaderData.ts）

**Files:**
- Create: `frontend/src/components/reader/useReaderData.ts`

**Interfaces:**
- Consumes: `ReaderPageItem/clamp` from `./readerHelpers`；`api, GalleryDetail, PageInfo, ReaderState, Work` from `../../lib/api`。
- Produces:
  ```ts
  type ReaderTag = { id: number; type: string; display: string };
  type UseReaderDataResult = {
    loading: boolean;
    error: string | null;
    notice: string | null;
    isRemote: boolean;
    sourceKey: string;
    title: string;
    coverSrc: string | null;
    tags: ReaderTag[];
    pages: ReaderPageItem[];
    pageIndex: number;
    pageCount: number;
    progressPercent: number;
    completed: boolean;
    work: Work | null;
    gallery: GalleryDetail | null;
    setPage: (next: number, completed?: boolean) => void;
    markCompleted: () => void;
    importRemote: () => Promise<void>;
  };
  function useReaderData(source: ReaderSource): UseReaderDataResult;
  ```
  其中 `ReaderSource = { kind: "local"; workId: number } | { kind: "remote"; galleryId: number }`（与 ReaderPage props 同型，导出供编排组件复用）。

- [ ] **Step 1: 创建 useReaderData.ts**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, GalleryDetail, PageInfo, ReaderState, Work } from "../../lib/api";
import { clamp, PERSIST_DEBOUNCE_MS, ReaderPageItem } from "./readerHelpers";

export type ReaderSource =
  | { kind: "local"; workId: number }
  | { kind: "remote"; galleryId: number };

export type ReaderTag = { id: number; type: string; display: string };

export function useReaderData(source: ReaderSource) {
  const [work, setWork] = useState<Work | null>(null);
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [state, setState] = useState<ReaderState | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRemote = source.kind === "remote";
  const sourceKey = source.kind === "local" ? `local:${source.workId}` : `remote:${source.galleryId}`;
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setNotice(null);
      setWork(null);
      setGallery(null);
      setLocalPages([]);
      setState(null);
      setPageIndex(1);
      setCompleted(false);
      try {
        if (source.kind === "local") {
          const [nextWork, nextPages, nextState] = await Promise.all([
            api.work(source.workId),
            api.pages(source.workId),
            api.readerState(source.workId),
          ]);
          if (cancelled) return;
          setWork(nextWork);
          setLocalPages(nextPages.result);
          setState(nextState);
          setPageIndex(Math.max(1, nextState.page_index || 1));
          setCompleted(Boolean(nextState.completed));
        } else {
          const detail = await api.gallery(source.galleryId);
          if (cancelled) return;
          setGallery(detail);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [source, sourceKey]);

  const pages = useMemo<ReaderPageItem[]>(() => {
    if (source.kind === "local") {
      return localPages.map((page) => ({
        key: `local-${page.id}`,
        pageIndex: page.page_index,
        src: `/api/works/${source.workId}/pages/${page.page_index}`,
      }));
    }
    return (gallery?.pages ?? [])
      .filter((page) => page.url)
      .map((page, index) => ({
        key: `remote-${page.index ?? index + 1}`,
        pageIndex: page.index ?? index + 1,
        src: page.url!,
      }));
  }, [gallery?.pages, localPages, source]);

  const pageCount =
    source.kind === "local"
      ? state?.page_count || pages.length
      : pages.length || gallery?.page_count || 0;

  const title = isRemote
    ? gallery?.title.japanese || gallery?.title.pretty || gallery?.title.english || `Gallery ${(source as { galleryId: number }).galleryId}`
    : work?.title || "NH Archive";

  const coverSrc = isRemote
    ? gallery?.thumbnail?.url || gallery?.cover?.url || null
    : work
      ? `/api/works/${work.id}/cover`
      : null;

  const tags = useMemo<ReaderTag[]>(() => {
    if (!isRemote || !gallery) return [];
    return gallery.tags.map((tag) => ({ id: tag.id, type: tag.type, display: tag.display || tag.name }));
  }, [gallery, isRemote]);

  const progressPercent = pageCount ? Math.round((pageIndex / pageCount) * 100) : 0;

  const persistLocal = useCallback(
    (next: number, done: boolean) => {
      if (source.kind !== "local") return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        api
          .updateReaderState(source.workId, next, done)
          .then((updated) => setState(updated))
          .catch((exc) => setError(exc instanceof Error ? exc.message : String(exc)));
      }, PERSIST_DEBOUNCE_MS);
    },
    [source]
  );

  const setPage = useCallback(
    (next: number, done = false) => {
      if (!pageCount) return;
      const bounded = clamp(next, 1, pageCount);
      const isDone = done || bounded >= pageCount;
      setPageIndex(bounded);
      setCompleted(isDone);
      persistLocal(bounded, isDone);
    },
    [pageCount, persistLocal]
  );

  const markCompleted = useCallback(() => setPage(pageCount, true), [pageCount, setPage]);

  const importRemote = useCallback(async () => {
    if (source.kind !== "remote") return;
    setError(null);
    try {
      await api.importGallery(source.galleryId);
      setNotice(`Gallery ${source.galleryId} 已加入真实导入队列。`);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }, [source]);

  return {
    loading,
    error,
    notice,
    isRemote,
    sourceKey,
    title,
    coverSrc,
    tags,
    pages,
    pageIndex,
    pageCount,
    progressPercent,
    completed,
    work,
    gallery,
    setPage,
    markCompleted,
    importRemote,
  };
}
```

- [ ] **Step 2: 确认 `api.importGallery` 存在**

Run: `grep -n "importGallery" frontend/src/lib/api.ts`
Expected: 命中 `importGallery:` 定义。若名称不同，按实际名称替换 `importRemote` 内调用（原 ReaderPage 用的就是 `api.importGallery`）。

- [ ] **Step 3: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/reader/useReaderData.ts
git commit -m "feat(reader): 数据 hook(本地防抖持久化/远端只读/标签归一)"
```

---

## Task 4: chrome 自动隐藏 hook（useReaderChrome.ts）

**Files:**
- Create: `frontend/src/components/reader/useReaderChrome.ts`

**Interfaces:**
- Consumes: `CHROME_IDLE_MS` from `./readerHelpers`。
- Produces: `useReaderChrome(): { visible: boolean; pinned: boolean; setPinned(v: boolean): void; reveal(): void }`。`visible` 已合并 pinned（pinned 时恒为 true）。

- [ ] **Step 1: 创建 useReaderChrome.ts**

```ts
import { useCallback, useEffect, useRef, useState } from "react";

import { CHROME_IDLE_MS } from "./readerHelpers";

export function useReaderChrome() {
  const [rawVisible, setRawVisible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | null>(null);

  const reveal = useCallback(() => {
    setRawVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRawVisible(false), CHROME_IDLE_MS);
  }, []);

  useEffect(() => {
    const onActivity = () => reveal();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("touchstart", onActivity);
    reveal();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("touchstart", onActivity);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [reveal]);

  return { visible: rawVisible || pinned, pinned, setPinned, reveal };
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/useReaderChrome.ts
git commit -m "feat(reader): chrome 空闲自动隐藏 hook"
```

---

## Task 5: 单页视图（SinglePageView.tsx）

**Files:**
- Create: `frontend/src/components/reader/SinglePageView.tsx`

**Interfaces:**
- Consumes: `Direction/Fit/ReaderPageItem/clickZoneDelta` from `./readerHelpers`。
- Produces:
  ```ts
  type SinglePageViewProps = {
    page: ReaderPageItem | null;
    fit: Fit;
    zoom: number;
    direction: Direction;
    onFlip: (delta: number) => void;
    onToggleChrome: () => void;
    emptyHint: string;
  };
  function SinglePageView(props: SinglePageViewProps): JSX.Element;
  ```

- [ ] **Step 1: 创建 SinglePageView.tsx**

`fit` 映射到 className（在 CSS 任务中定义 `.fit-width/.fit-height/.fit-original`）；`zoom` 通过内联 `transform: scale()`；左/中/右三点击区，左右翻页、中间切换 chrome。

```tsx
import { Direction, Fit, ReaderPageItem, clickZoneDelta } from "./readerHelpers";

type SinglePageViewProps = {
  page: ReaderPageItem | null;
  fit: Fit;
  zoom: number;
  direction: Direction;
  onFlip: (delta: number) => void;
  onToggleChrome: () => void;
  emptyHint: string;
};

export function SinglePageView({ page, fit, zoom, direction, onFlip, onToggleChrome, emptyHint }: SinglePageViewProps) {
  if (!page) {
    return <p className="reader-empty">{emptyHint}</p>;
  }
  return (
    <div className="reader-single">
      <button
        type="button"
        className="reader-zone reader-zone-left"
        aria-label="左侧点击区"
        onClick={() => onFlip(clickZoneDelta("left", direction))}
      />
      <button
        type="button"
        className="reader-zone reader-zone-center"
        aria-label="切换工具栏"
        onClick={onToggleChrome}
      />
      <button
        type="button"
        className="reader-zone reader-zone-right"
        aria-label="右侧点击区"
        onClick={() => onFlip(clickZoneDelta("right", direction))}
      />
      <img
        key={page.key}
        className={`reader-single-img fit-${fit}`}
        style={{ transform: `scale(${zoom})` }}
        src={page.src}
        alt={`第 ${page.pageIndex} 页`}
        draggable={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/SinglePageView.tsx
git commit -m "feat(reader): 单页视图(适配/缩放/方向点击区)"
```

---

## Task 6: 连续滚动视图（WebtoonView.tsx）

**Files:**
- Create: `frontend/src/components/reader/WebtoonView.tsx`

**Interfaces:**
- Consumes: `Fit/ReaderPageItem` from `./readerHelpers`。
- Produces:
  ```ts
  type WebtoonViewProps = {
    pages: ReaderPageItem[];
    pageIndex: number;
    fit: Fit;
    onReachPage: (pageIndex: number) => void;
    onToggleChrome: () => void;
    emptyHint: string;
  };
  function WebtoonView(props: WebtoonViewProps): JSX.Element;
  ```
  行为：垂直连续；`loading="lazy"`；IntersectionObserver 监测哪张图在视口中部，回调 `onReachPage`；当 `pageIndex` 因外部跳页变化且与当前观测不一致时滚动到对应图。

- [ ] **Step 1: 创建 WebtoonView.tsx**

```tsx
import { useEffect, useRef } from "react";

import { Fit, ReaderPageItem } from "./readerHelpers";

type WebtoonViewProps = {
  pages: ReaderPageItem[];
  pageIndex: number;
  fit: Fit;
  onReachPage: (pageIndex: number) => void;
  onToggleChrome: () => void;
  emptyHint: string;
};

export function WebtoonView({ pages, pageIndex, fit, onReachPage, onToggleChrome, emptyHint }: WebtoonViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  const lastReported = useRef<number>(pageIndex);

  // 观测视口中部的页面，回写当前页
  useEffect(() => {
    const root = containerRef.current;
    if (!root || pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = Number((visible.target as HTMLElement).dataset.pageIndex);
        if (idx && idx !== lastReported.current) {
          lastReported.current = idx;
          onReachPage(idx);
        }
      },
      { root, threshold: [0.5], rootMargin: "-40% 0px -40% 0px" }
    );
    itemRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pages, onReachPage]);

  // 外部跳页（缩略图/键盘）→ 滚动到目标
  useEffect(() => {
    if (pageIndex === lastReported.current) return;
    const target = itemRefs.current.get(pageIndex);
    if (target) {
      lastReported.current = pageIndex;
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [pageIndex]);

  if (pages.length === 0) {
    return <p className="reader-empty">{emptyHint}</p>;
  }

  return (
    <div className="reader-webtoon" ref={containerRef} onClick={onToggleChrome}>
      {pages.map((page) => (
        <img
          key={page.key}
          data-page-index={page.pageIndex}
          ref={(node) => {
            if (node) itemRefs.current.set(page.pageIndex, node);
            else itemRefs.current.delete(page.pageIndex);
          }}
          className={`reader-webtoon-img fit-${fit}`}
          src={page.src}
          alt={`第 ${page.pageIndex} 页`}
          loading="lazy"
          draggable={false}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/WebtoonView.tsx
git commit -m "feat(reader): webtoon 连续滚动视图(懒加载+当前页观测)"
```

---

## Task 7: 舞台容器（ReaderViewport.tsx）

**Files:**
- Create: `frontend/src/components/reader/ReaderViewport.tsx`

**Interfaces:**
- Consumes: `Mode/Direction/Fit/ReaderPageItem` from `./readerHelpers`；`SinglePageView`、`WebtoonView`。
- Produces:
  ```ts
  type ReaderViewportProps = {
    pages: ReaderPageItem[];
    pageIndex: number;
    mode: Mode;
    direction: Direction;
    fit: Fit;
    zoom: number;
    masked: boolean;
    isRemote: boolean;
    onFlip: (delta: number) => void;
    onJump: (pageIndex: number) => void;
    onToggleChrome: () => void;
  };
  function ReaderViewport(props: ReaderViewportProps): JSX.Element;
  ```

- [ ] **Step 1: 创建 ReaderViewport.tsx**

```tsx
import { Direction, Fit, Mode, ReaderPageItem } from "./readerHelpers";
import { SinglePageView } from "./SinglePageView";
import { WebtoonView } from "./WebtoonView";

type ReaderViewportProps = {
  pages: ReaderPageItem[];
  pageIndex: number;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  zoom: number;
  masked: boolean;
  isRemote: boolean;
  onFlip: (delta: number) => void;
  onJump: (pageIndex: number) => void;
  onToggleChrome: () => void;
};

export function ReaderViewport({
  pages,
  pageIndex,
  mode,
  direction,
  fit,
  zoom,
  masked,
  isRemote,
  onFlip,
  onJump,
  onToggleChrome,
}: ReaderViewportProps) {
  const emptyHint = isRemote ? "远端详情未返回可阅读页面 URL。" : "此作品没有可读取页面。";
  const current = pages.find((page) => page.pageIndex === pageIndex) ?? pages[0] ?? null;

  return (
    <div className={masked ? "reader-viewport masked" : "reader-viewport"}>
      {mode === "webtoon" ? (
        <WebtoonView
          pages={pages}
          pageIndex={pageIndex}
          fit={fit}
          onReachPage={onJump}
          onToggleChrome={onToggleChrome}
          emptyHint={emptyHint}
        />
      ) : (
        <SinglePageView
          page={current}
          fit={fit}
          zoom={zoom}
          direction={direction}
          onFlip={onFlip}
          onToggleChrome={onToggleChrome}
          emptyHint={emptyHint}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/ReaderViewport.tsx
git commit -m "feat(reader): 舞台容器按模式切换视图"
```

---

## Task 8: 浮层顶栏（ReaderToolbar.tsx）

**Files:**
- Create: `frontend/src/components/reader/ReaderToolbar.tsx`

**Interfaces:**
- Consumes: `Mode/Direction/Fit/ReaderPanel` from `./readerHelpers`；lucide 图标；`FadeInOut`/`Presence` from `../../lib/motion`。
- Produces:
  ```ts
  type ReaderToolbarProps = {
    visible: boolean;
    title: string;
    isRemote: boolean;
    pageIndex: number;
    pageCount: number;
    progressPercent: number;
    mode: Mode;
    direction: Direction;
    fit: Fit;
    masked: boolean;
    activePanel: ReaderPanel;
    onBack: () => void;
    onFlip: (delta: number) => void;
    onSetMode: (mode: Mode) => void;
    onToggleDirection: () => void;
    onCycleFit: () => void;
    onZoom: (delta: number) => void;
    onToggleMask: () => void;
    onToggleFullscreen: () => void;
    onOpenPanel: (panel: ReaderPanel) => void;
    onImport: () => void;
    onPanelHoverChange: (hovering: boolean) => void;
  };
  function ReaderToolbar(props: ReaderToolbarProps): JSX.Element;
  ```

- [ ] **Step 1: 创建 ReaderToolbar.tsx**

```tsx
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Image as ImageIcon,
  Info,
  Maximize,
  Maximize2,
  Minus,
  Plus,
  ScrollText,
} from "lucide-react";

import { Presence, FadeInOut } from "../../lib/motion";
import { Direction, Fit, Mode, ReaderPanel } from "./readerHelpers";

type ReaderToolbarProps = {
  visible: boolean;
  title: string;
  isRemote: boolean;
  pageIndex: number;
  pageCount: number;
  progressPercent: number;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  masked: boolean;
  activePanel: ReaderPanel;
  onBack: () => void;
  onFlip: (delta: number) => void;
  onSetMode: (mode: Mode) => void;
  onToggleDirection: () => void;
  onCycleFit: () => void;
  onZoom: (delta: number) => void;
  onToggleMask: () => void;
  onToggleFullscreen: () => void;
  onOpenPanel: (panel: ReaderPanel) => void;
  onImport: () => void;
  onPanelHoverChange: (hovering: boolean) => void;
};

const FIT_LABEL: Record<Fit, string> = { width: "适配宽", height: "适配高", original: "原始" };

export function ReaderToolbar(props: ReaderToolbarProps) {
  const {
    visible,
    title,
    isRemote,
    pageIndex,
    pageCount,
    progressPercent,
    mode,
    direction,
    fit,
    masked,
    activePanel,
    onBack,
    onFlip,
    onSetMode,
    onToggleDirection,
    onCycleFit,
    onZoom,
    onToggleMask,
    onToggleFullscreen,
    onOpenPanel,
    onImport,
    onPanelHoverChange,
  } = props;

  return (
    <Presence>
      {visible ? (
        <FadeInOut
          y={-12}
          className="reader-chrome reader-toolbar"
          onMouseEnter={() => onPanelHoverChange(true)}
          onMouseLeave={() => onPanelHoverChange(false)}
        >
          <button type="button" className="back-button" onClick={onBack}>
            <ArrowLeft size={17} />
            {isRemote ? "返回发现" : "返回库"}
          </button>

          <span className="reader-title" title={title}>
            {title}
          </span>

          <div className="reader-toolbar-spacer" />

          <button type="button" onClick={() => onFlip(-1)} disabled={pageIndex <= 1} aria-label="上一页">
            <ChevronLeft size={17} />
          </button>
          <span className="reader-counter">
            {pageIndex} / {pageCount}
          </span>
          <button type="button" onClick={() => onFlip(1)} disabled={pageIndex >= pageCount} aria-label="下一页">
            <ChevronRight size={17} />
          </button>
          <progress max={100} value={progressPercent} />

          <button
            type="button"
            className={mode === "single" ? "active" : ""}
            onClick={() => onSetMode("single")}
            aria-label="单页模式"
          >
            <Maximize2 size={17} />
          </button>
          <button
            type="button"
            className={mode === "webtoon" ? "active" : ""}
            onClick={() => onSetMode("webtoon")}
            aria-label="连续滚动模式"
          >
            <ScrollText size={17} />
          </button>

          <button type="button" onClick={onToggleDirection} aria-label="阅读方向">
            {direction === "rtl" ? "右→左" : "左→右"}
          </button>

          <button type="button" onClick={onCycleFit} aria-label="适配模式">
            {FIT_LABEL[fit]}
          </button>

          {mode === "single" ? (
            <>
              <button type="button" onClick={() => onZoom(-1)} aria-label="缩小">
                <Minus size={17} />
              </button>
              <button type="button" onClick={() => onZoom(1)} aria-label="放大">
                <Plus size={17} />
              </button>
            </>
          ) : null}

          <button type="button" className={masked ? "active" : ""} onClick={onToggleMask} aria-label="隐私遮罩">
            <EyeOff size={17} />
          </button>
          <button type="button" onClick={onToggleFullscreen} aria-label="全屏">
            <Maximize size={17} />
          </button>
          <button
            type="button"
            className={activePanel === "thumbnails" ? "active" : ""}
            onClick={() => onOpenPanel("thumbnails")}
            aria-label="缩略图"
          >
            <ImageIcon size={17} />
          </button>
          <button
            type="button"
            className={activePanel === "info" ? "active" : ""}
            onClick={() => onOpenPanel("info")}
            aria-label="信息"
          >
            <Info size={17} />
          </button>

          {isRemote ? (
            <button type="button" className="primary-action" onClick={onImport}>
              <Download size={17} />
              加入队列
            </button>
          ) : null}
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。若 lucide 中 `Image`/`Maximize` 图标名不存在，运行 `grep -ri "export" frontend/node_modules/lucide-react/dist/lucide-react.d.ts | grep -iE "Image|Maximize"` 确认实际导出名后替换。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/ReaderToolbar.tsx
git commit -m "feat(reader): 浮层顶栏工具栏"
```

---

## Task 9: 缩略图抽屉（ThumbnailPanel.tsx）

**Files:**
- Create: `frontend/src/components/reader/ThumbnailPanel.tsx`

**Interfaces:**
- Consumes: `ReaderPageItem` from `./readerHelpers`；`Presence`/`FadeInOut` from `../../lib/motion`；`X` from lucide。
- Produces:
  ```ts
  type ThumbnailPanelProps = {
    open: boolean;
    pages: ReaderPageItem[];
    pageIndex: number;
    onJump: (pageIndex: number) => void;
    onClose: () => void;
    onHoverChange: (hovering: boolean) => void;
  };
  function ThumbnailPanel(props: ThumbnailPanelProps): JSX.Element;
  ```

- [ ] **Step 1: 创建 ThumbnailPanel.tsx**

```tsx
import { X } from "lucide-react";

import { Presence, FadeInOut } from "../../lib/motion";
import { ReaderPageItem } from "./readerHelpers";

type ThumbnailPanelProps = {
  open: boolean;
  pages: ReaderPageItem[];
  pageIndex: number;
  onJump: (pageIndex: number) => void;
  onClose: () => void;
  onHoverChange: (hovering: boolean) => void;
};

export function ThumbnailPanel({ open, pages, pageIndex, onJump, onClose, onHoverChange }: ThumbnailPanelProps) {
  return (
    <Presence>
      {open ? (
        <FadeInOut
          x={16}
          className="reader-chrome reader-panel reader-thumbs"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <header className="reader-panel-head">
            <strong>缩略图</strong>
            <button type="button" onClick={onClose} aria-label="关闭">
              <X size={16} />
            </button>
          </header>
          <div className="reader-thumbs-grid">
            {pages.map((page) => (
              <button
                key={page.key}
                type="button"
                className={page.pageIndex === pageIndex ? "active" : ""}
                onClick={() => onJump(page.pageIndex)}
              >
                <img src={page.src} alt={`第 ${page.pageIndex} 页`} loading="lazy" draggable={false} />
                <span>{page.pageIndex}</span>
              </button>
            ))}
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/ThumbnailPanel.tsx
git commit -m "feat(reader): 缩略图抽屉(点击跳页)"
```

---

## Task 10: 信息/设置抽屉（ReaderInfoPanel.tsx）

**Files:**
- Create: `frontend/src/components/reader/ReaderInfoPanel.tsx`

**Interfaces:**
- Consumes: `Mode/Direction/Fit/ReaderTag(from useReaderData)` 类型；`Presence`/`FadeInOut`；lucide 图标；`navigate` from `../../lib/navigation`。
- Produces:
  ```ts
  type ReaderInfoPanelProps = {
    open: boolean;
    title: string;
    coverSrc: string | null;
    tags: { id: number; type: string; display: string }[];
    progressPercent: number;
    isRemote: boolean;
    workId: number | null;
    mode: Mode;
    direction: Direction;
    fit: Fit;
    onSetMode: (mode: Mode) => void;
    onToggleDirection: () => void;
    onCycleFit: () => void;
    onMarkCompleted: () => void;
    onImport: () => void;
    onClose: () => void;
    onHoverChange: (hovering: boolean) => void;
  };
  function ReaderInfoPanel(props: ReaderInfoPanelProps): JSX.Element;
  ```

- [ ] **Step 1: 创建 ReaderInfoPanel.tsx**

```tsx
import { Download, Star, X } from "lucide-react";

import { Presence, FadeInOut } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { Direction, Fit, Mode } from "./readerHelpers";

type ReaderInfoPanelProps = {
  open: boolean;
  title: string;
  coverSrc: string | null;
  tags: { id: number; type: string; display: string }[];
  progressPercent: number;
  isRemote: boolean;
  workId: number | null;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  onSetMode: (mode: Mode) => void;
  onToggleDirection: () => void;
  onCycleFit: () => void;
  onMarkCompleted: () => void;
  onImport: () => void;
  onClose: () => void;
  onHoverChange: (hovering: boolean) => void;
};

const FIT_LABEL = { width: "适配宽度", height: "适配高度", original: "原始尺寸" } as const;

export function ReaderInfoPanel(props: ReaderInfoPanelProps) {
  const {
    open,
    title,
    coverSrc,
    tags,
    progressPercent,
    isRemote,
    workId,
    mode,
    direction,
    fit,
    onSetMode,
    onToggleDirection,
    onCycleFit,
    onMarkCompleted,
    onImport,
    onClose,
    onHoverChange,
  } = props;

  return (
    <Presence>
      {open ? (
        <FadeInOut
          x={16}
          className="reader-chrome reader-panel reader-info-panel"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <header className="reader-panel-head">
            <strong>作品信息</strong>
            <button type="button" onClick={onClose} aria-label="关闭">
              <X size={16} />
            </button>
          </header>

          <div className="reader-info-meta">
            {coverSrc ? <img src={coverSrc} alt="" draggable={false} /> : null}
            <h2>{title}</h2>
            <p>当前进度 {progressPercent}%</p>
            {isRemote ? <small>远端只读预览，不保存阅读进度</small> : null}
            {tags.length > 0 ? (
              <ul className="reader-info-tags">
                {tags.map((tag) => (
                  <li key={tag.id} data-type={tag.type}>
                    {tag.display}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="reader-info-actions">
            {!isRemote ? (
              <button type="button" onClick={onMarkCompleted}>
                <Star size={16} />
                标记已读
              </button>
            ) : (
              <button type="button" onClick={onImport}>
                <Download size={16} />
                加入导入队列
              </button>
            )}
            {!isRemote && workId != null ? (
              <button type="button" onClick={() => navigate({ name: "governance", workId })}>
                进入治理
              </button>
            ) : null}
          </div>

          <div className="reader-info-settings">
            <h3>阅读设置</h3>
            <div className="reader-setting-row">
              <span>模式</span>
              <div className="reader-segmented">
                <button type="button" className={mode === "single" ? "active" : ""} onClick={() => onSetMode("single")}>
                  单页
                </button>
                <button type="button" className={mode === "webtoon" ? "active" : ""} onClick={() => onSetMode("webtoon")}>
                  连续滚动
                </button>
              </div>
            </div>
            <div className="reader-setting-row">
              <span>方向</span>
              <button type="button" onClick={onToggleDirection}>
                {direction === "rtl" ? "右 → 左" : "左 → 右"}
              </button>
            </div>
            <div className="reader-setting-row">
              <span>适配</span>
              <button type="button" onClick={onCycleFit}>
                {FIT_LABEL[fit]}
              </button>
            </div>
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
```

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/ReaderInfoPanel.tsx
git commit -m "feat(reader): 信息/动作/阅读设置抽屉"
```

---

## Task 11: 编排组件重写（ReaderPage.tsx）

**Files:**
- Modify (整文件重写): `frontend/src/components/reader/ReaderPage.tsx`

**Interfaces:**
- Consumes: 全部前述 hooks 与组件；`ReaderSource` from `./useReaderData`；`clamp/ZOOM_*/arrowDelta/Direction/Fit/Mode/ReaderPanel` from `./readerHelpers`。
- Produces: `ReaderPage({ source, privacyMode }): JSX.Element`（props 与旧版完全一致）。

- [ ] **Step 1: 重写 ReaderPage.tsx**

职责：装配三个 hooks；拥有 `zoom`、`masked`、`activePanel` 本地状态（按 sourceKey 重置 zoom）；统一翻页 `flip`/跳页 `jump`；缩放 `zoomBy`；适配循环 `cycleFit`；方向切换；全屏；键盘监听；标题写入 document.title（隐私模式用 "NH Archive"）。

```tsx
import { useCallback, useEffect, useState } from "react";

import { navigate } from "../../lib/navigation";
import {
  arrowDelta,
  clamp,
  Direction,
  Fit,
  Mode,
  ReaderPanel,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "./readerHelpers";
import { ReaderInfoPanel } from "./ReaderInfoPanel";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderViewport } from "./ReaderViewport";
import { ThumbnailPanel } from "./ThumbnailPanel";
import { ReaderSource, useReaderData } from "./useReaderData";
import { useReaderChrome } from "./useReaderChrome";
import { useReaderPrefs } from "./useReaderPrefs";

type Props = {
  source: ReaderSource;
  privacyMode: boolean;
};

const FIT_ORDER: Fit[] = ["height", "width", "original"];

export function ReaderPage({ source, privacyMode }: Props) {
  const data = useReaderData(source);
  const { prefs, setMode, setDirection, setFit } = useReaderPrefs();
  const chrome = useReaderChrome();

  const [zoom, setZoom] = useState(1);
  const [masked, setMasked] = useState(false);
  const [activePanel, setActivePanel] = useState<ReaderPanel>("none");

  // 切换作品时重置缩放/面板/遮罩
  useEffect(() => {
    setZoom(1);
    setActivePanel("none");
    setMasked(false);
  }, [data.sourceKey]);

  // 面板开启时钉住 chrome
  useEffect(() => {
    chrome.setPinned(activePanel !== "none");
  }, [activePanel, chrome]);

  // 标题
  useEffect(() => {
    document.title = privacyMode ? "NH Archive" : data.title;
    return () => {
      document.title = "NH Archive";
    };
  }, [privacyMode, data.title]);

  const flip = useCallback((delta: number) => data.setPage(data.pageIndex + delta), [data]);
  const jump = useCallback((pageIndex: number) => data.setPage(pageIndex), [data]);
  const zoomBy = useCallback(
    (steps: number) => setZoom((z) => clamp(Number((z + steps * ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX)),
    []
  );
  const cycleFit = useCallback(() => {
    const idx = FIT_ORDER.indexOf(prefs.fit);
    setFit(FIT_ORDER[(idx + 1) % FIT_ORDER.length]);
  }, [prefs.fit, setFit]);
  const toggleDirection = useCallback(
    () => setDirection(prefs.direction === "rtl" ? "ltr" : "rtl"),
    [prefs.direction, setDirection]
  );
  const setModeAndReset = useCallback(
    (mode: Mode) => {
      if (mode === "webtoon") setZoom(1);
      setMode(mode);
    },
    [setMode]
  );
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);
  const openPanel = useCallback((panel: ReaderPanel) => {
    setActivePanel((current) => (current === panel ? "none" : panel));
  }, []);
  const toggleChrome = useCallback(() => {
    if (chrome.visible) chrome.setPinned(false);
    else chrome.reveal();
  }, [chrome]);

  // 键盘
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key;
      const delta = arrowDelta(key, prefs.direction);
      if (prefs.mode === "single" && delta !== 0) {
        flip(delta);
        return;
      }
      if (key === " ") {
        event.preventDefault();
        flip(event.shiftKey ? -1 : 1);
      } else if (key === "f") {
        toggleFullscreen();
      } else if (key === "h") {
        setMasked((v) => !v);
      } else if (key === "t") {
        openPanel("thumbnails");
      } else if (key === "i") {
        openPanel("info");
      } else if (key === "+" || key === "=") {
        zoomBy(1);
      } else if (key === "-") {
        zoomBy(-1);
      } else if (key === "0") {
        setZoom(1);
      } else if (key === "Escape") {
        if (activePanel !== "none") setActivePanel("none");
        else if (document.fullscreenElement) void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activePanel, flip, openPanel, prefs.direction, prefs.mode, toggleFullscreen, zoomBy]);

  if (data.error) {
    return (
      <section className="reader-shell">
        <div className="notice error">{data.error}</div>
      </section>
    );
  }

  return (
    <section className="reader-shell">
      <ReaderViewport
        pages={data.pages}
        pageIndex={data.pageIndex}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        zoom={zoom}
        masked={masked}
        isRemote={data.isRemote}
        onFlip={flip}
        onJump={jump}
        onToggleChrome={toggleChrome}
      />

      {data.notice ? <div className="notice slim reader-notice">{data.notice}</div> : null}

      <ReaderToolbar
        visible={chrome.visible}
        title={data.title}
        isRemote={data.isRemote}
        pageIndex={data.pageIndex}
        pageCount={data.pageCount}
        progressPercent={data.progressPercent}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        masked={masked}
        activePanel={activePanel}
        onBack={() => navigate({ name: data.isRemote ? "discover" : "library" })}
        onFlip={flip}
        onSetMode={setModeAndReset}
        onToggleDirection={toggleDirection}
        onCycleFit={cycleFit}
        onZoom={zoomBy}
        onToggleMask={() => setMasked((v) => !v)}
        onToggleFullscreen={toggleFullscreen}
        onOpenPanel={openPanel}
        onImport={data.importRemote}
        onPanelHoverChange={chrome.setPinned}
      />

      <ThumbnailPanel
        open={activePanel === "thumbnails"}
        pages={data.pages}
        pageIndex={data.pageIndex}
        onJump={jump}
        onClose={() => setActivePanel("none")}
        onHoverChange={chrome.setPinned}
      />

      <ReaderInfoPanel
        open={activePanel === "info"}
        title={data.title}
        coverSrc={data.coverSrc}
        tags={data.tags}
        progressPercent={data.progressPercent}
        isRemote={data.isRemote}
        workId={data.work?.id ?? null}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        onSetMode={setModeAndReset}
        onToggleDirection={toggleDirection}
        onCycleFit={cycleFit}
        onMarkCompleted={data.markCompleted}
        onImport={data.importRemote}
        onClose={() => setActivePanel("none")}
        onHoverChange={chrome.setPinned}
      />
    </section>
  );
}
```

> 注：`onPanelHoverChange`/`onHoverChange` 直接复用 `chrome.setPinned`；当面板已 open 时 pinned 由面板 effect 维持为 true，hover 顶栏临时置 true 不影响关闭后的恢复（关闭面板的 effect 会重置）。若发现关闭面板后 chrome 不再自动隐藏，改为：hover 离开时 `chrome.setPinned(activePanel !== "none")`。

- [ ] **Step 2: 类型/构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功，无 TS 报错（含未使用变量/类型不匹配）。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/reader/ReaderPage.tsx
git commit -m "feat(reader): 编排组件重写(沉浸全屏+面板+键盘+全屏)"
```

---

## Task 12: app.css reader 样式收敛与清理

**Files:**
- Modify: `frontend/src/styles/app.css`

**Interfaces:**
- Consumes: 上述组件用到的 className：`reader-shell` / `reader-viewport`(+`.masked`) / `reader-single`(+`.reader-zone[-left|-center|-right]`、`.reader-single-img`) / `reader-webtoon`(+`-img`) / `fit-width|fit-height|fit-original` / `reader-chrome` / `reader-toolbar`(+`.reader-title`/`.reader-counter`/`.reader-toolbar-spacer`) / `reader-panel`(+`.reader-panel-head`) / `reader-thumbs`(+`-grid`) / `reader-info-panel`(+`.reader-info-meta`/`.reader-info-tags`/`.reader-info-actions`/`.reader-info-settings`/`.reader-setting-row`/`.reader-segmented`) / `reader-empty` / `reader-notice`。
- Produces: 单一连贯的 reader 样式区块。

- [ ] **Step 1: 定位并删除旧 reader 样式**

Run: `grep -nE "\.reader-(page|sidebar|inspector|main|work|toolbar|tabs|info|canvas|layout|page-cell)\b|\.page-stage|\.chapter-list" frontend/src/styles/app.css`
逐处删除旧规则块（含 `@media` 内的 reader 响应式块）。删除时**保留**非 reader 选择器（如有共用块需谨慎拆分）。删除依据：这些选择器对应旧三栏 DOM（`.reader-page` 根、`.reader-sidebar`、`.reader-inspector`、`.reader-main`、`.reader-work`、`.reader-tabs`、`.chapter-list`、`.page-stage`、`.reader-page-cell`、`.reader-layout`、`.reader-canvas`），新 DOM 不再使用。
注意：`.reader-toolbar` 选择器名沿用但样式重写——删除旧的、用下方新块替换。

- [ ] **Step 2: 在文件末尾追加新 reader 区块**

```css
/* ===================== Reader (沉浸全屏) ===================== */
.reader-shell {
  position: fixed;
  inset: 0;
  background: #07080c;
  color: #e8eaf2;
  overflow: hidden;
  z-index: 40;
}

/* 舞台 */
.reader-viewport {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
}
.reader-viewport.masked {
  filter: blur(28px) brightness(0.5);
  pointer-events: none;
}
.reader-empty {
  margin: auto;
  color: #9aa0b4;
  font-size: 0.95rem;
}

/* 单页 */
.reader-single {
  position: relative;
  min-height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.reader-single-img {
  display: block;
  transform-origin: center top;
  user-select: none;
}
.fit-height {
  max-height: 100vh;
  width: auto;
}
.fit-width {
  max-width: 100vw;
  height: auto;
}
.fit-original {
  max-width: none;
  max-height: none;
}
.reader-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.reader-zone-left { left: 0; width: 33%; }
.reader-zone-center { left: 33%; width: 34%; cursor: default; }
.reader-zone-right { right: 0; width: 33%; }

/* webtoon */
.reader-webtoon {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.reader-webtoon-img {
  display: block;
  max-width: 100vw;
}
.reader-webtoon-img.fit-width { width: 100vw; height: auto; }
.reader-webtoon-img.fit-height { max-height: 100vh; width: auto; }

/* chrome 通用 */
.reader-chrome { z-index: 50; }

/* 顶栏 */
.reader-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  background: linear-gradient(180deg, rgba(8, 10, 16, 0.94), rgba(8, 10, 16, 0));
}
.reader-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
.reader-toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
.reader-toolbar button.active { background: rgba(120, 150, 255, 0.28); border-color: rgba(120, 150, 255, 0.6); }
.reader-toolbar button.primary-action { background: rgba(120, 150, 255, 0.85); border-color: transparent; color: #0b0d14; }
.reader-toolbar .reader-title {
  max-width: 22ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.reader-toolbar .reader-counter { font-variant-numeric: tabular-nums; font-size: 0.85rem; }
.reader-toolbar-spacer { flex: 1; }
.reader-toolbar progress { width: 90px; height: 6px; }

/* 抽屉面板 */
.reader-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(340px, 86vw);
  background: rgba(12, 14, 22, 0.97);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.reader-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.reader-panel-head button {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
}

/* 缩略图 */
.reader-thumbs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  padding: 0.8rem;
  overflow-y: auto;
}
.reader-thumbs-grid button {
  position: relative;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}
.reader-thumbs-grid button.active { border-color: rgba(120, 150, 255, 0.85); }
.reader-thumbs-grid img { width: 100%; display: block; aspect-ratio: 3 / 4; object-fit: cover; }
.reader-thumbs-grid span {
  position: absolute;
  bottom: 0;
  right: 0;
  padding: 0 0.35rem;
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.6);
  border-top-left-radius: 0.35rem;
}

/* 信息面板 */
.reader-info-panel { padding-bottom: 1rem; overflow-y: auto; }
.reader-info-meta { padding: 1rem; }
.reader-info-meta img { width: 100%; border-radius: 0.6rem; margin-bottom: 0.7rem; }
.reader-info-meta h2 { font-size: 1rem; margin: 0 0 0.4rem; }
.reader-info-tags { list-style: none; display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.6rem 0 0; margin: 0; }
.reader-info-tags li { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.72rem; background: rgba(255, 255, 255, 0.08); }
.reader-info-actions { display: flex; flex-direction: column; gap: 0.5rem; padding: 0 1rem 1rem; }
.reader-info-actions button {
  display: inline-flex; align-items: center; gap: 0.4rem; justify-content: center;
  padding: 0.5rem; border-radius: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.06);
  color: inherit; cursor: pointer;
}
.reader-info-settings { padding: 0 1rem; }
.reader-info-settings h3 { font-size: 0.85rem; color: #9aa0b4; margin: 0.4rem 0; }
.reader-setting-row { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0; }
.reader-setting-row > span { font-size: 0.82rem; }
.reader-setting-row button {
  padding: 0.3rem 0.6rem; border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.06);
  color: inherit; cursor: pointer; font-size: 0.8rem;
}
.reader-segmented { display: inline-flex; gap: 0.25rem; }
.reader-segmented button.active { background: rgba(120, 150, 255, 0.28); border-color: rgba(120, 150, 255, 0.6); }

.reader-notice {
  position: absolute;
  left: 50%;
  bottom: 1.2rem;
  transform: translateX(-50%);
  z-index: 55;
}

@media (max-width: 720px) {
  .reader-toolbar { flex-wrap: wrap; }
  .reader-toolbar .reader-title { max-width: 12ch; }
  .reader-thumbs-grid { grid-template-columns: repeat(3, 1fr); }
}
/* =================== /Reader =================== */
```

- [ ] **Step 3: 确认无遗留旧选择器引用**

Run: `grep -nE "\.reader-sidebar|\.reader-inspector|\.reader-main|\.chapter-list|\.page-stage|\.reader-page-cell|\.reader-tabs|\.reader-work" frontend/src/styles/app.css`
Expected: 无输出（全部已删除）。

- [ ] **Step 4: 构建门**

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/styles/app.css
git commit -m "style(reader): 收敛清理 reader 样式为单一区块"
```

---

## Task 13: Playwright e2e（需浏览器环境，本地环境不保证可运行）

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/reader.spec.ts`

**Interfaces:**
- Consumes: `@playwright/test`（已安装）。后端 + 前端 dev server 需运行（`vite` 默认 5173；后端按项目实际端口）。
- Produces: 阅读器关键行为回归。

> 说明：本计划其余任务的验证门为 `npm run build`；本任务需真实浏览器与运行中的服务，**本沙箱环境无法保证执行**（dev-environment 记忆）。请在具备浏览器的环境/CI 运行 `npx playwright test`。spec 文档第 10 节称"复用现有 Playwright e2e"，但仓库当前并无 config/spec，故此处新建。

- [ ] **Step 1: 创建 playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    headless: true,
  },
});
```

- [ ] **Step 2: 创建 e2e/reader.spec.ts**

> 选择器以 aria-label / 文本为准（见各组件）。`#reader/<id>` 路由 hash 见 `lib/navigation`。下面用占位 `WORK_ID`，运行前由执行者替换为环境中存在的本地作品 id（或经库页点进）。

```ts
import { expect, test } from "@playwright/test";

const WORK_ID = process.env.E2E_WORK_ID ?? "1";

test.beforeEach(async ({ page }) => {
  await page.goto(`/#reader/${WORK_ID}`);
  await page.mouse.move(10, 10); // 唤出 chrome
});

test("显示页码计数并能下一页", async ({ page }) => {
  const counter = page.locator(".reader-counter");
  await expect(counter).toContainText("/");
  const before = await counter.textContent();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(counter).not.toHaveText(before ?? "");
});

test("切换到连续滚动模式", async ({ page }) => {
  await page.getByRole("button", { name: "连续滚动模式" }).click();
  await expect(page.locator(".reader-webtoon")).toBeVisible();
});

test("打开缩略图面板并跳页", async ({ page }) => {
  await page.getByRole("button", { name: "缩略图" }).click();
  await expect(page.locator(".reader-thumbs")).toBeVisible();
  await page.locator(".reader-thumbs-grid button").nth(2).click();
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});

test("打开信息面板含阅读设置", async ({ page }) => {
  await page.getByRole("button", { name: "信息" }).click();
  await expect(page.getByText("阅读设置")).toBeVisible();
});
```

- [ ] **Step 3: 类型/构建门（不破坏现有构建）**

Run: `cd frontend && npm run build`
Expected: 构建成功（e2e 目录不进 vite 入口，应无影响；若 tsc 纳入 e2e 报错，确认 `tsconfig` include 范围，必要时新增 `frontend/e2e/tsconfig.json` 或在根 tsconfig 排除 e2e）。

- [ ] **Step 4: 运行 e2e（具备浏览器的环境）**

Run: `cd frontend && E2E_WORK_ID=<真实id> npx playwright test`
Expected: 全部通过。**本沙箱若无法启动浏览器，记录"待用户/CI 验证"，勿声称通过。**

- [ ] **Step 5: 提交**

```bash
git add frontend/playwright.config.ts frontend/e2e/reader.spec.ts
git commit -m "test(reader): playwright e2e 关键行为回归"
```

---

## Self-Review

**1. Spec 覆盖检查：**
- 沉浸全屏+自动隐藏 chrome → Task 4 + Task 11（chrome）+ Task 12（样式 fixed 全屏）。✓
- 单页/webtoon/方向 → Task 5/6/7 + helpers。✓
- 缩放/适配/点击区/缩略图/键盘+全屏 → Task 5/8/9/11。✓
- 呼出面板含 阅读设置+作品信息+缩略图+偏好持久化 → Task 9/10/2。✓
- 本地防抖持久化 / 远端只读+加入队列 → Task 3。✓
- 标签 display 规则、本地无标签 → Task 3 + Task 10。✓
- 错误/空态/隐私遮罩 → Task 3(error)/Task 5,6(empty)/Task 7,12(masked)。✓
- CSS 清理 → Task 12。✓
- 测试 → Task 13。✓
- 不做双页/本地标签/章节跳转 → 计划未引入。✓

**2. 占位符扫描：** 无 TODO/TBD；每个改代码步骤含完整代码。e2e 中 `WORK_ID` 为运行期环境变量（已说明替换方式），非代码占位。✓

**3. 类型一致性：**
- `setPage(next, done?)`、`flip(delta)`、`jump(pageIndex)`、`onReachPage`、`onFlip`、`onJump` 跨任务命名一致。✓
- `ReaderPanel`/`Mode`/`Direction`/`Fit` 在所有组件 props 中类型一致。✓
- `tags` 元素类型 `{ id; type; display }` 在 useReaderData 产出与 ReaderInfoPanel 消费一致。✓
- `chrome.setPinned` 复用为各 `onHoverChange`/`onPanelHoverChange`，签名 `(boolean) => void` 一致。✓
- `FIT_ORDER` 含 height/width/original，与 `Fit` 联合类型一致。✓
