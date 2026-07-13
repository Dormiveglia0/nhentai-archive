import { AlertTriangle, Download, FileCheck2, FileCode2, FileJson, Package, RefreshCw } from "lucide-react";

import type { ExportOptions, ExportPreview, ExportQueueItem } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { formatBytes, workTitle } from "../library/libraryHelpers";
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
  const keepsJson = (currentPreview?.will_keep.length ?? 0) > 0;
  const compresses = currentPreview?.options.compress ?? true;
  const issues = currentPreview ? [...currentPreview.blockers, ...currentPreview.warnings] : [];
  const canDownloadCurrent = Boolean(currentPreview && !previewLoading && currentPreview.blockers.length === 0);
  const canDownloadSelection = selectedItems.some((item) => item.blockers.length === 0);
  const primaryDisabled = downloading || (count > 1 ? !canDownloadSelection : !canDownloadCurrent);
  const primaryDownload = () => {
    if (count > 1) onDownload();
    else if (currentPreview) onDownloadOne(currentPreview.work.id);
  };

  return (
    <aside className="folio-export-inspector">
      <header className="folio-export-column-head">
        <span>Export manifest</span>
        <h2>作品信息</h2>
        <p>预览最终写入字段与打包选项</p>
      </header>
      {currentPreview && focusItem ? (
        <FadeIn
          key={`focus-${currentPreview.work.id}-${writesComicInfo}-${keepsJson}-${compresses}`}
          y={8}
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
          <div className={`folio-export-comicinfo${writesComicInfo ? "" : " is-off"}`}>
            <div className="folio-export-comicinfo-title">
              <FileCheck2 size={16} />
              <h3>ComicInfo.xml</h3>
              <span className={`folio-export-tag ${writesComicInfo ? "is-ok" : "is-muted"}`}>
                {writesComicInfo ? "将写入" : "不写入"}
              </span>
            </div>
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
          </div>

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
        </FadeIn>
      ) : (
        <p className="folio-export-inspector-empty">{previewLoading ? "正在读取预览..." : "点击左侧任一作品查看详情。"}</p>
      )}

      {/* Sticky action zone */}
      <div className="folio-export-action-zone">
        {/* Global option switches */}
        <div className="folio-export-options">
          <label className={exportOptions.write_comicinfo ? "is-on" : ""}>
            <input
              type="checkbox"
              checked={exportOptions.write_comicinfo}
              onChange={(e) => onSetOption("write_comicinfo", e.target.checked)}
              aria-label="写入 ComicInfo.xml"
            />
            <FileCode2 size={16} />
            <span>ComicInfo</span>
          </label>
          <label className={exportOptions.keep_json ? "is-on" : ""}>
            <input
              type="checkbox"
              checked={exportOptions.keep_json}
              onChange={(e) => onSetOption("keep_json", e.target.checked)}
              aria-label="保留 JSON"
            />
            <FileJson size={16} />
            <span>保留JSON</span>
          </label>
          <label className={exportOptions.compress ? "is-on" : ""}>
            <input
              type="checkbox"
              checked={exportOptions.compress}
              onChange={(e) => onSetOption("compress", e.target.checked)}
              aria-label="标准压缩"
            />
            <Package size={16} />
            <span>压缩</span>
          </label>
          <button type="button" onClick={onRefresh} className="folio-export-refresh" aria-label="刷新预览">
            <RefreshCw size={16} className={previewLoading ? "spin" : ""} />
          </button>
        </div>

        {/* Selection summary + actions */}
        <div className="folio-export-action-cta">
          <span className="folio-export-summary-line">
            已选 {count} 项 · {formatBytes(selectedSize)}
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
