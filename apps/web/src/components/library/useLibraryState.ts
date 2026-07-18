import { useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  type LibrarySummary,
  type LibraryTag,
  type LibraryTagFilter,
  type LibraryWork,
} from "../../lib/api";
import type { LibraryView } from "./LibraryToolbar";

export function useLibraryState(perPage: number) {
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [continueReading, setContinueReading] = useState<LibraryWork[]>([]);
  const [recentAdded, setRecentAdded] = useState<LibraryWork[]>([]);
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [total, setTotal] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [selected, setSelected] = useState<LibraryWork | null>(null);

  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("all");
  const [readStatus, setReadStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("recent_updated");
  const [tags, setTags] = useState<LibraryTagFilter[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [view, setView] = useState<LibraryView>("grid");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestToken = useRef(0);
  const overviewToken = useRef(0);

  const filtersActive =
    Boolean(q) || language !== "all" || readStatus !== "all" || source !== "all" || tags.length > 0 || favoriteOnly;

  const loadOverview = useCallback(async () => {
    const current = ++overviewToken.current;
    try {
      const [summaryPayload, continuing, added] = await Promise.all([
        api.librarySummary(),
        api.libraryContinueReading(12),
        api.libraryRecentAdded(12),
      ]);
      if (overviewToken.current !== current) return;
      setSummary(summaryPayload);
      setContinueReading(continuing.result);
      setRecentAdded(added.result);
    } catch (exception) {
      if (overviewToken.current !== current) return;
      setError(exception instanceof Error ? exception.message : String(exception));
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    return () => {
      overviewToken.current += 1;
    };
  }, [loadOverview]);

  useEffect(() => {
    if (perPage < 1) return;
    const current = ++requestToken.current;
    setLoading(true);
    setError(null);

    void api.librarySearch({
      q,
      page,
      per_page: perPage,
      sort,
      read_status: readStatus,
      source,
      language,
      tag_ids: tags.map((tag) => tag.id),
      favorite_only: favoriteOnly,
    })
      .then((payload) => {
        if (requestToken.current !== current) return;
        setWorks(payload.result);
        setTotal(payload.total);
        setNumPages(payload.num_pages);
        setSelected((previous) => {
          if (!previous) return null;
          return payload.result.find((work) => work.id === previous.id) ?? null;
        });
      })
      .catch((exception) => {
        if (requestToken.current !== current) return;
        setError(exception instanceof Error ? exception.message : String(exception));
        setWorks([]);
        setTotal(0);
        setNumPages(1);
        setSelected(null);
      })
      .finally(() => {
        if (requestToken.current === current) setLoading(false);
      });

    return () => {
      if (requestToken.current === current) requestToken.current += 1;
    };
  }, [q, page, perPage, sort, readStatus, source, language, tags, favoriteOnly, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
    void loadOverview();
  }, [loadOverview]);

  function resetPage(action: () => void) {
    action();
    setPage(1);
  }

  function resetFilters() {
    setQ("");
    setLanguage("all");
    setReadStatus("all");
    setSource("all");
    setTags([]);
    setFavoriteOnly(false);
    setPage(1);
  }

  function pickTag(tag: LibraryTag) {
    resetPage(() => setTags((current) => {
      if (current.some((item) => item.id === tag.id)) return current;
      return [
        ...current,
        {
          id: tag.id,
          type: tag.type,
          name: tag.name,
          slug: tag.slug,
          display: tag.display,
          count: 0,
        },
      ];
    }));
  }

  function toggleMultiSelect() {
    setMultiSelect((enabled) => !enabled);
    setSelectedIds(new Set());
  }

  function toggleSelectedId(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      works.forEach((work) => next.add(work.id));
      return next;
    });
  }

  function afterBulkAction() {
    setSelectedIds(new Set());
    reload();
  }

  const toggleFavorite = useCallback(async (work: LibraryWork) => {
    setError(null);
    try {
      const updated = await api.setWorkFavorite(work.id, !work.favorite);
      setSelected((current) => current?.id === updated.id ? updated : current);
      reload();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    }
  }, [reload]);

  return {
    summary,
    continueReading,
    recentAdded,
    works,
    total,
    numPages,
    selected,
    setSelected,
    q,
    setQ: (value: string) => resetPage(() => setQ(value)),
    language,
    setLanguage: (value: string) => resetPage(() => setLanguage(value)),
    readStatus,
    setReadStatus: (value: string) => resetPage(() => setReadStatus(value)),
    source,
    setSource: (value: string) => resetPage(() => setSource(value)),
    sort,
    setSort: (value: string) => resetPage(() => setSort(value)),
    tags,
    setTags: (value: LibraryTagFilter[]) => resetPage(() => setTags(value)),
    favoriteOnly,
    setFavoriteOnly: (value: boolean) => resetPage(() => setFavoriteOnly(value)),
    view,
    setView,
    page,
    setPage,
    multiSelect,
    toggleMultiSelect,
    selectedIds,
    toggleSelectedId,
    selectAllOnPage,
    clearSelectedIds: () => setSelectedIds(new Set()),
    afterBulkAction,
    toggleFavorite,
    filtersActive,
    resetFilters,
    pickTag,
    loading,
    error,
    emptyLibrary: summary?.total === 0,
  };
}
