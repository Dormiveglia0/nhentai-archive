import { AlertTriangle, Download, FileCheck2, RefreshCw } from "lucide-react";

import { ExportPackage } from "./ExportPackage";
import type { ExportOptions, ExportPreview, ExportQueueItem } from "../../lib/api";
import { FadeIn, SelectionStage } from "../../lib/motion";
import { formatBytes, workTitle } from "../../lib/format";
import { Cover, STATUS_LABEL, itemStatus } from "./exportHelpers";

type ExportInspectorProps = {
  focusItem: ExportQueueItem | null;
  preview: ExportPreview | null;
  selectedItems: ExportQueueItem[];
  selectedSize: number;
  exportOptions: ExportOptions;
  previewLoading: boolean;
  downloading: boolean;
  blurCovers: boolean;
  outputNames: Record<number, string>;
  onRename: (id: number, value: string) => void;
  onSetOption: (key: keyof ExportOptions, value: boolean) => void;
  onRefresh: () => void;
  onDownload: () => void;
  onDownloadOne: (id: number) => void;
};

export function ExportInspector({
  focusItem,
  preview,
  selectedItems,
  selectedSize,
  exportOptions,
  previewLoading,
  downloading,
  blurCovers,
  outputNames,
  onRename,
  onSetOption,
  onRefresh,
  onDownload,
  onDownloadOne,
}: ExportInspectorProps) {
  const count = selectedItems.length;
  const downloadLabel = count > 1 ? `下载所选 ${count} 项 (.zip)` : "下载此作品";
  const currentPreview = preview && focusItem && preview.work.id === focusItem.work.id ? preview : null;
  const comicEntries = currentPreview ? Object.entries(currentPreview.comic_info) : [];
  const writesComicInfo = currentPreview?.will_write.includes("ComicInfo.xml") ?? false;
  const issues = currentPreview ? [...currentPreview.blockers, ...currentPreview.warnings] : [];
  const canDownloadCurrent = Boolean(currentPreview && !previewLoading && currentPreview.blockers.length === 0);
  const canDownloadSelection = selectedItems.some((item) => item.blockers.length === 0);
  const primaryDisabled = downloading || (count > 1 ? !canDownloadSelection : !canDownloadCurrent);
  const primaryDownload = () => {
    if (count > 1) onDownload();
    else if (currentPreview) onDownloadOne(currentPreview.work.id);
  };

  return (
    <aside className="folio-export-inspector export-workflow-inspector">
      <header className="folio-export-column-head">
        <h2>打包预览</h2>
      </header>
      <ExportPackage options={exportOptions} onChange={onSetOption} />
      {currentPreview && focusItem ? (
        <SelectionStage
          selection={currentPreview.work.id}
          className="folio-export-inspector-detail"
        >
          {/* Focus head */}
          <div className="folio-export-inspector-head">
            <Cover workId={currentPreview.work.id} coverPath={currentPreview.work.cover_path} blurCovers={blurCovers} />
            <div className="folio-export-inspector-head-text">
              <strong>{workTitle(currentPreview.work)}</strong>
              <label className="folio-export-name-field">
                <span>输出名</span>
                <input
                  className="folio-export-name-input"
                  type="text"
                  value={outputNames[focusItem.work.id] ?? focusItem.output_name}
                  onChange={(e) => onRename(focusItem.work.id, e.target.value)}
                  aria-label="输出名称"
                />
              </label>
              <span className={`folio-export-item-status is-${itemStatus(focusItem)}`}>
                {STATUS_LABEL[itemStatus(focusItem)]}
              </span>
            </div>
          </div>

          {/* ComicInfo.xml preview card */}
          <details className={`folio-export-comicinfo${writesComicInfo ? "" : " is-off"}`}>
            <summary className="folio-export-comicinfo-title">
              <FileCheck2 size={16} />
              <h3>ComicInfo.xml</h3>
              <span className={`folio-export-tag ${writesComicInfo ? "is-ok" : "is-muted"}`}>
                {writesComicInfo ? "将写入" : "不写入"}
              </span>
            </summary>
            {writesComicInfo ? (
              comicEntries.length ? (
                <dl className="folio-export-comicinfo-rows">
                  {comicEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd title={value}>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="empty-inline">暂无可写入的元数据字段，请先在治理中心补全。</p>
              )
            ) : (
              <p className="empty-inline">本次导出不写入 ComicInfo.xml，文件将保持源内容。</p>
            )}
          </details>

          {/* Issues area */}
          {issues.length ? (
            <div className="folio-export-issues">
              {issues.map((issue) => (
                <p
                  key={`${issue.code}-${issue.message}`}
                  className={currentPreview.blockers.includes(issue) ? "blocked" : ""}
                >
                  <AlertTriangle size={13} />
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}

          {/* Selected covers strip */}
          {count > 1 ? (
            <FadeIn y={6} className="folio-export-selected-strip" aria-label="已选作品">
              {selectedItems.slice(0, 6).map((item) => (
                <Cover key={item.work.id} workId={item.work.id} coverPath={item.work.cover_path} blurCovers={blurCovers} />
              ))}
              {count > 6 ? <span className="folio-export-selected-more">+{count - 6}</span> : null}
            </FadeIn>
          ) : null}
        </SelectionStage>
      ) : (
        <p className="folio-export-inspector-empty">{previewLoading ? "正在读取预览..." : "返回选择作品后查看打包预览。"}</p>
      )}

      {/* Sticky action zone */}
      <div className="folio-export-action-zone">
        {/* Global option switches */}
        <div className="folio-export-options">
          <button type="button" onClick={onRefresh} className="folio-export-refresh" aria-label="刷新预览">
            <RefreshCw size={16} className={previewLoading ? "spin" : ""} />
          </button>
        </div>

        {/* Selection summary + actions */}
        <div className="folio-export-action-cta">
          <span className="folio-export-summary-line">
            {count ? `已选 ${count} 项 · ${formatBytes(selectedSize)}` : focusItem ? `当前作品 · ${formatBytes(focusItem.source_file.size_bytes)}` : "尚未选择作品"}
          </span>

          <div className="folio-export-action-buttons">
            <button
              type="button"
              className="folio-export-primary"
              disabled={primaryDisabled}
              onClick={primaryDownload}
            >
              <Download size={17} />
              {downloading ? "正在下载..." : downloadLabel}
            </button>

            {/* Secondary action: download only current */}
            {count > 1 && currentPreview && currentPreview.blockers.length === 0 ? (
              <button
                type="button"
                className="folio-export-secondary"
                disabled={downloading || previewLoading}
                onClick={() => onDownloadOne(currentPreview.work.id)}
              >
                仅下载当前作品
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
