import type { GovernanceQueue, GovernanceQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { workTitle } from "../library/libraryHelpers";

type Props = {
  queue: GovernanceQueue;
  selectedId: number | null;
  onSelect: (id: number) => void;
  bulkMode: boolean;
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
};

export function GovernanceQueueRail({ queue, selectedId, onSelect, bulkMode, selectedIds, onToggleSelected }: Props) {
  return (
    <aside className="folio-governance-queue">
      <div className="folio-governance-queue-head">
        <div>
          <span>Queue</span>
          <h2>待编辑作品</h2>
        </div>
        <strong className="folio-governance-queue-count">
          <NumberTicker value={queue.summary.total} />
        </strong>
      </div>
      <Stagger key={queue.result.map((item) => item.work.id).join("-")} className="folio-governance-queue-list">
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
  const hasDanger = item.reasons.some((reason) => reason.severity === "danger");
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
            data-tone={item.completeness_percent >= 100 ? "ok" : hasDanger ? "bad" : "warn"}
          >
            {item.completeness_percent}%
          </span>
        </div>
        <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
        <span
          className="folio-governance-queue-progress"
          role="progressbar"
          aria-label="元数据完整度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.completeness_percent}
        >
          <span style={{ width: `${item.completeness_percent}%` }} />
        </span>
        <span className="folio-governance-queue-reasons">
          {item.reasons.length ? (
            item.reasons.slice(0, 3).map((reason) => (
              <em key={reason.code} className={reason.severity === "danger" ? "danger" : ""}>
                {reason.label}
              </em>
            ))
          ) : (
            <em className="ok">无待办</em>
          )}
        </span>
      </button>
    </article>
  );
}
