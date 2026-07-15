import { Check, FolderOpen, LoaderCircle } from "lucide-react";

import type { FileEntry } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { entryStatusLabel, entryStatusTone, formatBytes, kindLabel } from "./fileHelpers";

type Props = {
  entries: FileEntry[];
  selected: Set<string>;
  focusId: string | null;
  onPick: (id: string) => void;
  onToggle: (id: string) => void;
  loading: boolean;
};

export function FileList({ entries, selected, focusId, onPick, onToggle, loading }: Props) {
  return (
    <section className={"folio-files-inventory" + (loading ? " is-loading" : "")} aria-busy={loading}>
      <header className="folio-files-list-head" aria-hidden="true">
        <span>选择</span>
        <span>文件 / 受管路径</span>
        <span>类型</span>
        <span>体积</span>
        <span>状态</span>
      </header>

      {loading && entries.length === 0 ? (
        <FolioEmptyState icon={LoaderCircle} title="正在读取文件清单" copy="正在核对数据库索引与受管目录。" />
      ) : entries.length === 0 ? (
        <FolioEmptyState icon={FolderOpen} title="没有匹配的文件" copy="调整分类、状态或搜索条件后重试。" />
      ) : (
        <Stagger key={entries.map((entry) => entry.id).join("-")} className="folio-files-list">
          {entries.map((entry) => {
            const name = entry.kind === "work" ? entry.title ?? "(无标题)" : entry.name ?? "(未命名)";
            const path = (entry.kind === "work" ? entry.source_path : entry.path) ?? "—";
            const isSelected = selected.has(entry.id);
            const tone = entryStatusTone(entry);

            return (
              <StaggerItem key={entry.id} className="folio-files-row-wrap">
                <div
                  className={
                    "folio-files-row" +
                    (isSelected ? " is-selected" : "") +
                    (focusId === entry.id ? " is-focused" : "")
                  }
                >
                  <button
                    type="button"
                    className="folio-files-select"
                    aria-label={`${isSelected ? "取消选择" : "选择"} ${name}`}
                    aria-pressed={isSelected}
                    onClick={() => onToggle(entry.id)}
                  >
                    <span className={"folio-files-mark is-" + tone} aria-hidden="true">
                      <span className="folio-files-check">{isSelected ? <Check size={11} /> : null}</span>
                    </span>
                  </button>
                  <button type="button" className="folio-files-row-main" onClick={() => onPick(entry.id)}>
                    <span className="folio-files-file">
                      <strong title={name}>{name}</strong>
                      <small title={path}>{path}</small>
                    </span>
                    <span className="folio-files-kind">{kindLabel(entry.kind)}</span>
                    <span className="folio-files-size">{formatBytes(entry.size_bytes)}</span>
                    <span className={"folio-files-status is-" + tone}>{entryStatusLabel(entry)}</span>
                  </button>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </section>
  );
}
