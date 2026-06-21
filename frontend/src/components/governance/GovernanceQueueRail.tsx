import type { GovernanceQueue, GovernanceQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { workTitle } from "../library/libraryHelpers";

type Props = {
  queue: GovernanceQueue;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function GovernanceQueueRail({ queue, selectedId, onSelect }: Props) {
  return (
    <aside className="governance-rail">
      <div className="governance-rail-head">
        <div>
          <span className="eyebrow">Queue</span>
          <h2>待编辑作品</h2>
        </div>
        <strong className="governance-rail-count">
          <NumberTicker value={queue.summary.total} />
        </strong>
      </div>
      <Stagger key={queue.result.map((item) => item.work.id).join("-")} className="governance-rail-list">
        {queue.result.map((item) => (
          <StaggerItem key={item.work.id}>
            <QueueCard item={item} selected={selectedId === item.work.id} onSelect={onSelect} />
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
}: {
  item: GovernanceQueueItem;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const hasDanger = item.reasons.some((reason) => reason.severity === "danger");
  return (
    <button
      className={`governance-rail-card${selected ? " selected" : ""}`}
      type="button"
      onClick={() => onSelect(item.work.id)}
    >
      <div className="governance-rail-card-top">
        <strong>{workTitle(item.work)}</strong>
        <span className="governance-rail-pct" data-tone={item.completeness_percent >= 100 ? "ok" : hasDanger ? "bad" : "warn"}>
          {item.completeness_percent}%
        </span>
      </div>
      <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
      <span className="governance-rail-bar" aria-hidden="true">
        <span style={{ width: `${item.completeness_percent}%` }} />
      </span>
      <span className="governance-rail-reasons">
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
  );
}
