import { ArrowLeft, BookOpen, Download, Heart, PenTool } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api, GalleryDetail, PageInfo } from "../../lib/api";
import { FadeIn, Stagger, StaggerItem } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { defaultDisplayTag } from "./TagScroller";

type Props = {
  galleryId: number;
  returnTo?: string;
  blurCovers: boolean;
};

// Tag types grouped into readable sections; order defines display order.
const TAG_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: "credit", label: "社团 / 作者", types: ["group", "artist"] },
  { key: "parody", label: "原作", types: ["parody"] },
  { key: "character", label: "角色", types: ["character"] },
  { key: "tag", label: "内容标签", types: ["tag"] },
  { key: "meta", label: "分类 / 语言", types: ["category", "language"] },
];

const INITIAL_PREVIEW_COUNT = 20;

type PreviewPageItem = {
  key: string;
  pageIndex: number;
  src: string;
  width?: number;
  height?: number;
  source: "local" | "remote";
};

export function GalleryDetailPage({ galleryId, returnTo, blurCovers }: Props) {
  const [detail, setDetail] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    api.gallery(galleryId)
      .then((payload) => alive && setDetail(payload))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [galleryId]);

  const goBack = () => {
    if (returnTo) {
      window.history.replaceState(null, "", `#${returnTo}`);
      window.dispatchEvent(new Event("hashchange"));
      return;
    }
    if (window.history.length > 1) window.history.back();
    else navigate({ name: "discover" });
  };

  const read = () => {
    if (!detail) return;
    if (detail.imported && detail.work_id) navigate({ name: "reader", workId: detail.work_id });
    else navigate({ name: "readerRemote", galleryId: detail.gallery_id });
  };

  const enqueue = async () => {
    if (!detail) return;
    setImporting(true);
    setError(null);
    try {
      await api.importGallery(detail.gallery_id);
      setNotice("已加入真实导入队列。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const title = detail
    ? detail.title.japanese || detail.title.pretty || detail.title.english || `Gallery ${detail.gallery_id}`
    : "";

  return (
    <section className="page gallery-detail-page">
      <div className="gallery-detail-topbar">
        <button className="gallery-back" type="button" onClick={goBack}>
          <ArrowLeft size={16} />
          返回
        </button>
      </div>

      {error ? (
        <FadeIn key={error} className="notice error" y={6}>
          {error}
        </FadeIn>
      ) : null}
      {notice ? (
        <FadeIn key={notice} className="notice success" y={6}>
          {notice}
        </FadeIn>
      ) : null}

      {loading ? <div className="page-panel">正在读取作品详情...</div> : null}

      {!loading && detail ? (
        <FadeIn key={detail.gallery_id} y={10} className="gallery-detail-body">
          <GalleryHero
            detail={detail}
            title={title}
            blurCovers={blurCovers}
            importing={importing}
            onRead={read}
            onEnqueue={() => void enqueue()}
          />
          <GalleryTags detail={detail} />
          <GalleryPagePreview detail={detail} blurCovers={blurCovers} />
          {detail.related.length ? <GalleryRelated detail={detail} blurCovers={blurCovers} /> : null}
        </FadeIn>
      ) : null}
    </section>
  );
}

// Resolves the best available cover URL, falling back through local → remote
// sources when an image fails to load. Shared by the band backdrop and the
// floating cover art so both always show the same image.
function useCoverSource(detail: GalleryDetail) {
  const coverSources = useMemo(() => {
    const sources = [
      detail.imported && detail.work_id ? `/api/works/${detail.work_id}/cover` : null,
      detail.cover?.url,
      detail.thumbnail?.url,
    ].filter((value): value is string => Boolean(value));
    return Array.from(new Set(sources));
  }, [detail.cover?.url, detail.imported, detail.thumbnail?.url, detail.work_id]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [detail.gallery_id, coverSources.join("|")]);

  return {
    src: coverSources[sourceIndex] as string | undefined,
    onError: () => setSourceIndex((index) => index + 1),
  };
}

function GalleryHero({
  detail,
  title,
  blurCovers,
  importing,
  onRead,
  onEnqueue,
}: {
  detail: GalleryDetail;
  title: string;
  blurCovers: boolean;
  importing: boolean;
  onRead: () => void;
  onEnqueue: () => void;
}) {
  const { src, onError } = useCoverSource(detail);

  return (
    <div className="gallery-hero">
      {/* One fixed-height band: the cover sits in a constant-size slot (bounded by
          height, never by aspect ratio) and the blurred same-image backdrop fills
          the rest, so portrait and landscape covers occupy identical space and the
          page skeleton never shifts between works. */}
      <div className="gallery-hero-band">
        {src ? <div className="gallery-hero-backdrop" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" /> : null}
        <div className="gallery-hero-scrim" aria-hidden="true" />
        <div className="gallery-hero-stage">
          <div className="gallery-hero-cover">
            {src ? (
              <img
                className={blurCovers ? "gallery-hero-cover-art blurred" : "gallery-hero-cover-art"}
                src={src}
                alt="封面"
                onError={onError}
              />
            ) : (
              <span>暂无封面</span>
            )}
          </div>
          <div className="gallery-hero-info">
            <span className="eyebrow">{detail.imported ? "已入库作品" : "远端作品"}</span>
            <h1 title={title}>{title}</h1>
            {detail.title.english && detail.title.english !== title ? <p className="gallery-subtitle">{detail.title.english}</p> : null}
            <dl className="gallery-facts">
              <div>
                <dt>ID</dt>
                <dd>{detail.gallery_id}</dd>
              </div>
              <div>
                <dt>页数</dt>
                <dd>{detail.page_count}P</dd>
              </div>
              <div>
                <dt>收藏</dt>
                <dd>
                  <Heart size={13} /> {detail.favorites}
                </dd>
              </div>
              <div>
                <dt>上传</dt>
                <dd>{formatUploadDate(detail.upload_date)}</dd>
              </div>
            </dl>
            <div className="gallery-actions">
              <button className="primary-action" type="button" onClick={onRead}>
                <BookOpen size={17} />
                {detail.imported ? "阅读本地" : "在线阅读"}
              </button>
              {detail.imported && detail.work_id ? (
                <button className="gallery-secondary-action" type="button" onClick={() => navigate({ name: "governance", workId: detail.work_id! })}>
                  <PenTool size={16} />
                  治理元数据
                </button>
              ) : (
                <button className="gallery-secondary-action" type="button" onClick={onEnqueue} disabled={importing}>
                  <Download size={16} />
                  {importing ? "加入中..." : "加入导入队列"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryTags({ detail }: { detail: GalleryDetail }) {
  const groups = TAG_GROUPS.map((group) => ({
    ...group,
    tags: detail.tags.filter((tag) => group.types.includes(tag.type)),
  })).filter((group) => group.tags.length);

  if (!groups.length) return null;

  return (
    <div className="gallery-inline-tags">
      <Stagger className="gallery-tag-groups">
        {groups.map((group) => (
          <StaggerItem key={group.key} className="gallery-tag-group">
            <h3>{group.label}</h3>
            <div className="gallery-tag-wrap">
              {group.tags.map((tag) => (
                <button key={tag.id} type="button" className="gallery-tag" onClick={() => navigate({ name: "discover", tag })}>
                  {defaultDisplayTag(tag)}
                </button>
              ))}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function GalleryRelated({ detail, blurCovers }: { detail: GalleryDetail; blurCovers: boolean }) {
  if (!detail.related.length) return null;

  return (
    <section className="gallery-related">
      <h2>相关作品</h2>
      <div className="gallery-related-list">
        {detail.related.map((item) => {
          const relatedTitle = item.title_japanese || item.pretty_title || item.title;
          const contentTags = (item.tags ?? []).filter((tag) => tag.type === "tag" || tag.type === "character").slice(0, 6);
          return (
            <button
              key={item.gallery_id}
              className="gallery-related-item"
              type="button"
              onClick={() => navigate({ name: "gallery", galleryId: item.gallery_id })}
            >
              {item.thumbnail.url ? (
                <img className={blurCovers ? "gallery-related-cover blurred" : "gallery-related-cover"} src={item.thumbnail.url} alt="" loading="lazy" />
              ) : (
                <span className="gallery-related-cover gallery-related-noimg">NO COVER</span>
              )}
              <span className="gallery-related-copy">
                <strong title={relatedTitle}>{relatedTitle}</strong>
                <small>{item.page_count} 页 · ID {item.gallery_id}</small>
              </span>
              {contentTags.length ? (
                <span className="gallery-related-tags">
                  {contentTags.map((tag) => (
                    <span key={tag.id} className="gallery-related-tag">{defaultDisplayTag(tag)}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GalleryPagePreview({ detail, blurCovers }: { detail: GalleryDetail; blurCovers: boolean }) {
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PREVIEW_COUNT);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isLocal = Boolean(detail.imported && detail.work_id);

  useEffect(() => {
    let alive = true;
    setVisibleCount(INITIAL_PREVIEW_COUNT);
    setActiveIndex(null);
    setError(null);
    setLocalPages([]);

    if (!isLocal || !detail.work_id) return;

    setLoading(true);
    api.pages(detail.work_id)
      .then((payload) => {
        if (alive) setLocalPages(payload.result);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [detail.gallery_id, detail.work_id, isLocal]);

  const pages = useMemo<PreviewPageItem[]>(() => {
    if (isLocal && detail.work_id) {
      return localPages.map((page) => ({
        key: `local-${page.id}`,
        pageIndex: page.page_index,
        src: `/api/works/${detail.work_id}/pages/${page.page_index}`,
        source: "local",
      }));
    }

    return (detail.pages ?? [])
      .filter((page) => Boolean(page.url))
      .map((page, index) => ({
        key: `remote-${page.index ?? index + 1}`,
        pageIndex: page.index ?? index + 1,
        src: page.url!,
        width: page.width,
        height: page.height,
        source: "remote",
      }));
  }, [detail.pages, detail.work_id, isLocal, localPages]);

  const visiblePages = pages.slice(0, visibleCount);
  const hasMore = visiblePages.length < pages.length;

  return (
    <section className="gallery-preview">
      <div className="gallery-section-head">
        <div>
          <h2>内容预览</h2>
        </div>
        <small>{pages.length ? `${visiblePages.length} / ${pages.length} 页` : `${detail.page_count || 0} 页`}</small>
      </div>

      {loading ? <div className="gallery-preview-state">正在读取本地页面...</div> : null}
      {error ? <div className="gallery-preview-state error">{error}</div> : null}
      {!loading && !error && !pages.length ? <div className="gallery-preview-state">此作品没有可预览的真实页面。</div> : null}

      {pages.length ? (
        <>
          <div className={hasMore ? "gallery-preview-frame is-collapsed" : "gallery-preview-frame"}>
            <Stagger className="gallery-preview-grid">
              {visiblePages.map((page, index) => (
                <StaggerItem key={page.key}>
                  <button type="button" onClick={() => setActiveIndex(index)}>
                    <img
                      className={blurCovers ? "blurred" : ""}
                      src={page.src}
                      alt={`第 ${page.pageIndex} 页`}
                      loading={index < 8 ? "eager" : "lazy"}
                    />
                    <span>#{page.pageIndex}</span>
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          {hasMore ? (
            <div className="gallery-preview-actions">
              <button type="button" onClick={() => setVisibleCount((count) => Math.min(count + INITIAL_PREVIEW_COUNT, pages.length))}>
                显示更多
              </button>
              <button type="button" onClick={() => setVisibleCount(pages.length)}>
                显示全部
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {activeIndex !== null ? (
        <GalleryLightbox
          pages={pages}
          activeIndex={activeIndex}
          blurCovers={blurCovers}
          onClose={() => setActiveIndex(null)}
          onSelect={setActiveIndex}
        />
      ) : null}
    </section>
  );
}

function GalleryLightbox({
  pages,
  activeIndex,
  blurCovers,
  onClose,
  onSelect,
}: {
  pages: PreviewPageItem[];
  activeIndex: number;
  blurCovers: boolean;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const page = pages[activeIndex];

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onSelect(Math.max(0, activeIndex - 1));
      if (event.key === "ArrowRight") onSelect(Math.min(pages.length - 1, activeIndex + 1));
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activeIndex, onClose, onSelect, pages.length]);

  if (!page) return null;

  return (
    <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`第 ${page.pageIndex} 页预览`}>
      <button className="gallery-lightbox-backdrop" type="button" aria-label="关闭预览" onClick={onClose} />
      <div className="gallery-lightbox-stage">
        <div className="gallery-lightbox-media">
          <img className={blurCovers ? "blurred" : ""} src={page.src} alt={`第 ${page.pageIndex} 页`} />
          <button
            className="gallery-lightbox-zone previous"
            type="button"
            disabled={activeIndex <= 0}
            onClick={() => onSelect(activeIndex - 1)}
            aria-label="上一页"
          />
          <button
            className="gallery-lightbox-zone next"
            type="button"
            disabled={activeIndex >= pages.length - 1}
            onClick={() => onSelect(activeIndex + 1)}
            aria-label="下一页"
          />
        </div>
      </div>
    </div>
  );
}

function formatUploadDate(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "未知";
  const timestamp = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).toISOString().slice(0, 10);
  }
  return String(value);
}
