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
