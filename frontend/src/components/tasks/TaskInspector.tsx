import { AlertTriangle, Copy, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";

import type { Job, JobLog } from "../../lib/api";
import {
  canCancel,
  canDelete,
  canPause,
  canResume,
  canRetry,
  formatDurationHint,
  formatTime,
  jobTypeLabel,
  numberTarget,
  stageLabel,
  statusLabel,
  statusTone,
  targetLabel,
} from "./taskHelpers";

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

export function TaskInspector({
  job,
  logs,
  logsLoading,
  retryingId,
  actingId,
  onRetry,
  onPause,
  onResume,
  onCancel,
  onDelete,
}: Props) {
  if (!job) {
    return (
      <aside className="tasks-inspector">
        <div className="tasks-inspector-empty">选择一个真实任务查看详情。</div>
      </aside>
    );
  }

  const galleryId = numberTarget(job, "gallery_id");
  const workId = numberTarget(job, "work_id");
  const retryable = canRetry(job);
  const busy = retryingId === job.id || actingId === job.id;

  return (
    <aside className="tasks-inspector">
      <div className="tasks-inspector-head">
        <div>
          <h3>{jobTypeLabel(job.type)}</h3>
          <p className={`tasks-inspector-state tone-${statusTone(job.status)}`}>
            <span className="tasks-state-dot" aria-hidden="true" />
            {statusLabel(job.status)}
          </p>
        </div>
        <span>#{job.id}</span>
      </div>

      <section className="tasks-inspector-section">
        <h4>目标信息</h4>
        {job.meta?.title ? (
          <div className="tasks-inspector-work">
            {job.meta.cover_url ? (
              <img className="tasks-inspector-cover" src={job.meta.cover_url} alt="" loading="lazy" />
            ) : (
              <span className="tasks-inspector-cover is-empty" aria-hidden="true" />
            )}
            <div className="tasks-inspector-work-text">
              <strong>{job.meta.title}</strong>
              {job.meta.page_count ? <span>{job.meta.page_count}P</span> : null}
            </div>
          </div>
        ) : null}
        <dl className="tasks-kv">
          <div>
            <dt>目标</dt>
            <dd>{targetLabel(job)}</dd>
          </div>
          <div>
            <dt>Gallery ID</dt>
            <dd>{galleryId ?? "无"}</dd>
          </div>
          <div>
            <dt>Work ID</dt>
            <dd>{workId ?? "未生成"}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{formatTime(job.created_at)}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{formatTime(job.updated_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="tasks-inspector-section">
        <h4>进度详情</h4>
        <div className="tasks-progress-detail">
          <div>
            <strong>{job.progress.percent}%</strong>
            <span>{stageLabel(job.stage)}</span>
          </div>
          <progress max="100" value={job.progress.percent} />
          <dl className="tasks-kv">
            <div>
              <dt>完成</dt>
              <dd>{job.progress.current} / {job.progress.total || "未知"}</dd>
            </div>
            <div>
              <dt>提示</dt>
              <dd>{formatDurationHint(job)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="tasks-inspector-section">
        <h4>错误 / 提示</h4>
        {job.error ? (
          <div className="tasks-error-card">
            <AlertTriangle size={16} />
            <p>{job.error}</p>
            {job.retry_after ? <small>远端建议等待 {job.retry_after} 秒后再重试。</small> : null}
          </div>
        ) : (
          <p className="tasks-boundary">当前任务没有错误记录。</p>
        )}
      </section>

      <section className="tasks-inspector-section">
        <h4>操作</h4>
        <div className="tasks-inspector-actions">
          <button type="button" disabled={!retryable || busy} onClick={() => onRetry(job.id)}>
            <RotateCcw size={15} />
            {retryingId === job.id ? "重试中" : "重试任务"}
          </button>
          <button type="button" disabled={!canPause(job) || busy} onClick={() => onPause(job.id)}>
            <Pause size={15} />
            暂停任务
          </button>
          <button type="button" disabled={!canResume(job) || busy} onClick={() => onResume(job.id)}>
            <Play size={15} />
            恢复任务
          </button>
          <button type="button" disabled={!canCancel(job) || busy} onClick={() => onCancel(job.id)}>
            <X size={15} />
            取消任务
          </button>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(String(job.id))}>
            <Copy size={15} />
            复制任务 ID
          </button>
          <button
            type="button"
            className="tasks-action-danger"
            disabled={!canDelete(job) || busy}
            onClick={() => onDelete(job.id)}
          >
            <Trash2 size={15} />
            删除记录
          </button>
        </div>
      </section>

      <section className="tasks-inspector-section">
        <h4>任务日志</h4>
        {logsLoading ? (
          <p className="tasks-boundary">正在读取日志...</p>
        ) : logs.length > 0 ? (
          <ol className="tasks-log">
            {logs.map((entry) => (
              <li key={entry.id} className={entry.level === "error" ? "is-error" : undefined}>
                <time>{formatTime(entry.created_at)}</time>
                <span>{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="tasks-boundary">该任务暂无日志。</p>
        )}
      </section>
    </aside>
  );
}
