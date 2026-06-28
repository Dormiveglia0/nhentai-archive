# 轻量收尾阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐三项收尾功能——文件清单分页 UI、阅读历史专属页、治理批量预览/应用。

**Architecture:** 三个互相独立的小组件。文件分页纯前端补翻页器(后端已支持);阅读历史新增 `LibraryService.reading_history` 聚合查询 + API + 新前端页 `#history`;治理批量在 `GovernanceService` 复用既有单作品 `work_governance`/`write_back_comicinfo` 实现 `bulk_preview`/`bulk_apply` + API + 治理页多选 UI。

**Tech Stack:** Python 3.11 / FastAPI / SQLite(`app.database.Database`,stdlib);前端 TypeScript / React / Vite;测试 `pytest`(后端)+ `tsc -b && vite build`(前端,无前端单测框架)。

## Global Constraints

- 所有数据来自 SQLite / 本地归档;`LibraryService` 与历史查询绝不调 NH API。
- 全站页内 tag 显示走词典 `display`(`zh_name → name → slug`);英文仅后端 NH 请求用。
- 治理批量沿用单作品回写风险模型:仅 ComicInfo、原子替换、无备份、回写后同步 `work_files.sha256`/`size_bytes`、显式 opt-in 默认关、失败不回滚。
- 批量补全只填空:仅当字段终值规范化后为空且存在来源值时写入;绝不覆盖已有非空值。
- 失败隔离:批量中单个作品出错不得中断其余作品。
- 封面显示遵守全局 `blurCovers`:`<img className={blurCovers ? "blurred" : ""} src={`/api/works/${id}/cover`} />`。
- 不引入新依赖;沿用现有 TS/CSS/Python/SQLite 栈。
- 后端测试运行:`PYTHONPATH=backend .venv/bin/pytest backend/tests -q`;前端构建:`cd frontend && npm run build`。

---

## Task 1: 文件清单分页 UI(纯前端)

**Files:**
- Modify: `frontend/src/components/files/FilesPage.tsx`

**Interfaces:**
- Consumes: `useFilesState()` 已返回 `page: number`、`setPage: (n)=>void`、`inventory: { result, total, page, per_page } | null`、`loading: boolean`(见 `useFilesState.ts:226-245`)。复用 `IconPager`(`components/discover/IconPager.tsx`,props `{ page, totalPages, loading, onPage }`,`totalPages<=1` 自动返回 null)。
- Produces: 无下游消费。

> 后端 `inventory(page, per_page)` 与 `/api/files/inventory` 已支持分页且已有测试;`useFilesState` 已按 `page` 拉数并在筛选/搜索/分类变更时 `setPage(1)`。本任务只补 UI 翻页器,无后端改动、无新接口、无新测试。验证靠 `npm run build` + 手动翻页。

- [ ] **Step 1: 在 FilesPage 引入 IconPager 并渲染**

把 `frontend/src/components/files/FilesPage.tsx` 顶部 import 区加入:

```tsx
import { IconPager } from "../discover/IconPager";
```

在组件函数体内、`return` 之前计算总页数(`per_page` 后端默认 50):

```tsx
  const total = state.inventory?.total ?? 0;
  const perPage = state.inventory?.per_page ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
```

把 `FileList` 那一段替换为下方(在 `FileList` 后、`FileDetailPanel` 前插入翻页器):

```tsx
          <FileList
            entries={entries}
            selected={state.selected}
            focusId={state.focusId}
            multiSelect={state.multiSelect}
            onPick={state.pickRow}
            loading={state.loading}
          />
          <IconPager page={state.page} totalPages={totalPages} loading={state.loading} onPage={state.setPage} />
          <FileDetailPanel focus={focus} blurCovers={blurCovers} busy={state.busy} onDelete={state.previewEntry} />
```

- [ ] **Step 2: 构建验证**

Run: `cd frontend && npm run build`
Expected: PASS(`tsc -b && vite build` 零错误)。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/files/FilesPage.tsx
git commit -m "feat(files): 文件清单分页翻页器"
```

---

## Task 2: 阅读历史后端(service + API + 测试)

**Files:**
- Modify: `backend/app/services/library_service.py`(新增 `reading_history` 方法)
- Modify: `backend/app/main.py`(新增 `GET /api/library/reading-history` 路由)
- Test: `backend/tests/test_library_reading_history.py`

**Interfaces:**
- Consumes: `Database.fetchone/fetchall`;表 `reading_history(work_id, page_index, opened_at)`、`works`、`reader_progress`。
- Produces: `LibraryService.reading_history(page: int = 1, per_page: int = 30) -> dict`,返回
  `{"result": list[entry], "total": int, "page": int, "per_page": int, "num_pages": int}`,
  其中 entry =
  `{"id", "title", "title_japanese", "pretty_title", "source", "remote_gallery_id", "page_count", "cover_path", "date" (YYYY-MM-DD), "last_opened_at", "read_events", "furthest_page", "progress_percent", "completed"}`。
  API:`GET /api/library/reading-history?page=&per_page=`。

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_library_reading_history.py`:

```python
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.library_service import LibraryService
from app.services.reader_service import ReaderService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, pages: int) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for index in range(1, pages + 1):
            archive.writestr(f"{index:03d}.png", _png())


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    return settings, db, archive


def _import(archive, tmp_path, name, pages=10) -> int:
    cbz = tmp_path / f"{name}.cbz"
    _make_cbz(cbz, pages)
    return archive.ingest_cbz(cbz, "remote", name.title(), None, {"remote": "nhentai"})


def test_reading_history_empty(tmp_path):
    _settings, db, _archive = _setup(tmp_path)
    library = LibraryService(db)
    out = library.reading_history()
    assert out == {"result": [], "total": 0, "page": 1, "per_page": 30, "num_pages": 1}


def test_reading_history_aggregates_same_work_same_day(tmp_path):
    _settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    reader = ReaderService(db)
    work_id = _import(archive, tmp_path, "alpha", pages=10)
    reader.update_state(work_id, page_index=2)
    reader.update_state(work_id, page_index=5)

    out = library.reading_history()
    assert out["total"] == 1
    assert len(out["result"]) == 1
    entry = out["result"][0]
    assert entry["id"] == work_id
    assert entry["read_events"] == 2
    assert entry["furthest_page"] == 5
    assert entry["progress_percent"] == 50
    assert entry["completed"] is False
    assert entry["page_count"] == 10


def test_reading_history_splits_across_days_desc(tmp_path):
    _settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    work_id = _import(archive, tmp_path, "beta", pages=10)
    db.execute(
        "INSERT INTO reading_history (work_id, page_index, opened_at) VALUES (?, 3, '2026-06-20 08:00:00')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO reading_history (work_id, page_index, opened_at) VALUES (?, 7, '2026-06-21 09:00:00')",
        (work_id,),
    )
    out = library.reading_history()
    assert out["total"] == 2
    assert [e["date"] for e in out["result"]] == ["2026-06-21", "2026-06-20"]
    assert out["result"][0]["furthest_page"] == 7


def test_reading_history_paginates(tmp_path):
    _settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    work_id = _import(archive, tmp_path, "gamma", pages=10)
    for day in range(1, 6):
        db.execute(
            "INSERT INTO reading_history (work_id, page_index, opened_at) VALUES (?, 1, ?)",
            (work_id, f"2026-06-0{day} 08:00:00"),
        )
    out = library.reading_history(page=1, per_page=2)
    assert out["total"] == 5
    assert out["num_pages"] == 3
    assert len(out["result"]) == 2
```

