import { AlertTriangle, ArrowUpRight, Loader2, Pause, RotateCcw, Target, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type Job } from "../../lib/api";
import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import { pageHref } from "../../lib/navigation";
import { canRetry, formatDurationHint, jobTypeLabel, stageLabel, statusLabel, targetLabel } from "../../lib/jobs";
import "./TaskDock.css";

const DISMISSED_STORAGE_KEY = "nh-archive:task-dock-dismissed:v1";
type DismissedTasks = Record<string, string>;
let dismissedFallback: DismissedTasks | null = null;

function readDismissedTasks(): DismissedTasks {
  if (dismissedFallback) return dismissedFallback;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_STORAGE_KEY) ?? "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).filter(([, state]) => typeof state === "string"));
    }
  } catch {
    // Keep dismissals across route mounts when browser storage is unavailable.
  }
  return {};
}

function taskIdentity(job: Job) {
  return `${job.id}:${job.created_at}`;
}

function taskNoticeState(job: Job) {
  return job.status === "failed" ? `failed:${job.updated_at}` : "active";
}

export function TaskDock() {
  const reduceMotion = usePrefersReducedMotion();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dismissedTasks, setDismissedTasks] = useState(readDismissedTasks);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const requestId = useRef(0);
  const pollDelay = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const payload = await api.jobs();
      if (!mounted.current || request !== requestId.current) return;
      setJobs(payload.result);
      setError(null);
      pollDelay.current = payload.result.some((job) => (
        job.status === "running"
        || job.status === "queued"
        || job.status === "paused"
        || job.status === "cancelling"
      )) ? 2500 : 15000;
    } catch (reason) {
      if (mounted.current && request === requestId.current) {
        setError(reason instanceof Error ? reason.message : String(reason));
        pollDelay.current = 5000;
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    let disposed = false;
    const stop = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const poll = async () => {
      timer = null;
      if (!document.hidden) await load();
      if (!disposed && !document.hidden) timer = window.setTimeout(() => void poll(), pollDelay.current);
    };
    const start = () => {
      if (timer !== null || document.hidden || disposed) return;
      timer = window.setTimeout(() => void poll(), 0);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      requestId.current += 1;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => (
      job.status === "running"
      || job.status === "queued"
      || job.status === "paused"
      || job.status === "cancelling"
    )),
    [jobs]
  );
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const relevantJobs = [...activeJobs, ...failedJobs];
  const pendingNotices = relevantJobs.filter((job) => dismissedTasks[taskIdentity(job)] !== taskNoticeState(job));
  const visibleJobs = pendingNotices.slice(0, 2);
  const visibleError = error && dismissedTasks.error !== error ? error : null;
  const shouldRender = visibleJobs.length > 0 || Boolean(visibleError);

  function dismiss() {
    const next = new Map(Object.entries(dismissedTasks));
    for (const job of relevantJobs) {
      const identity = taskIdentity(job);
      next.delete(identity);
      next.set(identity, taskNoticeState(job));
    }
    if (error) next.set("error", error);
    dismissedFallback = Object.fromEntries([...next].slice(-200));
    setDismissedTasks(dismissedFallback);
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(dismissedFallback));
    } catch {
      // The in-memory copy still survives navigation.
    }
  }

  async function retry(job: Job) {
    if (!canRetry(job) || retryingId !== null) return;
    setRetryingId(job.id);
    setError(null);
    try {
      await api.retryJob(job.id);
      if (!mounted.current) return;
      await load();
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (mounted.current) setRetryingId(null);
    }
  }

  return (
    <AnimatePresence>
      {shouldRender ? (
        <m.aside
          className="folio-task-dock"
          aria-label="任务动态"
          initial={{ opacity: 0, x: reduceMotion ? 0 : 24, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : 18, y: 0 }}
          transition={{ duration: duration.base, ease: ease.standard }}
        >
          <button
            className="folio-task-dock-dismiss"
            type="button"
            aria-label="隐藏任务进度"
            onClick={dismiss}
          >
            <X size={15} />
          </button>

          <a className="folio-task-dock-head" href={pageHref({ name: "tasks" })}>
            <span className="folio-task-dock-mark" aria-hidden="true"><Target size={17} /><i /></span>
            <strong>任务动态</strong>
            <em>{pendingNotices.length}</em>
            <ArrowUpRight size={16} />
          </a>

          {visibleError ? <p className="folio-task-dock-error" role="alert"><AlertTriangle size={15} /><span>{visibleError}</span></p> : null}

          <div className="folio-task-dock-list">
            {visibleJobs.map((job) => {
              const failed = job.status === "failed";
              const paused = job.status === "paused";
              const percent = Math.max(0, Math.min(100, job.progress.percent));
              return (
                <article className={failed ? "is-failed" : "is-active"} key={job.id}>
                  <span className="folio-task-dock-status" aria-hidden="true">
                    {failed ? <AlertTriangle size={16} /> : paused ? <Pause size={16} /> : <Loader2 className="is-spinning" size={16} />}
                  </span>
                  <span className="folio-task-dock-copy">
                    <strong>{failed ? `${jobTypeLabel(job.type)}失败` : paused ? statusLabel(job.status) : stageLabel(job.stage)}</strong>
                    <small title={failed ? job.error ?? targetLabel(job) : targetLabel(job)}>{failed ? job.error ?? targetLabel(job) : job.stage === "downloading_cbz" ? formatDurationHint(job) : targetLabel(job)}</small>
                  </span>
                  {failed ? (
                    canRetry(job) ? <button type="button" onClick={() => void retry(job)} disabled={retryingId !== null}><RotateCcw size={14} />{retryingId === job.id ? "重试中" : "重试"}</button> : null
                  ) : (
                    <span className="folio-task-dock-percent">{percent}%</span>
                  )}
                  {!failed ? (
                    <span className="folio-task-dock-progress" role="progressbar" aria-label={`${jobTypeLabel(job.type)}进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                      <i style={{ width: `${percent}%` }} />
                    </span>
                  ) : null}
                </article>
              );
            })}
          </div>
        </m.aside>
      ) : null}
    </AnimatePresence>
  );
}
