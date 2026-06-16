import { Info } from "lucide-react";

import { GallerySummary } from "../../lib/api";
import { DiscoverViewMode, TagFilter } from "./discoverTypes";
import { DiscoverCard } from "./DiscoverCard";
import { IconPager } from "./IconPager";

type Props = {
  items: GallerySummary[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  notice: string | null;
  viewMode: DiscoverViewMode;
  blurCovers: boolean;
  onOpen: (id: number) => void;
  onImport: (id: number) => void;
  onPickTag: (tag: TagFilter) => void;
  onPage: (page: number) => void;
};

export function DiscoverFeed({
  items,
  total,
  page,
  totalPages,
  loading,
  error,
  notice,
  viewMode,
  blurCovers,
  onOpen,
  onImport,
  onPickTag,
  onPage,
}: Props) {
  return (
    <section className="result-panel discover-feed-panel">
      <div className="section-title">
        <span>{loading ? "读取中" : `当前页 ${items.length} 项 / 远端 ${total}`}</span>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice slim">{notice}</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="empty-state">
          <Info size={22} />
          <strong>暂无结果</strong>
          <p>这里不会填充样例作品；调整筛选或配置 NH API Key 后重试。</p>
        </div>
      ) : null}
      <div className={viewMode === "grid" ? "discover-card-grid" : "discover-card-list"}>
        {items.map((item) => (
          <DiscoverCard
            key={item.gallery_id}
            item={item}
            blurCovers={blurCovers}
            viewMode={viewMode}
            onOpen={() => onOpen(item.gallery_id)}
            onImport={() => onImport(item.gallery_id)}
            onPickTag={onPickTag}
          />
        ))}
      </div>
      <IconPager page={page} totalPages={totalPages} loading={loading} onPage={onPage} />
    </section>
  );
}
