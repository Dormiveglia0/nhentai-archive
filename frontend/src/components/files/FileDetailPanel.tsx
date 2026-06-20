import type { FileEntry } from "../../lib/api";
import { formatBytes, kindLabel, statusLabel } from "./fileHelpers";

type Props = {
  focus: FileEntry | null;
  blurCovers: boolean;
  busy: boolean;
  onDelete: (entry: FileEntry) => void;
};

function shortTime(value?: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export function FileDetailPanel({ focus, blurCovers, busy, onDelete }: Props) {
  if (!focus) {
    return <div className="files-detail files-detail-empty">选择上方任意文件查看详情。</div>;
  }

  const isWork = focus.kind === "work";
  const title = isWork ? focus.title ?? "(无标题)" : focus.name ?? "(未命名)";
  const path = (isWork ? focus.source_path : focus.path) ?? "—";
  const fields: { label: string; value: string }[] = isWork
    ? [
        { label: "文件大小", value: formatBytes(focus.size_bytes) },
        { label: "文件数", value: String(focus.page_count ?? 0) },
        { label: "修改时间", value: shortTime(focus.updated_at) },
        { label: "来源", value: focus.source ?? "—" },
        { label: "关联 ID", value: focus.remote_gallery_id ? String(focus.remote_gallery_id) : "—" },
      ]
    : [
        { label: "文件大小", value: formatBytes(focus.size_bytes) },
        { label: "类型", value: kindLabel(focus.kind) },
        { label: "目录", value: focus.dir ?? "—" },
        { label: "状态", value: statusLabel(focus.status) },
      ];
  const tags = focus.tags ?? [];

  const copyPath = () => {
    if (path && path !== "—") navigator.clipboard?.writeText(path).catch(() => {});
  };

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
        <p className="files-detail-kind">
          {kindLabel(focus.kind)} · <span className={`files-st files-st-${statusLabel(focus.status) === "正常" ? "ok" : "warn"}`}>{statusLabel(focus.status)}</span>
        </p>
        <h3 className="files-detail-title">{title}</h3>
        <p className="files-detail-path" title={path}>{path}</p>

        <dl className="files-detail-grid">
          {fields.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        {isWork ? (
          <div className="files-detail-tags">
            <span className="files-detail-tags-label">标签</span>
            {tags.length > 0 ? (
              tags.map((t) => <span key={t} className="files-tag-chip">{t}</span>)
            ) : (
              <span className="files-dim-inline">无标签</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="files-detail-actions">
        <span className="files-detail-actions-label">快捷操作</span>
        <button type="button" onClick={copyPath}>复制路径</button>
        {isWork ? (
          <>
            <button type="button" onClick={() => { window.location.hash = `#governance/${focus.work_id}`; }}>进入治理</button>
            <button type="button" onClick={() => { window.location.hash = `#export/${focus.work_id}`; }}>导出</button>
          </>
        ) : null}
        <button type="button" className="files-detail-del" onClick={() => onDelete(focus)} disabled={busy}>
          删除此项
        </button>
      </div>
    </div>
  );
}
