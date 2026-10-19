import { CheckCircle2, Search } from "lucide-react";
import { useEffect, useState } from "react";

import type { GovernanceQueue, GovernanceQueueFilter, GovernanceQueueItem } from "../../lib/api";
import { SlidingIndicator, Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { workTitle } from "../../lib/format";
import { IconPager } from "../folio/ui/IconPager";

type Props = {
  queue: GovernanceQueue;
  selectedId: number | null;
  onSelect: (id: number) => void;
  bulkMode: boolean;
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
  filters: { q: string; status: GovernanceQueueFilter; page: number };
  onChange: (next: Partial<Props["filters"]>) => void;
  loading: boolean;
};

export function GovernanceQueueRail({ queue, selectedId, onSelect, bulkMode, selectedIds, onToggleSelected, filters, onChange, loading }: Props) {
  const [draft, setDraft] = useState(filters.q);
  useEffect(() => setDraft(filters.q), [filters.q]);
  const options: Array<{ id: GovernanceQueueFilter; label: string }> = [
    { id: "review", label: "待核对" },
    { id: "metadata", label: "元数据" },
    { id: "dictionary", label: "词典" },
    { id: "files", label: "文件" },
    { id: "approved", label: "已核对" },
    { id: "all", label: "全部" },
  ];

  return (
    <aside className="folio-governance-queue" aria-busy={loading}>
      <div className="folio-governance-queue-head">
        <div>
          <h2>待处理作品</h2>
        </div>
        <strong className="folio-governance-queue-count">
          <NumberTicker value={queue.summary.total} />
        </strong>
      </div>
      <form className="folio-governance-search" role="search" onSubmit={event => { event.preventDefault(); onChange({ q: draft.trim() }); }}>
        <input type="search" aria-label="搜索整理作品" placeholder="作品、作者或文件名" value={draft} onChange={event => setDraft(event.target.value)} maxLength={240} />
        <button type="submit" aria-label="搜索" disabled={loading}><Search size={17} /></button>
      </form>
      <div className="folio-governance-queue-filters" role="group" aria-label="按问题类型筛选整理队列">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filters.status === item.id ? "is-active" : ""}
            aria-pressed={filters.status === item.id}
            disabled={loading}
            onClick={() => onChange({ status: item.id })}
          >
            {filters.status === item.id ? <SlidingIndicator className="folio-governance-filter-active" layoutId="governance-queue-filter" /> : null}
            <span>{item.label}</span>
            <strong>{queue.counts[item.id]}</strong>
          </button>
        ))}
      </div>
      {queue.result.length ? (
        <Stagger key={`${filters.status}-${queue.page}-${queue.result.map((item) => item.work.id).join("-")}`} className="folio-governance-queue-list">
          {queue.result.map((item) => (
            <StaggerItem key={item.work.id}>
              <QueueCard
                item={item}
                selected={selectedId === item.work.id}
                onSelect={onSelect}
                bulkMode={bulkMode}
                checked={selectedIds.has(item.work.id)}
                onToggleSelected={onToggleSelected}
              />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <div className="folio-governance-queue-clear">
          <CheckCircle2 size={20} />
          <strong>{loading ? "正在读取作品…" : filters.q ? "没有匹配的作品" : "这个分类已经处理完"}</strong>
          <button type="button" disabled={loading} onClick={() => { setDraft(""); onChange({ status: "all", q: "" }); }}>查看全部作品</button>
        </div>
      )}
      <IconPager className="folio-governance-pager" page={queue.page} totalPages={Math.max(1, Math.ceil(queue.total / queue.per_page))} loading={loading} onPage={page => onChange({ page })} />
    </aside>
  );
}

function QueueCard({
  item,
  selected,
  onSelect,
  bulkMode,
  checked,
  onToggleSelected,
}: {
  item: GovernanceQueueItem;
  selected: boolean;
  onSelect: (id: number) => void;
  bulkMode: boolean;
  checked: boolean;
  onToggleSelected: (id: number) => void;
}) {
  const reviewState = item.review.state;
  const status = reviewState === "approved" ? "已人工核对" : reviewState === "stale" ? "内容变化" : "待人工核对";
  return (
    <article className={`folio-governance-queue-card${selected ? " is-selected" : ""}`}>
      {bulkMode ? (
        <label className="folio-governance-queue-check" onClick={(event) => event.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={() => onToggleSelected(item.work.id)} aria-label={`选择作品 ${workTitle(item.work)}`} />
          <i aria-hidden="true" />
        </label>
      ) : null}
      <button className="folio-governance-queue-card-body" type="button" onClick={() => onSelect(item.work.id)}>
        <div className="folio-governance-queue-card-top">
          <strong>{workTitle(item.work)}</strong>
          <span
            className="folio-governance-queue-percent"
            data-tone={reviewState === "approved" ? "ok" : reviewState === "stale" ? "bad" : "warn"}
          >
            {status}
          </span>
        </div>
        <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
        {item.reasons.length ? (
          <span className="folio-governance-queue-reasons">
            {item.reasons.slice(0, 3).map((reason) => (
              <em key={reason.code} className={reason.severity === "danger" ? "danger" : ""}>
                {reason.label}
              </em>
            ))}
          </span>
        ) : <span className="folio-governance-queue-system-pass"><CheckCircle2 size={13} />系统检查无提示</span>}
      </button>
    </article>
  );
}
