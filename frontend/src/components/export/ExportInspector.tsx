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
  const comicEntries = preview ? Object.entries(preview.comic_info) : [];
  const writesComicInfo = preview?.will_write.includes("ComicInfo.xml") ?? false;
  const keepsJson = (preview?.will_keep.length ?? 0) > 0;
  const compresses = preview?.options.compress ?? true;
  const issues = preview ? [...preview.blockers, ...preview.warnings] : [];
  const canDownloadCurrent = Boolean(preview && preview.blockers.length === 0);
  const canDownloadSelection = selectedItems.some((item) => item.blockers.length === 0);
  const primaryDisabled = downloading || (count > 1 ? !canDownloadSelection : !canDownloadCurrent);
  const primaryDownload = () => {
    if (count > 1) onDownload();
    else if (preview) onDownloadOne(preview.work.id);
  };

  return (
    <aside className="export-inspector">
      {preview && focusItem ? (
        <FadeIn
          key={`focus-${preview.work.id}-${writesComicInfo}-${keepsJson}-${compresses}`}
          y={8}
          className="export-inspector-detail"
        >
          {/* Focus head */}
          <div className="export-inspector-head">
            <Cover workId={preview.work.id} coverPath={preview.work.cover_path} blurCovers={blurCovers} />
            <div className="export-inspector-head-text">
              <strong>{workTitle(preview.work)}</strong>
              <label className="export-inspector-name-label">
                <span>输出名</span>
                <input
                  className="export-inspector-name-input"
                  type="text"
                  value={outputNames[focusItem.work.id] ?? focusItem.output_name}
                  onChange={(e) => onRename(focusItem.work.id, e.target.value)}
                  aria-label="输出名称"
                />
              </label>
              <span className={`export-item-status ${itemStatus(focusItem)}`}>
                {STATUS_LABEL[itemStatus(focusItem)]}
              </span>
            </div>
          </div>

          {/* ComicInfo.xml preview card */}
          <div className={`export-comicinfo-card ${writesComicInfo ? "" : "off"}`}>
            <div className="export-comicinfo-title">
              <FileCheck2 size={16} />
              <h3>ComicInfo.xml</h3>
              <span className={`export-tag ${writesComicInfo ? "ok" : "muted"}`}>
                {writesComicInfo ? "将写入" : "不写入"}
              </span>
            </div>
            {writesComicInfo ? (
              comicEntries.length ? (
                <dl className="export-comicinfo-rows">
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
            <div className="export-issues">
              {issues.map((issue) => (
                <p
                  key={`${issue.code}-${issue.message}`}
                  className={preview.blockers.includes(issue) ? "blocked" : ""}
                >
                  <AlertTriangle size={13} />
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}

          {/* Selected covers strip */}
          {count > 1 ? (
            <FadeIn y={6} className="export-selected-strip" aria-label="已选作品">
              {selectedItems.slice(0, 6).map((item) => (
                <Cover key={item.work.id} workId={item.work.id} coverPath={item.work.cover_path} blurCovers={blurCovers} />
              ))}
              {count > 6 ? <span className="export-selected-more">+{count - 6}</span> : null}
            </FadeIn>
          ) : null}
        </FadeIn>
      ) : (
        <p className="export-inspector-empty">{previewLoading ? "正在读取预览..." : "点击左侧任一作品查看详情。"}</p>
      )}

      {/* Sticky action zone */}
      <div className="export-action-zone">
        {/* Global option switches */}
        <div className="export-options-compact">
          <label className={`export-option-compact ${exportOptions.write_comicinfo ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={exportOptions.write_comicinfo}
              onChange={(e) => onSetOption("write_comicinfo", e.target.checked)}
              aria-label="写入 ComicInfo.xml"
            />
            <FileCode2 size={16} />
            <span>ComicInfo</span>
          </label>
          <label className={`export-option-compact ${exportOptions.keep_json ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={exportOptions.keep_json}
              onChange={(e) => onSetOption("keep_json", e.target.checked)}
              aria-label="保留 JSON"
            />
            <FileJson size={16} />
            <span>保留JSON</span>
          </label>
          <label className={`export-option-compact ${exportOptions.compress ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={exportOptions.compress}
              onChange={(e) => onSetOption("compress", e.target.checked)}
              aria-label="标准压缩"
            />
            <Package size={16} />
            <span>压缩</span>
          </label>
          <button type="button" onClick={onRefresh} className="export-refresh-button" aria-label="刷新预览">
            <RefreshCw size={16} className={previewLoading ? "spin" : ""} />
          </button>
        </div>

        {/* Selection summary + actions */}
        <div className="export-action-cta">
          <span className="export-summary-line">
            已选 {count} 项 · {formatBytes(selectedSize)}
          </span>

          <div className="export-action-buttons">
            <button
              type="button"
              className="export-primary-button"
              disabled={primaryDisabled}
              onClick={primaryDownload}
            >
              <Download size={17} />
              {downloading ? "正在下载..." : downloadLabel}
            </button>

            {/* Secondary action: download only current */}
            {count > 1 && preview && preview.blockers.length === 0 ? (
              <button
                type="button"
                className="export-secondary-button"
                disabled={downloading}
                onClick={() => onDownloadOne(preview.work.id)}
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
