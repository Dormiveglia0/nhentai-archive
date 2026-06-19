import { CheckSquare } from "lucide-react";

import type { ExportQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { workTitle } from "../library/libraryHelpers";
import { Cover, STATUS_LABEL, itemStatus } from "./exportHelpers";
import type { ExportItemStatus } from "./exportHelpers";

type ExportWorkListProps = {
  items: ExportQueueItem[];
  selectedIds: Set<number>;
  focusId: number | null;
  blurCovers: boolean;
  onPick: (id: number) => void;
};

const STAGGER_CAP = 12;

export function ExportWorkList({ items, selectedIds, focusId, blurCovers, onPick }: ExportWorkListProps) {
  const rows = items.map((item) => (
    <Row
      key={item.work.id}
      item={item}
      selected={selectedIds.has(item.work.id)}
      focused={focusId === item.work.id}
      blurCovers={blurCovers}
      status={itemStatus(item)}
      onPick={onPick}
    />
  ));

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="export-work-list">
      {items.length > STAGGER_CAP ? (
        <div className="export-work-list-body">{rows}</div>
      ) : (
        <Stagger key={items.map((i) => i.work.id).join("-")} className="export-work-list-body">
          {items.map((item) => (
            <StaggerItem key={item.work.id}>
              <Row
                item={item}
                selected={selectedIds.has(item.work.id)}
                focused={focusId === item.work.id}
                blurCovers={blurCovers}
                status={itemStatus(item)}
                onPick={onPick}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}

function Row({
  item,
  selected,
  focused,
  blurCovers,
  status,
  onPick,
}: {
  item: ExportQueueItem;
  selected: boolean;
  focused: boolean;
  blurCovers: boolean;
  status: ExportItemStatus;
  onPick: (id: number) => void;
}) {
  const blocked = status === "blocked";

  return (
    <div
      className={`export-work-item ${focused ? "focused" : ""} ${selected ? "selected" : ""} ${blocked ? "blocked" : ""}`}
      onClick={() => onPick(item.work.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick(item.work.id);
        }
      }}
    >
      <span className="export-item-cover-wrapper">
        <Cover workId={item.work.id} coverPath={item.work.cover_path} blurCovers={blurCovers} />
        {selected && !blocked && (
          <span className="export-item-check-badge">
            <CheckSquare size={16} />
          </span>
        )}
      </span>
      <span className="export-item-info">
        <strong>{workTitle(item.work)}</strong>
        <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
      </span>
      <span className={`export-item-status ${status}`}>{STATUS_LABEL[status]}</span>
    </div>
  );
}
