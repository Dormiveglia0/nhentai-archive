import { useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  type FileDeletePreview,
  type FileEntry,
  type FileInventory,
  type FileOverview,
} from "../../lib/api";
import { entryToTarget } from "./fileHelpers";

export function useFilesState() {
  const [overview, setOverview] = useState<FileOverview | null>(null);
  const [inventory, setInventory] = useState<FileInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const requestToken = useRef(0);

  const loadOverview = useCallback(() => {
    api.filesOverview().then(setOverview).catch((e) => setError(String(e)));
  }, []);

  const loadInventory = useCallback(() => {
    const token = ++requestToken.current;
    setLoading(true);
    api
      .filesInventory({ category, q: query || undefined, status: statusFilter || undefined, page })
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
  }, [category, query, statusFilter, page]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const reload = useCallback(() => {
    loadOverview();
    loadInventory();
  }, [loadOverview, loadInventory]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFocusId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setPreview(null);
  }, []);

  const targetsFor = useCallback(
    (ids: Set<string>) => {
      const entries = inventory?.result ?? [];
      return entries.filter((e: FileEntry) => ids.has(e.id)).map(entryToTarget);
    },
    [inventory],
  );

  const requestPreview = useCallback(async () => {
    const targets = targetsFor(selected);
    if (targets.length === 0) {
      setPreview(null);
      return null;
    }
    setBusy(true);
    try {
      const result = await api.previewFileDelete(targets);
      setPreview(result);
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [selected, targetsFor]);

  const confirmDelete = useCallback(async () => {
    const targets = targetsFor(selected);
    if (targets.length === 0) return;
    setBusy(true);
    try {
      await api.deleteFiles(targets);
      clearSelection();
      reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [selected, targetsFor, clearSelection, reload]);

  return {
    overview,
    inventory,
    loading,
    error,
    category,
    setCategory: (c: string) => {
      setCategory(c);
      setPage(1);
    },
    query,
    setQuery: (q: string) => {
      setQuery(q);
      setPage(1);
    },
    statusFilter,
    setStatusFilter: (s: string) => {
      setStatusFilter(s);
      setPage(1);
    },
    page,
    setPage,
    selected,
    toggleSelect,
    clearSelection,
    focusId,
    setFocusId,
    preview,
    requestPreview,
    confirmDelete,
    busy,
    reload,
  };
}
