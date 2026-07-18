import { Check, Download, Flame, Heart } from "lucide-react";
import { Fragment, type CSSProperties } from "react";

import type { GallerySummary } from "../../lib/api";
import { AmbientCover } from "../folio/ui/AmbientCover";

type Props = {
  loading: boolean;
  items: GallerySummary[];
  blurCovers: boolean;
  onOpen: (id: number) => void;
  hrefFor: (id: number) => string;
  onImport: (id: number) => void;
};

export function PopularFan({ loading, items, blurCovers, onOpen, hrefFor, onImport }: Props) {
  const visibleItems = items.slice(0, 5);

  if (!loading && visibleItems.length === 0) return null;

  return (
    <section className="folio-discover-popular" aria-label="今日热门">
      <header className="folio-discover-popular-title">
        <span className="folio-discover-popular-mark" aria-hidden="true"><Flame size={16} /></span>
        <span><small>Trending now</small><strong>今日热门</strong></span>
        <em>{loading ? "LIVE / 读取中" : `TOP / ${String(visibleItems.length).padStart(2, "0")}`}</em>
      </header>

      {loading && !visibleItems.length ? (
        <div className="folio-discover-popular-loading" role="status">正在读取真实热门作品…</div>
      ) : (
        <div className="folio-discover-popular-track" role="list">
          {visibleItems.map((item, index) => {
            const title = item.title_japanese || item.pretty_title || item.title || `Gallery ${item.gallery_id}`;
            const coverRatio = item.thumbnail.width && item.thumbnail.height
              ? item.thumbnail.width / item.thumbnail.height
              : 3 / 4;
            return (
              <Fragment key={item.gallery_id}>
                {index === 2 ? <span className="folio-discover-popular-break" aria-hidden="true" /> : null}
                <article
                  className="folio-discover-popular-card"
                  role="listitem"
                  style={{
                    "--popular-ratio": coverRatio,
                    "--popular-mobile-width": `${Math.min(118, Math.max(78, coverRatio * 112))}px`,
                  } as CSSProperties}
                >
                  <a
                    href={hrefFor(item.gallery_id)}
                    className="folio-discover-popular-open"
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onOpen(item.gallery_id);
                    }}
                    aria-label={`打开作品详情：${title}`}
                  >
                    <span className="folio-discover-popular-media">
                      {item.thumbnail.url ? (
                        <AmbientCover
                          className="folio-discover-popular-artwork"
                          src={item.thumbnail.url}
                          alt=""
                          privateBlur={blurCovers}
                          loading="lazy"
                        />
                      ) : (
                        <span className="folio-cover-fallback">NO COVER</span>
                      )}
                      <b>{String(index + 1).padStart(2, "0")}</b>
                    </span>
                    <span className="folio-discover-popular-copy">
                      <strong>{title}</strong>
                      <span>
                        <em>{item.page_count} 页</em>
                        <em><Heart size={12} />{item.favorites.toLocaleString()}</em>
                      </span>
                    </span>
                  </a>

                  {item.imported ? (
                    <span className="folio-discover-popular-import is-imported" aria-label="已入库"><Check size={13} /><span>已入库</span></span>
                  ) : (
                    <button
                      type="button"
                      className="folio-discover-popular-import"
                      onClick={() => onImport(item.gallery_id)}
                      aria-label={`快捷导入：${title}`}
                    >
                      <Download size={13} /><span>快捷导入</span>
                    </button>
                  )}
                </article>
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