- [ ] **Step 2: 运行测试确认失败**

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_reading_history.py -q`
Expected: FAIL(`AttributeError: 'LibraryService' object has no attribute 'reading_history'`)。

- [ ] **Step 3: 实现 reading_history**

在 `backend/app/services/library_service.py` 的 `tag_filters` 方法之后、`# -- internals ---` 注释之前,插入:

```python
    def reading_history(self, page: int = 1, per_page: int = 30) -> dict[str, Any]:
        page = max(1, int(page))
        per_page = max(1, min(int(per_page), 100))
        total = int(
            self.db.fetchone(
                "SELECT COUNT(*) AS value FROM ("
                " SELECT 1 FROM reading_history GROUP BY work_id, date(opened_at)"
                ")"
            )["value"]
        )
        num_pages = max(1, (total + per_page - 1) // per_page)
        offset = (page - 1) * per_page
        rows = self.db.fetchall(
            """
            SELECT
              h.work_id AS id,
              date(h.opened_at) AS date,
              MAX(h.opened_at) AS last_opened_at,
              COUNT(*) AS read_events,
              MAX(h.page_index) AS furthest_page,
              w.title, w.title_japanese, w.pretty_title, w.source,
              w.remote_gallery_id, w.page_count, w.cover_path,
              COALESCE(rp.progress_percent, 0) AS progress_percent,
              COALESCE(rp.completed, 0) AS completed
            FROM reading_history h
            JOIN works w ON w.id = h.work_id
            LEFT JOIN reader_progress rp ON rp.work_id = h.work_id
            GROUP BY h.work_id, date(h.opened_at)
            ORDER BY last_opened_at DESC, h.work_id DESC
            LIMIT ? OFFSET ?
            """,
            [per_page, offset],
        )
        result = [
            {
                "id": int(row["id"]),
                "title": row["title"],
                "title_japanese": row["title_japanese"],
                "pretty_title": row["pretty_title"],
                "source": row["source"],
                "remote_gallery_id": row["remote_gallery_id"],
                "page_count": int(row["page_count"] or 0),
                "cover_path": row["cover_path"],
                "date": row["date"],
                "last_opened_at": row["last_opened_at"],
                "read_events": int(row["read_events"]),
                "furthest_page": int(row["furthest_page"] or 0),
                "progress_percent": int(row["progress_percent"]),
                "completed": bool(row["completed"]),
            }
            for row in rows
        ]
        return {"result": result, "total": total, "page": page, "per_page": per_page, "num_pages": num_pages}
```

- [ ] **Step 4: 加 API 路由**

在 `backend/app/main.py` 的 `library_tag_filters` 路由之后(`@app.get("/api/governance/queue")` 之前)插入:

```python
@app.get("/api/library/reading-history")
def library_reading_history(page: int = 1, per_page: int = 30):
    return library.reading_history(page, per_page)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests/test_library_reading_history.py -q`
Expected: PASS(4 passed,输出无 warning)。

- [ ] **Step 6: 跑全量后端测试确认无回归**

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS(全绿)。

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/library_service.py backend/app/main.py backend/tests/test_library_reading_history.py
git commit -m "feat(library): 阅读历史聚合查询与 API"
```

---

## Task 3: 阅读历史前端页(`#history`)

**Files:**
- Modify: `frontend/src/lib/api.ts`(类型 + `libraryReadingHistory`)
- Modify: `frontend/src/lib/navigation.ts`(`Page` 加 `history`)
- Modify: `frontend/src/components/layout/ArchiveShell.tsx`(NAV 项 + 导航类型)
- Modify: `frontend/src/App.tsx`(渲染分支)
- Create: `frontend/src/components/history/HistoryPage.tsx`
- Create: `frontend/src/components/history/useHistoryState.ts`
- Create: `frontend/src/components/history/historyHelpers.ts`

**Interfaces:**
- Consumes: Task 2 的 `GET /api/library/reading-history`;`IconPager`;`navigate({name:"reader", workId})`。
- Produces: 路由 `#history` → `HistoryPage`;`api.libraryReadingHistory(page, per_page)`;类型 `ReadingHistoryEntry`、`ReadingHistoryPage`。

- [ ] **Step 1: 加 api.ts 类型与方法**

在 `frontend/src/lib/api.ts` 中,`LibrarySummary` 类型定义之后插入:

```typescript
export type ReadingHistoryEntry = {
  id: number;
  title: string;
  title_japanese?: string | null;
  pretty_title?: string | null;
  source: string;
  remote_gallery_id?: number | null;
  page_count: number;
  cover_path?: string | null;
  date: string;
  last_opened_at: string;
  read_events: number;
  furthest_page: number;
  progress_percent: number;
  completed: boolean;
};

export type ReadingHistoryPage = {
  result: ReadingHistoryEntry[];
  total: number;
  page: number;
  per_page: number;
  num_pages: number;
};
```

在 `api` 对象里 `libraryRecentRead` 那一行之后插入:

```typescript
  libraryReadingHistory: (page = 1, per_page = 30) =>
    request<ReadingHistoryPage>(`/api/library/reading-history?page=${page}&per_page=${per_page}`),
```

- [ ] **Step 2: 注册路由 navigation.ts**

在 `frontend/src/lib/navigation.ts` 的 `Page` 联合类型里,`| { name: "files" }` 之后加一行:

```typescript
  | { name: "history" }
```

在 `pageFromLocation` 里 `if (route === "files") return { name: "files" };` 之后加:

```typescript
  if (route === "history") return { name: "history" };
```

(`navigate` 无需改:`page.name === "history"` 会落到末尾默认分支 `: page.name`,生成 `#history`。)

- [ ] **Step 3: 加导航项 ArchiveShell.tsx**

在 `frontend/src/components/layout/ArchiveShell.tsx` 顶部 lucide 导入里,`Library,` 之后插入图标(保持字母序,可放在 `Library,` 后)。把导入块改为含 `Clock`:

```tsx
import {
  BookOpen,
  Clock,
  Download,
  EyeOff,
  FileArchive,
  Library,
  PenTool,
  Search,
  Settings,
  Upload,
  Workflow,
  Wrench,
} from "lucide-react";
```

