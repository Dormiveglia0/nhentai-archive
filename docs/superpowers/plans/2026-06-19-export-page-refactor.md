# 导出中心页面重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `frontend/src/components/export/ExportPage.tsx`（812 行单文件）重构为多文件、精确还原 `design/导出中心.png` 的导出中心页面，并修复全部交互缺陷。

**Architecture:** 前端独占改动。将页面拆为「一个状态 hook + 五个表现组件 + 一个 helper 文件」，用单一选择集（`Set<number>`）同时驱动批量导出与预览；`.export-*` CSS 整段重写。后端 `export_service.py` 及其 API、测试不动。

**Tech Stack:** React 18 + TypeScript 5.7（strict）+ Vite 6 + Tailwind 4（仅 app.css 全局样式）+ `motion` 动画助手 + lucide-react 图标。

## Global Constraints

- 仅改 `frontend/`；后端零改动。`backend/tests` 现有用例必须仍通过：`PYTHONPATH=backend .venv/bin/pytest backend/tests -q`。
- 前端门禁：`cd frontend && npm run build`（= `tsc -b && vite build`）须零错误通过。项目无前端单测框架，逐任务以 build 通过为门禁，集成与 CSS 任务额外做浏览器/截图视觉核对。
- 硬 UI 参考：`design/导出中心.png`（`docs/DEVELOPMENT_RULES.md` 规定为权威）。
- 不造假：不新增 mock 作品/任务/统计/硬编码 tag 候选，不加成人样张。空数据渲染真实空状态。
- 标签显示遵循词典 `display` 规则（仅后端 API 用英文）。
- CSS 留在 `frontend/src/styles/app.css`，重写 `.export-*` 整段，不分散到组件。
- 不改共享 motion 原语（`Stagger` 无 cap API；长列表在组件层条件降级，不动 `lib/motion`）。
- 组件 props 显式且窄；每文件单一职责。
- 类型一律来自 `frontend/src/lib/api.ts`，不新增后端字段。`ExportPreset` 无 version 字段，禁止虚构。
- 提交信息结尾附：
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_012VeGHftM1CWDwEq1PsRKTp`

## File Structure

新建/改写于 `frontend/src/components/export/`：

| 文件 | 职责 |
|------|------|
| `exportHelpers.tsx` (新) | `Cover` 组件、`compactPath`、`presetSummaryLines` 等共享小件 |
| `useExportState.ts` (新) | 全部状态 + 数据加载/变更逻辑；返回 `ExportViewModel` |
| `ExportSummary.tsx` (新) | Hero（标题/副标题/草图题词）+ 5 张指标卡 |
| `ExportQueueTable.tsx` (新) | 待导出列表表格 |
| `ExportPresetBar.tsx` (新) | 导出预设事实条 + 输出目录编辑 + 操作按钮 |
| `ExportPreviewPanel.tsx` (新) | 导出预览侧栏 |
| `ExportHistory.tsx` (新) | 最近导出记录 |
| `ExportPage.tsx` (改写) | 容器：调 hook，组合上述组件，渲染通知/空状态 |
| `frontend/src/styles/app.css` (改) | 重写 `.export-*` 段（约 4692 行起） |

参考既有签名（实现时直接 import，勿改）：
- `frontend/src/components/library/libraryHelpers`：`formatBytes(bytes?: number): string`、`workTitle(work: LibraryWork): string`。
- `frontend/src/lib/motion`：`FadeIn`、`Stagger`、`StaggerItem`、`usePrefersReducedMotion`。
- `frontend/src/lib/api` 方法：`api.exportQueue()`、`api.exportSummary()`、`api.exportHistory()`、`api.settings()`、`api.exportPreview(id, options?)`、`api.exportBatch(items)`、`api.updateSettings(payload)`。
- API 类型：`ExportQueue`、`ExportQueueItem`、`ExportSummaryStats`、`ExportRecord`、`ExportPreview`、`ExportPreset`、`ExportBatchItem`、`SettingsSummary`。

---

### Task 1: 共享 helper（exportHelpers.tsx）

**Files:**
- Create: `frontend/src/components/export/exportHelpers.tsx`

**Interfaces:**
- Produces:
  - `function Cover(props: { workId: number; coverPath?: string | null; blurCovers: boolean }): JSX.Element`
  - `function compactPath(path: string): string`
  - `function presetSummaryLines(preset: ExportPreset | null): { name: string; rule: string }`

- [ ] **Step 1: 创建文件**

```tsx
import type { ExportPreset } from "../../lib/api";

export function compactPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join("/")}`;
}

export function presetSummaryLines(preset: ExportPreset | null): { name: string; rule: string } {
  return {
    name: preset?.name ?? "-",
    rule: preset?.comicinfo_rule ?? "-",
  };
}

export function Cover({
  workId,
  coverPath,
  blurCovers,
}: {
  workId: number;
  coverPath?: string | null;
  blurCovers: boolean;
}) {
  return (
    <span className="export-cover">
      {coverPath ? (
        <img className={blurCovers ? "blurred" : ""} src={`/api/works/${workId}/cover`} alt="" />
      ) : (
        <em>NO COVER</em>
      )}
    </span>
  );
}
```

- [ ] **Step 2: 类型检查通过**

Run: `cd frontend && npm run build`
Expected: 构建零错误（新文件可暂时未被引用，tsc 不报未用导出）。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/exportHelpers.tsx
git commit -m "feat(export): 抽出导出页共享 helper"
```

---

### Task 2: 状态 hook（useExportState.ts）

将当前 `ExportPage.tsx` 的全部状态与数据逻辑抽出，并把双选择态（`selectedId`+`selectedIds`）合并为**单一选择集** + 仅用于预览展开的 `focusId`。

**Files:**
- Create: `frontend/src/components/export/useExportState.ts`

**Interfaces:**
- Consumes: `api.*` 方法与 API 类型。
- Produces:

```ts
export type ExportViewModel = {
  loading: boolean;
  error: string | null;
  notice: string | null;
  queue: ExportQueue | null;
  summary: ExportSummaryStats | null;
  history: ExportRecord[];
  settings: SettingsSummary | null;
  selectedIds: Set<number>;
  focusId: number | null;
  outputNames: Record<number, string>;
  preview: ExportPreview | null;
  previewLoading: boolean;
  generating: boolean;
  savingOutputDir: boolean;
  outputDirDraft: string;
  openDirAfter: boolean;
  items: ExportQueueItem[];
  selectedItems: ExportQueueItem[];
  exportableItems: ExportQueueItem[];
  activePreset: ExportPreset | null;
  selectedSize: number;
  toggleSelected: (id: number) => void;
  focusItem: (id: number) => void;
  selectReady: () => void;
  removeSelected: () => void;
  clearSelected: () => void;
  renameOutput: (id: number, value: string) => void;
  setOutputDirDraft: (value: string) => void;
  setOpenDirAfter: (value: boolean) => void;
  saveOutputDir: () => Promise<void>;
  changePreset: (presetId: string) => Promise<void>;
  saveNewPreset: () => Promise<void>;
  generateSelected: () => Promise<void>;
  refreshPreview: () => Promise<void>;
};

