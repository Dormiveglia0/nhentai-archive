import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api, Job } from "../../lib/api";

export function TaskDock() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const payload = await api.jobs();
        if (!cancelled) {
          setJobs(payload.result);
          setError(null);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc));
      }
    };
    load();
    const timer = window.setInterval(load, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "running" || job.status === "queued").slice(0, 3),
    [jobs]
  );
  const failedJobs = jobs.filter((job) => job.status === "failed");

  return (
    <aside className="task-dock">
      <div className="dock-title">
        <Target size={22} />
        <strong>任务中心</strong>
        <span>{jobs.length}</span>
      </div>
      {error ? <p className="dock-error">{error}</p> : null}
      {!error && jobs.length === 0 ? <p className="dock-empty">暂无后台任务</p> : null}
      {activeJobs.map((job) => (
        <div className="dock-job" key={job.id}>
          <Loader2 size={18} className="spin" />
          <div>
            <strong>{stageLabel(job.stage)}</strong>
            <small>{targetLabel(job)}</small>
          </div>
          <progress max="100" value={job.progress.percent} />
          <span>{job.progress.percent}%</span>
        </div>
      ))}
      {failedJobs.slice(0, 2).map((job) => (
        <div className="dock-job failed" key={job.id}>
          <AlertTriangle size={18} />
          <div>
            <strong>任务失败</strong>
            <small>{job.error}</small>
          </div>
          <button type="button" onClick={() => api.retryJob(job.id)}>
            <RotateCcw size={15} />
            重试
          </button>
        </div>
      ))}
      {jobs.some((job) => job.status === "completed") ? (
        <div className="dock-complete">
          <CheckCircle2 size={17} />
          最近完成 {jobs.filter((job) => job.status === "completed").length} 项
        </div>
      ) : null}
    </aside>
  );
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    queued: "等待中",
    fetching_gallery: "获取作品信息",
    requesting_download_url: "请求下载地址",
    downloading_cbz: "下载 CBZ",
    indexing_archive: "解析入库",
    completed: "已完成"
  };
  return labels[stage] ?? stage;
}

function targetLabel(job: Job) {
  const galleryId = job.target.gallery_id;
  const workId = job.target.work_id;
  if (galleryId) return `Gallery ID ${galleryId}`;
  if (workId) return `Work ${workId}`;
  return job.type;
}
