import { useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  type FileDeletePreview,
  type FileDeleteTarget,
  type FileDuplicates,
  type FileEntry,
  type FileInventory,
  type FileOverview,
} from "../../lib/api";
import { entryToTarget } from "./fileHelpers";

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
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [pendingTargets, setPendingTargets] = useState<FileDeleteTarget[]>([]);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestToken = useRef(0);

  const loadOverview = useCallback(() => {
    api.filesOverview().then(setOverview).catch((e) => setError(String(e)));
    api.filesDuplicates().then(setDuplicates).catch(() => setDuplicates(null));
  }, []);

  const loadInventory = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    api
      .filesInventory({ category, q: query || undefined, status: statusFilter || undefined, sort, page })
      .then((data) => {
        if (token !== requestToken.current) return;
        setInventory(data);
        setError(null);
      })
      .catch((e) => {
        if (token !== requestToken.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (token === requestToken.current) setLoading(false);
      });
  }, [category, query, statusFilter, sort, page]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const clearPending = useCallback(() => {
    setPreview(null);
    setPendingTargets([]);
    setPendingLabel(null);
  }, []);

  const reload = useCallback(() => {
    loadOverview();
    loadInventory();
  }, [loadOverview, loadInventory]);

  const resetFilterExtras = useCallback(() => {
    setPage(1);
    clearPending();
    setActionNotice(null);
  }, [clearPending]);

  const setCategory = useCallback(
    (c: string) => {
      setCategoryState(c);
      resetFilterExtras();
    },
    [resetFilterExtras],
  );
  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      resetFilterExtras();
    },
    [resetFilterExtras],
  );
  const setStatusFilter = useCallback(
    (s: string) => {
      setStatusFilterState(s);
      resetFilterExtras();
    },
    [resetFilterExtras],
  );
  const setSort = useCallback(
    (s: string) => {
      setSortState(s);
      resetFilterExtras();
    },
    [resetFilterExtras],
  );

  const toggleMultiSelect = useCallback(() => {
    setMultiSelect((on) => !on);
    setSelected(new Set());
    clearPending();
  }, [clearPending]);

  // Row click: always focus the row; toggle selection only in multi-select mode.
  const pickRow = useCallback(
    (id: string) => {
      setFocusId(id);
      setActionNotice(null);
      if (multiSelect) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        clearPending();
      }
    },
    [multiSelect, clearPending],
  );

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

  const runPreview = useCallback(
    async (targets: FileDeleteTarget[], label: string) => {
      if (targets.length === 0) {
        clearPending();
        return;
      }
      setBusy(true);
      setActionNotice(null);
      try {
        const result = await api.previewFileDelete(targets);
        setPreview(result);
        setPendingTargets(targets);
        setPendingLabel(label);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [clearPending],
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
      setBusy(true);
      try {
        const targets: FileDeleteTarget[] = [];
        let nextPage = 1;
        let total = 0;
        do {
          const data = await api.filesInventory({ category: cat, page: nextPage, per_page: 500 });
          targets.push(...data.result.map(entryToTarget));
          total = data.total;
          nextPage += 1;
          if (data.result.length === 0) break;
        } while (targets.length < total);
        await runPreview(targets, label);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [runPreview],
  );

  const confirmDelete = useCallback(async () => {
    if (pendingTargets.length === 0) return;
    setBusy(true);
    try {
      const result = await api.deleteFiles(pendingTargets);
      if (result.errors.length > 0) {
        setActionNotice(
          `部分目标删除失败（${result.errors.length}）：${result.errors.map((e) => e.message).join("；")}`,
        );
      } else {
        setActionNotice(
          `已删除 ${result.deleted_files} 个文件${result.removed_works > 0 ? `，移除 ${result.removed_works} 个作品` : ""}`,
        );
      }
      setSelected(new Set());
      clearPending();
      reload();
    } catch (e) {
      setActionNotice(null);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [pendingTargets, clearPending, reload]);

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
    setPage,
    multiSelect,
    toggleMultiSelect,
    selected,
    pickRow,
    clearSelection,
    focusId,
    preview,
    pendingLabel,
    actionNotice,
    busy,
    previewSelected,
    previewEntry,
    cleanupCategory,
    confirmDelete,
    cancelDelete: clearPending,
    reload,
  };
}
