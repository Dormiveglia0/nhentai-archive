import { Copy, HardDrive, Play, RefreshCw, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";

import type { FileDuplicates, FileOverview, LibraryScanPreview } from "../../lib/api";
import { duration, ease } from "../../lib/motion";
import { formatBytes } from "./fileHelpers";

type Props = {
  overview: FileOverview | null;
  duplicates: FileDuplicates | null;
  busy: boolean;
  scanBusy: boolean;
  scanPreview: LibraryScanPreview | null;
  scanNotice: string | null;
  scanError: string | null;
  onCleanup: (category: "orphan" | "stale", label: string) => void;
  onScanPreview: () => void;
  onScanStart: () => void;
  onScanCancel: () => void;
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
  busy,
  scanBusy,
  scanPreview,
  scanNotice,
  scanError,
  onCleanup,
  onScanPreview,
  onScanStart,
  onScanCancel,
}: Props) {
  const scanCount = scanPreview ? scanPreview.new_linked.length + scanPreview.new_local.length : 0;

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

        <p className="folio-files-dim">预览完成后会打开独立确认窗口，不会直接删除。</p>
      </RailSection>

      <RailSection icon={HardDrive} title="目录扫描">
        <div className="folio-files-scan-action">
          <span><strong>扫描未索引 CBZ</strong><small>仅在确认后创建后台任务</small></span>
          <button type="button" onClick={onScanPreview} disabled={busy} aria-busy={scanBusy}>
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
                可关联入库 <strong>{scanPreview.counts.new_linked}</strong> 个 · 本地入库 <strong>{scanPreview.counts.new_local}</strong> 个
                {" · "}已知 <strong>{scanPreview.counts.already_known}</strong>
                {" · "}不可读 <strong>{scanPreview.counts.unreadable}</strong>
              </p>
              <div className="folio-files-confirm">
                <button type="button" onClick={onScanStart} disabled={busy || scanCount === 0}><Play size={14} />加入任务</button>
                <button type="button" onClick={onScanCancel} disabled={busy}><X size={14} />取消</button>
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