在 `NAV` 数组里 `{ id: "library", label: "我的库", icon: Library },` 之后插入:

```tsx
  { id: "history", label: "历史", icon: Clock },
```

把 `onClick` 里 `navigate({ name: item.id as ... })` 的联合类型补上 `"history"`:

```tsx
                  name: item.id as
                    | "workbench"
                    | "discover"
                    | "library"
                    | "history"
                    | "governance"
                    | "dictionary"
                    | "tasks"
                    | "export"
                    | "files"
                    | "settings",
```

- [ ] **Step 4: 写 historyHelpers.ts**

创建 `frontend/src/components/history/historyHelpers.ts`:

```typescript
import type { ReadingHistoryEntry } from "../../lib/api";

// 把 YYYY-MM-DD(UTC 日期)按相对今天归入桶。
export function dateBucket(date: string): string {
  const today = new Date();
  const todayStr = toDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  const weekAgoStr = toDateStr(weekAgo);

  if (date === todayStr) return "今天";
  if (date === yesterdayStr) return "昨天";
  if (date >= weekAgoStr) return "本周";
  return date;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function timeOfDay(iso: string): string {
  // last_opened_at 形如 "2026-06-23 08:15:42"(UTC)。只取 HH:MM。
  const match = /\d{2}:\d{2}/.exec(iso);
  return match ? match[0] : iso;
}

export type HistoryBucket = { label: string; entries: ReadingHistoryEntry[] };

export function groupByBucket(entries: ReadingHistoryEntry[]): HistoryBucket[] {
  const buckets: HistoryBucket[] = [];
  for (const entry of entries) {
    const label = dateBucket(entry.date);
    const last = buckets[buckets.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      buckets.push({ label, entries: [entry] });
    }
  }
  return buckets;
}

export function progressLabel(entry: ReadingHistoryEntry): { text: string; tone: "reading" | "done" } {
  if (entry.completed) return { text: "已读完", tone: "done" };
  return { text: `${entry.progress_percent}%`, tone: "reading" };
}
```

- [ ] **Step 5: 写 useHistoryState.ts**

创建 `frontend/src/components/history/useHistoryState.ts`:

```typescript
import { useEffect, useState } from "react";

import { api, type ReadingHistoryPage } from "../../lib/api";

export function useHistoryState() {
  const [data, setData] = useState<ReadingHistoryPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .libraryReadingHistory(page)
      .then((payload) => alive && setData(payload))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page]);

  return { data, page, setPage, loading, error };
}
```

- [ ] **Step 6: 写 HistoryPage.tsx**

创建 `frontend/src/components/history/HistoryPage.tsx`:

```tsx
import { IconPager } from "../discover/IconPager";
import { FadeIn } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { workTitle } from "../library/libraryHelpers";
import { groupByBucket, progressLabel, timeOfDay } from "./historyHelpers";
import { useHistoryState } from "./useHistoryState";

export function HistoryPage({ blurCovers }: { blurCovers: boolean }) {
  const state = useHistoryState();
  const entries = state.data?.result ?? [];
  const buckets = groupByBucket(entries);

  return (
    <section className="page history-page">
      <header className="hero">
        <div>
          <h1>阅读历史</h1>
          <p>按日期排列的真实阅读轨迹,数据来自本地阅读记录。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </header>

      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.loading ? <div className="page-panel">正在读取阅读历史...</div> : null}

      {!state.loading && entries.length === 0 ? (
        <div className="page-panel boundary-panel">
          <strong>暂无阅读记录</strong>
          <p>开始阅读任意作品后,这里会按日期显示真实的阅读轨迹。</p>
        </div>
      ) : null}

      {!state.loading && entries.length ? (
        <FadeIn className="history-list" y={8}>
          {buckets.map((bucket) => (
            <div className="history-bucket" key={bucket.label}>
              <h2 className="history-bucket-label">{bucket.label}</h2>
              {bucket.entries.map((entry) => {
                const progress = progressLabel(entry);
                return (
                  <button
                    className="history-row"
                    type="button"
                    key={`${entry.id}-${entry.date}`}
                    onClick={() => navigate({ name: "reader", workId: entry.id })}
                  >
                    <span className="history-cover">
                      {entry.cover_path ? (
                        <img
                          className={blurCovers ? "blurred" : ""}
                          src={`/api/works/${entry.id}/cover`}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="history-cover-empty" aria-hidden="true" />
                      )}
                    </span>
                    <span className="history-main">
                      <strong>{workTitle(entry)}</strong>
                      <small>
                        {timeOfDay(entry.last_opened_at)} · 阅读 {entry.read_events} 次 · 最远第 {entry.furthest_page}/
                        {entry.page_count} 页
                      </small>
                    </span>
                    <span className={`history-progress ${progress.tone}`}>{progress.text}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <IconPager
            page={state.page}
            totalPages={state.data?.num_pages ?? 1}
            loading={state.loading}
            onPage={state.setPage}
          />
        </FadeIn>
      ) : null}
    </section>
  );
}
```

> 注:`workTitle(work)` 取 `LibraryWork`,只读 `title/title_japanese/pretty_title` 字段;`ReadingHistoryEntry` 含这些字段,结构兼容。若 TS 报类型不符,在调用处 `workTitle(entry as unknown as LibraryWork)` 不可取——改为本地内联标题:`entry.title_japanese || entry.pretty_title || entry.title`。先用 `workTitle(entry)`,构建报错时再退回内联。

- [ ] **Step 7: App.tsx 渲染分支**

在 `frontend/src/App.tsx` 顶部 import 区(其它页面 import 附近)加:

```tsx
import { HistoryPage } from "./components/history/HistoryPage";
```

在 `{page.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}` 之后加一行:

```tsx
      {page.name === "history" ? <HistoryPage blurCovers={blurCovers} /> : null}
```

- [ ] **Step 8: 加最小样式**

在 `frontend/src/styles/app.css` 末尾追加(沿用现有 hairline 语言;若同名类已存在则跳过):

```css
.history-bucket { margin-bottom: 1.5rem; }
.history-bucket-label { font-size: 0.85rem; color: var(--text-muted); margin: 0 0 0.5rem; }
.history-row {
  display: flex; align-items: center; gap: 0.75rem; width: 100%;
  padding: 0.5rem 0.25rem; background: none; border: none;
  border-bottom: 1px solid var(--hairline); text-align: left; cursor: pointer;
}
.history-row:hover { background: var(--surface-hover, rgba(0,0,0,0.03)); }
.history-cover { width: 38px; height: 52px; flex: none; overflow: hidden; border-radius: 4px; }
.history-cover img { width: 100%; height: 100%; object-fit: cover; }
.history-cover img.blurred { filter: blur(12px); }
.history-cover-empty { display: block; width: 100%; height: 100%; background: var(--hairline); }
.history-main { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0; }
.history-main strong { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-main small { color: var(--text-muted); }
.history-progress { font-size: 0.8rem; flex: none; }
.history-progress.done { color: var(--ok, #2e7d32); }
.history-progress.reading { color: var(--text-muted); }
```