export function useExportState(initialWorkId?: number): ExportViewModel;
```

- [ ] **Step 1: 创建文件（完整实现）**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../lib/api";
import type {
  ExportPreset,
  ExportPreview,
  ExportQueue,
  ExportQueueItem,
  ExportRecord,
  ExportSummaryStats,
  SettingsSummary,
} from "../../lib/api";

export type ExportViewModel = {
  loading: boolean;
  error: string | null;
  notice: string | null;
  queue: ExportQueue | null;
  summary: ExportSummaryStats | null;
  history: ExportRecord[];
  settings: SettingsSummary | null;
  selectedIds: Set<number>;
  focusId: number | null;
  outputNames: Record<number, string>;
  preview: ExportPreview | null;
  previewLoading: boolean;
  generating: boolean;
  savingOutputDir: boolean;
  outputDirDraft: string;
  openDirAfter: boolean;
  items: ExportQueueItem[];
  selectedItems: ExportQueueItem[];
  exportableItems: ExportQueueItem[];
  activePreset: ExportPreset | null;
  selectedSize: number;
  toggleSelected: (id: number) => void;
  focusItem: (id: number) => void;
  selectReady: () => void;
  removeSelected: () => void;
  clearSelected: () => void;
  renameOutput: (id: number, value: string) => void;
  setOutputDirDraft: (value: string) => void;
  setOpenDirAfter: (value: boolean) => void;
  saveOutputDir: () => Promise<void>;
  changePreset: (presetId: string) => Promise<void>;
  saveNewPreset: () => Promise<void>;
  generateSelected: () => Promise<void>;
  refreshPreview: () => Promise<void>;
};

export function useExportState(initialWorkId?: number): ExportViewModel {
  const [queue, setQueue] = useState<ExportQueue | null>(null);
  const [summary, setSummary] = useState<ExportSummaryStats | null>(null);
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [settings, setSettings] = useState<SettingsSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(initialWorkId ? [initialWorkId] : [])
  );
  const [focusId, setFocusId] = useState<number | null>(initialWorkId ?? null);
  const [outputNames, setOutputNames] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingOutputDir, setSavingOutputDir] = useState(false);
  const [outputDirDraft, setOutputDirDraft] = useState("");
  const [openDirAfter, setOpenDirAfter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = useMemo(() => queue?.result ?? [], [queue]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.work.id)),
    [items, selectedIds]
  );
  const exportableItems = useMemo(
    () => selectedItems.filter((item) => item.blockers.length === 0),
    [selectedItems]
  );
  const selectedSize = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.source_file.size_bytes, 0),
    [selectedItems]
  );
  const activePreset = useMemo(() => {
    if (!settings?.export.presets.length) return null;
    return (
      settings.export.presets.find((p) => p.id === settings.export.active_preset_id) ??
      settings.export.presets[0]
    );
  }, [settings]);

  const load = useCallback(async (nextFocusId: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const [queuePayload, summaryPayload, historyPayload, settingsPayload] = await Promise.all([
        api.exportQueue(),
        api.exportSummary(),
        api.exportHistory(),
        api.settings(),
      ]);
      setQueue(queuePayload);
      setSummary(summaryPayload);
      setHistory(historyPayload.result);
      setSettings(settingsPayload);
      setOutputDirDraft(summaryPayload.output_dir);
      setOutputNames((current) => {
        const next: Record<number, string> = {};
        for (const item of queuePayload.result) {
          next[item.work.id] = current[item.work.id] ?? item.output_name;
        }
        return next;
      });

      const ready = queuePayload.result.filter((item) => item.blockers.length === 0);
      const fallback = ready[0] ?? queuePayload.result[0];
      const existing = new Set(queuePayload.result.map((item) => item.work.id));

      setSelectedIds((current) => {
        if (nextFocusId && existing.has(nextFocusId)) return new Set([nextFocusId]);
        const kept = new Set([...current].filter((id) => existing.has(id)));
        if (kept.size) return kept;
        return new Set(ready.length ? ready.map((i) => i.work.id) : fallback ? [fallback.work.id] : []);
      });
      setFocusId((current) => {
        if (nextFocusId && existing.has(nextFocusId)) return nextFocusId;
        if (current && existing.has(current)) return current;
        return fallback?.work.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(initialWorkId ?? null);
  }, [initialWorkId, load]);

  useEffect(() => {
    if (!focusId) {
      setPreview(null);
      return;
    }
    let alive = true;
    setPreviewLoading(true);
    api
      .exportPreview(focusId, { output_name: outputNames[focusId] })
      .then((payload) => alive && setPreview(payload))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setPreviewLoading(false));
    return () => {
      alive = false;
    };
  }, [focusId, outputNames]);

  const refreshPreview = useCallback(async () => {
    if (!focusId) return;
    setPreviewLoading(true);
    setError(null);
    try {
      setPreview(await api.exportPreview(focusId, { output_name: outputNames[focusId] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  }, [focusId, outputNames]);

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const focusItem = useCallback((id: number) => setFocusId(id), []);

  const selectReady = useCallback(() => {
    setSelectedIds(new Set(items.filter((item) => item.blockers.length === 0).map((i) => i.work.id)));
  }, [items]);

  const removeSelected = useCallback(() => {
    setSelectedIds((current) => {
      if (!focusId) return new Set();
      const next = new Set(current);
      next.delete(focusId);
      return next;
    });
  }, [focusId]);

  const clearSelected = useCallback(() => setSelectedIds(new Set()), []);

  const renameOutput = useCallback((id: number, value: string) => {
    setOutputNames((current) => ({ ...current, [id]: value }));
  }, []);

  const generateSelected = useCallback(async () => {
    const targets = items
      .filter((item) => selectedIds.has(item.work.id) && item.blockers.length === 0);
    if (targets.length === 0) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.exportBatch(
        targets.map((item) => ({
          work_id: item.work.id,
          output_name: outputNames[item.work.id] || item.output_name,
        }))
      );
      const failed = result.summary.failed ? `，${result.summary.failed} 项失败` : "";
      setNotice(`已导出 ${result.summary.generated} 项${failed}`);
      await load(focusId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [focusId, items, load, outputNames, selectedIds]);

  const saveOutputDir = useCallback(async () => {
    if (!outputDirDraft.trim()) return;
    setSavingOutputDir(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateSettings({ storage: { export_dir: outputDirDraft.trim() } });
      setNotice("输出目录已更新");
      await load(focusId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingOutputDir(false);
    }
  }, [focusId, load, outputDirDraft]);

  const changePreset = useCallback(
    async (presetId: string) => {
      if (!settings || presetId === settings.export.active_preset_id) return;
      const optimistic = {
        ...settings,
        export: { ...settings.export, active_preset_id: presetId },
      };
      setSettings(optimistic);
      setError(null);
      setNotice(null);
      try {
        const payload = await api.updateSettings({
          export: { active_preset_id: presetId, presets: settings.export.presets },
        });
        setSettings(payload);
        setNotice("导出预设已切换");
      } catch (err) {
        setSettings(settings);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [settings]
  );

  const saveNewPreset = useCallback(async () => {
    if (!settings || !activePreset) return;
    setError(null);
    setNotice(null);
    const nextIndex = settings.export.presets.length + 1;
    const nextPreset: ExportPreset = {
      ...activePreset,
      id: `custom-${Date.now()}`,
      name: `自定义预设 ${nextIndex}`,
    };
    try {
      const payload = await api.updateSettings({
        export: {
          active_preset_id: nextPreset.id,
          presets: [...settings.export.presets, nextPreset],
        },
      });
      setSettings(payload);
      setNotice(`已保存预设：${nextPreset.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [activePreset, settings]);

  return {
    loading,
    error,
    notice,
    queue,
    summary,
    history,
    settings,
    selectedIds,
    focusId,
    outputNames,
    preview,
    previewLoading,
    generating,
    savingOutputDir,
    outputDirDraft,
    openDirAfter,
    items,
    selectedItems,
    exportableItems,
    activePreset,
    selectedSize,
    toggleSelected,
    focusItem,
    selectReady,
    removeSelected,
    clearSelected,
    renameOutput,
    setOutputDirDraft,
    setOpenDirAfter,
    saveOutputDir,
    changePreset,
    saveNewPreset,
    generateSelected,
    refreshPreview,
  };
}
```

- [ ] **Step 2: 类型检查通过**

Run: `cd frontend && npm run build`
Expected: 零错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/useExportState.ts
git commit -m "feat(export): 抽出 useExportState（合并单一选择集）"
```

