import { CheckCheck, Layers3, XCircle } from "lucide-react";
import { m } from "motion/react";

import { FolioSearchField } from "../folio/ui/FolioPrimitives";

type Status = "all" | "ready" | "warning" | "blocked";
const STATUS_CHIPS: { value: Status; label: string }[] = [
  { value: "all", label: "全部" }, { value: "ready", label: "就绪" }, { value: "warning", label: "警告" }, { value: "blocked", label: "阻塞" },
];

export function ExportToolbar({ query, statusFilter, onQueryChange, onStatusFilterChange, multiSelect, onToggleMultiSelect, onSelectReady, onClear }: {
  query: string; statusFilter: Status; onQueryChange: (query: string) => void; onStatusFilterChange: (filter: Status) => void;
  multiSelect: boolean; onToggleMultiSelect: () => void; onSelectReady: () => void; onClear: () => void;
}) {
  return (
    <section className="folio-export-toolbar">
      <FolioSearchField value={query} onChange={onQueryChange} placeholder="搜索作品标题或 Gallery ID" />
      <div className="folio-export-tabs" role="group" aria-label="导出状态筛选">
        {STATUS_CHIPS.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={statusFilter === value} className={statusFilter === value ? "is-active" : ""} onClick={() => onStatusFilterChange(value)}>
            {statusFilter === value ? <m.span layoutId="folio-export-tab-active" /> : null}<strong>{label}</strong>
          </button>
        ))}
      </div>
      <div className="folio-export-toolbar-actions">
        <button className={multiSelect ? "is-active" : ""} type="button" aria-pressed={multiSelect} onClick={onToggleMultiSelect}><Layers3 size={15} />{multiSelect ? "退出多选" : "批量选择"}</button>
        {multiSelect ? <><button type="button" onClick={onSelectReady}><CheckCheck size={15} />全选就绪</button><button type="button" onClick={onClear}><XCircle size={15} />清空</button></> : null}
      </div>
    </section>
  );
}