> 若 `--hairline`/`--text-muted`/`--ok` 等 token 在 `app.css` 不存在,用文件内已有的等价变量替换(实现者先 `grep -n "\-\-hairline\|\-\-text-muted" frontend/src/styles/app.css` 确认,缺失则替换为现有变量名或具体色值)。

- [ ] **Step 9: 构建验证**

Run: `cd frontend && npm run build`
Expected: PASS。若 `workTitle(entry)` 报类型错,按 Step 6 注释改为内联 `entry.title_japanese || entry.pretty_title || entry.title` 后重跑。

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/navigation.ts frontend/src/components/layout/ArchiveShell.tsx frontend/src/App.tsx frontend/src/components/history/ frontend/src/styles/app.css
git commit -m "feat(history): 阅读历史专属页 #history"
```

---

## Task 4: 治理批量后端(service + API + 测试)

**Files:**
- Modify: `backend/app/services/governance_service.py`(新增 `bulk_preview`、`bulk_apply`,及内部 `_fill_fields_for`)
- Modify: `backend/app/main.py`(新增两个路由 + pydantic 模型)
- Test: `backend/tests/test_governance_bulk.py`

**Interfaces:**
- Consumes: 既有 `GovernanceService.work_governance(work_id)`(返回 `metadata.fields[*]` 含 `field/working_value/source_value/source`)、`write_back_comicinfo(work_id)`、`_normalize_value`、常量 `METADATA_FIELDS`、`ALLOWED_METADATA_SOURCES`。
- Produces:
  - `bulk_preview(work_ids: list[int], actions: dict) -> dict` →
    `{"result": [{"work": 摘要, "fill_fields": [{field,label,source_value,source}], "write_back_ready": bool, "blockers": [str]}], "summary": {"works": int, "fields_to_fill": int, "write_back_ready": int}}`
  - `bulk_apply(work_ids: list[int], actions: dict) -> dict` →
    `{"result": [{"work_id": int, "filled": [field...], "write_back": {...written}|{"error": str}|None}], "summary": {"works": int, "filled_fields": int, "written": int, "errors": int}}`
  - API:`POST /api/governance/bulk/preview`、`POST /api/governance/bulk/apply`,body `{work_ids: int[], actions: {fill_missing_metadata?: bool, write_back?: bool}}`。

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_governance_bulk.py`:

```python
import zipfile
from pathlib import Path

import pytest

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.governance_service import GovernanceService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, with_comicinfo: bool = False) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())
        if with_comicinfo:
            archive.writestr("ComicInfo.xml", "<ComicInfo><Title>Old</Title></ComicInfo>")


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    governance = GovernanceService(db, settings=settings)
    return settings, db, archive, governance


def _import(db, archive, tmp_path, gallery_id: int, *, title: str, with_comicinfo: bool = False) -> int:
    cbz = tmp_path / f"src-{gallery_id}.cbz"
    _make_cbz(cbz, with_comicinfo=with_comicinfo)
    # 写一个真实 remote payload,让 source_value 有来源(remote)。
    db.execute(
        "INSERT INTO remote_galleries (gallery_id, payload_json) VALUES (?, ?)",
        (gallery_id, '{"title": {"english": "%s"}, "num_pages": 2}' % title),
    )
    return archive.ingest_cbz(cbz, "remote", title, gallery_id, {"remote": "nhentai"})


def test_bulk_preview_lists_fillable_fields_without_writing(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 111, title="Alpha")
    out = governance.bulk_preview([work_id], {"fill_missing_metadata": True})
    assert out["summary"]["works"] == 1
    item = out["result"][0]
    fields = {f["field"] for f in item["fill_fields"]}
    # title 已由 ingest 落到 works.title(current 非空),不应进入补全;language 等缺失且有来源才进入。
    assert "title" not in fields
    # 预览不应写任何 work_metadata。
    assert db.fetchone("SELECT COUNT(*) AS c FROM work_metadata WHERE work_id = ?", (work_id,))["c"] == 0


def test_bulk_apply_fills_only_missing_and_never_overwrites(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 222, title="Beta")
    # 预置一个人工 language 值,batch 不得覆盖它。
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source, source_value) "
        "VALUES (?, 'language', '中文', 'manual', NULL)",
        (work_id,),
    )
    out = governance.bulk_apply([work_id], {"fill_missing_metadata": True})
    assert "language" not in out["result"][0]["filled"]
    kept = db.fetchone("SELECT value FROM work_metadata WHERE work_id = ? AND field = 'language'", (work_id,))
    assert kept["value"] == "中文"


def test_bulk_apply_write_back_updates_hash_and_isolates_failure(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    ok_id = _import(db, archive, tmp_path, 333, title="Gamma", with_comicinfo=True)
    bad_id = _import(db, archive, tmp_path, 444, title="Delta", with_comicinfo=True)
    # 破坏 bad 的源文件路径,使其回写失败。
    db.execute(
        "UPDATE work_files SET path = '/nonexistent/missing.cbz' WHERE work_id = ? AND kind = 'source_cbz'",
        (bad_id,),
    )
    before = db.fetchone("SELECT sha256 FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (ok_id,))["sha256"]

    out = governance.bulk_apply([ok_id, bad_id], {"write_back": True})

    results = {r["work_id"]: r for r in out["result"]}
    assert results[ok_id]["write_back"]["written"] is True
    assert "error" in results[bad_id]["write_back"]
    assert out["summary"]["written"] == 1
    assert out["summary"]["errors"] == 1
    after = db.fetchone("SELECT sha256 FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (ok_id,))["sha256"]
    assert after != before  # ok 作品哈希已同步更新


def test_bulk_requires_an_action(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 555, title="Echo")
    with pytest.raises(ValueError):
        governance.bulk_apply([work_id], {})
    with pytest.raises(ValueError):
        governance.bulk_preview([work_id], {"fill_missing_metadata": False, "write_back": False})
```

> 实现者注意:`remote_galleries` 的列名以实际 schema 为准——先 `grep -n "remote_galleries" backend/app/database.py` 确认 `gallery_id` / `payload_json` 列名;若不同则调整 INSERT。该表是 `work_governance` 解析 remote source_value 的来源。

