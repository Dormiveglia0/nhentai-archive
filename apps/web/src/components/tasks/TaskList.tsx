import { AlertTriangle, CheckCircle2, Clock3, Download, Loader2, Pause, Play, RotateCcw, Trash2, Workflow, X } from "lucide-react";
import { api, type Job } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { canCancel, canDelete, canDownloadBulkExport, canPause, canResume, canRetry, formatDurationHint, formatTime, jobTypeLabel, stageLabel, statusLabel, statusTone, targetLabel } from "../../lib/jobs";

type Props = {
  jobs: Job[]; focusId: number | null; loading: boolean; emptyLabel: string; blurCovers: boolean;
  retryingId: number | null; actingId: number | null;
  onFocus: (id: number) => void; onRetry: (id: number) => void;
  onPause: (id: number) => void; onResume: (id: number) => void; onCancel: (id: number) => void; onDelete: (id: number) => void;
};

const ACTIVE = new Set<Job["status"]>(["running", "queued", "paused", "cancelling"]);

export function TaskList(props: Props) {
  if (props.loading) return <div className="folio-tasks-loading" role="status">正在读取任务…</div>;
  if (props.jobs.length === 0) return <FolioEmptyState icon={Workflow} title="暂无任务" copy={props.emptyLabel} />;
  const groups = [
    { title: "进行中", jobs: props.jobs.filter(job => ACTIVE.has(job.status)) },
    { title: "已结束", jobs: props.jobs.filter(job => !ACTIVE.has(job.status)) },
  ];
  return <div className="folio-tasks-table">
    {groups.filter(group => group.jobs.length).map(group => <section className="folio-tasks-group" key={group.title}>
      <h2>{group.title}<span>{group.jobs.length}</span></h2>
      <Stagger className="folio-tasks-row-list">
        {group.jobs.map(job => <StaggerItem key={job.id} className="folio-tasks-row-motion">
          <article data-status={job.status} className={`folio-tasks-row is-${statusTone(job.status)}${props.focusId === job.id ? " is-focused" : ""}`}>
            <button className="folio-tasks-row-main" type="button" onClick={() => props.onFocus(job.id)} aria-label={`查看任务 ${job.id}：${jobTypeLabel(job.type)}`} aria-pressed={props.focusId === job.id}>
              <span className="folio-tasks-kind-icon"><StatusIcon status={job.status} /></span>
              <span className="folio-tasks-row-content">
                <span className="folio-tasks-kind"><strong>{jobTypeLabel(job.type)}</strong><small>#{job.id}</small><em className={`is-${job.status}`}>{statusLabel(job.status)}</em></span>
                <span className="folio-tasks-target">
                  {job.meta?.cover_url ? <img className={props.blurCovers ? "folio-media-blurred" : ""} src={job.meta.cover_url} alt="" loading="lazy" decoding="async" /> : null}
                  <strong title={job.meta?.title || targetLabel(job)}>{job.meta?.title || targetLabel(job)}</strong>
                </span>
                <span className="folio-tasks-stage">{stageLabel(job.stage) !== statusLabel(job.status) ? <span>{stageLabel(job.stage)}</span> : null}<small>{formatTime(job.updated_at)}</small></span>
                <span className="folio-tasks-progress"><span role="progressbar" aria-label="任务进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress.percent}><i style={{ transform: `scaleX(${job.progress.percent / 100})` }} /></span><em>{job.progress.percent}%</em></span>
                {ACTIVE.has(job.status) ? <small className="folio-tasks-transfer">{formatDurationHint(job)}</small> : null}
              </span>
            </button>
            <div className="folio-tasks-row-actions">
              {canDownloadBulkExport(job) ? <a href={api.bulkExportDownloadUrl(job.id)} download aria-label="下载"><Download size={15} /><span>下载</span></a> : null}
              {canRetry(job) ? <button type="button" aria-label="重试" disabled={props.retryingId === job.id} onClick={() => props.onRetry(job.id)}><RotateCcw size={15} /><span>{props.retryingId === job.id ? "重试中" : "重试"}</span></button>
                : canPause(job) ? <button type="button" aria-label="暂停" disabled={props.actingId === job.id} onClick={() => props.onPause(job.id)}><Pause size={15} /><span>暂停</span></button>
                : canResume(job) ? <button type="button" aria-label="恢复" disabled={props.actingId === job.id} onClick={() => props.onResume(job.id)}><Play size={15} /><span>恢复</span></button> : null}
              {canCancel(job) ? <button className="is-danger" type="button" aria-label="取消" disabled={props.actingId === job.id} onClick={() => props.onCancel(job.id)}><X size={15} /><span>取消</span></button> : null}
              {canDelete(job) ? <button className="is-danger" type="button" aria-label="删除" disabled={props.actingId === job.id} onClick={() => props.onDelete(job.id)}><Trash2 size={15} /><span>删除</span></button> : null}
            </div>
          </article>
        </StaggerItem>)}
      </Stagger>
    </section>)}
  </div>;
}

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "running") return <Loader2 size={20} className="spin" />;
  if (status === "paused") return <Pause size={19} />;
  if (status === "cancelling" || status === "cancelled") return <X size={19} />;
  if (status === "queued") return <Clock3 size={20} />;
  if (status === "failed") return <AlertTriangle size={20} />;
  return <CheckCircle2 size={20} />;
}
