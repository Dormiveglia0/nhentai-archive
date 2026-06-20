import type { FileDeletePreview, FileOverview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";

const WARNING_LABELS: Record<string, string> = {
  has_progress: "含阅读进度",
  has_governance: "含治理元数据",
  already_gone: "目标已不存在",
  forbidden_path: "路径不在受管目录内",
};

type Props = {
  overview: FileOverview | null;
  selectedCount: number;
  preview: FileDeletePreview | null;
  busy: boolean;
  actionNotice?: string | null;
  onPreview: () => void;
  onConfirm: () => void;
  onClear: () => void;
};

export function FileHealthRail({
  overview,
  selectedCount,
  preview,
  busy,
  actionNotice,
  onPreview,
  onConfirm,
  onClear,
}: Props) {
  const hasHealthyWork = preview?.items.some((i) => i.kind === "work" && i.exists) ?? false;
  const hasWarnings = preview?.items.some((i) => i.warnings.length > 0) ?? false;

  return (
    <aside className="files-rail">
      <section className="files-rail-section">
        <h4>健康度</h4>
        {overview ? (
          <ul className="files-health">
            <li>
              <span>源文件</span>
              <span className="files-health-val">
                <em>{overview.work_count - overview.missing_source} 正常</em>
                {overview.missing_source > 0 ? <em className="bad">{overview.missing_source} 缺失</em> : null}
              </span>
            </li>
            <li>
              <span>封面</span>
              <span className="files-health-val">
                <em>{overview.cover_ok} 正常</em>
                {overview.missing_cover > 0 ? <em className="bad">{overview.missing_cover} 缺失</em> : null}
              </span>
            </li>
            <li>
              <span>孤立文件</span>
              <span className="files-health-val">
                <em>{overview.orphan_count}</em>
                <em className="dim">{formatBytes(overview.orphan_bytes)}</em>
              </span>
            </li>
            <li>
              <span>临时残留</span>
              <span className="files-health-val">
                <em>{overview.stale_count}</em>
                <em className="dim">{formatBytes(overview.stale_bytes)}</em>
              </span>
            </li>
            <li>
              <span>可回收</span>
              <span className="files-health-val">
                <em>{formatBytes(overview.reclaimable_bytes)}</em>
              </span>
            </li>
          </ul>
        ) : (
          <p className="files-dim">读取中…</p>
        )}
      </section>

      <section className="files-rail-section">
        <h4>重复检测</h4>
        <p className="files-boundary">未接入。重复文件检测尚未实现，不会显示估算或假的重复数。</p>
      </section>

      <section className="files-rail-section">
        <h4>清理工具</h4>
        <button type="button" className="files-tool-btn" onClick={onPreview} disabled={busy || selectedCount === 0}>
          预览删除（{selectedCount}）
        </button>
        {preview ? (
          <div className="files-preview">
            <p className="files-preview-line">
              将删除 <strong>{preview.files_to_delete}</strong> 个文件
              {preview.works_to_remove > 0 ? (
                <>
                  {" · 移除 "}
                  <strong>{preview.works_to_remove}</strong> 个作品
                </>
              ) : null}
              {" · 可回收 "}
              <strong>{formatBytes(preview.reclaim_bytes)}</strong>
            </p>
            {hasWarnings ? (
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
            ) : null}
            <div className="files-confirm-row">
              <button type="button" className="files-danger" onClick={onConfirm} disabled={busy}>
                {hasHealthyWork ? "确认删除（不可恢复）" : "确认删除"}
              </button>
              <button type="button" className="files-ghost" onClick={onClear} disabled={busy}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="files-dim">勾选清单中的文件，预览删除影响后再确认。</p>
        )}
        {actionNotice ? <p className="files-notice">{actionNotice}</p> : null}
      </section>
    </aside>
  );
}
