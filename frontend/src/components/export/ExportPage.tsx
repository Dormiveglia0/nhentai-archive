import { FadeIn } from "../../lib/motion";
import { ExportInspector } from "./ExportInspector";
import { ExportToolbar } from "./ExportToolbar";
import { ExportWorkList } from "./ExportWorkList";
import { useExportState } from "./useExportState";

type Props = {
  initialWorkId?: number;
  blurCovers: boolean;
};

export function ExportPage({ initialWorkId, blurCovers }: Props) {
  const vm = useExportState(initialWorkId);
  const focusItem = vm.focusId ? vm.items.find((item) => item.work.id === vm.focusId) ?? null : null;

  return (
    <section className="page export-page">
      {vm.error ? (
        <FadeIn key={vm.error} className="notice error" y={6}>
          {vm.error}
        </FadeIn>
      ) : null}
      {vm.notice ? (
        <FadeIn key={vm.notice} className="notice success" y={6}>
          {vm.notice}
        </FadeIn>
      ) : null}

      {vm.loading ? <div className="page-panel">正在读取导出队列...</div> : null}

      {!vm.loading && vm.queue ? (
        vm.queue.result.length === 0 ? (
          <div className="page-panel boundary-panel">
            <strong>暂无可导出作品</strong>
            <p>导入真实 CBZ 后，导出队列会显示源文件、阻塞项和 ComicInfo preview。</p>
          </div>
        ) : (
          <>
            <ExportToolbar
              query={vm.query}
              statusFilter={vm.statusFilter}
              onQueryChange={vm.setQuery}
              onStatusFilterChange={vm.setStatusFilter}
              multiSelect={vm.multiSelect}
              onToggleMultiSelect={vm.toggleMultiSelect}
              onSelectReady={vm.selectReady}
              onClear={vm.clearSelected}
            />

            <div className="export-workspace">
              {vm.visibleItems.length === 0 ? (
                <div className="page-panel boundary-panel export-empty-list">
                  <strong>没有匹配的作品</strong>
                  <p>{vm.query ? "尝试调整搜索词或筛选条件。" : "调整筛选条件后重新查看。"}</p>
                </div>
              ) : (
                <ExportWorkList
                  items={vm.visibleItems}
                  selectedIds={vm.selectedIds}
                  focusId={vm.focusId}
                  multiSelect={vm.multiSelect}
                  blurCovers={blurCovers}
                  onPick={vm.pickItem}
                />
              )}
              <ExportInspector
                focusItem={focusItem}
                preview={vm.preview}
                selectedItems={vm.selectedItems}
                selectedSize={vm.selectedSize}
                exportOptions={vm.exportOptions}
                previewLoading={vm.previewLoading}
                downloading={vm.downloading}
                blurCovers={blurCovers}
                outputNames={vm.outputNames}
                onRename={vm.renameOutput}
                onSetOption={vm.setExportOption}
                onRefresh={vm.refreshPreview}
                onDownload={vm.downloadSelected}
                onDownloadOne={vm.downloadOne}
              />
            </div>
          </>
        )
      ) : null}
    </section>
  );
}
