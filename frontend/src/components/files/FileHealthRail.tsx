import { AlertTriangle, Copy, HardDrive, Play, RefreshCw, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { api, type FileDeletePreview, type FileDuplicates, type FileOverview, type LibraryScanPreview } from "../../lib/api";
import { duration, ease } from "../../lib/motion";
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
  onCleanup: (category: "orphan" | "stale", label: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function HealthRow({ label, count }: { label: string; count: number }) {
  return <li><span>{label}</span><em className={count > 0 ? "is-bad" : "is-ok"}><i aria-hidden="true" />{count}</em></li>;
}

function RailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="folio-files-rail-section">
      <header><Icon size={15} /><h3>{title}</h3></header>
      {children}
    </section>
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
  const hasHealthyWork = preview?.items.some((item) => item.kind === "work" && item.exists) ?? false;
  const hasWarnings = preview?.items.some((item) => item.warnings.length > 0) ?? false;
  const [scanPreview, setScanPreview] = useState<LibraryScanPreview | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanRequest = useRef(0);

  useEffect(() => () => {
    scanRequest.current += 1;
  }, []);

  async function handleScanPreview() {
    const request = ++scanRequest.current;
    setScanBusy(true);
    setScanPreview(null);
    setScanNotice(null);
    setScanError(null);
    try {
      const result = await api.scanLibraryPreview();
      if (request === scanRequest.current) setScanPreview(result);
    } catch (error) {
      if (request === scanRequest.current) setScanError(String(error));
    } finally {
      if (request === scanRequest.current) setScanBusy(false);
    }
  }

  async function handleScanStart() {
    const request = ++scanRequest.current;
    setScanBusy(true);
    setScanNotice(null);
    setScanError(null);
    try {
      await api.enqueueLibraryScan();
      if (request !== scanRequest.current) return;
      setScanPreview(null);
      setScanNotice("扫描已加入任务中心");
    } catch (error) {
      if (request === scanRequest.current) setScanError(String(error));
    } finally {
      if (request === scanRequest.current) setScanBusy(false);
    }
  }

  return (
    <aside className="folio-files-rail">
      <header className="folio-files-column-head">
        <span>Maintenance</span>
        <h2>维护与健康</h2>
        <p>所有破坏性操作都先显示真实影响。</p>
      </header>

      <RailSection icon={ShieldCheck} title="索引健康">
        {overview ? (
          <ul className="folio-files-health-list">
            <HealthRow label="缺失源文件" count={overview.missing_source} />
            <HealthRow label="缺失封面" count={overview.missing_cover} />
            <HealthRow label="孤立文件" count={overview.orphan_count} />
            <HealthRow label="临时残留" count={overview.stale_count} />
          </ul>
        ) : <p className="folio-files-dim">正在读取真实索引…</p>}
      </RailSection>

      <RailSection icon={Copy} title="重复检查">
        {duplicates ? (
          <ul className="folio-files-health-list">
            <HealthRow label="Hash 相同文件" count={duplicates.hash.files} />
            <HealthRow label="Gallery ID 相同作品" count={duplicates.gallery_id.works} />
          </ul>
        ) : <p className="folio-files-dim">正在核对重复项…</p>}
      </RailSection>

      <RailSection icon={Trash2} title="清理预览">
        {overview ? (
          <ul className="folio-files-cleanup-list">
            <li>
              <span><strong>临时与导出残留</strong><small>{formatBytes(overview.stale_bytes)} · {overview.stale_count} 项</small></span>
              <button type="button" onClick={() => onCleanup("stale", "临时与导出残留")} disabled={busy || overview.stale_count === 0}>预览</button>
            </li>
            <li>
              <span><strong>孤立文件</strong><small>{formatBytes(overview.orphan_bytes)} · {overview.orphan_count} 项</small></span>
              <button type="button" onClick={() => onCleanup("orphan", "孤立文件")} disabled={busy || overview.orphan_count === 0}>预览</button>
            </li>
          </ul>
        ) : <p className="folio-files-dim">正在统计可清理空间…</p>}

        <AnimatePresence mode="wait" initial={false}>
          {preview ? (
            <m.div
              key="delete-preview"
              className="folio-files-preview"
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              transition={{ duration: duration.base, ease: ease.standard }}
            >
              {pendingLabel ? <span>{pendingLabel}</span> : null}
              <p>
                删除 <strong>{preview.files_to_delete}</strong> 个文件
                {preview.works_to_remove > 0 ? <> · 移除 <strong>{preview.works_to_remove}</strong> 个作品</> : null}
                {" · "}回收 <strong>{formatBytes(preview.reclaim_bytes)}</strong>
              </p>
              {hasWarnings ? (
                <ul className="folio-files-warning-list">
                  {preview.items.flatMap((item, index) => item.warnings.map((warning) => (
                    <li key={index + "-" + warning}><AlertTriangle size={13} />{WARNING_LABELS[warning] ?? warning}{item.kind === "work" && item.title ? "：" + item.title : ""}</li>
                  )))}
                </ul>
              ) : null}
              <div className="folio-files-confirm">
                <button type="button" className="is-danger" onClick={onConfirm} disabled={busy}>
                  <Trash2 size={14} />{hasHealthyWork ? "确认删除（不可恢复）" : "确认删除"}
                </button>
                <button type="button" onClick={onCancel} disabled={busy}><X size={14} />取消</button>
              </div>
            </m.div>
          ) : (
            <m.p key="delete-hint" className="folio-files-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              从清单或批量选择中发起预览。
            </m.p>
          )}
        </AnimatePresence>
        {actionNotice ? <p className="folio-files-notice" role="status">{actionNotice}</p> : null}
      </RailSection>

      <RailSection icon={HardDrive} title="目录扫描">
        <div className="folio-files-scan-action">
          <span><strong>扫描未索引 CBZ</strong><small>仅在确认后创建后台任务</small></span>
          <button type="button" onClick={() => void handleScanPreview()} disabled={scanBusy} aria-busy={scanBusy}>
            {scanBusy ? <RefreshCw className="folio-files-spin" size={14} /> : <Search size={14} />}预览
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {scanPreview ? (
            <m.div
              key="scan-preview"
              className="folio-files-preview"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: duration.base, ease: ease.standard }}
            >
              <p>
                新增 <strong>{scanPreview.counts.new_linked}</strong> linked / <strong>{scanPreview.counts.new_local}</strong> local
                {" · "}已知 <strong>{scanPreview.counts.already_known}</strong>
                {" · "}不可读 <strong>{scanPreview.counts.unreadable}</strong>
              </p>
              <div className="folio-files-confirm">
                <button type="button" onClick={() => void handleScanStart()} disabled={scanBusy}><Play size={14} />开始扫描</button>
                <button type="button" onClick={() => setScanPreview(null)} disabled={scanBusy}><X size={14} />取消</button>
              </div>
            </m.div>
          ) : <m.p key="scan-hint" className="folio-files-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>先预览目录差异，不会立即写入。</m.p>}
        </AnimatePresence>
        {scanNotice ? <p className="folio-files-notice" role="status">{scanNotice} · <a href="#tasks">查看任务中心</a></p> : null}
        {scanError ? <p className="folio-files-notice is-error" role="alert">{scanError}</p> : null}
      </RailSection>
    </aside>
  );
}
