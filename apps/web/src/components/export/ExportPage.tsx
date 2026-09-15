import { useState } from "react";
import { ArrowRight, AlertCircle, Archive } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { ExportInspector } from "./ExportInspector";
import { ExportToolbar } from "./ExportToolbar";
import { ExportWorkList } from "./ExportWorkList";
import { useExportState } from "./useExportState";
import "./ExportPage.css";
import "./ExportWorkflow.css";

export function ExportPage({ initialWorkId, blurCovers }: { initialWorkId?: number; blurCovers: boolean }) {
  const exports = useExportState(initialWorkId);
  const [step,setStep] = useState<"source"|"package">("source");
  const focusItem = exports.focusId ? exports.items.find((item) => item.work.id === exports.focusId) ?? null : null;
  const selectionCount = exports.multiSelect ? exports.selectedItems.length : focusItem ? 1 : 0;


  return (
    <section className="folio-page-body folio-export-page">
      <header className="export-workflow-head"><h1>导出</h1><div><span>就绪 <strong>{exports.summary?.ready ?? "—"}</strong></span><span>警告 <strong>{exports.summary?.warnings ?? "—"}</strong></span><span>阻塞 <strong>{exports.summary?.blocked ?? "—"}</strong></span></div></header>
      <nav className="export-workflow-steps" aria-label="导出步骤"><button type="button" aria-current={step==="source"?"step":undefined} onClick={()=>setStep("source")}><span>01</span>选择作品<small>{selectionCount} 已选</small></button><ArrowRight size={20}/><button type="button" aria-current={step==="package"?"step":undefined} onClick={()=>setStep("package")}><span>02</span>配置与下载<small>CBZ / ZIP</small></button></nav>

      {exports.error ? <FadeIn key={exports.error} className="folio-export-message is-error" role="alert" y={6}><AlertCircle size={15} /><p>{exports.error}</p></FadeIn> : null}
      {exports.notice ? <FadeIn key={exports.notice} className="folio-export-message" role="status" y={6}><span aria-hidden="true" /><p>{exports.notice}</p></FadeIn> : null}
      {exports.loading ? <div className="folio-export-loading" role="status">正在读取导出队列…</div> : null}

      {!exports.loading && exports.queue ? exports.queue.result.length === 0 ? (
        <section className="folio-ruled-panel folio-export-empty"><FolioEmptyState icon={Archive} title="暂无可导出作品" copy="导入 CBZ 后，导出队列会显示源文件、阻塞项与 ComicInfo 预览。" /></section>
      ) : (
        <>
          <div hidden={step!=="source"}><ExportToolbar query={exports.query} statusFilter={exports.statusFilter} onQueryChange={exports.setQuery} onStatusFilterChange={exports.setStatusFilter} multiSelect={exports.multiSelect} onToggleMultiSelect={exports.toggleMultiSelect} onSelectReady={exports.selectReady} onClear={exports.clearSelected} /></div>
          <div className="folio-export-layout">
            <section hidden={step!=="source"} className="folio-export-source" aria-labelledby="folio-export-source-title">
              <header className="folio-export-column-head"><h2 id="folio-export-source-title">选择作品</h2><p>{exports.visibleItems.length} 项匹配当前条件</p></header>
              {exports.visibleItems.length ? <ExportWorkList items={exports.visibleItems} selectedIds={exports.selectedIds} focusId={exports.focusId} multiSelect={exports.multiSelect} blurCovers={blurCovers} onPick={exports.pickItem} /> : <FolioEmptyState icon={Archive} title="没有匹配的作品" copy={exports.query ? "调整搜索词或筛选条件后重试。" : "当前筛选条件下没有条目。"} />}
            </section>
            <div hidden={step!=="package"} className="export-package-workspace"><ExportInspector focusItem={focusItem} preview={exports.preview} selectedItems={exports.selectedItems} selectedSize={exports.selectedSize} exportOptions={exports.exportOptions} previewLoading={exports.previewLoading} downloading={exports.downloading} blurCovers={blurCovers} outputNames={exports.outputNames} onRename={exports.renameOutput} onSetOption={exports.setExportOption} onRefresh={() => void exports.refreshPreview()} onDownload={() => void exports.downloadSelected()} onDownloadOne={(id) => void exports.downloadOne(id)} /></div>
          </div>
          {step==="source" && <button className="export-next" type="button" disabled={!selectionCount} onClick={()=>{setStep("package");document.querySelector(".folio-scroll")?.scrollTo({top:0});}}>配置 {selectionCount} 部作品<ArrowRight size={18}/></button>}
        </>
      ) : null}
    </section>
  );
}
