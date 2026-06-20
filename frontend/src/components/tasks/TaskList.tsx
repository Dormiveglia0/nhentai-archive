import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import type { Job } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import {
  canCancel,
  canDelete,
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
} from "./taskHelpers";

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

export function TaskList({
  jobs,
  focusId,
  loading,
  emptyLabel,
  retryingId,
  actingId,
  onFocus,
  onOpenLogs,
  onRetry,
  onPause,
  onResume,
  onCancel,
  onDelete,
}: Props) {
  if (loading) return <div className="tasks-empty">正在读取任务队列...</div>;
  if (jobs.length === 0) return <div className="tasks-empty">{emptyLabel}</div>;

  const signature = jobs.map((job) => job.id).join("-");

  return (
    <div className="tasks-table">
      <div className="tasks-thead">
        <span>任务</span>
        <span>目标 / 文件</span>
        <span>阶段</span>
        <span>进度</span>
        <span>时间</span>
        <span>操作</span>
      </div>
      <Stagger key={signature} className="tasks-tbody">
        {jobs.map((job) => (
          <StaggerItem key={job.id}>
            <div
              className={`tasks-trow tone-${statusTone(job.status)}${focusId === job.id ? " is-focused" : ""}${job.status === "failed" ? " is-failed" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onFocus(job.id)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onFocus(job.id);
              }}
            >
              <span className="tasks-kind">
                <span className="tasks-kind-icon">
                  <StatusIcon status={job.status} />
                </span>
                <span>
                  <strong>{jobTypeLabel(job.type)}</strong>
                  <small>{jobTypeDescription(job.type)}</small>
                </span>
              </span>
              <TargetCell job={job} />
              <span className={`tasks-status tasks-status-${job.status}`}>
                {stageLabel(job.stage)}
                <small>{statusLabel(job.status)}</small>
              </span>
              <span className="tasks-progress-cell">
                <progress max="100" value={job.progress.percent} />
                <em>{job.progress.percent}%</em>
              </span>
              <span className="tasks-time">
                {formatTime(job.updated_at)}
                <small>{formatDurationHint(job)}</small>
              </span>
              <span className="tasks-actions">
                {canRetry(job) ? (
                  <button
                    type="button"
                    className="tasks-row-action"
                    disabled={retryingId === job.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRetry(job.id);
                    }}
                  >
                    <RotateCcw size={14} />
                    {retryingId === job.id ? "重试中" : "重试"}
                  </button>
                ) : canPause(job) ? (
                  <button
                    type="button"
                    className="tasks-row-action"
                    disabled={actingId === job.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPause(job.id);
                    }}
                  >
                    <Pause size={14} />
                    暂停
                  </button>
                ) : canResume(job) ? (
                  <button
                    type="button"
                    className="tasks-row-action"
                    disabled={actingId === job.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onResume(job.id);
                    }}
                  >
                    <Play size={14} />
                    恢复
                  </button>
                ) : (
                  <span className="tasks-row-muted">
                    <MoreHorizontal size={15} />
                    查看
                  </span>
                )}
                {canCancel(job) ? (
                  <button
                    type="button"
                    className="tasks-row-action tasks-row-danger"
                    disabled={actingId === job.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancel(job.id);
                    }}
                  >
                    <X size={14} />
                    取消
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tasks-row-action tasks-row-secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenLogs(job.id);
                  }}
                >
                  <FileText size={14} />
                  日志
                </button>
                {canDelete(job) ? (
                  <button
                    type="button"
                    className="tasks-row-action tasks-row-danger"
                    disabled={actingId === job.id}
                    title="删除该任务记录"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(job.id);
                    }}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                ) : null}
              </span>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function TargetCell({ job }: { job: Job }) {
  const meta = job.meta;
  const title = meta?.title?.trim();
  if (!title) {
    return <span className="tasks-target">{targetLabel(job)}</span>;
  }
  const pages = meta?.page_count ? `${meta.page_count}P` : null;
  const sub = [targetLabel(job), pages].filter(Boolean).join(" · ");
  return (
    <span className="tasks-target tasks-target-rich">
      {meta?.cover_url ? (
        <img className="tasks-target-cover" src={meta.cover_url} alt="" loading="lazy" />
      ) : (
        <span className="tasks-target-cover is-empty" aria-hidden="true" />
      )}
      <span className="tasks-target-text">
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
    </span>
  );
}

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "running") return <Loader2 size={18} className="spin" />;
  if (status === "queued") return <Clock3 size={18} />;
  if (status === "paused") return <Clock3 size={18} />;
  if (status === "failed") return <AlertTriangle size={18} />;
  return <CheckCircle2 size={18} />;
}