> 交互修复要点（对照 spec §4）：`toggleSelected` 只改选择集；`focusItem` 只改 `focusId`（预览详情聚焦）；`selectReady`/`removeSelected`/`clearSelected` 三者互不相同；`generateSelected` 仅对「已勾选且无 blocker」执行。

---

### Task 3: Hero + 指标卡（ExportSummary.tsx）

**Files:**
- Create: `frontend/src/components/export/ExportSummary.tsx`

**Interfaces:**
- Consumes: `ExportQueue`、`ExportSummaryStats`，`compactPath`（Task 1）。
- Produces: `function ExportSummary(props: ExportSummaryProps): JSX.Element`，其中

```ts
type ExportSummaryProps = {
  queue: ExportQueue;
  summary: ExportSummaryStats | null;
  selectedCount: number;
  exportableCount: number;
  presetCount: number;
  activePresetName: string;
};
```

- [ ] **Step 1: 创建文件（完整实现）**

```tsx
import { AlertTriangle, CheckSquare, FileArchive, FolderOpen, Layers } from "lucide-react";
import type { ReactNode } from "react";

import type { ExportQueue, ExportSummaryStats } from "../../lib/api";
import exportHeroSketch from "../../assets/export-hero-sketch.png";
import { compactPath } from "./exportHelpers";

type ExportSummaryProps = {
  queue: ExportQueue;
  summary: ExportSummaryStats | null;
  selectedCount: number;
  exportableCount: number;
  presetCount: number;
  activePresetName: string;
};

export function ExportSummary({
  queue,
  summary,
  selectedCount,
  exportableCount,
  presetCount,
  activePresetName,
}: ExportSummaryProps) {
  return (
    <>
      <header className="export-hero">
        <div className="export-hero-head">
          <h1>导出中心</h1>
          <p>批量导出你的作品为 CBZ 格式，或按预设规则打包与整理。</p>
        </div>
        <div className="export-hero-note" aria-hidden="true">
          <img className="export-hero-sketch" src={exportHeroSketch} alt="" />
          <p>在纸与墨的世界里，归档收藏的是秩序、心意与时光。</p>
          <span>— NH Archive</span>
        </div>
      </header>

      <section className="export-summary">
        <Metric icon={<FileArchive size={20} />} label="导出记录" value={summary?.generated ?? 0} caption="查看历史记录" />
        <Metric icon={<Layers size={20} />} label="导出预设" value={presetCount} caption={activePresetName} />
        <Metric icon={<CheckSquare size={20} />} label="批量导出" value={selectedCount} caption={`${exportableCount} 项可处理`} tone="green" />
        <Metric icon={<AlertTriangle size={20} />} label="失败重试" value={queue.summary.blocked} caption="需修复阻塞项" tone="warn" />
        <Metric
          icon={<FolderOpen size={20} />}
          label="输出目录"
          text={summary?.output_dir ? compactPath(summary.output_dir) : "-"}
          title={summary?.output_dir}
          caption={`可用 ${summary?.available ?? 0} 个文件`}
        />
      </section>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  text,
  title,
  caption,
  tone = "",
}: {
  icon: ReactNode;
  label: string;
  value?: number;
  text?: string;
  title?: string;
  caption: string;
  tone?: string;
}) {
  return (
    <div className={`export-metric ${tone}`}>
      <span className="export-metric-icon">{icon}</span>
      <div className="export-metric-body">
        <strong title={title ?? text}>{text ?? value}</strong>
        <small>{label}</small>
        <em>{caption}</em>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误。
- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/ExportSummary.tsx
git commit -m "feat(export): ExportSummary（hero + 指标卡）"
```

---

### Task 4: 待导出列表（ExportQueueTable.tsx）

**Files:**
- Create: `frontend/src/components/export/ExportQueueTable.tsx`

**Interfaces:**
- Consumes: `ExportQueueItem`、`ExportPreset`；`Cover`、`presetSummaryLines`（Task 1）；`formatBytes`、`workTitle`；`Stagger`、`StaggerItem`。
- Produces: `function ExportQueueTable(props: ExportQueueTableProps): JSX.Element`，其中

```ts
type ExportQueueTableProps = {
  items: ExportQueueItem[];
  selectedIds: Set<number>;
  focusId: number | null;
  outputNames: Record<number, string>;
  activePreset: ExportPreset | null;
  blurCovers: boolean;
  selectedCount: number;
  selectedSize: number;
  onToggle: (id: number) => void;
  onFocus: (id: number) => void;
  onRename: (id: number, value: string) => void;
  onSelectReady: () => void;
  onRemoveSelected: () => void;
  onClear: () => void;
};
```

- [ ] **Step 1: 创建文件（完整实现）**

