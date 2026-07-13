import { useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  type FileDeletePreview,
  type FileDeleteTarget,
  type FileDuplicates,
  type FileEntry,
  type FileInventory,
  type FileOverview,
  type LibraryScanPreview,
} from "../../lib/api";
import { entryToTarget, formatBytes } from "./fileHelpers";

type FileOperation = "delete-preview" | "cleanup-preview" | "delete" | "scan-preview" | "scan-start";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useFilesState() {
  const [overview, setOverview] = useState<FileOverview | null>(null);
  const [duplicates, setDuplicates] = useState<FileDuplicates | null>(null);
  const [inventory, setInventory] = useState<FileInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategoryState] = useState("all");
  const [query, setQueryState] = useState("");
  const [statusFilter, setStatusFilterState] = useState("");
  const [sort, setSortState] = useState("default");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [pendingTargets, setPendingTargets] = useState<FileDeleteTarget[]>([]);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [scanPreview, setScanPreview] = useState<LibraryScanPreview | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [operation, setOperation] = useState<FileOperation | null>(null);
  const overviewToken = useRef(0);
  const requestToken = useRef(0);
  const operationToken = useRef(0);
  const operationRef = useRef<FileOperation | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const inventoryParams = useRef({ category, query, statusFilter, sort, page });
  inventoryParams.current = { category, query, statusFilter, sort, page };

  const beginOperation = useCallback((next: FileOperation) => {
    if (operationRef.current) return null;
    const token = ++operationToken.current;
    operationRef.current = next;
    setOperation(next);
    return token;
  }, []);

  const operationIsCurrent = useCallback((token: number) => token === operationToken.current, []);

  const finishOperation = useCallback((token: number) => {
    if (!operationIsCurrent(token)) return false;
    operationRef.current = null;
    setOperation(null);
    return true;
  }, [operationIsCurrent]);

  const loadOverview = useCallback(async () => {
    const token = ++overviewToken.current;
    const [overviewResult, duplicatesResult] = await Promise.allSettled([
      api.filesOverview(),
      api.filesDuplicates(),
    ]);
    if (token !== overviewToken.current) return;
    if (overviewResult.status === "fulfilled") {
      setOverview(overviewResult.value);
    } else {
      setError(errorMessage(overviewResult.reason));
    }
    setDuplicates(duplicatesResult.status === "fulfilled" ? duplicatesResult.value : null);
  }, []);

  const loadInventory = useCallback(() => {
    const {
      category: currentCategory,
      query: currentQuery,
      statusFilter: currentStatus,
      sort: currentSort,
      page: currentPage,
    } = inventoryParams.current;
    const token = ++requestToken.current;
    setLoading(true);
    api
      .filesInventory({
        category: currentCategory,
        q: currentQuery || undefined,
        status: currentStatus || undefined,
        sort: currentSort,
        page: currentPage,
      })
      .then((data) => {
        if (token !== requestToken.current) return;
        const lastPage = Math.max(1, Math.ceil(data.total / data.per_page));
        if (currentPage > lastPage) {
          setPage(lastPage);
          return;
        }
        setInventory(data);
        setFocusId((current) =>
          current && data.result.some((entry) => entry.id === current) ? current : null,
        );
        setError(null);
      })
      .catch((e) => {
        if (token !== requestToken.current) return;
        setError(errorMessage(e));
      })
      .finally(() => {
        if (token === requestToken.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    void loadOverview();
    return () => {
      overviewToken.current += 1;
      operationToken.current += 1;
      operationRef.current = null;
    };
  }, [loadOverview]);

  useEffect(() => {
    const timer = window.setTimeout(loadInventory, 180);
    return () => {
      window.clearTimeout(timer);
      requestToken.current += 1;
    };
  }, [category, query, statusFilter, sort, page, loadInventory]);

  const resetDeleteState = useCallback(() => {
    setPreview(null);
    setPendingTargets([]);
    setPendingLabel(null);
  }, []);

  const clearPending = useCallback(() => {
    if (operationRef.current === "delete-preview" || operationRef.current === "cleanup-preview") {
      operationToken.current += 1;
      operationRef.current = null;
      setOperation(null);
    }
    resetDeleteState();
  }, [resetDeleteState]);

  const reload = useCallback(() => {
    void loadOverview();
    loadInventory();
  }, [loadOverview, loadInventory]);

  const resetFilterExtras = useCallback(() => {
    setPage(1);
    setSelected(new Set());
    setFocusId(null);
    clearPending();
    setActionNotice(null);
  }, [clearPending]);

  const setCategory = useCallback(
    (c: string) => {
      if (c === category) return;
      setCategoryState(c);
      resetFilterExtras();
    },
    [category, resetFilterExtras],
  );
  const setQuery = useCallback(
    (q: string) => {
      if (q === query) return;
      setQueryState(q);
      resetFilterExtras();
    },
    [query, resetFilterExtras],
  );
  const setStatusFilter = useCallback(
    (s: string) => {
      if (s === statusFilter) return;
      setStatusFilterState(s);
      resetFilterExtras();
    },
    [resetFilterExtras, statusFilter],
  );
  const setSort = useCallback(
    (s: string) => {
      if (s === sort) return;
      setSortState(s);
      resetFilterExtras();
    },
    [resetFilterExtras, sort],
  );

  const changePage = useCallback(
    (nextPage: number) => {
      if (nextPage === page) return;
      setPage(nextPage);
      setSelected(new Set());
      clearPending();
    },
    [clearPending, page],
  );

  const pickRow = useCallback((id: string) => {
    setFocusId(id);
    setActionNotice(null);
    clearPending();
  }, [clearPending]);

  const closeFocus = useCallback(() => {
    setFocusId(null);
    clearPending();
  }, [clearPending]);

  const toggleSelected = useCallback((id: string) => {
    setFocusId(id);
    setActionNotice(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clearPending();
  }, [clearPending]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    clearPending();
  }, [clearPending]);

  const targetsFromIds = useCallback(
    (ids: Set<string>): FileDeleteTarget[] => {
      const entries = inventory?.result ?? [];
      return entries.filter((e: FileEntry) => ids.has(e.id)).map(entryToTarget);
    },
    [inventory],
  );

  const fetchDeletePreview = useCallback(
    async (targets: FileDeleteTarget[], label: string, token: number) => {
      const result = await api.previewFileDelete(targets);
      if (!operationIsCurrent(token)) return;
      setPreview(result);
      setPendingTargets(targets);
      setPendingLabel(label);
    },
    [operationIsCurrent],
  );

  const runPreview = useCallback(
    async (targets: FileDeleteTarget[], label: string) => {
      if (targets.length === 0) {
        clearPending();
        return;
      }
      deleteTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const token = beginOperation("delete-preview");
      if (token === null) return;
      setActionNotice(null);
      setError(null);
      try {
        await fetchDeletePreview(targets, label, token);
      } catch (e) {
        if (operationIsCurrent(token)) setError(errorMessage(e));
      } finally {
        finishOperation(token);
      }
    },
    [beginOperation, clearPending, fetchDeletePreview, finishOperation, operationIsCurrent],
  );

  const previewSelected = useCallback(
    () => runPreview(targetsFromIds(selected), `已选 ${selected.size} 项`),
    [runPreview, targetsFromIds, selected],
  );

  const previewEntry = useCallback(
    (entry: FileEntry) =>
      runPreview([entryToTarget(entry)], entry.kind === "work" ? entry.title ?? "该作品" : entry.name ?? "该文件"),
    [runPreview],
  );

  const cleanupCategory = useCallback(
    async (cat: "orphan" | "stale", label: string) => {
      deleteTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const token = beginOperation("cleanup-preview");
      if (token === null) return;
      setActionNotice(null);
      setError(null);
      try {
        const targets: FileDeleteTarget[] = [];
        let nextPage = 1;
        let total = 0;
        do {
          const data = await api.filesInventory({ category: cat, page: nextPage, per_page: 500 });
          if (!operationIsCurrent(token)) return;
          targets.push(...data.result.map(entryToTarget));
          total = data.total;
          nextPage += 1;
          if (data.result.length === 0) break;
        } while (targets.length < total);
        if (targets.length === 0) {
          setActionNotice({ message: "没有仍可清理的目标，文件状态已发生变化。", error: false });
          resetDeleteState();
          return;
        }
        await fetchDeletePreview(targets, label, token);
      } catch (e) {
        if (operationIsCurrent(token)) setError(errorMessage(e));
      } finally {
        finishOperation(token);
      }
    },
    [beginOperation, fetchDeletePreview, finishOperation, operationIsCurrent, resetDeleteState],
  );

  const confirmDelete = useCallback(async () => {
    if (pendingTargets.length === 0) return;
    const token = beginOperation("delete");
    if (token === null) return;
    const targets = pendingTargets;
    setActionNotice(null);
    setError(null);
    try {
      const result = await api.deleteFiles(targets);
      if (!operationIsCurrent(token)) return;
      const summary = `已删除 ${result.deleted_files} 个文件${result.removed_works > 0 ? `，移除 ${result.removed_works} 个作品` : ""}，回收 ${formatBytes(result.reclaimed_bytes)}`;
      if (result.errors.length > 0) {
        setActionNotice({
          message: `${summary}；另有 ${result.errors.length} 项失败：${result.errors.map((e) => e.message).join("；")}`,
          error: true,
        });
      } else {
        setActionNotice({ message: summary, error: false });
      }
      setSelected(new Set());
      resetDeleteState();
      reload();
    } catch (e) {
      if (operationIsCurrent(token)) setError(errorMessage(e));
    } finally {
      finishOperation(token);
    }
  }, [beginOperation, finishOperation, operationIsCurrent, pendingTargets, reload, resetDeleteState]);

  const previewScan = useCallback(async () => {
    const token = beginOperation("scan-preview");
    if (token === null) return;
    setScanPreview(null);
    setScanNotice(null);
    setScanError(null);
    try {
      const result = await api.scanLibraryPreview();
      if (operationIsCurrent(token)) setScanPreview(result);
    } catch (e) {
      if (operationIsCurrent(token)) setScanError(errorMessage(e));
    } finally {
      finishOperation(token);
    }
  }, [beginOperation, finishOperation, operationIsCurrent]);

  const startScan = useCallback(async () => {
    const paths = scanPreview
      ? [...scanPreview.new_linked, ...scanPreview.new_local].map((item) => item.path)
      : [];
    if (paths.length === 0) return;
    const token = beginOperation("scan-start");
    if (token === null) return;
    setScanNotice(null);
    setScanError(null);
    try {
      const job = await api.enqueueLibraryScan(paths);
      if (!operationIsCurrent(token)) return;
      setScanPreview(null);
      setScanNotice(`已将 ${paths.length} 个预览目标加入任务 #${job.id}`);
    } catch (e) {
      if (operationIsCurrent(token)) setScanError(errorMessage(e));
    } finally {
      finishOperation(token);
    }
  }, [beginOperation, finishOperation, operationIsCurrent, scanPreview]);

  const cancelScan = useCallback(() => {
    if (operationRef.current) return;
    setScanPreview(null);
    setScanError(null);
  }, []);

  const busy = operation !== null;

  return {
    overview,
    duplicates,
    inventory,
    loading,
    error,
    category,
    setCategory,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    sort,
    setSort,
    page,
    setPage: changePage,
    selected,
    pickRow,
    closeFocus,
    toggleSelected,
    clearSelection,
    focusId,
    preview,
    pendingLabel,
    deleteTrigger: deleteTriggerRef.current,
    actionNotice,
    busy,
    scanBusy: operation === "scan-preview" || operation === "scan-start",
    scanPreview,
    scanNotice,
    scanError,
    previewSelected,
    previewEntry,
    cleanupCategory,
    confirmDelete,
    cancelDelete: clearPending,
    previewScan,
    startScan,
    cancelScan,
    reload,
  };
}
