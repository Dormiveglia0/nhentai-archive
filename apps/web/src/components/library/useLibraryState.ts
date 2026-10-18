import { useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  type LibrarySummary,
  type LibraryGrouping,
  type LibraryTag,
  type LibraryTagFilter,
  type LibraryWork,
  type MediaLibrary,
} from "../../lib/api";
import type { LibraryView } from "./LibraryToolbar";
import { readLibraryLocation, libraryLocationHash, type LibraryLocation } from "./libraryLocation";
import { libraryTagKey } from "../../lib/navigation";

export function useLibraryState(perPage: number) {
  const initialFilters = useRef<LibraryLocation | null>(null);
  if (initialFilters.current === null) initialFilters.current = readLibraryLocation();
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [continueReading, setContinueReading] = useState<LibraryWork[]>([]);
  const [recentAdded, setRecentAdded] = useState<LibraryWork[]>([]);
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [total, setTotal] = useState(0);
  const [workTotal, setWorkTotal] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [selected, setSelected] = useState<LibraryWork | null>(null);

  const [q, setQ] = useState(() => initialFilters.current?.q ?? "");
  const [language, setLanguage] = useState(initialFilters.current.language);
  const [readStatus, setReadStatus] = useState(initialFilters.current.readStatus);
  const [libraryId, setLibraryId] = useState(initialFilters.current.libraryId);
  const [mediaLibraries, setMediaLibraries] = useState<MediaLibrary[]>([]);
  const [sort, setSort] = useState(initialFilters.current.sort);
  const [tags, setTags] = useState<LibraryTagFilter[]>(() => initialFilters.current?.tags ?? []);
  const [favoriteOnly, setFavoriteOnly] = useState(initialFilters.current.favoriteOnly);
  const [view, setView] = useState<LibraryView>(initialFilters.current.view);
  const [page, setPage] = useState(initialFilters.current.page);
  const [groupBy, setGroupBy] = useState<LibraryGrouping>(initialFilters.current.groupBy);
  const [reloadKey, setReloadKey] = useState(0);

  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestToken = useRef(0);
  const overviewToken = useRef(0);
  const lastQuery = useRef("");
  const libraryHash = useRef(window.location.hash);
  const libraryRevision = useRef<number | null>(null);
  const searching = useRef(false);
  const restoreScroll = useRef<number | null>(window.history.state?.libraryScroll ?? null);

  useEffect(() => {
    function syncLocation() {
      const hash = window.location.hash;
      if (!/^#library(?:\?|$)/.test(hash) || hash === libraryHash.current) return;
      libraryHash.current = hash;
      const filters = readLibraryLocation();
      setQ(filters.q); setTags(filters.tags); setLibraryId(filters.libraryId);
      setLanguage(filters.language); setReadStatus(filters.readStatus); setSort(filters.sort);
      setFavoriteOnly(filters.favoriteOnly); setView(filters.view); setPage(filters.page);
      setGroupBy(filters.groupBy);
      restoreScroll.current = window.history.state?.libraryScroll ?? 0;
    }
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);
    return () => {
      window.removeEventListener("hashchange", syncLocation);
      window.removeEventListener("popstate", syncLocation);
    };
  }, []);

  function snapshot(): LibraryLocation {
    return { q, tags, language, readStatus, libraryId, sort, favoriteOnly, view, page, groupBy };
  }

  useEffect(() => {
    if (!/^#library(?:\?|$)/.test(window.location.hash)) return;
    const hash = libraryLocationHash(snapshot());
    libraryHash.current = hash;
    window.history.replaceState({ ...window.history.state }, "", hash);
  }, [q, tags, language, readStatus, libraryId, sort, favoriteOnly, view, page, groupBy]);

  useEffect(() => {
    const scroll = document.querySelector<HTMLElement>(".folio-scroll");
    if (!scroll) return;
    let timer = 0;
    const save = () => {
      timer = 0;
      if (/^#library(?:\?|$)/.test(window.location.hash) && restoreScroll.current === null)
        window.history.replaceState({ ...window.history.state, libraryScroll: scroll.scrollTop }, "");
    };
    const onScroll = () => { if (!timer) timer = window.setTimeout(save, 250); };
    scroll.addEventListener("scroll", onScroll, { passive: true });
    return () => { scroll.removeEventListener("scroll", onScroll); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (loading || restoreScroll.current === null) return;
    const frame = requestAnimationFrame(() => {
      const scroll = document.querySelector<HTMLElement>(".folio-scroll");
      if (scroll) scroll.scrollTop = restoreScroll.current ?? 0;
      restoreScroll.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, page]);

  function loadPage(next: number) {
    if (next === page) return;
    const scroll = document.querySelector<HTMLElement>(".folio-scroll");
    const head = document.querySelector<HTMLElement>(".folio-library-results-head");
    window.history.replaceState({ ...window.history.state, libraryScroll: scroll?.scrollTop ?? 0 }, "");
    const top = scroll && head ? Math.max(0, scroll.scrollTop + head.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 16) : 0;
    const hash = libraryLocationHash({ ...snapshot(), page: next });
    window.history.pushState({ ...window.history.state, libraryScroll: top }, "", hash);
    libraryHash.current = hash;
    restoreScroll.current = top;
    setPage(next);
    if (scroll) scroll.scrollTop = top;
  }

  const filtersActive =
    Boolean(q) || libraryId !== "all" || language !== "all" || readStatus !== "all" || sort !== "recent_updated" || tags.length > 0 || favoriteOnly;

  const loadOverview = useCallback(async () => {
    const current = ++overviewToken.current;
    try {
      const [summaryPayload, continuing, added, media] = await Promise.all([
        api.librarySummary(),
        api.libraryContinueReading(12),
        api.libraryRecentAdded(12),
        api.mediaLibraries(),
      ]);
      if (overviewToken.current !== current) return;
      setSummary(summaryPayload);
      setContinueReading(continuing.result);
      setRecentAdded(added.result);
      setMediaLibraries(media.result);
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
    const query = JSON.stringify([q, page, perPage, sort, readStatus, language, tags, favoriteOnly, libraryId, groupBy]);
    const background = lastQuery.current === query;
    lastQuery.current = query;
    const current = ++requestToken.current;
    searching.current = true;
    if (!background) {
      setLoading(true);
      setError(null);
    }

    void api.librarySearch({
      q,
      page,
      per_page: perPage,
      group_by: groupBy,
      sort,
      read_status: readStatus,
      language,
      tag_keys: tags.map(libraryTagKey),
      favorite_only: favoriteOnly,
      library_id: libraryId === "all" ? undefined : Number(libraryId),
    })
      .then((payload) => {
        if (requestToken.current !== current) return;
        libraryRevision.current = payload.revision;
        setError(null);
        setWorks(payload.result);
        setTotal(payload.total);
        setWorkTotal(payload.work_total ?? payload.total);
        setNumPages(payload.num_pages);
        setSelected((previous) => {
          if (!previous) return null;
          return payload.result.find((work) => work.id === previous.id) ?? (background ? previous : null);
        });
        if (page > payload.num_pages) setPage(payload.num_pages);
      })
      .catch((exception) => {
        if (requestToken.current !== current) return;
        setError(exception instanceof Error ? exception.message : String(exception));
        if (background) return;
        setWorks([]);
        setTotal(0);
        setWorkTotal(0);
        setNumPages(1);
        setSelected(null);
      })
      .finally(() => {
        if (requestToken.current === current) {
          searching.current = false;
          setLoading(false);
        }
      });

    return () => {
      if (requestToken.current === current) requestToken.current += 1;
    };
  }, [q, page, perPage, sort, readStatus, language, tags, favoriteOnly, libraryId, groupBy, reloadKey]);

  useEffect(() => {
    let stopped = false;
    let pending = false;
    async function checkChanges() {
      if (stopped || pending || document.hidden || document.querySelector<HTMLElement>(".app-route-archive")?.inert || searching.current || libraryRevision.current === null) return;
      pending = true;
      try {
        const payload = await api.libraryRevision();
        if (!stopped && !searching.current && payload.revision !== libraryRevision.current) {
          setReloadKey(value => value + 1);
          void loadOverview();
        }
      } catch { /* Keep the current wall during a temporary connection failure. */ }
      finally { pending = false; }
    }
    const timer = window.setInterval(() => void checkChanges(), 5000);
    const onVisibility = () => { if (!document.hidden) void checkChanges(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("hashchange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("hashchange", onVisibility);
    };
  }, [loadOverview]);

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
    setLibraryId("all");
    setSort("recent_updated");
    setTags([]);
    setFavoriteOnly(false);
    setPage(1);
  }

  function pickTag(tag: LibraryTag) {
    resetFilters();
    setTags([{
      id: tag.id,
      key: libraryTagKey(tag),
      type: tag.type,
      name: tag.name,
      slug: tag.slug,
      display: tag.display,
      count: 0,
    }]);
  }

  function toggleMultiSelect() {
    setMultiSelect((enabled) => !enabled);
    setSelectedIds(new Set());
  }

  function toggleSelectedId(id: number) {
    toggleSelectedWorks([id]);
  }

  function toggleSelectedWorks(ids: number[]) {
    setSelectedIds((current) => {
      const next = new Set(current);
      const remove = ids.every(id => next.has(id));
      ids.forEach(id => remove ? next.delete(id) : next.add(id));
      return next;
    });
  }

  function selectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      works.forEach(work => (work.group?.member_ids ?? [work.id]).forEach(id => next.add(id)));
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
    workTotal,
    numPages,
    selected,
    setSelected,
    q,
    setQ: (value: string) => resetPage(() => setQ(value)),
    language,
    setLanguage: (value: string) => resetPage(() => setLanguage(value)),
    readStatus,
    setReadStatus: (value: string) => resetPage(() => setReadStatus(value)),
    libraryId,
    mediaLibraries,
    setLibraryId: (value: string) => resetPage(() => setLibraryId(value)),
    sort,
    setSort: (value: string) => resetPage(() => setSort(value)),
    tags,
    setTags: (value: LibraryTagFilter[]) => resetPage(() => setTags(value)),
    favoriteOnly,
    setFavoriteOnly: (value: boolean) => resetPage(() => setFavoriteOnly(value)),
    view,
    setView,
    groupBy,
    setGroupBy: (value: LibraryGrouping) => { resetPage(() => setGroupBy(value)); setSelectedIds(new Set()); },
    page,
    setPage: loadPage,
    multiSelect,
    toggleMultiSelect,
    selectedIds,
    toggleSelectedId,
    toggleSelectedWorks,
    selectAllOnPage,
    clearSelectedIds: () => setSelectedIds(new Set()),
    afterBulkAction,
    reload,
    toggleFavorite,
    filtersActive,
    resetFilters,
    pickTag,
    loading,
    error,
    emptyLibrary: summary?.total === 0,
  };
}