- [ ] **Step 2: 运行测试确认失败**

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_bulk.py -q`
Expected: FAIL(`AttributeError: 'GovernanceService' object has no attribute 'bulk_preview'`)。

- [ ] **Step 3: 实现来源映射 + 批量方法**

在 `backend/app/services/governance_service.py` 顶部常量区,`ALLOWED_METADATA_SOURCES` 定义之后加映射常量:

```python
# work_governance 的 source（comicinfo/json/remote/unknown）→ 允许写入 work_metadata 的 source。
SOURCE_TO_METADATA = {"comicinfo": "comicinfo", "remote": "remote", "json": "remote"}
BULK_ACTION_KEYS = {"fill_missing_metadata", "write_back"}
```

在 `GovernanceService` 类内、`apply` 方法之后插入三个方法:

```python
    def _fill_fields_for(self, aggregate: dict[str, Any]) -> list[dict[str, Any]]:
        """空值且有来源值的字段，作为「可补全」返回。绝不含已有非空终值的字段。"""
        fills: list[dict[str, Any]] = []
        for field in aggregate["metadata"]["fields"]:
            working = self._normalize_value(field.get("working_value"))
            source_value = field.get("source_value")
            source = str(field.get("source") or "")
            if working == "" and source_value and source in SOURCE_TO_METADATA:
                fills.append(
                    {
                        "field": field["field"],
                        "label": field["label"],
                        "source_value": source_value,
                        "source": source,
                    }
                )
        return fills

    def bulk_preview(self, work_ids: list[int], actions: dict[str, Any]) -> dict[str, Any]:
        fill = bool(actions.get("fill_missing_metadata"))
        write_back = bool(actions.get("write_back"))
        if not (fill or write_back):
            raise ValueError("至少选择一个批量动作。")

        result = []
        fields_to_fill = 0
        write_back_ready = 0
        for work_id in work_ids:
            work = self._work_row(int(work_id))
            if not work:
                continue
            aggregate = self.work_governance(int(work_id))
            fill_fields = self._fill_fields_for(aggregate) if fill else []
            fields_to_fill += len(fill_fields)
            ready, blockers = (False, [])
            if write_back:
                ready, blockers = self._write_back_readiness(int(work_id))
                if ready:
                    write_back_ready += 1
            result.append(
                {
                    "work": aggregate["work"],
                    "fill_fields": fill_fields,
                    "write_back_ready": ready,
                    "blockers": blockers,
                }
            )
        return {
            "result": result,
            "summary": {
                "works": len(result),
                "fields_to_fill": fields_to_fill,
                "write_back_ready": write_back_ready,
            },
        }

    def bulk_apply(self, work_ids: list[int], actions: dict[str, Any]) -> dict[str, Any]:
        fill = bool(actions.get("fill_missing_metadata"))
        write_back = bool(actions.get("write_back"))
        if not (fill or write_back):
            raise ValueError("至少选择一个批量动作。")

        result = []
        filled_total = 0
        written = 0
        errors = 0
        for work_id in work_ids:
            work_id = int(work_id)
            work = self._work_row(work_id)
            if not work:
                continue
            entry: dict[str, Any] = {"work_id": work_id, "filled": [], "write_back": None}

            if fill:
                aggregate = self.work_governance(work_id)
                fill_fields = self._fill_fields_for(aggregate)
                if fill_fields:
                    with self.db.connect() as conn:
                        for field in fill_fields:
                            conn.execute(
                                """
                                INSERT INTO work_metadata (work_id, field, value, source, source_value, updated_at)
                                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                ON CONFLICT(work_id, field) DO UPDATE SET
                                  value = excluded.value,
                                  source = excluded.source,
                                  source_value = excluded.source_value,
                                  updated_at = CURRENT_TIMESTAMP
                                """,
                                (
                                    work_id,
                                    field["field"],
                                    field["source_value"],
                                    SOURCE_TO_METADATA[field["source"]],
                                    field["source_value"],
                                ),
                            )
                    entry["filled"] = [field["field"] for field in fill_fields]
                    filled_total += len(fill_fields)

            if write_back:
                try:
                    entry["write_back"] = self.write_back_comicinfo(work_id)
                    written += 1
                except Exception as exc:  # 失败隔离：记录并继续下一作品，不回滚已写 metadata
                    entry["write_back"] = {"error": str(exc)}
                    errors += 1

            result.append(entry)

        return {
            "result": result,
            "summary": {
                "works": len(result),
                "filled_fields": filled_total,
                "written": written,
                "errors": errors,
            },
        }

    def _write_back_readiness(self, work_id: int) -> tuple[bool, list[str]]:
        """复用 write_back_comicinfo 的前置防护判定，但不动盘。"""
        blockers: list[str] = []
        if self.settings is None:
            return False, ["未配置 library 目录"]
        row = self.db.fetchone(
            "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz' "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (work_id,),
        )
        source_path = Path(row["path"]).resolve() if row and row["path"] else None
        if source_path is None or not source_path.exists() or not zipfile.is_zipfile(source_path):
            return False, ["源 CBZ 不存在或不是有效 ZIP"]
        library_root = self.settings.library_dir.resolve()
        if not (source_path == library_root or library_root in source_path.parents):
            return False, ["源文件不在受管 library 目录内"]
        return True, blockers
```

> `_write_back_readiness` 的判定逻辑与 `write_back_comicinfo:198-203` 一致;实现时核对两处保持同一防护(同一 `library_dir.resolve()` + `in parents` 组件式判定)。

- [ ] **Step 4: 运行单测确认通过**

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_bulk.py -q`
Expected: PASS(5 passed)。若 `test_bulk_preview_lists_fillable_fields_without_writing` 因 remote payload 列名失败,按 Step 1 注释核对 `remote_galleries` schema 后修正测试再跑。

- [ ] **Step 5: 加 API 模型与路由**

在 `backend/app/main.py` 的 `GovernanceApplyRequest` 类定义之后插入:

```python
class GovernanceBulkActions(BaseModel):
    fill_missing_metadata: bool = False
    write_back: bool = False


class GovernanceBulkRequest(BaseModel):
    work_ids: list[int] = []
    actions: GovernanceBulkActions = GovernanceBulkActions()
```

在 `apply_work_governance` 路由之后插入:

```python
@app.post("/api/governance/bulk/preview")
def governance_bulk_preview(payload: GovernanceBulkRequest):
    try:
        return governance.bulk_preview(payload.work_ids, payload.actions.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/governance/bulk/apply")
def governance_bulk_apply(payload: GovernanceBulkRequest):
    try:
        return governance.bulk_apply(payload.work_ids, payload.actions.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
```

- [ ] **Step 6: 写 API 测试并验证**

把下面追加到 `backend/tests/test_governance_bulk.py` 末尾(经 FastAPI `TestClient`,复用 `app.main` 的真实依赖装配方式——实现者参考 `test_governance_writeback.py` 之外的 `test_jobs_api.py`/`test_files_api.py` 看本仓如何用 `TestClient` 覆写 db/settings;沿用同一 fixture 风格):

```python
def test_bulk_apply_api_rejects_empty_actions(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    import app.main as main

    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 666, title="Foxtrot")
    monkeypatch.setattr(main, "governance", governance)
    client = TestClient(main.app)

    resp = client.post("/api/governance/bulk/apply", json={"work_ids": [work_id], "actions": {}})
    assert resp.status_code == 422
```

