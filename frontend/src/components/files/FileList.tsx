import type { FileEntry } from "../../lib/api";
import { formatBytes, kindLabel, statusLabel, statusTone } from "./fileHelpers";

type Props = {
  entries: FileEntry[];
  selected: Set<string>;
  focusId: string | null;
  multiSelect: boolean;
  onPick: (id: string) => void;
  loading: boolean;
};

export function FileList({ entries, selected, focusId, multiSelect, onPick, loading }: Props) {
  if (loading && entries.length === 0) {
    return <div className="files-empty">读取文件清单…</div>;
  }
  if (entries.length === 0) {
    return <div className="files-empty">没有匹配的文件。</div>;
  }
  return (
    <div className="files-table" role="table">
      <div className="files-thead" role="row">
        <span aria-hidden="true" />
        <span>文件名</span>
        <span>路径</span>
        <span>类型</span>
        <span className="num">大小</span>
        <span>状态</span>
      </div>
      <ul className="files-tbody">
        {entries.map((entry) => {
          const name = entry.kind === "work" ? entry.title ?? "(无标题)" : entry.name ?? "(未命名)";
          const path = (entry.kind === "work" ? entry.source_path : entry.path) ?? "—";
          const isSelected = selected.has(entry.id);
          const tone = statusTone(entry.status);
          return (
            <li
              key={entry.id}
              role="row"
              className={`files-trow${isSelected ? " is-selected" : ""}${focusId === entry.id ? " is-focused" : ""}`}
              onClick={() => onPick(entry.id)}
            >
              <span className="files-mark">
                {multiSelect && isSelected ? (
                  <span className="files-mark-check" aria-hidden="true" />
                ) : (
                  <span className={`files-dot files-dot-${tone}`} aria-hidden="true" />
                )}
              </span>
              <span className="files-name" title={name}>{name}</span>
              <span className="files-cell-path" title={path}>{path}</span>
              <span className="files-kind">{kindLabel(entry.kind)}</span>
              <span className="num">{formatBytes(entry.size_bytes)}</span>
              <span className={`files-st files-st-${tone}`}>{statusLabel(entry.status)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
