import { AlertTriangle, ArrowUpRight, Loader2, Pause, RotateCcw, Target } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type Job } from "../../lib/api";
import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { canRetry, jobTypeLabel, stageLabel, statusLabel, targetLabel } from "../../lib/jobs";
import "./TaskDock.css";

export function TaskDock() {
  const reduceMotion = usePrefersReducedMotion();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const payload = await api.jobs();
      if (!mounted.current || request !== requestId.current) return;
      setJobs(payload.result);
      setError(null);
    } catch (reason) {
      if (mounted.current && request === requestId.current) setError(reason instanceof Error ? reason.message : String(reason));
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
      if (!disposed && !document.hidden) timer = window.setTimeout(() => void poll(), 2500);
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
  const shouldRender = Boolean(error) || activeJobs.length > 0 || failedJobs.length > 0;
  const visibleJobs = [...activeJobs, ...failedJobs].slice(0, 2);
  const relevantCount = activeJobs.length + failedJobs.length;

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
          <button className="folio-task-dock-head" type="button" onClick={() => navigate({ name: "tasks" })}>
            <span className="folio-task-dock-mark" aria-hidden="true"><Target size={17} /><i /></span>
            <span><small>LIVE OPERATIONS</small><strong>任务动态</strong></span>
            <em>{relevantCount}</em>
            <ArrowUpRight size={16} />
          </button>

          {error ? <p className="folio-task-dock-error" role="alert"><AlertTriangle size={15} /><span>{error}</span></p> : null}

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
                    <small title={failed ? job.error ?? targetLabel(job) : targetLabel(job)}>{failed ? job.error ?? targetLabel(job) : targetLabel(job)}</small>
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
