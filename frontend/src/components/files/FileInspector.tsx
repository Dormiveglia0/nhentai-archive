import type { FileDeletePreview, FileEntry } from "../../lib/api";
import { formatBytes, statusLabel } from "./fileHelpers";

type Props = {
  focus: FileEntry | null;
  selectedCount: number;
  preview: FileDeletePreview | null;
  busy: boolean;
  onPreview: () => void;
  onConfirm: () => void;
  onClear: () => void;
  actionNotice?: string | null;
};

const WARNING_LABELS: Record<string, string> = {
  has_progress: "该作品有阅读进度",
  has_governance: "该作品有治理元数据",
  already_gone: "目标已不存在",
  forbidden_path: "路径不在受管目录内",
};

export function FileInspector({ focus, selectedCount, preview, busy, onPreview, onConfirm, onClear, actionNotice }: Props) {
  const hasHealthyWork = preview?.items.some((i) => i.kind === "work" && i.exists) ?? false;
  return (
    <aside className="files-inspector">
      {focus ? (
        <div className="files-inspector-detail">
          <h3>{focus.kind === "work" ? focus.title : focus.name}</h3>
          <dl>
            <div><dt>状态</dt><dd>{statusLabel(focus.status)}</dd></div>
            <div><dt>占用</dt><dd>{formatBytes(focus.size_bytes)}</dd></div>
            {focus.kind === "work" ? (
              <>
                <div><dt>页数</dt><dd>{focus.page_count ?? 0}</dd></div>
                <div><dt>来源</dt><dd>{focus.source ?? "—"}</dd></div>
                <div><dt>ID</dt><dd>{focus.remote_gallery_id ?? "—"}</dd></div>
                <div><dt>源路径</dt><dd className="files-path">{focus.source_path ?? "—"}</dd></div>
              </>
            ) : (
              <div><dt>路径</dt><dd className="files-path">{focus.path}</dd></div>
            )}
          </dl>
        </div>
      ) : (
        <p className="files-empty">选择一个文件查看详情。</p>
      )}

      <div className="files-actions">
        {actionNotice ? <p className="files-notice">{actionNotice}</p> : null}
        <button type="button" onClick={onPreview} disabled={busy || selectedCount === 0}>
          预览删除（{selectedCount}）
        </button>
        {preview ? (
          <div className="files-delete-preview">
            <p>
              将删除 {preview.files_to_delete} 个文件
              {preview.works_to_remove > 0 ? `，移除 ${preview.works_to_remove} 个作品` : ""}，
              可回收 {formatBytes(preview.reclaim_bytes)}。
            </p>
            <ul className="files-warn-list">
              {preview.items.flatMap((item, idx) =>
                item.warnings.map((w) => (
                  <li key={`${idx}-${w}`} className="files-warn">
                    {WARNING_LABELS[w] ?? w}
                    {item.kind === "work" && item.title ? `：${item.title}` : ""}
                  </li>
                )),
              )}
            </ul>
            <div className="files-confirm-row">
              <button type="button" className="files-danger" onClick={onConfirm} disabled={busy}>
                {hasHealthyWork ? "确认删除（不可恢复）" : "确认删除"}
              </button>
              <button type="button" onClick={onClear} disabled={busy}>
                取消
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
