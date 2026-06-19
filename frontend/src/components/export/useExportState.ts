import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../lib/api";
import type {
  ExportPreset,
  ExportPreview,
  ExportQueue,
  ExportQueueItem,
  ExportSummaryStats,
  SettingsSummary,
} from "../../lib/api";

export type ExportViewModel = {
  loading: boolean;
  error: string | null;
  notice: string | null;
  queue: ExportQueue | null;
  summary: ExportSummaryStats | null;
  settings: SettingsSummary | null;
  selectedIds: Set<number>;
  focusId: number | null;
  outputNames: Record<number, string>;
  preview: ExportPreview | null;
  previewLoading: boolean;
  downloading: boolean;
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
  changePreset: (presetId: string) => Promise<void>;
  saveNewPreset: () => Promise<void>;
  downloadSelected: () => Promise<void>;
  downloadOne: (id: number) => Promise<void>;
  refreshPreview: () => Promise<void>;
};

export function useExportState(initialWorkId?: number): ExportViewModel {
  const [queue, setQueue] = useState<ExportQueue | null>(null);
  const [summary, setSummary] = useState<ExportSummaryStats | null>(null);
  const [settings, setSettings] = useState<SettingsSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(initialWorkId ? [initialWorkId] : [])
  );
  const [focusId, setFocusId] = useState<number | null>(initialWorkId ?? null);
  const [outputNames, setOutputNames] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
      const [queuePayload, summaryPayload, settingsPayload] = await Promise.all([
        api.exportQueue(),
        api.exportSummary(),
        api.settings(),
      ]);
      setQueue(queuePayload);
      setSummary(summaryPayload);
      setSettings(settingsPayload);
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
  }, [focusId, outputNames[focusId ?? -1]]);

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
      if (!focusId) return current;
      const next = new Set(current);
      next.delete(focusId);
      return next;
    });
  }, [focusId]);

  const clearSelected = useCallback(() => setSelectedIds(new Set()), []);

  const renameOutput = useCallback((id: number, value: string) => {
    setOutputNames((current) => ({ ...current, [id]: value }));
  }, []);

  const downloadOne = useCallback(
    async (id: number) => {
      const item = items.find((entry) => entry.work.id === id);
      if (!item || item.blockers.length > 0) return;
      setDownloading(true);
      setError(null);
      setNotice(null);
      try {
        const filename = await api.downloadExport(id, { output_name: outputNames[id] || item.output_name });
        setNotice(`已开始下载：${filename}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDownloading(false);
      }
    },
    [items, outputNames]
  );

  const downloadSelected = useCallback(async () => {
    const targets = items.filter((item) => selectedIds.has(item.work.id) && item.blockers.length === 0);
    if (targets.length === 0) return;
    setDownloading(true);
    setError(null);
    setNotice(null);
    try {
      if (targets.length === 1) {
        const only = targets[0];
        const filename = await api.downloadExport(only.work.id, {
          output_name: outputNames[only.work.id] || only.output_name,
        });
        setNotice(`已开始下载：${filename}`);
      } else {
        const filename = await api.downloadExportBundle(
          targets.map((item) => ({
            work_id: item.work.id,
            output_name: outputNames[item.work.id] || item.output_name,
          }))
        );
        setNotice(`已开始下载 ${targets.length} 项打包文件：${filename}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, [items, outputNames, selectedIds]);

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
    settings,
    selectedIds,
    focusId,
    outputNames,
    preview,
    previewLoading,
    downloading,
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
    changePreset,
    saveNewPreset,
    downloadSelected,
    downloadOne,
    refreshPreview,
  };
}
