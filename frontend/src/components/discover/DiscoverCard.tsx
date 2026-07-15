import { BookOpen, Download } from "lucide-react";

import type { GallerySummary, RemoteTag } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import type { TagFilter } from "./discoverTypes";
import { defaultDisplayTag, TagScroller } from "./TagScroller";

type Props = {
  item: GallerySummary;
  blurCovers: boolean;
  onOpen: () => void;
  onImport: () => void;
  onPickTag: (tag: TagFilter) => void;
};

export function DiscoverCard({ item, blurCovers, onOpen, onImport, onPickTag }: Props) {
  const tags = item.tags ?? [];
  const author = tagName(tags, "artist") || tagName(tags, "group") || "作者未缓存";
  const language = languageLabel(tags);
  const category = tagName(tags, "category") || "远端作品";
  const contentTags = tags.filter((tag) => tag.type === "tag" || tag.type === "character");
  const title = item.title_japanese || item.pretty_title || item.title || `Gallery ${item.gallery_id}`;

  return (
    <article className="folio-discover-card">
      <button type="button" className="folio-discover-cover" onClick={onOpen} aria-label={`打开作品详情：${title}`}>
        {item.thumbnail.url ? (
          <img className={blurCovers ? "folio-media-blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
        ) : (
          <span className="folio-cover-fallback">NO COVER</span>
        )}
        <span className={item.imported ? "folio-discover-status is-imported" : "folio-discover-status"}>
          {item.imported ? "已入库" : "未入库"}
        </span>
      </button>

      <div className="folio-discover-card-body">
        <div className="folio-discover-card-meta"><span>{category}</span><em>{language}</em></div>
        <button type="button" className="folio-discover-card-title" onClick={onOpen}>{title}</button>
        <p title={author}>{author}</p>
        <small>{item.page_count} 页 · Gallery {item.gallery_id}</small>
        <TagScroller className="folio-discover-card-tags" tags={contentTags} onPickTag={(tag) => onPickTag(tag)} />

        {item.imported && item.work_id ? (
          <button type="button" className="folio-discover-card-action" onClick={() => navigate({ name: "reader", workId: item.work_id! })}>
            <BookOpen size={15} />打开本地
          </button>
        ) : (
          <button type="button" className="folio-discover-card-action" onClick={onImport}>
            <Download size={15} />加入队列
          </button>
        )}
      </div>
    </article>
  );
}

function tagName(tags: RemoteTag[], type: string) {
  const tag = tags.find((item) => item.type === type);
  return tag ? defaultDisplayTag(tag) : "";
}

function languageLabel(tags: RemoteTag[]) {
  const language = tags.find((tag) => tag.type === "language" && !isTranslatedTag(tag));
  return language ? defaultDisplayTag(language) : "语言未缓存";
}

function isTranslatedTag(tag: RemoteTag) {
  return `${tag.name ?? ""} ${tag.slug ?? ""}`.toLowerCase().includes("translated");
}
