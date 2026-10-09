import { ArrowUpRight, Bell, Folder, RefreshCw, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Job, type MediaLibrary } from "../../lib/api";
import { jobTypeLabel, statusLabel } from "../../lib/jobs";
import { useSubscriptionUpdates } from "../subscriptions/useSubscriptionUpdates";

export function HomeActivity() {
  const { updates, error: updatesError } = useSubscriptionUpdates(1, true);
  const [libraries, setLibraries] = useState<MediaLibrary[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false, timer = 0;
    async function load() {
      if (document.hidden || document.querySelector<HTMLElement>(".app-route-archive")?.inert) {
        if (!stopped) timer = window.setTimeout(load, 15000);
        return;
      }
      const results = await Promise.allSettled([api.mediaLibraries(), api.jobs()]);
      if (stopped) return;
      if (results[0].status === "fulfilled") setLibraries(results[0].value.result);
      if (results[1].status === "fulfilled") setJobs(results[1].value.result.filter(job => ["running", "queued", "paused", "cancelling", "failed"].includes(job.status)));
      setError(results.some(result => result.status === "rejected") ? "部分活动读取失败" : "");
      timer = window.setTimeout(load, 15000);
    }
    void load();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [revision]);
  const issues = libraries?.filter(library => library.enabled && (library.health === "offline" || library.health === "partial" || library.error_count > 0 || library.missing_count > 0)) ?? [];
  return <div className="folio-home-activity">
    <a className="folio-home-activity-link" href="#discover?view=updates" aria-label="订阅更新">
      <Bell size={19} /><span>订阅更新<strong>{updates?.unread_count ?? "…"}</strong></span>
      <small>{updates?.unread_count ? "未读作品" : updates ? "没有未读更新" : "正在读取…"}</small><ArrowUpRight size={14} />
    </a>
    <a className={"folio-home-activity-link" + (issues.length ? " has-issue" : "")} href="#files" aria-label="媒体库状态">
      <Folder size={19} /><span>媒体库<strong>{libraries ? libraries.filter(library => library.enabled).length : "…"}</strong></span>
      <small>{issues.length ? issues.length + " 个库需要检查" : libraries ? "目录与扫描" : "正在读取…"}</small><ArrowUpRight size={14} />
    </a>
    <a className="folio-home-activity-link" href="#tasks" aria-label="任务状态">
      <Workflow size={19} /><span>队列<strong>{jobs?.length ?? "…"}</strong></span>
      <small>{jobs?.length ? jobTypeLabel(jobs[0].type) + " · " + statusLabel(jobs[0].status) : jobs ? "没有待处理任务" : "正在读取…"}</small><ArrowUpRight size={14} />
    </a>
    {error || updatesError ? <div className="folio-home-feedback" role="alert"><span>{error || updatesError}</span><button type="button" aria-label="刷新首页活动" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /></button></div> : null}
  </div>;
}
