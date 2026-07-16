import { AlertTriangle, ArrowLeft, Check, RotateCw } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

import { FadeIn } from "../../lib/motion";
import { GalleryHero } from "./gallery/GalleryHero";
import { GalleryPagePreview } from "./gallery/GalleryPagePreview";
import { GalleryRelated } from "./gallery/GalleryRelated";
import { GalleryTags } from "./gallery/GalleryTags";
import { useGalleryDetail } from "./gallery/useGalleryDetail";
import "./gallery/GalleryDetailPage.css";

type Props = {
  galleryId: number;
  returnTo?: string;
  blurCovers: boolean;
};

export function GalleryDetailPage({ galleryId, returnTo, blurCovers }: Props) {
  const gallery = useGalleryDetail(galleryId, returnTo);
  const backLabel = returnTo?.startsWith("reader/")
    ? "返回阅读器"
    : returnTo === "files"
      ? "返回文件管理"
      : returnTo
        ? "返回搜索结果"
        : "返回发现";

  return (
    <section className="folio-page-body folio-gallery-page">
      <header className="folio-gallery-context">
        <button type="button" onClick={gallery.goBack}>
          <ArrowLeft size={15} />
          {backLabel}
        </button>
        <span>作品档案 · 真实来源</span>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {gallery.error ? (
          <m.div key={gallery.error} className="folio-gallery-feedback is-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <AlertTriangle size={16} />
            <span>{gallery.error}</span>
            {!gallery.detail ? <button type="button" onClick={gallery.reload}><RotateCw size={14} />重新读取</button> : null}
          </m.div>
        ) : gallery.notice ? (
          <m.div key={gallery.notice} className="folio-gallery-feedback is-success" role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <Check size={16} />
            <span>{gallery.notice}</span>
          </m.div>
        ) : null}
      </AnimatePresence>

      {gallery.loading ? (
        <div className="folio-gallery-loading" role="status" aria-label="正在读取作品详情">
          <i className="folio-gallery-loading-cover" />
          <span><i /><i /><i /><i /></span>
        </div>
      ) : null}

      {!gallery.loading && gallery.detail ? (
        <FadeIn key={gallery.detail.gallery_id} y={12} className="folio-gallery-detail">
          <GalleryHero
            detail={gallery.detail}
            title={gallery.title}
            blurCovers={blurCovers}
            importing={gallery.importing}
            queued={gallery.queued}
            onRead={gallery.read}
            onEnqueue={() => void gallery.enqueue()}
          />
          <GalleryTags detail={gallery.detail} />
          <GalleryPagePreview detail={gallery.detail} blurCovers={blurCovers} />
          <GalleryRelated detail={gallery.detail} blurCovers={blurCovers} />
        </FadeIn>
      ) : null}
    </section>
  );
}
