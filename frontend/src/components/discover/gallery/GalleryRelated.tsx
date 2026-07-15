import { ArrowUpRight, Layers3 } from "lucide-react";

import type { GalleryDetail } from "../../../lib/api";
import { Stagger, StaggerItem } from "../../../lib/motion";
import { navigate, tagSearchHref } from "../../../lib/navigation";
import { defaultDisplayTag } from "../../folio/ui/TagScroller";
import "./GalleryRelated.css";

export function GalleryRelated({ detail, blurCovers }: { detail: GalleryDetail; blurCovers: boolean }) {
  const related = detail.related.slice(0, 5);
  if (!related.length) return null;

  function openGallery(galleryId: number) {
    navigate({
      name: "gallery",
      galleryId,
      returnTo: window.location.hash.replace(/^#/, ""),
    });
  }

  return (
    <section className="folio-gallery-related">
      <header className="folio-gallery-section-head">
        <div><Layers3 size={18} /><span><h2>相关作品</h2><p>由远端来源返回的真实关联结果。</p></span></div>
        <small>{related.length} 项</small>
      </header>
      <Stagger className="folio-gallery-related-list">
        {related.map((item) => {
          const relatedTitle = item.title_japanese || item.pretty_title || item.title;
          const contentTags = (item.tags ?? []).filter((tag) => tag.type === "tag" || tag.type === "character").slice(0, 4);
          return (
            <StaggerItem key={item.gallery_id} className="folio-gallery-related-cell">
              <article className="folio-gallery-related-card">
                <button className="folio-gallery-related-media" type="button" onClick={() => openGallery(item.gallery_id)} aria-label={`打开作品详情：${relatedTitle}`}>
                  {item.thumbnail.url ? (
                    <img className={blurCovers ? "is-blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
                  ) : <span className="folio-gallery-related-empty">NO COVER</span>}
                  <small>{item.imported ? "已入库" : `ID ${item.gallery_id}`}</small>
                </button>
                <div className="folio-gallery-related-copy">
                  <button type="button" onClick={() => openGallery(item.gallery_id)}>
                    <strong title={relatedTitle}>{relatedTitle}</strong>
                    <ArrowUpRight size={15} />
                  </button>
                  <small>{item.page_count} 页</small>
                  {contentTags.length ? (
                    <span className="folio-gallery-related-tags">
                      {contentTags.map((tag) => <a key={tag.id} href={tagSearchHref(tag)}>{defaultDisplayTag(tag)}</a>)}
                    </span>
                  ) : null}
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
