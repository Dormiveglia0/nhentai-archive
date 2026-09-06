import { AlertTriangle, Info, Search } from "lucide-react";
import type { Ref } from "react";

import type { GallerySummary } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import type { balanceGridRows } from "../../lib/useGridColumns";
import { FolioEmptyState, FolioPanelHeading } from "../folio/ui/FolioPrimitives";
import { DiscoverCard } from "./DiscoverCard";
import type { TagFilter } from "./discoverTypes";
import { IconPager } from "../folio/ui/IconPager";

type Props = {
  gridRef: Ref<HTMLDivElement>;
  gridRows: ReturnType<typeof balanceGridRows>;
  items: GallerySummary[];
  total: number | null;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  notice: string | null;
  blurCovers: boolean;
  onOpen: (id: number) => void;
  hrefFor: (id: number) => string;
  onImport: (id: number) => void;
  onPickTag: (tag: TagFilter) => void;
  onPage: (page: number) => void;
};

export function DiscoverFeed(props: Props) {
  return (
    <section className="folio-discover-feed" aria-busy={props.loading}>
      <header className="folio-discover-feed-head">
        <FolioPanelHeading title="远端索引" description="浏览漫画，或按标签查找。" />
        <span>{props.loading ? "读取中…" : discoverCount(props.items.length, props.total)}</span>
      </header>

      {props.error ? (
        <div className="folio-discover-message is-error" role="alert"><AlertTriangle size={16} /><span>{props.error}</span></div>
      ) : null}
      {props.notice ? (
        <div className="folio-discover-message" role="status"><Info size={16} /><span>{props.notice}</span></div>
      ) : null}

      {props.loading && !props.items.length ? (
        <div className="folio-discover-loading" role="status">正在读取远端结果…</div>
      ) : null}

      {!props.loading && !props.error && props.items.length === 0 ? (
        <FolioEmptyState
          icon={Search}
          title="暂无结果"
          copy="试试其他关键词，或调整标签和筛选条件。"
        />
      ) : null}

      {props.items.length || props.loading ? (
        <div className={props.loading ? "folio-discover-results is-loading" : "folio-discover-results"}>
          <div ref={props.gridRef} className="folio-discover-grid-measure" aria-hidden="true" />
          <Stagger
            key={`${props.page}:${props.items.length}:${props.items[0]?.gallery_id ?? "none"}`}
            className="folio-discover-grid"
            style={props.gridRows.style}
          >
            {props.items.map((item, index) => (
              <StaggerItem key={item.gallery_id} className={`folio-discover-card-cell${index >= props.gridRows.tailStart ? " is-balanced-tail" : ""}`}>
                <DiscoverCard
                  item={item}
                  blurCovers={props.blurCovers}
                  onOpen={() => props.onOpen(item.gallery_id)}
                  href={props.hrefFor(item.gallery_id)}
                  onImport={() => props.onImport(item.gallery_id)}
                  onPickTag={props.onPickTag}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      ) : null}

      <IconPager className="folio-discover-pager" page={props.page} totalPages={props.totalPages} loading={props.loading} onPage={props.onPage} />
    </section>
  );
}

function discoverCount(pageCount: number, total: number | null) {
  return total === null
    ? `本页 ${pageCount} 项 · 远端未返回总量`
    : `本页 ${pageCount} 项 · 远端 ${total.toLocaleString()}`;
}
