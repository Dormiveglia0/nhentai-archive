import { ArrowUpRight, Layers3 } from "lucide-react";

import type { GalleryDetail } from "../../../lib/api";
import { Stagger, StaggerItem } from "../../../lib/motion";
import { navigate } from "../../../lib/navigation";
import { defaultDisplayTag } from "../TagScroller";
import "./GalleryRelated.css";

export function GalleryRelated({ detail, blurCovers }: { detail: GalleryDetail; blurCovers: boolean }) {
  if (!detail.related.length) return null;

  return (
    <section className="folio-gallery-related">
      <header className="folio-gallery-section-head">
        <div><Layers3 size={18} /><span><h2>相关作品</h2><p>由远端来源返回的真实关联结果。</p></span></div>
        <small>{detail.related.length} 项</small>
      </header>
      <Stagger className="folio-gallery-related-list">
        {detail.related.map((item) => {
          const relatedTitle = item.title_japanese || item.pretty_title || item.title;
          const contentTags = (item.tags ?? []).filter((tag) => tag.type === "tag" || tag.type === "character").slice(0, 4);
          return (
            <StaggerItem key={item.gallery_id} className="folio-gallery-related-cell">
              <button
                type="button"
                onClick={() => navigate({
                  name: "gallery",
                  galleryId: item.gallery_id,
                  returnTo: window.location.hash.replace(/^#/, ""),
                })}
              >
                <span className="folio-gallery-related-media">
                  {item.thumbnail.url ? (
                    <img className={blurCovers ? "is-blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
                  ) : <span className="folio-gallery-related-empty">NO COVER</span>}
                  <small>{item.imported ? "已入库" : `ID ${item.gallery_id}`}</small>
                </span>
                <span className="folio-gallery-related-copy">
                  <strong title={relatedTitle}>{relatedTitle}</strong>
                  <small>{item.page_count} 页</small>
                  {contentTags.length ? (
                    <span className="folio-gallery-related-tags">
                      {contentTags.map((tag) => <span key={tag.id}>{defaultDisplayTag(tag)}</span>)}
                    </span>
                  ) : null}
                </span>
                <ArrowUpRight className="folio-gallery-related-open" size={16} />
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