```tsx
import { CheckSquare, Plus, Square, Trash2, XCircle } from "lucide-react";

import type { ExportPreset, ExportQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { formatBytes, workTitle } from "../library/libraryHelpers";
import { Cover, presetSummaryLines } from "./exportHelpers";

type ExportQueueTableProps = {
  items: ExportQueueItem[];
  selectedIds: Set<number>;
  focusId: number | null;
  outputNames: Record<number, string>;
  activePreset: ExportPreset | null;
  blurCovers: boolean;
  selectedCount: number;
  selectedSize: number;
  onToggle: (id: number) => void;
  onFocus: (id: number) => void;
  onRename: (id: number, value: string) => void;
  onSelectReady: () => void;
  onRemoveSelected: () => void;
  onClear: () => void;
};

const STAGGER_CAP = 12;

export function ExportQueueTable({
  items,
  selectedIds,
  focusId,
  outputNames,
  activePreset,
  blurCovers,
  selectedCount,
  selectedSize,
  onToggle,
  onFocus,
  onRename,
  onSelectReady,
  onRemoveSelected,
  onClear,
}: ExportQueueTableProps) {
  const preset = presetSummaryLines(activePreset);
  const rows = items.map((item) => (
    <Row
      key={item.work.id}
      item={item}
      selected={selectedIds.has(item.work.id)}
      focused={focusId === item.work.id}
      outputName={outputNames[item.work.id] ?? item.output_name}
      presetName={preset.name}
      presetRule={preset.rule}
      blurCovers={blurCovers}
      onToggle={onToggle}
      onFocus={onFocus}
      onRename={onRename}
    />
  ));

  return (
    <section className="export-panel export-queue-panel">
      <div className="export-panel-head">
        <div>
          <h2>
            待导出列表 <small>已选择 {selectedCount} 项</small>
          </h2>
          <p>输出名称可在导出前重命名，所有文件都会生成到当前输出目录。</p>
        </div>
        <div className="export-panel-actions">
          <button type="button" onClick={onSelectReady}>
            <Plus size={15} />
            全选就绪
          </button>
          <button type="button" onClick={onRemoveSelected} disabled={selectedCount === 0}>
            <Trash2 size={15} />
            移除选中
          </button>
          <button type="button" onClick={onClear} disabled={selectedCount === 0}>
            <XCircle size={15} />
            清空
          </button>
        </div>
      </div>

      <div className="export-table">
        <div className="export-table-head">
          <span />
          <span>作品</span>
          <span>输出名称（预览）</span>
          <span>状态</span>
          <span>警告</span>
          <span>使用预设</span>
        </div>
        {items.length > STAGGER_CAP ? (
          <div className="export-table-body">{rows}</div>
        ) : (
          <Stagger key={items.map((i) => i.work.id).join("-")} className="export-table-body">
            {items.map((item) => (
              <StaggerItem key={item.work.id}>
                <Row
                  item={item}
                  selected={selectedIds.has(item.work.id)}
                  focused={focusId === item.work.id}
                  outputName={outputNames[item.work.id] ?? item.output_name}
                  presetName={preset.name}
                  presetRule={preset.rule}
                  blurCovers={blurCovers}
                  onToggle={onToggle}
                  onFocus={onFocus}
                  onRename={onRename}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
        <div className="export-table-foot">
          <span>
            已选择 {selectedCount} 项 · 预计大小 {formatBytes(selectedSize)}
          </span>
          <span>总计 {items.length} 项</span>
        </div>
      </div>
    </section>
  );
}

function Row({
  item,
  selected,
  focused,
  outputName,
  presetName,
  presetRule,
  blurCovers,
  onToggle,
  onFocus,
  onRename,
}: {
  item: ExportQueueItem;
  selected: boolean;
  focused: boolean;
  outputName: string;
  presetName: string;
  presetRule: string;
  blurCovers: boolean;
  onToggle: (id: number) => void;
  onFocus: (id: number) => void;
  onRename: (id: number, value: string) => void;
}) {
  const issues = [...item.blockers, ...item.warnings];
  const blocked = item.blockers.length > 0;
  return (
    <div
      className={`export-row ${focused ? "focused" : ""} ${selected ? "selected" : ""}`}
      onClick={() => onFocus(item.work.id)}
    >
      <button
        type="button"
        className="export-check"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(item.work.id);
        }}
        aria-label={selected ? "取消选择" : "选择作品"}
      >
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>
      <span className="export-work-cell">
        <Cover workId={item.work.id} coverPath={item.work.cover_path} blurCovers={blurCovers} />
        <span>
          <strong>{workTitle(item.work)}</strong>
          <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
        </span>
      </span>
      <label className="export-name-field" onClick={(event) => event.stopPropagation()}>
        <span>输出名称</span>
        <input
          className="export-name-input"
          value={outputName}
          onChange={(event) => onRename(item.work.id, event.target.value)}
          aria-label="输出名称"
        />
      </label>
      <span className={blocked ? "export-state blocked" : "export-state ready"}>
        {blocked ? "阻塞" : "就绪"}
      </span>
      <span className="export-warning-cell">
        {issues.length === 0 ? (
          <em className="export-warning-empty">无</em>
        ) : (
          <>
            {issues.slice(0, 2).map((issue) => (
              <span key={`${issue.code}-${issue.message}`} className="export-warning-item">
                {issue.message}
              </span>
            ))}
            {issues.length > 2 ? <span className="export-warning-more">+{issues.length - 2}</span> : null}
          </>
        )}
      </span>
      <span className="export-preset-cell">
        <strong>{presetName}</strong>
        <small>{presetRule}</small>
      </span>
    </div>
  );
}
```

> 注：`Row` 在「Stagger 版」与「降级版」复用同一组件（DRY）。`STAGGER_CAP=12` 时降级为无逐项动画，避免长列表迟钝（不改共享 motion 原语）。第一段 `rows` 变量用于降级分支。

- [ ] **Step 2: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误。
- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/ExportQueueTable.tsx
git commit -m "feat(export): ExportQueueTable（警告堆叠 + 单选择集）"
```

---

### Task 5: 导出预设条（ExportPresetBar.tsx）

**Files:**
- Create: `frontend/src/components/export/ExportPresetBar.tsx`

**Interfaces:**
- Consumes: `SettingsSummary`、`ExportPreset`；`compactPath`（Task 1）。
- Produces: `function ExportPresetBar(props: ExportPresetBarProps): JSX.Element`，其中

```ts
type ExportPresetBarProps = {
  settings: SettingsSummary | null;
  activePreset: ExportPreset | null;
  outputDir?: string;
  outputDirDraft: string;
  savingOutputDir: boolean;
  openDirAfter: boolean;
  selectedCount: number;
  exportableCount: number;
  generating: boolean;
  onPresetChange: (presetId: string) => void;
  onSavePreset: () => void;
  onOutputDirChange: (value: string) => void;
  onSaveOutputDir: () => void;
  onToggleOpenDir: (value: boolean) => void;
  onGenerate: () => void;
};
```

- [ ] **Step 1: 创建文件（完整实现）**

```tsx
import { Download } from "lucide-react";
import { useState } from "react";

