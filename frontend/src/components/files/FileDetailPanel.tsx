import type { FileEntry } from "../../lib/api";
import { formatBytes, kindLabel, statusLabel } from "./fileHelpers";

type Props = {
  focus: FileEntry | null;
  blurCovers: boolean;
};

export function FileDetailPanel({ focus, blurCovers }: Props) {
  if (!focus) {
    return <div className="files-detail files-detail-empty">选择上方任意文件查看详情。</div>;
  }

  const isWork = focus.kind === "work";
  const title = isWork ? focus.title ?? "(无标题)" : focus.name ?? "(未命名)";
  const path = (isWork ? focus.source_path : focus.path) ?? "—";
  const stats: { label: string; value: string }[] = isWork
    ? [
        { label: "占用", value: formatBytes(focus.size_bytes) },
        { label: "页数", value: String(focus.page_count ?? 0) },
        { label: "来源", value: focus.source ?? "—" },
        { label: "ID", value: focus.remote_gallery_id ? String(focus.remote_gallery_id) : "—" },
      ]
    : [
        { label: "占用", value: formatBytes(focus.size_bytes) },
        { label: "类型", value: kindLabel(focus.kind) },
        { label: "目录", value: focus.dir ?? "—" },
        { label: "状态", value: statusLabel(focus.status) },
      ];

  return (
    <div className="files-detail">
      <div className="files-detail-cover">
        {isWork && focus.cover_path ? (
          <img className={blurCovers ? "blurred" : ""} src={`/api/works/${focus.work_id}/cover`} alt="" />
        ) : (
          <span className="files-detail-noart">{isWork ? "无封面" : kindLabel(focus.kind)}</span>
        )}
      </div>
      <div className="files-detail-body">
        <p className="files-detail-kind">{kindLabel(focus.kind)} · {statusLabel(focus.status)}</p>
        <h3 className="files-detail-title">{title}</h3>
        <p className="files-detail-path" title={path}>{path}</p>
        <div className="files-detail-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
