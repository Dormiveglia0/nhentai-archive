import { BookOpen, CalendarDays, Download, Hash, Heart, Images, LoaderCircle, PenTool } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import type { GalleryDetail } from "../../../lib/api";
import { duration, ease, usePrefersReducedMotion } from "../../../lib/motion";
import { navigate } from "../../../lib/navigation";
import { formatUploadDate } from "./galleryDetailModel";
import "./GalleryHero.css";

function useCoverSource(detail: GalleryDetail) {
  const coverSources = useMemo(() => Array.from(new Set([
    detail.imported && detail.work_id ? `/api/works/${detail.work_id}/cover` : null,
    detail.cover?.url,
    detail.thumbnail?.url,
  ].filter((value): value is string => Boolean(value)))), [detail.cover?.url, detail.imported, detail.thumbnail?.url, detail.work_id]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => setSourceIndex(0), [coverSources, detail.gallery_id]);

  return {
    src: coverSources[sourceIndex],
    onError: () => setSourceIndex((index) => Math.min(index + 1, coverSources.length)),
  };
}

export function GalleryHero({
  detail,
  title,
  blurCovers,
  importing,
  queued,
  onRead,
  onEnqueue,
}: {
  detail: GalleryDetail;
  title: string;
  blurCovers: boolean;
  importing: boolean;
  queued: boolean;
  onRead: () => void;
  onEnqueue: () => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const { src, onError } = useCoverSource(detail);

  return (
    <section className={`folio-gallery-hero${blurCovers ? " is-private" : ""}`}>
      {src ? <div className="folio-gallery-hero-image" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" /> : null}
      <div className="folio-gallery-hero-paper" aria-hidden="true"><i /><i /><i /></div>
      <div className="folio-gallery-hero-stage">
        <m.div
          className="folio-gallery-cover-stage"
          initial={{ opacity: 0, x: reduceMotion ? 0 : -26, rotate: reduceMotion ? 0 : -1.4 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: duration.slow, ease: ease.standard }}
        >
          <span className="folio-gallery-cover-register" aria-hidden="true"><i /><i /><i /><i /></span>
          <div className="folio-gallery-cover-slot">
            {src ? (
              <img className={blurCovers ? "is-blurred" : ""} src={src} alt="作品封面" onError={onError} />
            ) : (
              <span className="folio-gallery-cover-empty">暂无封面</span>
            )}
            <span className="folio-gallery-cover-scan" aria-hidden="true" />
          </div>
        </m.div>

        <m.div
          className="folio-gallery-hero-copy"
          initial={{ opacity: 0, x: reduceMotion ? 0 : 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: duration.slow, ease: ease.standard, delay: reduceMotion ? 0 : 0.08 }}
        >
          <div className="folio-gallery-kicker">
            <span>{detail.imported ? "本地馆藏" : "远端档案"}</span>
            <i />
            <small>Gallery {detail.gallery_id}</small>
          </div>
          <h1 title={title}>{title}</h1>
          {detail.title.english && detail.title.english !== title ? <p>{detail.title.english}</p> : null}

          <dl className="folio-gallery-facts">
            <div><dt><Hash size={14} />编号</dt><dd>{detail.gallery_id}</dd></div>
            <div><dt><Images size={14} />页数</dt><dd>{detail.page_count.toLocaleString()}</dd></div>
            <div><dt><Heart size={14} />收藏</dt><dd>{detail.favorites.toLocaleString()}</dd></div>
            <div><dt><CalendarDays size={14} />上传</dt><dd>{formatUploadDate(detail.upload_date)}</dd></div>
          </dl>

          <div className="folio-gallery-actions">
            <button className="is-primary" type="button" onClick={onRead}>
              <BookOpen size={17} />
              <span>{detail.imported ? "阅读本地" : "在线阅读"}</span>
            </button>
            {detail.imported && detail.work_id ? (
              <button type="button" onClick={() => navigate({ name: "governance", workId: detail.work_id! })}>
                <PenTool size={16} />
                <span>治理元数据</span>
              </button>
            ) : (
              <button type="button" onClick={onEnqueue} disabled={importing || queued} aria-busy={importing}>
                {importing ? <LoaderCircle className="folio-gallery-spinner" size={16} /> : <Download size={16} />}
                <span>{queued ? "已加入队列" : importing ? "正在加入" : "加入导入队列"}</span>
              </button>
            )}
          </div>
        </m.div>
      </div>
    </section>
  );
}
