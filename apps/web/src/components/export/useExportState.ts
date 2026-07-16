import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, EXPORT_SYNC_THRESHOLD } from "../../lib/api";
import type {
  ExportOptions,
  ExportPreset,
  ExportPreview,
  ExportQueue,
  ExportQueueItem,
  ExportSummaryStats,
  SettingsSummary,
} from "../../lib/api";
import { workTitle } from "../../lib/format";
import { itemStatus } from "./exportHelpers";

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
  exportOptions: ExportOptions;
  items: ExportQueueItem[];
  selectedItems: ExportQueueItem[];
  exportableItems: ExportQueueItem[];
  activePreset: ExportPreset | null;
  selectedSize: number;
  query: string;
  statusFilter: "all" | "ready" | "warning" | "blocked";
  visibleItems: ExportQueueItem[];
  multiSelect: boolean;
  toggleMultiSelect: () => void;
  toggleSelected: (id: number) => void;
  focusItem: (id: number) => void;
  selectReady: () => void;
  removeSelected: () => void;
  clearSelected: () => void;
  renameOutput: (id: number, value: string) => void;
  setExportOption: (key: keyof ExportOptions, value: boolean) => void;
  downloadSelected: () => Promise<void>;
  downloadOne: (id: number) => Promise<void>;
  refreshPreview: () => Promise<void>;
  pickItem: (id: number) => void;
  setQuery: (query: string) => void;
  setStatusFilter: (filter: "all" | "ready" | "warning" | "blocked") => void;
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
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    write_comicinfo: true,
    keep_json: true,
    compress: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const defaultsApplied = useRef(false);
  const loadRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "warning" | "blocked">("all");
  const [multiSelect, setMultiSelect] = useState(false);

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

  const visibleItems = useMemo(() => {
    let filtered = items;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => itemStatus(item) === statusFilter);
    }

    // Filter by query (match workTitle or remote_gallery_id)
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter((item) => {
        const title = workTitle(item.work).toLowerCase();
        const id = item.work.remote_gallery_id?.toString() ?? "";
        return title.includes(lowerQuery) || id.includes(lowerQuery);
      });
    }

    return filtered;
  }, [items, statusFilter, query]);

  const load = useCallback(async (nextFocusId: number | null) => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const [queuePayload, summaryPayload, settingsPayload] = await Promise.all([
        api.exportQueue(),
        api.exportSummary(),
        api.settings(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      setQueue(queuePayload);
      setSummary(summaryPayload);
      setSettings(settingsPayload);
      // Seed export option switches from the saved defaults, once per session.
      if (!defaultsApplied.current && settingsPayload.export.default_options) {
        setExportOptions(settingsPayload.export.default_options);
        defaultsApplied.current = true;
      }
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

      // Single-focus is the default; the multi-select toggle builds a bundle set.
      // Keep any still-existing selection across reloads, but do not auto-select.
      setSelectedIds((current) => new Set([...current].filter((id) => existing.has(id))));
      setFocusId((current) => {
        if (nextFocusId && existing.has(nextFocusId)) return nextFocusId;
        if (current && existing.has(current)) return current;
        return fallback?.work.id ?? null;
      });
    } catch (err) {
      if (requestId === loadRequestRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(initialWorkId ?? null);
    return () => {
      loadRequestRef.current += 1;
      previewRequestRef.current += 1;
    };
  }, [initialWorkId, load]);

  useEffect(() => {
    if (!focusId) {
      previewRequestRef.current += 1;
      setPreview(null);
      return;
    }
    const requestId = ++previewRequestRef.current;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
      api
        .exportPreview(focusId, { output_name: outputNames[focusId], ...exportOptions })
        .then((payload) => requestId === previewRequestRef.current && setPreview(payload))
        .catch((err: Error) => requestId === previewRequestRef.current && setError(err.message))
        .finally(() => requestId === previewRequestRef.current && setPreviewLoading(false));
    }, 160);
    return () => {
      window.clearTimeout(timer);
      if (previewRequestRef.current === requestId) previewRequestRef.current += 1;
    };
  }, [focusId, outputNames[focusId ?? -1], exportOptions]);

  const refreshPreview = useCallback(async () => {
    if (!focusId) return;
    const requestId = ++previewRequestRef.current;
    setPreviewLoading(true);
    setError(null);
    try {
      const payload = await api.exportPreview(focusId, { output_name: outputNames[focusId], ...exportOptions });
      if (requestId === previewRequestRef.current) setPreview(payload);
    } catch (err) {
      if (requestId === previewRequestRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === previewRequestRef.current) setPreviewLoading(false);
    }
  }, [focusId, outputNames, exportOptions]);

  const setExportOption = useCallback((key: keyof ExportOptions, value: boolean) => {
    setExportOptions((current) => ({ ...current, [key]: value }));
  }, []);

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
        const filename = await api.downloadExport(id, {
          output_name: outputNames[id] || item.output_name,
          ...exportOptions,
        });
        setNotice(`已开始下载：${filename}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDownloading(false);
      }
    },
    [items, outputNames, exportOptions]
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
          ...exportOptions,
        });
        setNotice(`已开始下载：${filename}`);
      } else if (targets.length > EXPORT_SYNC_THRESHOLD) {
        const job = await api.enqueueBulkExport(
          targets.map((item) => ({
            work_id: item.work.id,
            output_name: outputNames[item.work.id] || item.output_name,
          })),
          exportOptions,
        );
        setNotice(`已加入任务中心（任务 #${job.id}），完成后可在任务页下载合集`);
      } else {
        const filename = await api.downloadExportBundle(
          targets.map((item) => ({
            work_id: item.work.id,
            output_name: outputNames[item.work.id] || item.output_name,
          })),
          exportOptions
        );
        setNotice(`已开始下载 ${targets.length} 项打包文件：${filename}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, [items, outputNames, selectedIds, exportOptions]);

  const toggleMultiSelect = useCallback(() => {
    setMultiSelect((on) => !on);
    setSelectedIds(new Set());
  }, []);

  const pickItem = useCallback(
    (id: number) => {
      const item = items.find((entry) => entry.work.id === id);
      if (!item) return;

      // Always focus the clicked item; only build a selection in multi-select mode.
      setFocusId(id);
      if (!multiSelect || item.blockers.length > 0) return;

      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [items, multiSelect],
  );

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
    exportOptions,
    items,
    selectedItems,
    exportableItems,
    activePreset,
    selectedSize,
    query,
    statusFilter,
    visibleItems,
    multiSelect,
    toggleMultiSelect,
    toggleSelected,
    focusItem,
    selectReady,
    removeSelected,
    clearSelected,
    renameOutput,
    setExportOption,
    downloadSelected,
    downloadOne,
    refreshPreview,
    pickItem,
    setQuery,
    setStatusFilter,
  };
}
