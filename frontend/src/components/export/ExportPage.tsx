import { Download } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { ExportHistory } from "./ExportHistory";
import { ExportPresetBar } from "./ExportPresetBar";
import { ExportPreviewPanel } from "./ExportPreviewPanel";
import { ExportQueueTable } from "./ExportQueueTable";
import { ExportSummary } from "./ExportSummary";
import { useExportState } from "./useExportState";

type Props = {
  initialWorkId?: number;
  blurCovers: boolean;
};

export function ExportPage({ initialWorkId, blurCovers }: Props) {
  const vm = useExportState(initialWorkId);
  const activePresetName = vm.activePreset?.name ?? "-";

  return (
    <section className="page export-page">
      {vm.summary || vm.queue ? (
        <ExportSummary
          queue={vm.queue ?? { result: [], summary: { total: 0, ready: 0, blocked: 0, warnings: 0 } }}
          summary={vm.summary}
          selectedCount={vm.selectedIds.size}
          exportableCount={vm.exportableItems.length}
          presetCount={vm.settings?.export.presets.length ?? 0}
          activePresetName={activePresetName}
        />
      ) : null}

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
            <div className="export-mobile-dock">
              <div>
                <strong>{vm.selectedIds.size} 项已选</strong>
                <span>
                  {vm.exportableItems.length} 项可导出 · {activePresetName}
                </span>
              </div>
              <button
                type="button"
                disabled={vm.generating || vm.exportableItems.length === 0 || vm.selectedIds.size === 0}
                onClick={vm.generateSelected}
              >
                <Download size={16} />
                {vm.generating ? "导出中" : "开始导出"}
              </button>
            </div>

            <div className="export-workspace">
              <div className="export-left-stack">
                <ExportQueueTable
                  items={vm.items}
                  selectedIds={vm.selectedIds}
                  focusId={vm.focusId}
                  outputNames={vm.outputNames}
                  activePreset={vm.activePreset}
                  blurCovers={blurCovers}
                  selectedCount={vm.selectedIds.size}
                  selectedSize={vm.selectedSize}
                  onToggle={vm.toggleSelected}
                  onFocus={vm.focusItem}
                  onRename={vm.renameOutput}
                  onSelectReady={vm.selectReady}
                  onRemoveSelected={vm.removeSelected}
                  onClear={vm.clearSelected}
                />
                <ExportPresetBar
                  settings={vm.settings}
                  activePreset={vm.activePreset}
                  outputDir={vm.summary?.output_dir}
                  outputDirDraft={vm.outputDirDraft}
                  savingOutputDir={vm.savingOutputDir}
                  openDirAfter={vm.openDirAfter}
                  selectedCount={vm.selectedIds.size}
                  exportableCount={vm.exportableItems.length}
                  generating={vm.generating}
                  onPresetChange={vm.changePreset}
                  onSavePreset={vm.saveNewPreset}
                  onOutputDirChange={vm.setOutputDirDraft}
                  onSaveOutputDir={vm.saveOutputDir}
                  onToggleOpenDir={vm.setOpenDirAfter}
                  onGenerate={vm.generateSelected}
                />
              </div>
              <ExportPreviewPanel
                selectedItems={vm.selectedItems}
                selectedSize={vm.selectedSize}
                preview={vm.preview}
                loading={vm.previewLoading}
                generating={vm.generating}
                blurCovers={blurCovers}
                onGenerate={vm.generateSelected}
                onRefresh={vm.refreshPreview}
              />
            </div>

            <ExportHistory records={vm.history} blurCovers={blurCovers} />
          </>
        )
      ) : null}
    </section>
  );
}