import type { ExportPreset, SettingsSummary } from "../../lib/api";
import { compactPath } from "./exportHelpers";

type ExportPresetBarProps = {
  settings: SettingsSummary | null;
  activePreset: ExportPreset | null;
  outputDir?: string;
  outputDirDraft: string;
  savingOutputDir: boolean;
  openDirAfter: boolean;
  selectedCount: number;
  exportableCount: number;
  generating: boolean;
  onPresetChange: (presetId: string) => void;
  onSavePreset: () => void;
  onOutputDirChange: (value: string) => void;
  onSaveOutputDir: () => void;
  onToggleOpenDir: (value: boolean) => void;
  onGenerate: () => void;
};

export function ExportPresetBar({
  settings,
  activePreset,
  outputDir,
  outputDirDraft,
  savingOutputDir,
  openDirAfter,
  selectedCount,
  exportableCount,
  generating,
  onPresetChange,
  onSavePreset,
  onOutputDirChange,
  onSaveOutputDir,
  onToggleOpenDir,
  onGenerate,
}: ExportPresetBarProps) {
  const [editingDir, setEditingDir] = useState(false);
  return (
    <section className="export-panel export-preset-panel">
      <div className="export-panel-head compact">
        <div>
          <h2>
            导出预设 <small>当前：{activePreset?.name ?? "-"}</small>
          </h2>
        </div>
        <select
          className="export-preset-select"
          value={settings?.export.active_preset_id ?? ""}
          onChange={(event) => onPresetChange(event.target.value)}
          disabled={!settings?.export.presets.length}
          aria-label="选择导出预设"
        >
          {settings?.export.presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="export-preset-grid">
        <PresetFact label="命名规则" value={activePreset?.naming_rule ?? "-"} />
        <PresetFact label="ComicInfo 写入规则" value={activePreset?.comicinfo_rule ?? "-"} />
        <PresetFact label="meta.json 保留规则" value={activePreset?.meta_rule ?? "-"} />
        <PresetFact label="压缩方式" value={activePreset?.compression ?? "-"} />
        <div className={`export-dir-editor ${editingDir ? "editing" : ""}`}>
          <span>输出目录</span>
          {editingDir ? (
            <label>
              <input
                value={outputDirDraft}
                onChange={(event) => onOutputDirChange(event.target.value)}
                aria-label="输出目录"
              />
              <button
                type="button"
                onClick={() => {
                  onSaveOutputDir();
                  setEditingDir(false);
                }}
                disabled={savingOutputDir || !outputDirDraft.trim() || outputDirDraft === outputDir}
              >
                {savingOutputDir ? "保存中" : "保存"}
              </button>
            </label>
          ) : (
            <label>
              <strong title={outputDir}>{compactPath(outputDir ?? "-")}</strong>
              <button type="button" onClick={() => setEditingDir(true)}>
                更改
              </button>
            </label>
          )}
        </div>
      </div>

      <div className="export-preset-bottom">
        <label className="export-openafter">
          <input
            type="checkbox"
            checked={openDirAfter}
            onChange={(event) => onToggleOpenDir(event.target.checked)}
          />
          导出完成后打开输出目录
        </label>
        <div className="export-preset-buttons">
          <button type="button" className="export-secondary-action" onClick={onSavePreset} disabled={!activePreset}>
            保存为新预设
          </button>
          <button
            type="button"
            className="export-generate"
            disabled={generating || exportableCount === 0 || selectedCount === 0}
            onClick={onGenerate}
          >
            <Download size={17} />
            {generating ? "正在导出..." : "开始导出"}
          </button>
        </div>
      </div>
    </section>
  );
}

function PresetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="export-preset-fact">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}
```

> `导出完成后打开输出目录` 为仅本地 UI 状态（spec §5），不持久化、不触发后端行为。

- [ ] **Step 2: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误。
- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/ExportPresetBar.tsx
git commit -m "feat(export): ExportPresetBar（事实条 + 本地 openDir 复选）"
```

---

### Task 6: 导出预览（ExportPreviewPanel.tsx）

**Files:**
- Create: `frontend/src/components/export/ExportPreviewPanel.tsx`

**Interfaces:**
- Consumes: `ExportQueueItem`、`ExportPreview`；`Cover`（Task 1）；`formatBytes`、`workTitle`；`FadeIn`。
- Produces: `function ExportPreviewPanel(props: ExportPreviewPanelProps): JSX.Element`，其中

```ts
type ExportPreviewPanelProps = {
  selectedItems: ExportQueueItem[];
  selectedSize: number;
  preview: ExportPreview | null;
  loading: boolean;
  generating: boolean;
  blurCovers: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
};
```

- [ ] **Step 1: 创建文件（完整实现）**

