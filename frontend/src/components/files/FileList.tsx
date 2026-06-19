import type { FileEntry } from "../../lib/api";
import { formatBytes, statusLabel } from "./fileHelpers";

type Props = {
  entries: FileEntry[];
  selected: Set<string>;
  focusId: string | null;
  onToggle: (id: string) => void;
  loading: boolean;
};

export function FileList({ entries, selected, focusId, onToggle, loading }: Props) {
  if (loading && entries.length === 0) {
    return <div className="files-empty">加载中…</div>;
  }
  if (entries.length === 0) {
    return <div className="files-empty">没有匹配的文件。</div>;
  }
  return (
    <ul className="files-list">
      {entries.map((entry) => {
        const name = entry.kind === "work" ? entry.title : entry.name;
        const sub = entry.kind === "work" ? entry.source_path : entry.path;
        return (
          <li
            key={entry.id}
            className={`files-row${selected.has(entry.id) ? " is-selected" : ""}${focusId === entry.id ? " is-focused" : ""}`}
            onClick={() => onToggle(entry.id)}
          >
            <input type="checkbox" checked={selected.has(entry.id)} readOnly />
            <div className="files-row-main">
              <span className="files-row-name">{name}</span>
              <span className="files-row-sub">{sub}</span>
            </div>
            <span className={`files-badge files-badge-${entry.status}`}>{statusLabel(entry.status)}</span>
            <span className="files-row-size">{formatBytes(entry.size_bytes)}</span>
          </li>
        );
      })}
    </ul>
  );
}
