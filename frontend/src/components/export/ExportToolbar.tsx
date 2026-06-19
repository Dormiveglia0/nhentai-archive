import { Search, XCircle } from "lucide-react";

type ExportToolbarProps = {
  query: string;
  statusFilter: "all" | "ready" | "warning" | "blocked";
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (filter: "all" | "ready" | "warning" | "blocked") => void;
  onSelectReady: () => void;
  onClear: () => void;
};

const STATUS_CHIPS = [
  { value: "all", label: "全部" },
  { value: "ready", label: "就绪" },
  { value: "warning", label: "警告" },
  { value: "blocked", label: "阻塞" },
] as const;

export function ExportToolbar({
  query,
  statusFilter,
  onQueryChange,
  onStatusFilterChange,
  onSelectReady,
  onClear,
}: ExportToolbarProps) {
  return (
    <section className="export-toolbar">
      <div className="export-toolbar-head">
        <h1>导出中心</h1>
        <p>挑选作品，写入整理后的 ComicInfo，打包为 CBZ 下载到你的设备。</p>
      </div>

      <div className="export-toolbar-controls">
        <div className="export-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="搜索作品…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="export-search-input"
            aria-label="搜索作品"
          />
        </div>

        <div className="export-status-chips">
          {STATUS_CHIPS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`export-chip-button ${statusFilter === value ? "active" : ""}`}
              onClick={() => onStatusFilterChange(value)}
              aria-pressed={statusFilter === value}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="export-toolbar-actions">
          <button type="button" onClick={onSelectReady} className="export-toolbar-action">
            全选就绪
          </button>
          <button type="button" onClick={onClear} className="export-toolbar-action">
            <XCircle size={14} />
            清空
          </button>
        </div>
      </div>
    </section>
  );
}
