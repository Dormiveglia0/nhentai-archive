import { useCallback, useEffect, useMemo, useState } from "react";

import { api, GalleryDetail, GallerySummary, RemoteTag } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { DiscoverFeed } from "./DiscoverFeed";
import { DiscoverToolbar } from "./DiscoverToolbar";
import { DiscoverSurface, DiscoverViewMode, GalleryPreview, TagFilter } from "./discoverTypes";
import { GalleryPreviewModal } from "./GalleryPreviewModal";
import { PopularFan } from "./PopularFan";

type Props = {
  blurCovers: boolean;
};

const PER_PAGE = 24;

export function DiscoverPage({ blurCovers }: Props) {
  const [surface, setSurface] = useState<DiscoverSurface>("feed");
  const [viewMode, setViewMode] = useState<DiscoverViewMode>("grid");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("date");
  const [unimportedOnly, setUnimportedOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagFilter[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [preview, setPreview] = useState<GalleryPreview | null>(null);
  const [popularCollapseSignal, setPopularCollapseSignal] = useState(0);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularItems, setPopularItems] = useState<GallerySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeQuery = surface === "feed" ? submittedQuery : "";
  const isBoundary = surface === "upload" || surface === "scan";
  const collapsePopular = useCallback(() => setPopularCollapseSignal((value) => value + 1), []);

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
        if (payload.reason === "min_query_length") {
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
    void loadFeed(1);
  }, [loadFeed]);

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

  async function openDetail(id: number) {
    collapsePopular();
    setLoading(true);
    setError(null);
    try {
      setPreview({ kind: "detail", detail: await api.gallery(id) });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function openPreview(id: number, kindName: GalleryPreview["kind"]) {
    collapsePopular();
    setLoading(true);
    setError(null);
    try {
      setPreview({ kind: kindName, detail: await api.gallery(id) });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function openRandom() {
    collapsePopular();
    setLoading(true);
    setError(null);
    try {
      setPreview({ kind: "random", detail: await api.random() });
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
      const id = Number(nextQuery);
      await openPreview(id, "gallery");
      return;
    }
    if (nextQuery === submittedQuery) {
      await loadFeed(1, nextQuery);
      return;
    }
    setPage(1);
    setSubmittedQuery(nextQuery);
  }

  async function importGallery(detail: GalleryDetail | null) {
    if (!detail) return;
    setLoading(true);
    setError(null);
    try {
      await api.importGallery(detail.gallery_id);
      setNotice(`Gallery ${detail.gallery_id} 已加入真实导入队列。`);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
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

  function readGallery(detail: GalleryDetail) {
    if (detail.imported && detail.work_id) {
      navigate({ name: "reader", workId: detail.work_id });
    } else {
      navigate({ name: "readerRemote", galleryId: detail.gallery_id });
    }
    setPreview(null);
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
    void loadFeed(nextPage);
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
          onOpen={(id) => openPreview(id, "gallery")}
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

      <GalleryPreviewModal
        detail={preview?.detail ?? null}
        label={previewLabel(preview?.kind)}
        blurCovers={blurCovers}
        onClose={() => setPreview(null)}
        onImport={() => importGallery(preview?.detail ?? null)}
        onRead={readGallery}
        onOpenRelated={openDetail}
      />
    </section>
  );
}

function shouldUseTagged(tags: TagFilter[], query: string, language: string, kind: string) {
  return tags.length === 1 && !query.trim() && language === "all" && kind === "all";
}

function tagQueryValue(tag: TagFilter) {
  return tag.name || tag.slug || "";
}

function previewLabel(kind: GalleryPreview["kind"] | undefined) {
  if (kind === "random") return "随机预览";
  if (kind === "detail") return "作品详情";
  return "画廊预览";
}