```tsx
import { CheckCircle2, Download, FileText, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import type { ExportPreview, ExportQueueItem } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { formatBytes, workTitle } from "../library/libraryHelpers";
import { Cover } from "./exportHelpers";

type ExportPreviewPanelProps = {
  selectedItems: ExportQueueItem[];
  selectedSize: number;
  preview: ExportPreview | null;
  loading: boolean;
  generating: boolean;
  blurCovers: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
};

export function ExportPreviewPanel({
  selectedItems,
  selectedSize,
  preview,
  loading,
  generating,
  blurCovers,
  onGenerate,
  onRefresh,
}: ExportPreviewPanelProps) {
  const keepsMeta = preview?.will_keep.includes("meta.json") ?? false;
  const signature = selectedItems.map((item) => item.work.id).join("-");
  return (
    <aside className="export-panel export-preview-panel">
      <div className="export-panel-head">
        <div>
          <h2>导出预览</h2>
          <p>已选择 {selectedItems.length} 项作品。</p>
        </div>
        <button type="button" className="export-icon-action" onClick={onRefresh} aria-label="刷新导出预览">
          <RefreshCw size={16} />
        </button>
      </div>

      {selectedItems.length ? (
        <FadeIn key={`list-${signature}`} y={6} className="export-selected-list">
          {selectedItems.slice(0, 4).map((selected) => (
            <div key={selected.work.id}>
              <Cover workId={selected.work.id} coverPath={selected.work.cover_path} blurCovers={blurCovers} />
              <span>
                <strong>{workTitle(selected.work)}</strong>
                <small>{formatBytes(selected.source_file.size_bytes)}</small>
              </span>
            </div>
          ))}
          {selectedItems.length > 4 ? (
            <p className="export-selected-more">+{selectedItems.length - 4} 项</p>
          ) : null}
        </FadeIn>
      ) : (
        <p className="empty-inline">还没有选择待导出的作品。</p>
      )}

      <div className="export-will-write">
        <h3>将生成的新文件</h3>
        <div className="export-rule-grid">
          <RuleCard title="将生成新 CBZ" caption="不会覆盖原文件" ok />
          <RuleCard title="将写入 ComicInfo.xml" caption="补充与修正元数据" ok />
          <RuleCard
            title={keepsMeta ? "默认保留 meta.json" : "未检测到 meta.json"}
            caption={keepsMeta ? "不覆盖原 meta.json" : "源文件中无 meta.json"}
            ok={keepsMeta}
          />
          <RuleCard title="不会修改原始 CBZ" caption="原文件保持不变" ok />
        </div>
      </div>

      {loading ? <p className="empty-inline">正在读取 preview...</p> : null}

      {!loading && preview ? (
        <FadeIn key={`detail-${preview.work.id}`} y={8} className="export-preview-content">
          <details className="export-path-details">
            <summary>路径明细</summary>
            <dl className="export-preview-facts">
              <div>
                <dt>输出文件</dt>
                <dd>{preview.output_name}</dd>
              </div>
              <div>
                <dt>输出路径</dt>
                <dd>{preview.output_path}</dd>
              </div>
              <div>
                <dt>源文件</dt>
                <dd>{preview.source_file.path || "缺少源文件"}</dd>
              </div>
              <div>
                <dt>批量大小</dt>
                <dd>{formatBytes(selectedSize)}</dd>
              </div>
            </dl>
          </details>

          <details className="export-comicinfo">
            <summary>
              <FileText size={16} /> ComicInfo.xml
            </summary>
            <div className="export-comicinfo-fields">
              {Object.entries(preview.comic_info).map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </details>

          {preview.blockers.length || preview.warnings.length ? (
            <div className="export-issues">
              {[...preview.blockers, ...preview.warnings].map((issue) => (
                <p key={`${issue.code}-${issue.message}`} className={preview.blockers.includes(issue) ? "blocked" : ""}>
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </FadeIn>
      ) : null}

      <button
        type="button"
        className="export-generate"
        disabled={generating || selectedItems.length === 0}
        onClick={onGenerate}
      >
        <Download size={17} />
        {generating ? "正在导出..." : "开始导出"}
      </button>
    </aside>
  );
}

function RuleCard({ title, caption, ok }: { title: string; caption: string; ok: boolean }): ReactNode {
  return (
    <div className={`export-rule-card ${ok ? "ok" : "muted"}`}>
      <CheckCircle2 size={16} />
      <div>
        <strong>{title}</strong>
        <small>{caption}</small>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误。
- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/ExportPreviewPanel.tsx
git commit -m "feat(export): ExportPreviewPanel（2×2 规则网格，真实数据驱动）"
```

---

### Task 7: 最近导出记录（ExportHistory.tsx）

**Files:**
- Create: `frontend/src/components/export/ExportHistory.tsx`

**Interfaces:**
- Consumes: `ExportRecord`；`Cover`（Task 1）；`formatBytes`。
- Produces: `function ExportHistory(props: { records: ExportRecord[]; blurCovers: boolean }): JSX.Element`

- [ ] **Step 1: 创建文件（完整实现）**

```tsx
import { ChevronRight } from "lucide-react";

import type { ExportRecord } from "../../lib/api";
import { formatBytes } from "../library/libraryHelpers";
import { Cover } from "./exportHelpers";

export function ExportHistory({ records, blurCovers }: { records: ExportRecord[]; blurCovers: boolean }) {
  return (
    <section className="export-panel export-history-panel">
      <div className="export-panel-head">
        <div>
          <h2>最近导出记录</h2>
          <p>真实生成过的新 CBZ 文件，缺失文件会保留记录并标记。</p>
        </div>
        <button type="button" className="export-link-action">
          查看全部记录 <ChevronRight size={15} />
        </button>
      </div>
      {records.length === 0 ? (
        <p className="empty-inline">尚无导出记录。</p>
      ) : (
        <div className="export-history-grid">
          {records.slice(0, 4).map((record) => (
            <article key={record.id} className="export-history-card">
              <Cover workId={record.work_id} coverPath={record.work.cover_path} blurCovers={blurCovers} />
              <div>
                <strong>{record.output_name}</strong>
                <small>
                  {formatBytes(record.size_bytes)} · {record.created_at}
                </small>
                <span className={record.exists ? "export-state ready" : "export-state blocked"}>
                  {record.exists ? "导出完成" : "部分失败"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误。
- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/export/ExportHistory.tsx
git commit -m "feat(export): ExportHistory（最近导出记录卡片）"
```

---

### Task 8: 容器整合（改写 ExportPage.tsx）

把 `ExportPage.tsx` 改写为「调 hook + 组合组件」，删除全部旧内联子组件。这是把新文件接线、并真正替换旧页面的集成任务。

**Files:**
- Modify (整文件改写): `frontend/src/components/export/ExportPage.tsx`

**Interfaces:**
- Consumes: `useExportState`（Task 2）及全部组件（Task 3–7）。
- Produces: `export function ExportPage(props: { initialWorkId?: number; blurCovers: boolean }): JSX.Element`（签名不变，`App.tsx` 无需改）。

- [ ] **Step 1: 整文件替换为以下内容**

