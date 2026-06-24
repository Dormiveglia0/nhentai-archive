import { useState } from "react";

import { api, type FileDeletePreview, type FileDuplicates, type FileOverview, type LibraryScanPreview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";

const WARNING_LABELS: Record<string, string> = {
  has_progress: "含阅读进度",
  has_governance: "含治理元数据",
  already_gone: "目标已不存在",
  forbidden_path: "路径不在受管目录内",
};

type Props = {
  overview: FileOverview | null;
  duplicates: FileDuplicates | null;
  preview: FileDeletePreview | null;
  pendingLabel: string | null;
  busy: boolean;
  actionNotice?: string | null;
  onCleanup: (cat: "orphan" | "stale", label: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function HealthRow({ label, count }: { label: string; count: number }) {
  return (
    <li>
      <span>{label}</span>
      <em className={count > 0 ? "bad" : "ok"}>{count}</em>
    </li>
  );
}

export function FileHealthRail({
  overview,
  duplicates,
  preview,
  pendingLabel,
  busy,
  actionNotice,
  onCleanup,
  onConfirm,
  onCancel,
}: Props) {
  const hasHealthyWork = preview?.items.some((i) => i.kind === "work" && i.exists) ?? false;
  const hasWarnings = preview?.items.some((i) => i.warnings.length > 0) ?? false;

  const [scanPreview, setScanPreview] = useState<LibraryScanPreview | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScanPreview = async () => {
    setScanBusy(true);
    setScanPreview(null);
    setScanNotice(null);
    setScanError(null);
    try {
      const result = await api.scanLibraryPreview();
      setScanPreview(result);
    } catch (e) {
      setScanError(String(e));
    } finally {
      setScanBusy(false);
    }
  };

  const handleScanStart = async () => {
    setScanBusy(true);
    setScanNotice(null);
    setScanError(null);
    try {
      await api.enqueueLibraryScan();
      setScanPreview(null);
      setScanNotice("已加入任务中心");
    } catch (e) {
      setScanError(String(e));
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <aside className="files-rail">
      <section className="files-rail-section">
        <h4>健康检查</h4>
        {overview ? (
          <ul className="files-health">
            <HealthRow label="缺失源文件" count={overview.missing_source} />
            <HealthRow label="缺失封面" count={overview.missing_cover} />
            <HealthRow label="孤立文件" count={overview.orphan_count} />
            <HealthRow label="临时残留" count={overview.stale_count} />
          </ul>
        ) : (
          <p className="files-dim">读取中…</p>
        )}
      </section>

      <section className="files-rail-section">
        <h4>重复检查</h4>
        {duplicates ? (
          <ul className="files-health">
            <li>
              <span>Hash 相同</span>
              <em className={duplicates.hash.files > 0 ? "bad" : "ok"}>{duplicates.hash.files}</em>
            </li>
            <li>
              <span>Gallery ID 相同</span>
              <em className={duplicates.gallery_id.works > 0 ? "bad" : "ok"}>{duplicates.gallery_id.works}</em>
            </li>
          </ul>
        ) : (
          <p className="files-dim">读取中…</p>
        )}
      </section>

      <section className="files-rail-section">
        <h4>清理工具</h4>
        {overview ? (
          <ul className="files-cleanup">
            <li>
              <span className="files-cleanup-main">
                <span>临时与导出残留</span>
                <em>{formatBytes(overview.stale_bytes)} · {overview.stale_count} 项</em>
              </span>
              <button type="button" onClick={() => onCleanup("stale", "临时与导出残留")} disabled={busy || overview.stale_count === 0}>
                清理
              </button>
            </li>
            <li>
              <span className="files-cleanup-main">
                <span>孤立文件</span>
                <em>{formatBytes(overview.orphan_bytes)} · {overview.orphan_count} 项</em>
              </span>
              <button type="button" onClick={() => onCleanup("orphan", "孤立文件")} disabled={busy || overview.orphan_count === 0}>
                清理
              </button>
            </li>
          </ul>
        ) : (
          <p className="files-dim">读取中…</p>
        )}

        {preview ? (
          <div className="files-preview">
            <p className="files-preview-line">
              {pendingLabel ? <span className="files-preview-label">{pendingLabel}</span> : null}
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
              <button type="button" className="files-ghost" onClick={onCancel} disabled={busy}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="files-dim">开启多选勾选文件，或用上面的清理按钮，预览后再确认删除。</p>
        )}
        {actionNotice ? <p className="files-notice">{actionNotice}</p> : null}
      </section>

      <section className="files-rail-section">
        <h4>扫描库</h4>
        <ul className="files-cleanup">
          <li>
            <span className="files-cleanup-main">
              <span>扫描未索引 CBZ</span>
              <em>将新文件入库</em>
            </span>
            <button type="button" onClick={() => void handleScanPreview()} disabled={scanBusy}>
              预览
            </button>
          </li>
        </ul>

        {scanPreview ? (
          <div className="files-preview">
            <p className="files-preview-line">
              新增 <strong>{scanPreview.counts.new_linked}</strong> linked /{" "}
              <strong>{scanPreview.counts.new_local}</strong> local · 已知{" "}
              <strong>{scanPreview.counts.already_known}</strong> · 不可读{" "}
              <strong>{scanPreview.counts.unreadable}</strong>
            </p>
            <div className="files-confirm-row">
              <button type="button" onClick={() => void handleScanStart()} disabled={scanBusy}>
                开始扫描
              </button>
              <button type="button" className="files-ghost" onClick={() => setScanPreview(null)} disabled={scanBusy}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className="files-dim">点击「预览」查看可入库的新文件。</p>
        )}

        {scanNotice ? (
          <p className="files-notice">
            {scanNotice} · <a href="#tasks">查看任务中心</a>
          </p>
        ) : null}
        {scanError ? <p className="files-notice">{scanError}</p> : null}
      </section>
    </aside>
  );
}