> 实现者:若 `app.main` 的服务实例无法这样 monkeypatch(模块级单例),改为参照仓内既有 API 测试(`test_files_api.py`)的装配方式构造 client,确保打到的是测试库而非真实数据目录。本测试的断言不变:空 actions → 422。

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests/test_governance_bulk.py -q`
Expected: PASS(6 passed)。

- [ ] **Step 7: 跑全量后端测试**

Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`
Expected: PASS(全绿)。

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/governance_service.py backend/app/main.py backend/tests/test_governance_bulk.py
git commit -m "feat(governance): 批量补全缺失元数据与批量回写 ComicInfo"
```

---

## Task 5: 治理批量前端(多选 + 批量条)

**Files:**
- Modify: `frontend/src/lib/api.ts`(类型 + `governanceBulkPreview`/`governanceBulkApply`)
- Modify: `frontend/src/components/governance/useGovernanceState.ts`(多选状态 + 批量动作)
- Modify: `frontend/src/components/governance/GovernanceQueueRail.tsx`(复选框)
- Modify: `frontend/src/components/governance/GovernancePage.tsx`(挂批量条 + 传多选 props)
- Create: `frontend/src/components/governance/GovernanceBulkBar.tsx`

**Interfaces:**
- Consumes: Task 4 的 `POST /api/governance/bulk/preview|apply`;既有 `GovernanceQueue`、`useGovernanceState`。
- Produces: `api.governanceBulkPreview(work_ids, actions)`、`api.governanceBulkApply(...)`;类型 `GovernanceBulkActions`、`GovernanceBulkPreview`、`GovernanceBulkResult`。单作品流程保持不变。

- [ ] **Step 1: 加 api.ts 类型与方法**

在 `frontend/src/lib/api.ts` 的 `GovernanceApplyResult` 类型之后插入:

```typescript
export type GovernanceBulkActions = {
  fill_missing_metadata?: boolean;
  write_back?: boolean;
};

export type GovernanceBulkPreview = {
  result: Array<{
    work: LibraryWork;
    fill_fields: Array<{ field: string; label: string; source_value: string; source: string }>;
    write_back_ready: boolean;
    blockers: string[];
  }>;
  summary: { works: number; fields_to_fill: number; write_back_ready: number };
};

export type GovernanceBulkResult = {
  result: Array<{
    work_id: number;
    filled: string[];
    write_back: { written?: boolean; error?: string } | null;
  }>;
  summary: { works: number; filled_fields: number; written: number; errors: number };
};
```

在 `api` 对象里 `applyWorkGovernance` 之后插入:

```typescript
  governanceBulkPreview: (work_ids: number[], actions: GovernanceBulkActions) =>
    request<GovernanceBulkPreview>("/api/governance/bulk/preview", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_ids, actions })
    }),
  governanceBulkApply: (work_ids: number[], actions: GovernanceBulkActions) =>
    request<GovernanceBulkResult>("/api/governance/bulk/apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_ids, actions })
    }),
```

- [ ] **Step 2: useGovernanceState 加多选与批量动作**

在 `frontend/src/components/governance/useGovernanceState.ts` 的 import 里补类型:

```typescript
import {
  api,
  DictionaryApplyPayload,
  GovernanceAggregate,
  GovernanceBulkPreview,
  GovernanceBulkResult,
  GovernanceQueue,
  GovernanceTag,
} from "../../lib/api";
```

在 `const [writeBack, setWriteBack] = useState(false);` 之后加批量状态:

```typescript
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkFill, setBulkFill] = useState(true);
  const [bulkWriteBack, setBulkWriteBack] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<GovernanceBulkPreview | null>(null);
  const [bulkResult, setBulkResult] = useState<GovernanceBulkResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