```tsx
import { Download } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { ExportHistory } from "./ExportHistory";
import { ExportPresetBar } from "./ExportPresetBar";
import { ExportPreviewPanel } from "./ExportPreviewPanel";
import { ExportQueueTable } from "./ExportQueueTable";
import { ExportSummary } from "./ExportSummary";
import { useExportState } from "./useExportState";

type Props = {
  initialWorkId?: number;
  blurCovers: boolean;
};

export function ExportPage({ initialWorkId, blurCovers }: Props) {
  const vm = useExportState(initialWorkId);
  const activePresetName = vm.activePreset?.name ?? "-";

  return (
    <section className="page export-page">
      {vm.summary || vm.queue ? (
        <ExportSummary
          queue={vm.queue ?? { result: [], summary: { total: 0, ready: 0, blocked: 0, warnings: 0 } }}
          summary={vm.summary}
          selectedCount={vm.selectedIds.size}
          exportableCount={vm.exportableItems.length}
          presetCount={vm.settings?.export.presets.length ?? 0}
          activePresetName={activePresetName}
        />
      ) : null}

      {vm.error ? (
        <FadeIn key={vm.error} className="notice error" y={6}>
          {vm.error}
        </FadeIn>
      ) : null}
      {vm.notice ? (
        <FadeIn key={vm.notice} className="notice success" y={6}>
          {vm.notice}
        </FadeIn>
      ) : null}

      {vm.loading ? <div className="page-panel">正在读取导出队列...</div> : null}

      {!vm.loading && vm.queue ? (
        vm.queue.result.length === 0 ? (
          <div className="page-panel boundary-panel">
            <strong>暂无可导出作品</strong>
            <p>导入真实 CBZ 后，导出队列会显示源文件、阻塞项和 ComicInfo preview。</p>
          </div>
        ) : (
          <>
            <div className="export-mobile-dock">
              <div>
                <strong>{vm.selectedIds.size} 项已选</strong>
                <span>
                  {vm.exportableItems.length} 项可导出 · {activePresetName}
                </span>
              </div>
              <button
                type="button"
                disabled={vm.generating || vm.exportableItems.length === 0 || vm.selectedIds.size === 0}
                onClick={vm.generateSelected}
              >
                <Download size={16} />
                {vm.generating ? "导出中" : "开始导出"}
              </button>
            </div>

            <div className="export-workspace">
              <div className="export-left-stack">
                <ExportQueueTable
                  items={vm.items}
                  selectedIds={vm.selectedIds}
                  focusId={vm.focusId}
                  outputNames={vm.outputNames}
                  activePreset={vm.activePreset}
                  blurCovers={blurCovers}
                  selectedCount={vm.selectedIds.size}
                  selectedSize={vm.selectedSize}
                  onToggle={vm.toggleSelected}
                  onFocus={vm.focusItem}
                  onRename={vm.renameOutput}
                  onSelectReady={vm.selectReady}
                  onRemoveSelected={vm.removeSelected}
                  onClear={vm.clearSelected}
                />
                <ExportPresetBar
                  settings={vm.settings}
                  activePreset={vm.activePreset}
                  outputDir={vm.summary?.output_dir}
                  outputDirDraft={vm.outputDirDraft}
                  savingOutputDir={vm.savingOutputDir}
                  openDirAfter={vm.openDirAfter}
                  selectedCount={vm.selectedIds.size}
                  exportableCount={vm.exportableItems.length}
                  generating={vm.generating}
                  onPresetChange={vm.changePreset}
                  onSavePreset={vm.saveNewPreset}
                  onOutputDirChange={vm.setOutputDirDraft}
                  onSaveOutputDir={vm.saveOutputDir}
                  onToggleOpenDir={vm.setOpenDirAfter}
                  onGenerate={vm.generateSelected}
                />
              </div>
              <ExportPreviewPanel
                selectedItems={vm.selectedItems}
                selectedSize={vm.selectedSize}
                preview={vm.preview}
                loading={vm.previewLoading}
                generating={vm.generating}
                blurCovers={blurCovers}
                onGenerate={vm.generateSelected}
                onRefresh={vm.refreshPreview}
              />
            </div>

            <ExportHistory records={vm.history} blurCovers={blurCovers} />
          </>
        )
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误，无未用导入。
- [ ] **Step 3: 启动并视觉核对**

Run: 后端 `PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001`，前端 `cd frontend && npm run dev`，浏览导出页。
Expected: 五个区块都渲染；勾选驱动「批量导出」计数与预览「已选择 N 项」；点击行只切换预览聚焦详情、不改勾选；`全选就绪 / 移除选中 / 清空` 三者行为不同；重命名生效；切换预设生效；空库显示边界面板。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/export/ExportPage.tsx
git commit -m "refactor(export): ExportPage 改为组合式容器，移除内联子组件"
```

---

### Task 9: 样式重写（app.css 中 .export-* 段）

按 `导出中心.png` 重写 `.export-*` 段，落实间距/密度/层次/配色与新结构（`.export-metric-icon/-body`、`.export-warning-item/-more`、`.export-preset-cell`、`.export-rule-grid/.export-rule-card`、`.export-will-write`、`.export-openafter`、`.export-preset-buttons`、`.export-hero-head`、hero `span` 署名、`.export-row.focused`）。

**Files:**
- Modify: `frontend/src/styles/app.css`（替换 `.export-page {` 起至 `.export-history` 相关段的整块）

**复用既有设计 token（已核对 `frontend/src/styles/app.css` `:root`，直接使用真实变量名）：**
`--paper`（暖纸背景）、`--surface`/`--surface-solid`（卡面）、`--ink`（黑墨标题）、`--muted`（次要文字）、
`--line`/`--line-strong`（描边）、`--accent`/`--accent-dark`（terracotta 主操作）、`--green`（成功）、`--warn`（琥珀警告）、`--shadow`。
无 `--ink-faint`/`--serif`：更淡文字用 `color-mix(in srgb, var(--muted) 65%, var(--paper))`；题词衬线用字面字体栈 `Georgia, "Songti SC", serif`。

- [ ] **Step 1: 定位旧段** — Run: `grep -n "\.export-" frontend/src/styles/app.css | head -1` 与 `grep -n "export-history" frontend/src/styles/app.css | tail -1`，确定替换范围（约 4692 行起）。

- [ ] **Step 2: 重写该段**（关键新增/调整规则，配合 Task 3–8 的类名；保留 `.export-cover`、`.export-state`、`.export-name-input` 等仍被引用的既有规则）：

