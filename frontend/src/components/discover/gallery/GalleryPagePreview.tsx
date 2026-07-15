import { Expand, Images } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, type GalleryDetail, type PageInfo } from "../../../lib/api";
import { Stagger, StaggerItem } from "../../../lib/motion";
import { GalleryLightbox } from "./GalleryLightbox";
import { INITIAL_PREVIEW_COUNT, type PreviewPageItem } from "./galleryDetailModel";
import "./GalleryPagePreview.css";

export function GalleryPagePreview({ detail, blurCovers }: { detail: GalleryDetail; blurCovers: boolean }) {
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PREVIEW_COUNT);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const requestId = useRef(0);
  const isLocal = Boolean(detail.imported && detail.work_id);

  useEffect(() => {
    const request = ++requestId.current;
    setVisibleCount(INITIAL_PREVIEW_COUNT);
    setActiveIndex(null);
    setError(null);
    setLocalPages([]);

    if (!isLocal || !detail.work_id) {
      setLoading(false);
      return () => { requestId.current += 1; };
    }

    setLoading(true);
    api.pages(detail.work_id)
      .then((payload) => {
        if (request === requestId.current) setLocalPages(payload.result);
      })
      .catch((reason: Error) => {
        if (request === requestId.current) setError(reason.message);
      })
      .finally(() => {
        if (request === requestId.current) setLoading(false);
      });
    return () => { requestId.current += 1; };
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
    return (detail.pages ?? []).filter((page) => Boolean(page.url)).map((page, index) => ({
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
    <section className="folio-gallery-preview">
      <header className="folio-gallery-section-head">
        <div><Images size={18} /><span><h2>页面预览</h2><p>{isLocal ? "读取本地归档中的真实页面。" : "读取远端来源提供的真实页面。"}</p></span></div>
        <small>{pages.length ? `${visiblePages.length} / ${pages.length} 页` : `${detail.page_count || 0} 页`}</small>
      </header>

      {loading ? <div className="folio-gallery-preview-loading" role="status" aria-label="正在读取本地页面"><i /><i /><i /><i /></div> : null}
      {error ? <div className="folio-gallery-preview-state is-error" role="alert">{error}</div> : null}
      {!loading && !error && !pages.length ? <div className="folio-gallery-preview-state">此作品没有可预览的真实页面。</div> : null}

      {pages.length ? (
        <>
          <m.div layout className={`folio-gallery-preview-frame${hasMore ? " is-collapsed" : ""}`}>
            <Stagger className="folio-gallery-preview-grid">
              {visiblePages.map((page, index) => (
                <StaggerItem key={page.key} className="folio-gallery-preview-cell">
                  <button type="button" onClick={() => setActiveIndex(index)}>
                    <img className={blurCovers ? "is-blurred" : ""} src={page.src} alt={`第 ${page.pageIndex} 页`} loading={index < 6 ? "eager" : "lazy"} />
                    <span>#{String(page.pageIndex).padStart(3, "0")}</span>
                    <Expand size={15} />
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          </m.div>
          {hasMore ? (
            <div className="folio-gallery-preview-actions">
              <button type="button" onClick={() => setVisibleCount((count) => Math.min(count + INITIAL_PREVIEW_COUNT, pages.length))}>再显示 {Math.min(INITIAL_PREVIEW_COUNT, pages.length - visiblePages.length)} 页</button>
              <button type="button" onClick={() => setVisibleCount(pages.length)}>显示全部</button>
            </div>
          ) : null}
        </>
      ) : null}

      <AnimatePresence>
        {activeIndex !== null ? (
          <GalleryLightbox
            key="gallery-lightbox"
            pages={pages}
            activeIndex={activeIndex}
            blurCovers={blurCovers}
            onClose={() => setActiveIndex(null)}
            onSelect={setActiveIndex}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
