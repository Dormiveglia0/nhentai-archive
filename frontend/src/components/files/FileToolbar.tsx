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
};

export function FileToolbar({ category, onCategory, query, onQuery, statusFilter, onStatus, total }: Props) {
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
      <span className="files-count">{total} 项</span>
    </div>
  );
}
