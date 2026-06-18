import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, GallerySummary, RemoteTag } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { DiscoverFeed } from "./DiscoverFeed";
import { DiscoverToolbar } from "./DiscoverToolbar";
import { DiscoverSurface, DiscoverViewMode, TagFilter } from "./discoverTypes";
import {
  canReplaceDiscoverHash,
  discoverFilterKey,
  DISCOVER_STATE_KEY,
  nextDiscoverFeedLoad,
  PersistedDiscoverState,
  readDiscoverStateFrom,
  serializeDiscoverHash,
} from "./discoverState";
import { PopularFan } from "./PopularFan";

type Props = {
  blurCovers: boolean;
  initialTag?: RemoteTag;
};

const PER_PAGE = 24;

export function DiscoverPage({ blurCovers, initialTag }: Props) {
  const restored = useMemo(() => readDiscoverState(), []);
  const [surface, setSurface] = useState<DiscoverSurface>(restored.surface);
  const [viewMode, setViewMode] = useState<DiscoverViewMode>(restored.viewMode);
  const [query, setQuery] = useState(restored.query);
  const [submittedQuery, setSubmittedQuery] = useState(restored.submittedQuery);
  const [language, setLanguage] = useState(restored.language);
  const [kind, setKind] = useState(restored.kind);
  const [sort, setSort] = useState(restored.sort);
  const [unimportedOnly, setUnimportedOnly] = useState(restored.unimportedOnly);
  const [selectedTags, setSelectedTags] = useState<TagFilter[]>(() => (initialTag ? [initialTag] : restored.selectedTags));
  const [page, setPage] = useState(restored.page);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [popularCollapseSignal, setPopularCollapseSignal] = useState(0);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularItems, setPopularItems] = useState<GallerySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeQuery = surface === "feed" ? submittedQuery : "";
  const isBoundary = surface === "upload" || surface === "scan";
  const collapsePopular = useCallback(() => setPopularCollapseSignal((value) => value + 1), []);
  const initialTagKey = initialTag?.id ?? null;
  const initialPageRef = useRef(restored.page);
  const lastFilterKeyRef = useRef<string | null>(null);
  const restoreScrollRef = useRef(restored.scrollY);
  const initialTagSeenRef = useRef(initialTagKey);
  const filterKey = useMemo(
    () => discoverFilterKey({
      activeQuery,
      kind,
      language,
      selectedTags,
      sort,
      surface,
      unimportedOnly,
    }),
    [activeQuery, kind, language, selectedTags, sort, surface, unimportedOnly]
  );

  const loadFeed = useCallback(
    async (nextPage: number, queryOverride?: string) => {
      if (isBoundary) return;
      setLoading(true);
      setError(null);
      setNotice(null);
      const remoteQuery = queryOverride ?? activeQuery;
      try {
        const payload = await api.feed({
          q: remoteQuery,
          page: nextPage,
          per_page: PER_PAGE,
          sort,
          language,
          type: kind,
          tag_id: shouldUseTagged(selectedTags, remoteQuery, language, kind) ? selectedTags[0].id : null,
          tag_names: shouldUseTagged(selectedTags, remoteQuery, language, kind) ? [] : selectedTags.map(tagQueryValue).filter(Boolean),
          unimported_only: unimportedOnly,
        });
        setItems(payload.result);
        setTotal(payload.total);
        setTotalPages(payload.num_pages || 1);
        setPage(nextPage);
        if (selectedTags.length) {
          const label = selectedTags.map(displayTag).join(" / ");
          setNotice(`已按词典标签「${label}」筛选；远端查询使用原始 tag 标识。`);
        } else if (payload.reason === "min_query_length") {
          setNotice("请输入关键词，或使用语言、类型、tag 组成远端查询。");
        } else if (payload.query) {
          setNotice(`远端查询：${payload.query}`);
        }
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        setLoading(false);
      }
    },
    [activeQuery, isBoundary, kind, language, selectedTags, sort, surface, unimportedOnly]
  );

  useEffect(() => {
    const next = nextDiscoverFeedLoad(lastFilterKeyRef.current, filterKey, initialPageRef.current);
    lastFilterKeyRef.current = filterKey;
    if (!next.isInitialLoad) {
      setPage(1);
      restoreScrollRef.current = 0;
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    void loadFeed(next.page);
  }, [filterKey]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    persistDiscoverState(currentDiscoverState({
      surface,
      viewMode,
      query,
      submittedQuery,
      language,
      kind,
      sort,
      unimportedOnly,
      selectedTags,
      page,
    }), true);
  }, [kind, language, page, query, selectedTags, sort, submittedQuery, surface, unimportedOnly, viewMode]);

  useEffect(() => {
    // Throttle the scroll-position persist: writing (JSON.stringify + sessionStorage)
    // on every scroll event blocks the main thread and makes the page stutter.
    // At most one write per 250ms keeps the restore point fresh without the jank.
    let timer = 0;
    const persistScroll = () => {
      timer = 0;
      persistDiscoverState({
        surface,
        viewMode,
        query,
        submittedQuery,
        language,
        kind,
        sort,
        unimportedOnly,
        selectedTags,
        page,
        scrollY: window.scrollY,
      }, false);
    };
    const handleScroll = () => {
      if (timer) return;
      timer = window.setTimeout(persistScroll, 250);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [kind, language, page, query, selectedTags, sort, submittedQuery, surface, unimportedOnly, viewMode]);

  useEffect(() => {
    if (loading || !items.length || !restoreScrollRef.current) return;
    const y = restoreScrollRef.current;
    restoreScrollRef.current = 0;
    const timers = [0, 120, 320].map((delay) => window.setTimeout(() => window.scrollTo({ top: y, behavior: "auto" }), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [items.length, loading]);

  useEffect(() => {
    if (!initialTagKey || !initialTag) return;
    if (initialTagSeenRef.current === initialTagKey) return;
    initialTagSeenRef.current = initialTagKey;
    setSurface("feed");
    setQuery("");
    setSubmittedQuery("");
    setSelectedTags([initialTag]);
    setPage(1);
    collapsePopular();
  }, [collapsePopular, initialTag, initialTagKey]);

  const boundaryNotice = useMemo(() => {
    if (surface === "upload") return "上传 CBZ 将在本地导入模块接入后开放；当前不显示假上传任务。";
    if (surface === "scan") return "扫描目录将在文件维护模块接入后开放；当前不显示假扫描结果。";
    return null;
  }, [surface]);

  const loadPopular = useCallback(async () => {
    setPopularLoading(true);
    try {
      const payload = await api.popular();
      setPopularItems(payload.result);
    } catch (exc) {
      setNotice(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setPopularLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!popularItems.length && !popularLoading) void loadPopular();
  }, [loadPopular, popularItems.length, popularLoading]);

  function openDetail(id: number) {
    collapsePopular();
    const state = {
      surface,
      viewMode,
      query,
      submittedQuery,
      language,
      kind,
      sort,
      unimportedOnly,
      selectedTags,
      page,
      scrollY: window.scrollY,
    };
    persistDiscoverState(state, true);
    // Build the return target from the serialized state so it always carries the
    // current page; reading window.location.hash can momentarily miss the page
    // param (e.g. right after a tag jump) and send the user back to page 1.
    navigate({ name: "gallery", galleryId: id, returnTo: serializeDiscoverHash(state).replace(/^#/, "") });
  }

  async function openRandom() {
    collapsePopular();
    setLoading(true);
    setError(null);
    try {
      const detail = await api.random();
      navigate({ name: "gallery", galleryId: detail.gallery_id });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function submitToolbar() {
    if (surface !== "feed") return;
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
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  function pickTag(tag: RemoteTag) {
    collapsePopular();
    setSelectedTags((current) => (current.some((item) => item.id === tag.id) ? current : [...current, tag]));
    setPage(1);
  }

  function setSurfaceAndCollapse(nextSurface: DiscoverSurface) {
    collapsePopular();
    setSurface(nextSurface);
  }

  function setQueryAndCollapse(value: string) {
    collapsePopular();
    setQuery(value);
  }

  function setLanguageAndCollapse(value: string) {
    collapsePopular();
    setLanguage(value);
  }

  function setKindAndCollapse(value: string) {
    collapsePopular();
    setKind(value);
  }

  function setSortAndCollapse(value: string) {
    collapsePopular();
    setSort(value);
  }

  function setUnimportedAndCollapse(value: boolean) {
    collapsePopular();
    setUnimportedOnly(value);
  }

  function setViewModeAndCollapse(value: DiscoverViewMode) {
    collapsePopular();
    setViewMode(value);
  }

  function setTagsAndCollapse(tags: TagFilter[]) {
    collapsePopular();
    setSelectedTags(tags);
  }

  function loadPageAndCollapse(nextPage: number) {
    collapsePopular();
    const boundedPage = Math.max(1, nextPage);
    // Do NOT bump `page` here: loadFeed sets it together with the new items once
    // the fetch resolves. Setting it early changes the feed's animation key while
    // the old items are still mounted, which replays the entrance animation on the
    // previous page and then again on the new page (the "old then sudden refresh"
    // flicker). Persisting boundedPage still updates the URL immediately.
    persistDiscoverState({
      surface,
      viewMode,
      query,
      submittedQuery,
      language,
      kind,
      sort,
      unimportedOnly,
      selectedTags,
      page: boundedPage,
      scrollY: 0,
    }, true);
    window.scrollTo({ top: 0, behavior: "auto" });
    void loadFeed(boundedPage);
  }

  return (
    <section className="page discover-page">
      <div className="hero">
        <div>
          <h1>发现 / 导入</h1>
          <p>从远端源发现同人志，支持画廊 ID、tag 筛选、随机预览与真实导入队列。</p>
        </div>
        <PopularFan
          loading={popularLoading}
          items={popularItems}
          blurCovers={blurCovers}
          collapseSignal={popularCollapseSignal}
          onOpen={openDetail}
          onImport={enqueueGalleryId}
        />
      </div>

      <div className="discover-workspace">
        <DiscoverToolbar
          surface={surface}
          query={query}
          language={language}
          kind={kind}
          sort={sort}
          unimportedOnly={unimportedOnly}
          viewMode={viewMode}
          selectedTags={selectedTags}
          onSurface={setSurfaceAndCollapse}
          onQuery={setQueryAndCollapse}
          onLanguage={setLanguageAndCollapse}
          onKind={setKindAndCollapse}
          onSort={setSortAndCollapse}
          onUnimportedOnly={setUnimportedAndCollapse}
          onViewMode={setViewModeAndCollapse}
          onTags={setTagsAndCollapse}
          onSubmit={submitToolbar}
          onRandom={openRandom}
        />
        {boundaryNotice ? <div className="notice slim boundary-notice">{boundaryNotice}</div> : null}
        <div className="discover-stage">
          <DiscoverFeed
            items={items}
            total={total}
            page={page}
            totalPages={totalPages}
            loading={loading}
            error={error}
            notice={notice}
            viewMode={viewMode}
            blurCovers={blurCovers}
            onOpen={openDetail}
            onImport={enqueueGalleryId}
            onPickTag={pickTag}
            onPage={loadPageAndCollapse}
          />
        </div>
      </div>
    </section>
  );
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
    // Session storage is a convenience for navigation restore; ignore unavailable storage.
  }
  if (syncUrl && canReplaceDiscoverHash(window.location.hash)) {
    const nextHash = serializeDiscoverHash(state);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }
}

function currentDiscoverState(state: Omit<PersistedDiscoverState, "scrollY">): PersistedDiscoverState {
  return { ...state, scrollY: window.scrollY };
}