```

在 `selectWork` 函数定义之后(`return {` 之前)加批量操作函数:

```typescript
  const toggleBulkMode = () => {
    setBulkMode((on) => !on);
    setSelectedIds(new Set());
    setBulkPreview(null);
    setBulkResult(null);
  };

  const toggleSelected = (id: number) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulkActions = (): { fill_missing_metadata: boolean; write_back: boolean } => ({
    fill_missing_metadata: bulkFill,
    write_back: bulkWriteBack,
  });

  const runBulkPreview = async () => {
    if (!selectedIds.size) {
      setNotice("请先勾选要批量处理的作品。");
      return;
    }
    if (!bulkFill && !bulkWriteBack) {
      setNotice("请至少选择一个批量动作。");
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    setBulkResult(null);
    try {
      setBulkPreview(await api.governanceBulkPreview([...selectedIds], bulkActions()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkApply = async () => {
    if (!selectedIds.size) return;
    if (!bulkFill && !bulkWriteBack) {
      setNotice("请至少选择一个批量动作。");
      return;
    }
    if (bulkWriteBack && !window.confirm("将就地改写所选作品源 CBZ 的 ComicInfo，此操作不可撤销。是否继续？")) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.governanceBulkApply([...selectedIds], bulkActions());
      setBulkResult(result);
      setQueue(await api.governanceQueue());
      const { filled_fields, written, errors } = result.summary;
      setNotice(`批量完成：补全 ${filled_fields} 个字段，回写 ${written} 个文件${errors ? `，${errors} 个失败` : ""}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  };
```

在 `return { ... }` 对象里(`selectWork,` 之后)补出口:

```typescript
    selectWork,
    bulkMode,
    toggleBulkMode,
    selectedIds,
    toggleSelected,
    bulkFill,
    setBulkFill,
    bulkWriteBack,
    setBulkWriteBack,
    bulkPreview,
    bulkResult,
    bulkBusy,
    runBulkPreview,
    runBulkApply,
```

- [ ] **Step 3: GovernanceQueueRail 支持多选复选框**

把 `frontend/src/components/governance/GovernanceQueueRail.tsx` 的 `Props` 与 `QueueCard` 改为支持多选(完整替换文件):

```tsx
import type { GovernanceQueue, GovernanceQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { workTitle } from "../library/libraryHelpers";

type Props = {
  queue: GovernanceQueue;
  selectedId: number | null;
  onSelect: (id: number) => void;
  bulkMode: boolean;
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
};

export function GovernanceQueueRail({ queue, selectedId, onSelect, bulkMode, selectedIds, onToggleSelected }: Props) {
  return (
    <aside className="governance-rail">
      <div className="governance-rail-head">
        <div>
          <span className="eyebrow">Queue</span>
          <h2>待编辑作品</h2>
        </div>
        <strong className="governance-rail-count">
          <NumberTicker value={queue.summary.total} />
        </strong>
      </div>
      <Stagger key={queue.result.map((item) => item.work.id).join("-")} className="governance-rail-list">
        {queue.result.map((item) => (
          <StaggerItem key={item.work.id}>
            <QueueCard
              item={item}
              selected={selectedId === item.work.id}
              onSelect={onSelect}
              bulkMode={bulkMode}
              checked={selectedIds.has(item.work.id)}
              onToggleSelected={onToggleSelected}
            />
          </StaggerItem>
        ))}
      </Stagger>
    </aside>
  );
}

function QueueCard({
  item,
  selected,
  onSelect,
  bulkMode,
  checked,
  onToggleSelected,
}: {
  item: GovernanceQueueItem;
  selected: boolean;
  onSelect: (id: number) => void;
  bulkMode: boolean;
  checked: boolean;
  onToggleSelected: (id: number) => void;
}) {
  const hasDanger = item.reasons.some((reason) => reason.severity === "danger");
  return (
    <div className={`governance-rail-card${selected ? " selected" : ""}`}>
      {bulkMode ? (
        <label className="governance-rail-check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={() => onToggleSelected(item.work.id)} />
        </label>
      ) : null}
      <button className="governance-rail-card-body" type="button" onClick={() => onSelect(item.work.id)}>
        <div className="governance-rail-card-top">
          <strong>{workTitle(item.work)}</strong>
          <span
            className="governance-rail-pct"
            data-tone={item.completeness_percent >= 100 ? "ok" : hasDanger ? "bad" : "warn"}
          >
            {item.completeness_percent}%
          </span>
        </div>
        <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
        <span className="governance-rail-bar" aria-hidden="true">
          <span style={{ width: `${item.completeness_percent}%` }} />
        </span>
        <span className="governance-rail-reasons">
          {item.reasons.length ? (
            item.reasons.slice(0, 3).map((reason) => (
              <em key={reason.code} className={reason.severity === "danger" ? "danger" : ""}>
                {reason.label}
              </em>
            ))
          ) : (
            <em className="ok">无待办</em>
          )}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 写 GovernanceBulkBar.tsx**

创建 `frontend/src/components/governance/GovernanceBulkBar.tsx`:

```tsx
import type { GovernanceBulkPreview, GovernanceBulkResult } from "../../lib/api";

type Props = {
  selectedCount: number;
  fill: boolean;
  onFillChange: (value: boolean) => void;
  writeBack: boolean;
  onWriteBackChange: (value: boolean) => void;
  busy: boolean;
  preview: GovernanceBulkPreview | null;
  result: GovernanceBulkResult | null;
  onPreview: () => void;
  onApply: () => void;
};

export function GovernanceBulkBar({
  selectedCount,
  fill,
  onFillChange,
  writeBack,
  onWriteBackChange,
  busy,
  preview,
  result,
  onPreview,
  onApply,
}: Props) {
  return (
    <div className="governance-bulk-bar">
      <div className="governance-bulk-head">
        <strong>已选 {selectedCount} 部</strong>
        <label>
          <input type="checkbox" checked={fill} onChange={(e) => onFillChange(e.target.checked)} />
          补全缺失元数据
        </label>
        <label>
          <input type="checkbox" checked={writeBack} onChange={(e) => onWriteBackChange(e.target.checked)} />
          回写源文件（ComicInfo）
        </label>
        <button type="button" disabled={busy || !selectedCount} onClick={onPreview}>
          预览
        </button>
        <button type="button" className="primary" disabled={busy || !selectedCount} onClick={onApply}>
          应用
        </button>
      </div>
      {writeBack ? (
        <p className="governance-bulk-hint">回写会就地改写所选作品源 CBZ 的 ComicInfo，不可撤销；单个失败不影响其余。</p>
      ) : null}

      {preview ? (
        <div className="governance-bulk-preview">
          <p>
            将补全 {preview.summary.fields_to_fill} 个字段
            {writeBack ? `，可回写 ${preview.summary.write_back_ready}/${preview.summary.works} 个文件` : ""}。
          </p>
          <ul>
            {preview.result.map((row) => (
              <li key={row.work.id}>
                <span>{row.work.title || `#${row.work.id}`}</span>
                <small>
                  {row.fill_fields.length ? `补全 ${row.fill_fields.map((f) => f.label).join("、")}` : "无可补全字段"}
                  {writeBack ? (row.write_back_ready ? " · 可回写" : ` · 不可回写（${row.blockers.join("；")}）`) : ""}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="governance-bulk-result">
          <p>
            完成：补全 {result.summary.filled_fields} 字段、回写 {result.summary.written} 个
            {result.summary.errors ? `、失败 ${result.summary.errors} 个` : ""}。
          </p>
          <ul>
            {result.result.map((row) => (
              <li key={row.work_id}>
                <span>#{row.work_id}</span>
                <small>
                  {row.filled.length ? `补全 ${row.filled.length} 字段` : "未补全"}
                  {row.write_back
                    ? row.write_back.error
                      ? ` · 回写失败：${row.write_back.error}`
                      : " · 已回写"
                    : ""}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: GovernancePage 挂批量条 + 传 props**

在 `frontend/src/components/governance/GovernancePage.tsx` import 区加:

```tsx
import { GovernanceBulkBar } from "./GovernanceBulkBar";
```

把 `<GovernanceQueueRail ... />` 调用替换为带多选 props 的版本,并在其后(`governance-shell` 内、`governance-editor` 之前不行——批量条应在编辑区上方整宽)调整:把 `governance-shell` 那段改为:

```tsx
      {!gov.loading && gov.queue && gov.queue.result.length ? (
        <div className="governance-shell">
          <GovernanceQueueRail
            queue={gov.queue}
            selectedId={gov.selectedId}
            onSelect={gov.selectWork}
            bulkMode={gov.bulkMode}
            selectedIds={gov.selectedIds}
            onToggleSelected={gov.toggleSelected}
          />

          <div className="governance-editor">
            <div className="governance-bulk-toggle">
              <button type="button" onClick={gov.toggleBulkMode}>
                {gov.bulkMode ? "退出批量" : "批量处理"}
              </button>
            </div>

            {gov.bulkMode ? (
              <GovernanceBulkBar
                selectedCount={gov.selectedIds.size}
                fill={gov.bulkFill}
                onFillChange={gov.setBulkFill}
                writeBack={gov.bulkWriteBack}
                onWriteBackChange={gov.setBulkWriteBack}
                busy={gov.bulkBusy}
                preview={gov.bulkPreview}
                result={gov.bulkResult}
                onPreview={gov.runBulkPreview}
                onApply={gov.runBulkApply}
              />
            ) : (
              <>
                {gov.aggregateLoading ? <div className="page-panel">正在读取作品元数据...</div> : null}
                {!gov.aggregateLoading && gov.aggregate ? (
                  <FadeIn key={gov.aggregate.work.id} y={10}>
                    <GovernanceWorkHeader aggregate={gov.aggregate} blurCovers={blurCovers} />

                    <MetadataEditor
                      aggregate={gov.aggregate}
                      edits={gov.edits}
                      onChange={gov.changeField}
                      onlyDiff={gov.onlyDiff}
                      onToggleDiff={() => gov.setOnlyDiff((value) => !value)}
                    />

                    <GovernanceTagBoard aggregate={gov.aggregate} onApplyDictionaryTag={gov.applyDictionaryTag} />

                    <GovernanceActionBar
                      workId={gov.aggregate.work.id}
                      changedCount={gov.changedFields.length}
                      saving={gov.saving}
                      writeBack={gov.writeBack}
                      onWriteBackChange={gov.setWriteBack}
                      onSave={gov.saveMetadata}
                      onReload={gov.reload}
                    />
                  </FadeIn>
                ) : null}
                {!gov.aggregateLoading && !gov.aggregate ? (
                  <div className="governance-editor-empty">从左侧队列选择一部作品开始编辑。</div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
```

- [ ] **Step 6: 加最小样式**

在 `frontend/src/styles/app.css` 末尾追加(token 缺失时按 Task 3 Step 8 注释处理):

```css
.governance-bulk-toggle { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
.governance-rail-card { display: flex; align-items: flex-start; gap: 0.4rem; }
.governance-rail-card-body { flex: 1; min-width: 0; background: none; border: none; text-align: left; cursor: pointer; padding: 0; }
.governance-rail-check { padding-top: 0.4rem; }
.governance-bulk-bar { border: 1px solid var(--hairline); border-radius: 8px; padding: 0.85rem; }
.governance-bulk-head { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; }
.governance-bulk-head label { display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
.governance-bulk-hint { color: var(--danger, #c0392b); font-size: 0.8rem; margin: 0.5rem 0 0; }
.governance-bulk-preview, .governance-bulk-result { margin-top: 0.75rem; }
.governance-bulk-preview ul, .governance-bulk-result ul { list-style: none; padding: 0; margin: 0.4rem 0 0; }
.governance-bulk-preview li, .governance-bulk-result li { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.3rem 0; border-bottom: 1px solid var(--hairline); }
.governance-bulk-preview small, .governance-bulk-result small { color: var(--text-muted); text-align: right; }
```

- [ ] **Step 7: 构建验证**

Run: `cd frontend && npm run build`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/governance/ frontend/src/styles/app.css
git commit -m "feat(governance): 治理队列多选与批量预览/应用 UI"
```

---

## Task 6: 文档更新

**Files:**
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Consumes: 前五个任务的成果。
- Produces: 无代码;状态文档同步。

- [ ] **Step 1: 更新 Completed / Not Implemented / Next Plan / Decisions**

编辑 `docs/PROJECT_STATUS.md`:

1. 在 `## Completed` 区顶部(治理回写条目之后)加一条:

```markdown
- 轻量收尾阶段:① 文件管理 `#files` 清单补真实分页翻页器(复用 IconPager,后端 `inventory` 早已支持 page/per_page);② 新增阅读历史专属页 `#history`:`LibraryService.reading_history` 按 (作品, 日期) 聚合 `reading_history`(当天最近时间/阅读次数/最远页 + 当前总进度),`GET /api/library/reading-history` 分页,前端按「今天/昨天/本周/更早」日期桶分组时间线,点击进本地阅读器,遵守 blurCovers;③ 治理批量:`GovernanceService.bulk_preview/bulk_apply` 对多选作品执行统一动作——批量补全缺失元数据(只填空、绝不覆盖已有值、来源 comicinfo>json>remote)与批量回写 ComicInfo(沿用单作品 opt-in/原子/无备份/哈希同步/失败隔离),API `POST /api/governance/bulk/preview|apply`,治理队列加多选 + 批量条(预览/应用/结果回显 + 回写二次确认)。验证:`PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿(新增 reading_history 4 项 + governance_bulk 6 项);`cd frontend && npm run build` 通过。
```

2. 在 `## Not Implemented Yet` 区,删除/改写已落地项:把「Governance bulk preview/apply」一项移除;保留「Long-running bulk export jobs through the task center」(仍未做);`reading-history page` 已落地,从该区移除对应描述(原 `Library bulk actions ... and a dedicated reading-history page.` 改为只保留 `Library bulk actions (multi-select batch tray).`)。

3. 在 `## Next Plan` 区改为:

```markdown
轻量收尾三项(文件分页/阅读历史/治理批量)已落地。剩余方向:长时批量导出任务接入任务中心(需先单独设计「导出=下载给用户」与后台落盘的语义冲突——产物落盘策略/生命周期/清理);治理批量可扩展(词典批量解决仍留单作品人工);文件清单更多筛选维度。
```

4. 在 `## Risks And Decisions` 区加三条 Decision:

```markdown
- Decision: 治理批量只做「逐作品执行统一动作、取值各自解析」:批量补全缺失元数据(只填空、绝不覆盖人工/已有非空值,来源映射 comicinfo→comicinfo / remote→remote / json→remote)+ 批量回写 ComicInfo(沿用单作品 opt-in/原子/无备份/哈希同步/失败隔离;单作品失败记录 error 并继续,不回滚已写 metadata)。词典 review/冲突不批量,留单作品页人工解决。
- Decision: 阅读历史按 (作品, 日期) 聚合,前端按日期桶分组时间线;高频裸事件(每翻页一行)不展示。历史(完整可分页轨迹)与「继续阅读」(仅在读)、「最近阅读」(Top 12 书架)区分。
- Decision: 文件清单分页为纯前端补翻页器;后端 `FileMaintenanceService.inventory` 早已支持分页,无需改动。批量导出接任务中心仍不在范围,需先单独设计落盘/生命周期语义。
```

- [ ] **Step 2: Commit**

```bash
git add docs/PROJECT_STATUS.md
git commit -m "docs: 轻量收尾阶段状态与决策更新"
```

---

## Self-Review(已执行)

- **Spec coverage:** 文件分页→Task 1;阅读历史(后端聚合/API/前端页/导航)→Task 2-3;治理批量(预览/应用/API/多选 UI)→Task 4-5;决策记录→Task 6。全覆盖。
- **Placeholder scan:** 无 TBD/TODO;所有代码步骤含完整代码。两处带「实现者核对」说明(remote_galleries 列名、CSS token、TestClient 装配)是真实环境探查指令,非占位,均给了确认命令与回退方案。
- **Type consistency:** `reading_history` 返回结构与 `ReadingHistoryEntry`/`ReadingHistoryPage` 一致;`bulk_preview`/`bulk_apply` 返回与 `GovernanceBulkPreview`/`GovernanceBulkResult` 一致;`GovernanceQueueRail` 新 props 与 `useGovernanceState` 出口一致;`SOURCE_TO_METADATA` 的目标值均 ∈ `ALLOWED_METADATA_SOURCES`。
