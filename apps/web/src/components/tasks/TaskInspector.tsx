import { AlertTriangle, Check, Copy, Download, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { api, type Job, type JobLog } from "../../lib/api";
import {
  bulkExportExpired,
  bulkExportSkipped,
  canCancel,
  canDelete,
  canDownloadBulkExport,
  canPause,
  canResume,
  canRetry,
  formatDurationHint,
  formatTime,
  jobTypeLabel,
  libraryScanSkipped,
  numberTarget,
  stageLabel,
  statusLabel,
  statusTone,
  targetLabel,
} from "../../lib/jobs";

type Props = {
  job: Job | null;
  logs: JobLog[];
  logsLoading: boolean;
  retryingId: number | null;
  actingId: number | null;
  onRetry: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (id: number) => void;
};

export function TaskInspector(props: Props) {
  const [copied, setCopied] = useState(false);
  const { job } = props;

  useEffect(() => setCopied(false), [job?.id]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!job) return <aside className="folio-tasks-inspector"><div className="folio-tasks-inspector-empty">选择一个真实任务查看阶段、进度与日志。</div></aside>;

  const galleryId = numberTarget(job, "gallery_id");
  const workId = numberTarget(job, "work_id");
  const busy = props.retryingId === job.id || props.actingId === job.id;

  async function copyId() {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(String(job?.id));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <aside className="folio-tasks-inspector" aria-label={`任务 ${job.id} 详情`}>
      <header className="folio-tasks-inspector-head">
        <div><span>Task log</span><h2>{jobTypeLabel(job.type)}</h2><p className={`is-${statusTone(job.status)}`}><i aria-hidden="true" />{statusLabel(job.status)}</p></div>
        <strong>#{job.id}</strong>
      </header>

      <section className="folio-tasks-progress-detail">
        <div className="folio-tasks-progress-ring" style={{ "--task-progress": `${job.progress.percent * 3.6}deg` } as CSSProperties}>
          <span><strong>{job.progress.percent}%</strong><small>{statusLabel(job.status)}</small></span>
        </div>
        <div><span>当前阶段</span><strong>{stageLabel(job.stage)}</strong><small>{formatDurationHint(job)}</small></div>
      </section>

      <InspectorSection title="目标信息">
        {job.meta?.title ? (
          <div className="folio-tasks-inspector-work">
            {job.meta.cover_url ? <img src={job.meta.cover_url} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true" />}
            <div><strong>{job.meta.title}</strong>{job.meta.page_count ? <small>{job.meta.page_count}P</small> : null}</div>
          </div>
        ) : null}
        <dl className="folio-tasks-kv">
          <div><dt>目标</dt><dd>{targetLabel(job)}</dd></div>
          <div><dt>Gallery ID</dt><dd>{galleryId ?? "无"}</dd></div>
          <div><dt>Work ID</dt><dd>{workId ?? "未生成"}</dd></div>
          <div><dt>创建时间</dt><dd>{formatTime(job.created_at)}</dd></div>
          <div><dt>更新时间</dt><dd>{formatTime(job.updated_at)}</dd></div>
        </dl>
      </InspectorSection>

      {job.type === "bulk_export" ? (
        <InspectorSection title="导出产物">
          {canDownloadBulkExport(job) ? (
            <a className="folio-tasks-inspector-link" href={api.bulkExportDownloadUrl(job.id)} download><Download size={15} />下载 .zip（{job.target.output_name ?? "合集"}）</a>
          ) : job.status === "completed" ? (
            <p className="folio-tasks-boundary">{job.target.downloaded ? "产物已下载并清除。" : bulkExportExpired(job) ? "产物已过期清除。" : "产物已就绪。"}</p>
          ) : <p className="folio-tasks-boundary">完成后可下载临时产物；下载即删，24 小时后自动清理。</p>}
          {bulkExportSkipped(job).length ? <p className="folio-tasks-boundary">已跳过 {bulkExportSkipped(job).length} 部存在阻塞的作品。</p> : null}
        </InspectorSection>
      ) : null}

      {job.type === "library_scan" ? (
        <InspectorSection title="入库详情">
          <dl className="folio-tasks-kv"><div><dt>已入库</dt><dd>{numberTarget(job, "ingested") ?? 0} / {numberTarget(job, "total") ?? 0} 个</dd></div></dl>
          {libraryScanSkipped(job).length ? <p className="folio-tasks-boundary">跳过 {libraryScanSkipped(job).length} 个不可读或失败文件。</p> : null}
        </InspectorSection>
      ) : null}

      <InspectorSection title="错误 / 提示">
        {job.error ? <div className="folio-tasks-error-card"><AlertTriangle size={16} /><p>{job.error}</p>{job.retry_after ? <small>远端建议等待 {job.retry_after} 秒后重试。</small> : null}</div> : <p className="folio-tasks-boundary">当前任务没有错误记录。</p>}
      </InspectorSection>

      <InspectorSection title="操作">
        <div className="folio-tasks-inspector-actions">
          <button type="button" disabled={!canRetry(job) || busy} onClick={() => props.onRetry(job.id)}><RotateCcw size={15} />{props.retryingId === job.id ? "重试中" : "重试"}</button>
          <button type="button" disabled={!canPause(job) || busy} onClick={() => props.onPause(job.id)}><Pause size={15} />暂停</button>
          <button type="button" disabled={!canResume(job) || busy} onClick={() => props.onResume(job.id)}><Play size={15} />恢复</button>
          <button type="button" disabled={!canCancel(job) || busy} onClick={() => props.onCancel(job.id)}><X size={15} />取消</button>
          <button type="button" onClick={() => void copyId()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "已复制" : "复制 ID"}</button>
          <button className="is-danger" type="button" disabled={!canDelete(job) || busy} onClick={() => props.onDelete(job.id)}><Trash2 size={15} />删除</button>
        </div>
      </InspectorSection>

      <InspectorSection title="任务日志" className="folio-tasks-log-section">
        {props.logsLoading ? <p className="folio-tasks-boundary">正在读取日志…</p> : props.logs.length ? (
          <ol className="folio-tasks-log">
            {props.logs.map((entry) => <li key={entry.id} className={entry.level === "error" ? "is-error" : ""}><time>{formatTime(entry.created_at)}</time><span>{entry.message}</span></li>)}
          </ol>
        ) : <p className="folio-tasks-boundary">该任务暂无日志。</p>}
      </InspectorSection>
    </aside>
  );
}

function InspectorSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`folio-tasks-inspector-section${className ? ` ${className}` : ""}`}><h3>{title}</h3>{children}</section>;
}
