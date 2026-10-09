import { X } from "lucide-react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { useExportState } from "./useExportState";
import { ExportInspector } from "./ExportInspector";
import { workTitle } from "../../lib/format";
import "./ExportPage.css";

export function ExportDialog({ workIds, blurCovers, onClose }: { workIds: number[]; blurCovers?: boolean; onClose: () => void }) {
  const vm = useExportState(workIds[0], workIds);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useNativeDialog(dialog, onClose, true, vm.downloading);
  const focus = vm.items.find(item => item.work.id === vm.focusId) ?? null;
  return createPortal(<dialog ref={dialog} className="folio-export-dialog" aria-label="导出作品" aria-busy={vm.loading || vm.downloading}>
    <header><h2>导出{workIds.length > 1 ? ` · ${workIds.length} 部作品` : "作品"}</h2><button type="button" aria-label="关闭导出" data-dialog-focus autoFocus disabled={vm.downloading} onClick={dismiss}><X size={20} /></button></header>
    {vm.error ? <p className="folio-media-error" role="alert">{vm.error}</p> : null}
    {vm.notice ? <p role="status">{vm.notice}</p> : null}
    {vm.loading ? <p role="status">正在读取作品…</p> : <>
      {vm.items.length > 1 ? <nav className="folio-export-context-list" aria-label="导出作品预览">
        {vm.items.map(item => <button type="button" key={item.work.id} aria-pressed={vm.focusId === item.work.id} onClick={() => vm.focusItem(item.work.id)} title={workTitle(item.work)}>{workTitle(item.work)}</button>)}
      </nav> : null}
      <ExportInspector focusItem={focus} preview={vm.preview} selectedItems={vm.selectedItems} selectedSize={vm.selectedSize} multiSelect={vm.multiSelect} exportOptions={vm.exportOptions} previewLoading={vm.previewLoading} downloading={vm.downloading}
        blurCovers={blurCovers ?? vm.settings?.privacy.blur_covers_default ?? true} outputNames={vm.outputNames} onRename={vm.renameOutput} onSetOption={vm.setExportOption} onRefresh={() => void vm.refreshPreview()} onDownload={() => void vm.downloadSelected()} onDownloadOne={id => void vm.downloadOne(id)} />
    </>}
  </dialog>, document.querySelector(".folio") ?? document.body);
}
