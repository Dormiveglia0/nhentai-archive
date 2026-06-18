import { BookOpen, Download } from "lucide-react";

import { GallerySummary, RemoteTag } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { DiscoverViewMode, TagFilter } from "./discoverTypes";
import { TagScroller } from "./TagScroller";

type Props = {
  item: GallerySummary;
  blurCovers: boolean;
  viewMode: DiscoverViewMode;
  onOpen: () => void;
  onImport: () => void;
  onPickTag: (tag: TagFilter) => void;
};

export function DiscoverCard({ item, blurCovers, viewMode, onOpen, onImport, onPickTag }: Props) {
  const tags = item.tags ?? [];
  const author = tagName(tags, "artist") || tagName(tags, "group") || "作者未缓存";
  const language = tagName(tags, "language") || "语言未缓存";
  // The card already surfaces author/language/category elsewhere; the tag row should only
  // carry real content tags, not meta types like category (doujinshi) or parody (original).
  const contentTags = tags.filter((tag) => tag.type === "tag" || tag.type === "character");
  const title = item.title_japanese || item.pretty_title || item.title || `Gallery ${item.gallery_id}`;

  return (
    <article className={viewMode === "grid" ? "discover-card" : "discover-card list-card"}>
      <button type="button" className="discover-cover" onClick={onOpen}>
        {item.thumbnail.url ? (
          <img className={blurCovers ? "blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
        ) : (
          <span className="cover-fallback">NO COVER</span>
        )}
        <span className={item.imported ? "status-pill imported" : "status-pill"}>{item.imported ? "已入库" : "未入库"}</span>
      </button>
      <div className="discover-card-body" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
        <div className="card-meta">
          <span>R-18</span>
          <em>{language}</em>
        </div>
        <h3 title={title}>{title}</h3>
        <p title={author}>{author}</p>
        <small>
          {item.page_count} 页 · ID {item.gallery_id}
        </small>
        <TagScroller tags={contentTags} onPickTag={(tag) => onPickTag(tag)} />
        <div className="card-actions">
          {item.imported && item.work_id ? (
            <button type="button" onClick={() => navigate({ name: "reader", workId: item.work_id! })}>
              <BookOpen size={15} />
              打开本地
            </button>
          ) : (
            <button type="button" onClick={(event) => {
              event.stopPropagation();
              onImport();
            }}>
              <Download size={15} />
              加入队列
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function tagName(tags: RemoteTag[], type: string) {
  return tags.find((tag) => tag.type === type)?.name;
}
