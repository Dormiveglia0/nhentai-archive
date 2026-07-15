import { CheckSquare } from "lucide-react";

import type { ExportQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { workTitle } from "../../lib/format";
import { Cover, STATUS_LABEL, itemStatus } from "./exportHelpers";
import type { ExportItemStatus } from "./exportHelpers";

type ExportWorkListProps = {
  items: ExportQueueItem[];
  selectedIds: Set<number>;
  focusId: number | null;
  multiSelect: boolean;
  blurCovers: boolean;
  onPick: (id: number) => void;
};

const STAGGER_CAP = 12;

export function ExportWorkList({ items, selectedIds, focusId, multiSelect, blurCovers, onPick }: ExportWorkListProps) {
  const rows = items.map((item) => (
    <Row
      key={item.work.id}
      item={item}
      selected={multiSelect && selectedIds.has(item.work.id)}
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
    <section className="folio-export-work-list">
      {items.length > STAGGER_CAP ? (
        <div className="folio-export-work-list-body">{rows}</div>
      ) : (
        <Stagger key={items.map((i) => i.work.id).join("-")} className="folio-export-work-list-body">
          {items.map((item) => (
            <StaggerItem key={item.work.id}>
              <Row
                item={item}
                selected={multiSelect && selectedIds.has(item.work.id)}
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
    <button
      type="button"
      className={`folio-export-work-item${focused ? " is-focused" : ""}${selected ? " is-selected" : ""}${blocked ? " is-blocked" : ""}`}
      onClick={() => onPick(item.work.id)}
      aria-pressed={selected}
    >
      <span className="folio-export-item-cover">
        <Cover workId={item.work.id} coverPath={item.work.cover_path} blurCovers={blurCovers} />
        {selected && !blocked && (
          <span className="folio-export-item-check">
            <CheckSquare size={16} />
          </span>
        )}
      </span>
      <span className="folio-export-item-info">
        <strong>{workTitle(item.work)}</strong>
        <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
      </span>
      <span className={`folio-export-item-status is-${status}`}>{STATUS_LABEL[status]}</span>
    </button>
  );
}