```css
/* ── Hero ─────────────────────────────── */
.export-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
.export-hero-head h1 { font-size: 30px; letter-spacing: 1px; color: var(--ink); }
.export-hero-head p { margin-top: 6px; color: var(--muted); font-size: 14px; }
.export-hero-note { position: relative; max-width: 360px; text-align: right; }
.export-hero-sketch { position: absolute; inset: -10px 0 auto auto; width: 280px; opacity: 0.14; pointer-events: none; }
.export-hero-note p { position: relative; font-family: Georgia, "Songti SC", serif; font-style: italic; color: var(--muted); font-size: 13px; line-height: 1.7; }
.export-hero-note span { position: relative; display: block; margin-top: 6px; font-size: 12px; color: color-mix(in srgb, var(--muted) 65%, var(--paper)); }

/* ── 指标卡 ───────────────────────────── */
.export-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-top: 20px; }
.export-metric { display: flex; gap: 12px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.export-metric-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); flex: none; }
.export-metric.green .export-metric-icon { background: color-mix(in srgb, var(--green) 14%, transparent); color: var(--green); }
.export-metric.warn .export-metric-icon { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }
.export-metric-body { display: flex; flex-direction: column; min-width: 0; }
.export-metric-body strong { font-size: 22px; line-height: 1.1; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.export-metric.warn .export-metric-body strong { color: var(--warn); }
.export-metric-body small { font-size: 12px; color: var(--muted); margin-top: 2px; }
.export-metric-body em { font-size: 11px; color: color-mix(in srgb, var(--muted) 65%, var(--paper)); font-style: normal; margin-top: 2px; }

/* ── 工作区两栏 ───────────────────────── */
.export-workspace { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 18px; margin-top: 18px; align-items: start; }
.export-left-stack { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

/* ── 表格 ─────────────────────────────── */
.export-table-head, .export-row { display: grid; grid-template-columns: 32px minmax(0, 2.2fr) minmax(0, 1.6fr) 64px minmax(0, 1.6fr) minmax(0, 1.2fr); gap: 12px; align-items: center; }
.export-warning-cell { display: flex; flex-direction: column; gap: 2px; }
.export-warning-item { font-size: 12px; color: var(--warn); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.export-warning-more { font-size: 11px; color: color-mix(in srgb, var(--muted) 65%, var(--paper)); }
.export-warning-empty { color: color-mix(in srgb, var(--muted) 65%, var(--paper)); font-style: normal; }
.export-preset-cell { display: flex; flex-direction: column; }
.export-preset-cell strong { font-size: 13px; color: var(--ink); }
.export-preset-cell small { font-size: 11px; color: var(--muted); }
.export-row.focused { background: color-mix(in srgb, var(--accent) 6%, transparent); box-shadow: inset 3px 0 0 var(--accent); }

/* ── 预设条 ───────────────────────────── */
.export-preset-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.export-preset-fact span { display: block; font-size: 11px; color: color-mix(in srgb, var(--muted) 65%, var(--paper)); }
.export-preset-fact strong { display: block; font-size: 13px; color: var(--ink); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.export-preset-bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; }
.export-openafter { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.export-preset-buttons { display: flex; gap: 10px; }

/* ── 预览 ─────────────────────────────── */
.export-will-write h3 { font-size: 13px; color: var(--ink); margin: 14px 0 8px; }
.export-rule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.export-rule-card { display: flex; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; }
.export-rule-card.ok > svg { color: var(--green); flex: none; }
.export-rule-card.muted > svg { color: color-mix(in srgb, var(--muted) 65%, var(--paper)); flex: none; }
.export-rule-card strong { display: block; font-size: 12.5px; color: var(--ink); }
.export-rule-card small { display: block; font-size: 11px; color: var(--muted); margin-top: 2px; }
.export-selected-more { font-size: 12px; color: color-mix(in srgb, var(--muted) 65%, var(--paper)); }

/* ── 响应式 ───────────────────────────── */
@media (max-width: 1080px) {
  .export-summary, .export-preset-grid { grid-template-columns: repeat(2, 1fr); }
  .export-workspace { grid-template-columns: 1fr; }
}
```

> 注：以上为关键结构样式。实现时合并进既有 `.export-*` 段、保留仍被引用的旧规则（`.export-panel`、`.export-panel-head`、`.export-cover`、`.export-state`、`.export-name-field/-input`、`.export-table-foot`、`.export-history-grid/-card`、`.export-generate`、`.export-secondary-action`、`.export-link-action`、`.export-mobile-dock`、`.export-icon-action`、`.export-path-details`、`.export-comicinfo`、`.export-issues`），删除已无引用的旧规则（如旧 `.export-rules`、`.export-preset-name`、`.export-hero-note` 旧版）。CSS 变量已按 `:root` 实际定义校准（`--accent`/`--green`/`--warn`/`--muted` 等），无需新增变量。

- [ ] **Step 3: build 通过** — Run: `cd frontend && npm run build` — Expected: 零错误。

- [ ] **Step 4: 视觉核对（对照 design/导出中心.png）**

逐项检查：hero 草图为低对比水印 + 斜体题词署名；5 卡等宽、图标方块不过大、批量导出=绿/失败重试=琥珀；表格警告堆叠（≤2 + “+N”）、使用预设双行、focused 行 terracotta 左条；预设条事实 + openDir 复选 + 右对齐主按钮；预览 2×2 规则网格；历史卡片状态徽章；窄屏单栏。
Expected: 与参考图一致；与重建后的治理中心 (`GovernancePage`) 同等质量基线。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/styles/app.css
git commit -m "style(export): 按 导出中心.png 重写 .export-* 样式"
```

---

### Task 10: 回归 + 文档

**Files:**
- Modify: `docs/PROJECT_STATUS.md`、`docs/PROJECT_MAP.md`

- [ ] **Step 1: 后端回归门禁** — Run: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` — Expected: 全绿（后端未改）。
- [ ] **Step 2: 前端门禁** — Run: `cd frontend && npm run build` — Expected: 零错误。
- [ ] **Step 3: 更新文档**
  - `docs/PROJECT_MAP.md`：记录 `components/export/` 由单文件拆为 `ExportPage + useExportState + ExportSummary/QueueTable/PresetBar/PreviewPanel/History + exportHelpers`。
  - `docs/PROJECT_STATUS.md`：记录导出中心重构阶段完成（视觉还原 + 单一选择集交互修复 + 动效细节）。
- [ ] **Step 4: 提交**

```bash
git add docs/PROJECT_STATUS.md docs/PROJECT_MAP.md
git commit -m "docs: 记录导出中心重构（多文件 + 交互修复 + 视觉还原）"
```

---

## Self-Review

**Spec coverage（逐节核对）：**
- §3 架构/拆分 → Task 1–8（八文件全部建立/改写）。✓
- §4 交互模型（单一选择集、focusId、三操作、导出门槛）→ Task 2（hook）+ Task 4（表头三按钮）。✓
- §5 视觉还原各区块 → Task 3/4/5/6/7（结构）+ Task 9（样式）。✓
  - openDir 复选 = 本地态 → Task 5。✓
  - 2×2 规则网格真实数据驱动（will_keep）→ Task 6。✓
  - 警告堆叠、使用预设双行（无虚构 version）→ Task 4。✓
- §6 动效（FadeIn/Stagger、长列表降级、预览按选择签名交叉淡入、空/错/加载态）→ Task 4（STAGGER_CAP）+ Task 6（signature key）+ Task 8（loading/空状态/notice）。✓
- §7 测试（后端 pytest 回归、前端 build、视觉核对）→ Task 8/9/10。✓
- §8 YAGNI（不改后端、不新依赖、不无关重构）→ 全程仅前端 + app.css。✓
- §9 文档（PROJECT_STATUS/MAP）→ Task 10。✓

**Placeholder scan：** 无 TBD/TODO；每个代码步骤给出完整可运行代码；CSS 任务给出完整关键规则 + 明确保留/删除清单。✓

**Type consistency：** `ExportViewModel` 字段名在 Task 2 定义、Task 8 逐一消费一致；各组件 props 名称（`onSelectReady/onRemoveSelected/onClear`、`activePreset`、`focusId`、`selectedSize` 等）跨 Task 4/8 一致；helper 名（`Cover`/`compactPath`/`presetSummaryLines`）Task 1 定义、Task 3–7 引用一致。✓

> 备注：Task 9 CSS 变量名已对照 `app.css` `:root` 校准为真实变量（`--paper`/`--surface`/`--surface-solid`/`--ink`/`--muted`/`--line`/`--line-strong`/`--accent`/`--accent-dark`/`--green`/`--warn`/`--shadow`），更淡文字用 `color-mix(... var(--muted) ...)`，无占位符遗留。实现时仅需确认这些变量未被改名即可。
