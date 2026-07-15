import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type GallerySummary, type RemoteTag } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import {
  canReplaceDiscoverHash,
  discoverFilterKey,
  DISCOVER_STATE_KEY,
  type PersistedDiscoverState,
  readDiscoverStateFrom,
  serializeDiscoverHash,
} from "./discoverState";
import type { TagFilter } from "./discoverTypes";

const SURFACE = "feed" as const;

export function useDiscoverState(initialTag?: RemoteTag) {
  const restored = useMemo(readDiscoverState, []);
  const [query, setQuery] = useState(restored.query);
  const [submittedQuery, setSubmittedQuery] = useState(restored.submittedQuery);
  const [language, setLanguage] = useState(restored.language);
  const [kind, setKind] = useState(restored.kind);
  const [sort, setSort] = useState(restored.sort);
  const [unimportedOnly, setUnimportedOnly] = useState(restored.unimportedOnly);
  const [selectedTags, setSelectedTags] = useState<TagFilter[]>(() => initialTag ? [initialTag] : restored.selectedTags);
  const [page, setPage] = useState(restored.page);
  const [perPage, setPerPage] = useState(discoverPerPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState<number | null>(0);
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [popularCollapseSignal, setPopularCollapseSignal] = useState(0);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularItems, setPopularItems] = useState<GallerySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeQuery = submittedQuery;
  const collapsePopular = useCallback(() => setPopularCollapseSignal((value) => value + 1), []);
  const initialTagKey = initialTag?.id ?? null;
  const initialPageRef = useRef(restored.page);
  const currentPageRef = useRef(restored.page);
  const lastFilterKeyRef = useRef<string | null>(null);
  const restoreScrollRef = useRef(restored.scrollY);
  const initialTagSeenRef = useRef(initialTagKey);
  const feedRequestRef = useRef(0);
  const filterKey = useMemo(
    () => discoverFilterKey({
      activeQuery,
      kind,
      language,
      selectedTags,
      sort,
      surface: SURFACE,
      unimportedOnly,
    }),
    [activeQuery, kind, language, selectedTags, sort, unimportedOnly],
  );

  const loadFeed = useCallback(async (nextPage: number, queryOverride?: string) => {
    const request = ++feedRequestRef.current;
    setLoading(true);
    setError(null);
    setNotice(null);
    const remoteQuery = queryOverride ?? activeQuery;

    try {
      const payload = await api.feed({
        q: remoteQuery,
        page: nextPage,
        per_page: perPage,
        sort,
        language,
        type: kind,
        tag_id: shouldUseTagged(selectedTags, remoteQuery, language, kind) ? selectedTags[0].id : null,
        tag_names: shouldUseTagged(selectedTags, remoteQuery, language, kind)
          ? []
          : selectedTags.map(tagQueryValue).filter(Boolean),
        unimported_only: unimportedOnly,
      });
      if (feedRequestRef.current !== request) return;

      setItems(payload.result);
      setTotal(typeof payload.total === "number" ? payload.total : null);
      setTotalPages(payload.num_pages || 1);
      currentPageRef.current = nextPage;
      setPage(nextPage);
      if (selectedTags.length) {
        setNotice(`已按词典标签「${selectedTags.map(displayTag).join(" / ")}」筛选；远端查询使用原始 tag 标识。`);
      } else if (payload.reason === "min_query_length") {
        setNotice("请输入关键词，或使用语言、类型、tag 组成远端查询。");
      }
    } catch (exception) {
      if (feedRequestRef.current === request) {
        setError(exception instanceof Error ? exception.message : String(exception));
      }
    } finally {
      if (feedRequestRef.current === request) setLoading(false);
    }
  }, [activeQuery, kind, language, perPage, selectedTags, sort, unimportedOnly]);

  useEffect(() => {
    const previousKey = lastFilterKeyRef.current;
    const filterChanged = previousKey !== null && previousKey !== filterKey;
    const nextPage = previousKey === null ? initialPageRef.current : filterChanged ? 1 : currentPageRef.current;
    lastFilterKeyRef.current = filterKey;
    if (filterChanged) {
      currentPageRef.current = 1;
      setPage(1);
      restoreScrollRef.current = 0;
      scrollDiscoverTo(0);
    }
    void loadFeed(nextPage);
  }, [filterKey, loadFeed, perPage]);

  useEffect(() => () => {
    feedRequestRef.current += 1;
  }, []);

  useEffect(() => {
    function updatePageSize() {
      setPerPage((current) => {
        const next = discoverPerPage();
        return current === next ? current : next;
      });
    }
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, []);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    persistDiscoverState(currentDiscoverState({
      surface: SURFACE,
      query,
      submittedQuery,
      language,
      kind,
      sort,
      unimportedOnly,
      selectedTags,
      page,
    }), true);
  }, [kind, language, page, query, selectedTags, sort, submittedQuery, unimportedOnly]);

  useEffect(() => {
    let timer = 0;
    const persistScroll = () => {
      timer = 0;
      persistDiscoverState({
        surface: SURFACE,
        query,
        submittedQuery,
        language,
        kind,
        sort,
        unimportedOnly,
        selectedTags,
        page,
        scrollY: discoverScrollTop(),
      }, false);
    };
    const handleScroll = () => {
      if (!timer) timer = window.setTimeout(persistScroll, 250);
    };
    const target = discoverScrollElement() ?? window;
    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", handleScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [kind, language, page, query, selectedTags, sort, submittedQuery, unimportedOnly]);

  useEffect(() => {
    if (loading || !items.length || !restoreScrollRef.current) return;
    const top = restoreScrollRef.current;
    restoreScrollRef.current = 0;
    const timers = [0, 120, 320].map((delay) => window.setTimeout(() => scrollDiscoverTo(top), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [items.length, loading]);

  useEffect(() => {
    if (!initialTagKey || !initialTag || initialTagSeenRef.current === initialTagKey) return;
    initialTagSeenRef.current = initialTagKey;
    setQuery("");
    setSubmittedQuery("");
    setSelectedTags([initialTag]);
    currentPageRef.current = 1;
    setPage(1);
    collapsePopular();
  }, [collapsePopular, initialTag, initialTagKey]);

  useEffect(() => {
    let cancelled = false;
    setPopularLoading(true);
    void api.popular()
      .then((payload) => {
        if (!cancelled) setPopularItems(payload.result);
      })
      .catch((exception) => {
        if (!cancelled) setNotice(exception instanceof Error ? exception.message : String(exception));
      })
      .finally(() => {
        if (!cancelled) setPopularLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openDetail(id: number) {
    collapsePopular();
    const state = snapshot();
    persistDiscoverState(state, true);
    navigate({ name: "gallery", galleryId: id, returnTo: serializeDiscoverHash(state).replace(/^#/, "") });
  }

  async function openRandom() {
    collapsePopular();
    setLoading(true);
    setError(null);
    try {
      const detail = await api.random();
      navigate({ name: "gallery", galleryId: detail.gallery_id });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setLoading(false);
    }
  }

  async function submitToolbar() {
    collapsePopular();
    const nextQuery = query.trim();
    if (/^\d+$/.test(nextQuery)) {
      navigate({ name: "gallery", galleryId: Number(nextQuery) });
      return;
    }
    if (nextQuery === submittedQuery) {
      await loadFeed(1, nextQuery);
      return;
    }
    currentPageRef.current = 1;
    setPage(1);
    setSubmittedQuery(nextQuery);
  }

  async function enqueueGalleryId(galleryId: number) {
    collapsePopular();
    setLoading(true);
    setError(null);
    try {
      await api.importGallery(galleryId);
      setNotice(`Gallery ${galleryId} 已加入真实导入队列。`);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setLoading(false);
    }
  }

  function pickTag(tag: RemoteTag) {
    collapsePopular();
    setSelectedTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag]);
    currentPageRef.current = 1;
    setPage(1);
  }

  function loadPage(nextPage: number) {
    collapsePopular();
    const boundedPage = Math.max(1, nextPage);
    currentPageRef.current = boundedPage;
    persistDiscoverState({ ...snapshot(), page: boundedPage, scrollY: 0 }, true);
    scrollDiscoverTo(0);
    void loadFeed(boundedPage);
  }

  function snapshot(): PersistedDiscoverState {
    return {
      surface: SURFACE,
      query,
      submittedQuery,
      language,
      kind,
      sort,
      unimportedOnly,
      selectedTags,
      page,
      scrollY: discoverScrollTop(),
    };
  }

  return {
    query,
    language,
    kind,
    sort,
    unimportedOnly,
    selectedTags,
    page,
    totalPages,
    total,
    items,
    loading,
    error,
    notice,
    popularCollapseSignal,
    popularLoading,
    popularItems,
    openDetail,
    openRandom,
    enqueueGalleryId,
    submitToolbar,
    pickTag,
    loadPage,
    setQuery: (value: string) => { collapsePopular(); setQuery(value); },
    setLanguage: (value: string) => { collapsePopular(); setLanguage(value); },
    setKind: (value: string) => { collapsePopular(); setKind(value); },
    setSort: (value: string) => { collapsePopular(); setSort(value); },
    setUnimportedOnly: (value: boolean) => { collapsePopular(); setUnimportedOnly(value); },
    setSelectedTags: (tags: TagFilter[]) => { collapsePopular(); setSelectedTags(tags); },
  };
}

function shouldUseTagged(tags: TagFilter[], query: string, language: string, kind: string) {
  return tags.length === 1 && !query.trim() && language === "all" && kind === "all";
}

function tagQueryValue(tag: TagFilter) {
  return tag.name || tag.slug || "";
}

function displayTag(tag: TagFilter) {
  return tag.display || tag.name || tag.slug || String(tag.id);
}

function readDiscoverState(): PersistedDiscoverState {
  try {
    return readDiscoverStateFrom(window.location.hash, window.sessionStorage.getItem(DISCOVER_STATE_KEY));
  } catch {
    return readDiscoverStateFrom(window.location.hash, null);
  }
}

function persistDiscoverState(state: PersistedDiscoverState, syncUrl: boolean) {
  try {
    window.sessionStorage.setItem(DISCOVER_STATE_KEY, JSON.stringify(state));
  } catch {
    // Session storage only preserves navigation context; unavailable storage is non-fatal.
  }
  if (syncUrl && canReplaceDiscoverHash(window.location.hash)) {
    const nextHash = serializeDiscoverHash(state);
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }
}

function currentDiscoverState(state: Omit<PersistedDiscoverState, "scrollY">): PersistedDiscoverState {
  return { ...state, scrollY: discoverScrollTop() };
}

function discoverScrollElement() {
  return document.querySelector<HTMLElement>(".folio-scroll");
}

function discoverScrollTop() {
  return discoverScrollElement()?.scrollTop ?? window.scrollY;
}

function scrollDiscoverTo(top: number) {
  const scroll = discoverScrollElement();
  if (scroll) scroll.scrollTo({ top, behavior: "auto" });
  else window.scrollTo({ top, behavior: "auto" });
}

function discoverPerPage() {
  const workspaceGutter = 76;
  const cardWidth = 224;
  const gap = 16;
  const usableWidth = Math.max(cardWidth, window.innerWidth - workspaceGutter);
  return Math.max(1, Math.floor((usableWidth + gap) / (cardWidth + gap))) * 4;
}
