const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "work", label: "作品" },
  { key: "orphan", label: "孤立" },
  { key: "stale", label: "临时" },
];

const STATUSES = [
  { key: "", label: "全部状态" },
  { key: "ok", label: "正常" },
  { key: "missing_source", label: "缺失源" },
  { key: "missing_cover", label: "缺失封面" },
  { key: "orphan", label: "孤立" },
  { key: "stale", label: "临时" },
];

type Props = {
  category: string;
  onCategory: (c: string) => void;
  query: string;
  onQuery: (q: string) => void;
  statusFilter: string;
  onStatus: (s: string) => void;
  total: number;
  multiSelect: boolean;
  onToggleMultiSelect: () => void;
  selectedCount: number;
  onPreviewSelected: () => void;
  onClearSelection: () => void;
};

export function FileToolbar({
  category,
  onCategory,
  query,
  onQuery,
  statusFilter,
  onStatus,
  total,
  multiSelect,
  onToggleMultiSelect,
  selectedCount,
  onPreviewSelected,
  onClearSelection,
}: Props) {
  return (
    <div className="files-toolbar">
      <div className="files-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`files-tab${category === c.key ? " is-active" : ""}`}
            onClick={() => onCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        className="files-search"
        type="search"
        placeholder="搜索标题或路径"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <select className="files-status" value={statusFilter} onChange={(e) => onStatus(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`files-multi-toggle${multiSelect ? " is-on" : ""}`}
        onClick={onToggleMultiSelect}
        aria-pressed={multiSelect}
      >
        多选{multiSelect ? "中" : ""}
      </button>
      {multiSelect ? (
        <span className="files-selbar">
          <span className="files-count">已选 {selectedCount}</span>
          <button type="button" className="files-link" onClick={onPreviewSelected} disabled={selectedCount === 0}>
            预览删除
          </button>
          <button type="button" className="files-link" onClick={onClearSelection} disabled={selectedCount === 0}>
            清空
          </button>
        </span>
      ) : (
        <span className="files-count">{total} 项</span>
      )}
    </div>
  );
}
