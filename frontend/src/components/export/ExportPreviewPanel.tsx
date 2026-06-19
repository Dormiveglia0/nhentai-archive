import { CheckCircle2, Download, FileText, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import type { ExportPreview, ExportQueueItem } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { formatBytes, workTitle } from "../library/libraryHelpers";
import { Cover } from "./exportHelpers";

type ExportPreviewPanelProps = {
  selectedItems: ExportQueueItem[];
  selectedSize: number;
  preview: ExportPreview | null;
  loading: boolean;
  downloading: boolean;
  blurCovers: boolean;
  onDownload: () => void;
  onDownloadOne: (id: number) => void;
  onRefresh: () => void;
};

export function ExportPreviewPanel({
  selectedItems,
  selectedSize,
  preview,
  loading,
  downloading,
  blurCovers,
  onDownload,
  onDownloadOne,
  onRefresh,
}: ExportPreviewPanelProps) {
  const keepsMeta = preview?.will_keep.includes("meta.json") ?? false;
  const previewBlocked = (preview?.blockers.length ?? 0) > 0;
  const signature = selectedItems.map((item) => item.work.id).join("-");
  return (
    <aside className="export-panel export-preview-panel">
      <div className="export-panel-head">
        <div>
          <h2>导出预览</h2>
          <p>已选择 {selectedItems.length} 项作品。</p>
        </div>
        <button type="button" className="export-icon-action" onClick={onRefresh} aria-label="刷新导出预览">
          <RefreshCw size={16} />
        </button>
      </div>

      {selectedItems.length ? (
        <FadeIn key={`list-${signature}`} y={6} className="export-selected-list">
          {selectedItems.slice(0, 4).map((selected) => (
            <div key={selected.work.id}>
              <Cover workId={selected.work.id} coverPath={selected.work.cover_path} blurCovers={blurCovers} />
              <span>
                <strong>{workTitle(selected.work)}</strong>
                <small>{formatBytes(selected.source_file.size_bytes)}</small>
              </span>
            </div>
          ))}
          {selectedItems.length > 4 ? (
            <p className="export-selected-more">+{selectedItems.length - 4} 项</p>
          ) : null}
        </FadeIn>
      ) : (
        <p className="empty-inline">还没有选择待导出的作品。</p>
      )}

      <div className="export-will-write">
        <h3>将生成的新文件</h3>
        <div className="export-rule-grid">
          <RuleCard title="将生成新 CBZ" caption="下载到你的设备" ok />
          <RuleCard title="将写入 ComicInfo.xml" caption="补充与修正元数据" ok />
          <RuleCard
            title={keepsMeta ? "默认保留 meta.json" : "未检测到 meta.json"}
            caption={keepsMeta ? "保留原 meta.json" : "源文件中无 meta.json"}
            ok={keepsMeta}
          />
          <RuleCard title="不会修改原始 CBZ" caption="原文件保持不变" ok />
        </div>
      </div>

      {loading ? <p className="empty-inline">正在读取 preview...</p> : null}

      {!loading && preview ? (
        <FadeIn key={`detail-${preview.work.id}`} y={8} className="export-preview-content">
          <div className="export-focus-head">
            <div>
              <strong>{workTitle(preview.work)}</strong>
              <small>{preview.output_name}</small>
            </div>
            <button
              type="button"
              className="export-secondary-action"
              disabled={downloading || previewBlocked}
              onClick={() => onDownloadOne(preview.work.id)}
            >
              <Download size={15} />
              下载此项
            </button>
          </div>

          <details className="export-path-details">
            <summary>路径明细</summary>
            <dl className="export-preview-facts">
              <div>
                <dt>输出文件</dt>
                <dd>{preview.output_name}</dd>
              </div>
              <div>
                <dt>源文件</dt>
                <dd>{preview.source_file.path || "缺少源文件"}</dd>
              </div>
              <div>
                <dt>批量大小</dt>
                <dd>{formatBytes(selectedSize)}</dd>
              </div>
            </dl>
          </details>

          <details className="export-comicinfo">
            <summary>
              <FileText size={16} /> ComicInfo.xml
            </summary>
            <div className="export-comicinfo-fields">
              {Object.entries(preview.comic_info).map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </details>

          {preview.blockers.length || preview.warnings.length ? (
            <div className="export-issues">
              {[...preview.blockers, ...preview.warnings].map((issue) => (
                <p key={`${issue.code}-${issue.message}`} className={preview.blockers.includes(issue) ? "blocked" : ""}>
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </FadeIn>
      ) : null}

      <button
        type="button"
        className="export-generate"
        disabled={downloading || selectedItems.length === 0}
        onClick={onDownload}
      >
        <Download size={17} />
        {downloading ? "正在下载..." : "下载选中"}
      </button>
    </aside>
  );
}

function RuleCard({ title, caption, ok }: { title: string; caption: string; ok: boolean }): ReactNode {
  return (
    <div className={`export-rule-card ${ok ? "ok" : "muted"}`}>
      <CheckCircle2 size={16} />
      <div>
        <strong>{title}</strong>
        <small>{caption}</small>
      </div>
    </div>
  );
}
