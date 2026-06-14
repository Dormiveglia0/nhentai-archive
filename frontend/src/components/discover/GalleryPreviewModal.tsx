import { BookOpen, Download, X } from "lucide-react";
import { useEffect } from "react";

import { GalleryDetail } from "../../lib/api";
import { TagScroller } from "./TagScroller";

type Props = {
  detail: GalleryDetail | null;
  blurCovers: boolean;
  label: string;
  onClose: () => void;
  onImport: () => void;
  onRead: (detail: GalleryDetail) => void;
  onOpenRelated: (id: number) => void;
};

export function GalleryPreviewModal({ detail, blurCovers, label, onClose, onImport, onRead, onOpenRelated }: Props) {
  useEffect(() => {
    if (!detail) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onClose]);

  if (!detail) return null;
  const title = detail.title.japanese || detail.title.pretty || detail.title.english || `Gallery ${detail.gallery_id}`;

  return (
    <div className="preview-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <article className="preview-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭预览">
          <X size={18} />
        </button>
        <div className="preview-cover">
          {detail.thumbnail?.url ? <img className={blurCovers ? "blurred" : ""} src={detail.thumbnail.url} alt="" /> : null}
        </div>
        <div className="preview-body">
          <span className="modal-label">{label}</span>
          <h2>{title}</h2>
          <p>{detail.title.english || detail.title.pretty}</p>
          <dl>
            <div>
              <dt>Gallery ID</dt>
              <dd>{detail.gallery_id}</dd>
            </div>
            <div>
              <dt>页数</dt>
              <dd>{detail.page_count}</dd>
            </div>
            <div>
              <dt>收藏</dt>
              <dd>{detail.favorites}</dd>
            </div>
          </dl>
          <TagScroller tags={detail.tags} />
          {detail.related.length ? (
            <div className="modal-related">
              {detail.related.slice(0, 6).map((item) => (
                <button key={item.gallery_id} type="button" onClick={() => onOpenRelated(item.gallery_id)}>
                  {item.thumbnail.url ? <img className={blurCovers ? "blurred" : ""} src={item.thumbnail.url} alt="" /> : <span />}
                  <small>{item.title_japanese || item.pretty_title || item.title}</small>
                </button>
              ))}
            </div>
          ) : null}
          <div className="modal-actions">
            <button className="primary-action" type="button" onClick={() => onRead(detail)}>
              <BookOpen size={17} />
              阅读
            </button>
            <button className="secondary-wide" type="button" onClick={onImport}>
              <Download size={17} />
              加入导入队列
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
