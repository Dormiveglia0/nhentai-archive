import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Workflow,
  X,
} from "lucide-react";

import { api, type Job } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import {
  canCancel,
  canDelete,
  canDownloadBulkExport,
  canPause,
  canResume,
  canRetry,
  formatDurationHint,
  formatTime,
  jobTypeDescription,
  jobTypeLabel,
  stageLabel,
  statusLabel,
  statusTone,
  targetLabel,
} from "../../lib/jobs";

type Props = {
  jobs: Job[];
  focusId: number | null;
  loading: boolean;
  emptyLabel: string;
  retryingId: number | null;
  actingId: number | null;
  onFocus: (id: number) => void;
  onOpenLogs: (id: number) => void;
  onRetry: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (id: number) => void;
};

export function TaskList(props: Props) {
  if (props.loading) return <div className="folio-tasks-loading" role="status">正在读取真实任务队列…</div>;
  if (props.jobs.length === 0) return <FolioEmptyState icon={Workflow} title="没有匹配的真实任务" copy={props.emptyLabel} />;

  const signature = props.jobs.map((job) => `${job.id}:${job.status}`).join("-");

  return (
    <div className="folio-tasks-table">
      <div className="folio-tasks-table-head" aria-hidden="true">
        <span>任务</span><span>目标 / 文件</span><span>阶段</span><span>进度</span><span>时间</span><span>操作</span>
      </div>
      <Stagger key={signature} className="folio-tasks-row-list">
        {props.jobs.map((job) => (
          <StaggerItem key={job.id} className="folio-tasks-row-motion">
            <article className={`folio-tasks-row is-${statusTone(job.status)}${props.focusId === job.id ? " is-focused" : ""}`}>
              <button className="folio-tasks-row-main" type="button" onClick={() => props.onFocus(job.id)} aria-label={`查看任务 ${job.id}：${jobTypeLabel(job.type)}`}>
                <span className="folio-tasks-kind">
                  <span className="folio-tasks-kind-icon"><StatusIcon status={job.status} /></span>
                  <span><strong>{jobTypeLabel(job.type)}</strong><small>{jobTypeDescription(job.type)}</small></span>
                </span>
                <TargetCell job={job} />
                <span className={`folio-tasks-stage is-${job.status}`}><strong>{stageLabel(job.stage)}</strong><small>{statusLabel(job.status)}</small></span>
                <span className="folio-tasks-progress">
                  <span role="progressbar" aria-label="任务进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress.percent}><i style={{ width: `${job.progress.percent}%` }} /></span>
                  <em>{job.progress.percent}%</em>
                </span>
                <span className="folio-tasks-time"><strong>{formatTime(job.updated_at)}</strong><small>{formatDurationHint(job)}</small></span>
              </button>
              <div className="folio-tasks-row-actions">
                {canDownloadBulkExport(job) ? (
                  <a href={api.bulkExportDownloadUrl(job.id)} download aria-label="下载"><Download size={14} /><span>下载</span></a>
                ) : null}
                {canRetry(job) ? (
                  <button type="button" aria-label="重试" disabled={props.retryingId === job.id} onClick={() => props.onRetry(job.id)}><RotateCcw size={14} /><span>{props.retryingId === job.id ? "重试中" : "重试"}</span></button>
                ) : canPause(job) ? (
                  <button type="button" aria-label="暂停" disabled={props.actingId === job.id} onClick={() => props.onPause(job.id)}><Pause size={14} /><span>暂停</span></button>
                ) : canResume(job) ? (
                  <button type="button" aria-label="恢复" disabled={props.actingId === job.id} onClick={() => props.onResume(job.id)}><Play size={14} /><span>恢复</span></button>
                ) : null}
                {canCancel(job) ? (
                  <button className="is-danger" type="button" aria-label="取消" disabled={props.actingId === job.id} onClick={() => props.onCancel(job.id)}><X size={14} /><span>取消</span></button>
                ) : null}
                <button type="button" aria-label="日志" onClick={() => props.onOpenLogs(job.id)}><FileText size={14} /><span>日志</span></button>
                {canDelete(job) ? (
                  <button className="is-danger" type="button" aria-label="删除" disabled={props.actingId === job.id} onClick={() => props.onDelete(job.id)}><Trash2 size={14} /><span>删除</span></button>
                ) : null}
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function TargetCell({ job }: { job: Job }) {
  const title = job.meta?.title?.trim();
  if (!title) return <span className="folio-tasks-target"><strong>{targetLabel(job)}</strong></span>;
  const sub = [targetLabel(job), job.meta?.page_count ? `${job.meta.page_count}P` : null].filter(Boolean).join(" · ");
  return (
    <span className="folio-tasks-target is-rich">
      {job.meta?.cover_url ? <img src={job.meta.cover_url} alt="" loading="lazy" decoding="async" /> : <span className="folio-tasks-cover-empty" aria-hidden="true" />}
      <span><strong>{title}</strong><small>{sub}</small></span>
    </span>
  );
}

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "running") return <Loader2 size={17} className="spin" />;
  if (status === "queued" || status === "paused" || status === "cancelling") return <Clock3 size={17} />;
  if (status === "failed") return <AlertTriangle size={17} />;
  return <CheckCircle2 size={17} />;
}
