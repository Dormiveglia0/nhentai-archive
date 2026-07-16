import { AlertCircle, Archive, CheckCircle2, ShieldAlert, TriangleAlert } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { FolioMetricGrid, type FolioMetricTone } from "../folio/ui/FolioMetricGrid";
import { ExportInspector } from "./ExportInspector";
import { ExportToolbar } from "./ExportToolbar";
import { ExportWorkList } from "./ExportWorkList";
import { useExportState } from "./useExportState";
import "./ExportPage.css";

export function ExportPage({ initialWorkId, blurCovers }: { initialWorkId?: number; blurCovers: boolean }) {
  const exports = useExportState(initialWorkId);
  const focusItem = exports.focusId ? exports.items.find((item) => item.work.id === exports.focusId) ?? null : null;
  const metrics = [
    { label: "全部作品", value: exports.summary?.total, icon: Archive, tone: "neutral" },
    { label: "导出就绪", value: exports.summary?.ready, icon: CheckCircle2, tone: "good" },
    { label: "存在警告", value: exports.summary?.warnings, icon: TriangleAlert, tone: exports.summary?.warnings ? "warning" : "good" },
    { label: "导出阻塞", value: exports.summary?.blocked, icon: ShieldAlert, tone: exports.summary?.blocked ? "danger" : "good" },
  ];

  return (
    <section className="folio-page-body folio-export-page">
      <FolioMetricGrid
        ariaLabel="导出队列摘要"
        className="folio-export-summary"
        items={metrics.map(({ label, value, icon, tone }) => ({
          label,
          icon,
          tone: tone as FolioMetricTone,
          value: value == null ? "—" : value.toLocaleString(),
        }))}
      />

      {exports.error ? <FadeIn key={exports.error} className="folio-export-message is-error" role="alert" y={6}><AlertCircle size={15} /><p>{exports.error}</p></FadeIn> : null}
      {exports.notice ? <FadeIn key={exports.notice} className="folio-export-message" role="status" y={6}><span aria-hidden="true" /><p>{exports.notice}</p></FadeIn> : null}
      {exports.loading ? <div className="folio-export-loading" role="status">正在读取真实导出队列…</div> : null}

      {!exports.loading && exports.queue ? exports.queue.result.length === 0 ? (
        <section className="folio-ruled-panel folio-export-empty"><FolioEmptyState icon={Archive} title="暂无可导出作品" copy="导入真实 CBZ 后，导出队列会显示源文件、阻塞项与 ComicInfo 预览。" /></section>
      ) : (
        <>
          <ExportToolbar query={exports.query} statusFilter={exports.statusFilter} onQueryChange={exports.setQuery} onStatusFilterChange={exports.setStatusFilter} multiSelect={exports.multiSelect} onToggleMultiSelect={exports.toggleMultiSelect} onSelectReady={exports.selectReady} onClear={exports.clearSelected} />
          <div className="folio-export-layout">
            <section className="folio-export-source" aria-labelledby="folio-export-source-title">
              <header className="folio-export-column-head"><span>Local collection</span><h2 id="folio-export-source-title">选择作品</h2><p>{exports.visibleItems.length} 项匹配当前条件</p></header>
              {exports.visibleItems.length ? <ExportWorkList items={exports.visibleItems} selectedIds={exports.selectedIds} focusId={exports.focusId} multiSelect={exports.multiSelect} blurCovers={blurCovers} onPick={exports.pickItem} /> : <FolioEmptyState icon={Archive} title="没有匹配的作品" copy={exports.query ? "调整搜索词或筛选条件后重试。" : "当前筛选条件下没有真实条目。"} />}
            </section>
            <ExportInspector focusItem={focusItem} preview={exports.preview} selectedItems={exports.selectedItems} selectedSize={exports.selectedSize} exportOptions={exports.exportOptions} previewLoading={exports.previewLoading} downloading={exports.downloading} blurCovers={blurCovers} outputNames={exports.outputNames} onRename={exports.renameOutput} onSetOption={exports.setExportOption} onRefresh={() => void exports.refreshPreview()} onDownload={() => void exports.downloadSelected()} onDownloadOne={(id) => void exports.downloadOne(id)} />
          </div>
        </>
      ) : null}
    </section>
  );
}
