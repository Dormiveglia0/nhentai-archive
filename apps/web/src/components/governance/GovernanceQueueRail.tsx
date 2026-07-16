import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { GovernanceQueue, GovernanceQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { workTitle } from "../../lib/format";

type Props = {
  queue: GovernanceQueue;
  selectedId: number | null;
  onSelect: (id: number) => void;
  bulkMode: boolean;
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
};

type QueueFilter = "review" | "metadata" | "dictionary" | "files" | "approved" | "all";

const DICTIONARY_REASONS = new Set(["untagged", "dictionary_unmapped", "dictionary_review", "dictionary_conflict"]);
const FILE_REASONS = new Set(["missing_source", "missing_comicinfo", "missing_cover"]);

export function GovernanceQueueRail({ queue, selectedId, onSelect, bulkMode, selectedIds, onToggleSelected }: Props) {
  const [filter, setFilter] = useState<QueueFilter>(() => (queue.summary.total ? "review" : "all"));
  const filters: Array<{ id: QueueFilter; label: string; count: number; description: string }> = [
    { id: "review", label: "待核对", count: queue.summary.total, description: "尚未人工核对，或核对后内容已经变化。" },
    { id: "metadata", label: "元数据", count: queue.summary.missing_metadata, description: "标题或语言缺失；其余字段在对照表中人工判断。" },
    { id: "dictionary", label: "词典", count: countMatching(queue, DICTIONARY_REASONS), description: "无标签、未映射、译名待复核或词典冲突。" },
    { id: "files", label: "文件", count: countMatching(queue, FILE_REASONS), description: "源 CBZ、封面或 ComicInfo.xml 不可用。" },
    { id: "approved", label: "已核对", count: queue.summary.approved, description: "人工确认过当前数据快照；后续变化会自动失效。" },
    { id: "all", label: "全部", count: queue.result.length, description: "显示全部真实作品，不代表其已经通过审核。" },
  ];
  const visibleItems = useMemo(
    () => queue.result.filter((item) => matchesFilter(item, filter)),
    [filter, queue.result]
  );

  return (
    <aside className="folio-governance-queue">
      <div className="folio-governance-queue-head">
        <div>
          <span>Queue</span>
          <h2>治理待办</h2>
        </div>
        <strong className="folio-governance-queue-count">
          <NumberTicker value={queue.summary.total} />
        </strong>
      </div>
      <div className="folio-governance-queue-filters" role="group" aria-label="按问题类型筛选治理队列">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "is-active" : ""}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </div>
      <p className="folio-governance-filter-explainer">{filters.find((item) => item.id === filter)?.description}</p>
      {visibleItems.length ? (
        <Stagger key={`${filter}-${visibleItems.map((item) => item.work.id).join("-")}`} className="folio-governance-queue-list">
          {visibleItems.map((item) => (
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
          <strong>这个分类已经处理完</strong>
          <button type="button" onClick={() => setFilter("all")}>查看全部作品</button>
        </div>
      )}
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

function countMatching(queue: GovernanceQueue, codes: Set<string>) {
  return queue.result.filter((item) => item.reasons.some((reason) => codes.has(reason.code))).length;
}

function matchesFilter(item: GovernanceQueueItem, filter: QueueFilter) {
  if (filter === "all") return true;
  if (filter === "review") return item.review.state !== "approved";
  if (filter === "approved") return item.review.state === "approved";
  if (filter === "metadata") return item.reasons.some((reason) => reason.code === "missing_metadata");
  const codes = filter === "dictionary" ? DICTIONARY_REASONS : FILE_REASONS;
  return item.reasons.some((reason) => codes.has(reason.code));
}
