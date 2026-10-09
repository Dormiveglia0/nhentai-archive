import { ArrowUpRight, Bell, Folder, RefreshCw, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Job, type MediaLibrary } from "../../lib/api";
import { jobTypeLabel, statusLabel, targetLabel } from "../../lib/jobs";
import { pageHref } from "../../lib/navigation";
import { useSubscriptionUpdates } from "../subscriptions/useSubscriptionUpdates";
import { AmbientCover } from "../folio/ui/AmbientCover";

export function HomeActivity({ blurCovers }: { blurCovers: boolean }) {
  const { updates, error: updatesError } = useSubscriptionUpdates(1, true);
  const [libraries, setLibraries] = useState<MediaLibrary[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
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
    return () => { stopped = true; alive.current = false; window.clearTimeout(timer); };
  }, [revision]);
  const issues = libraries?.filter(library => library.enabled && (library.health === "offline" || library.health === "partial" || library.error_count > 0 || library.missing_count > 0)) ?? [];
  const inProgress = libraries?.filter(library => library.scanning || library.active_scan_job_id || library.pending_count > 0) ?? [];
  return <div className="folio-home-activity">
    <section className="folio-home-updates" aria-label="订阅更新">
      <header><h2>订阅更新{updates?.unread_count ? <span>{updates.unread_count}</span> : null}</h2><a href="#discover?view=updates">查看全部<ArrowUpRight size={15} /></a></header>
      {updates?.result.length ? <div className="folio-home-update-list">{updates.result.slice(0, 3).map(update => {
        const title = update.gallery.title_japanese || update.gallery.pretty_title || update.gallery.title;
        return <a key={update.id} href={pageHref({ name: "gallery", galleryId: update.gallery_id, returnTo: "workbench" })} className="folio-home-update" onClick={() => void api.readSubscriptionUpdates(update.id).catch(() => { if (alive.current) setError("未能标记已读"); })}>
          <div className="folio-home-update-cover">{update.gallery.thumbnail.url ? <AmbientCover src={update.gallery.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <Bell size={22} />}</div>
          <div><strong title={title}>{title}</strong><span>{update.name}</span><small>{update.gallery.page_count} 页{update.gallery.work_id ? " · 已导入" : ""}</small></div><ArrowUpRight size={18} />
        </a>;
      })}</div> : <div className="folio-home-quiet"><Bell size={24} strokeWidth={1.25} /><span>{updates ? "没有未读更新" : "正在读取更新…"}</span><a href="#discover?view=subscriptions">管理订阅<ArrowUpRight size={15} /></a></div>}
    </section>
    <section className="folio-home-library-state" aria-label="媒体库状态">
      <header><h2>媒体库</h2><a href="#files">管理<ArrowUpRight size={15} /></a></header>
      {libraries ? <><a className={issues.length ? "folio-home-state-row has-issue" : "folio-home-state-row"} href="#files"><Folder size={23} strokeWidth={1.25} /><span><strong>{issues.length ? `${issues.length} 个库需要检查` : `${libraries.filter(library => library.enabled).length} 个库已启用`}</strong><small>{issues.length ? issues.map(library => library.name).join("、") : inProgress.length ? `${inProgress.length} 个库正在扫描或等待文件稳定` : libraries.some(library => !library.enabled) ? `${libraries.filter(library => !library.enabled).length} 个库已暂停` : "查看目录与扫描记录"}</small></span><ArrowUpRight size={17} /></a>
        {libraries.find(library => library.kind === "managed" && library.work_count > 0) ? <a className="folio-home-migrate-link" href="#files?view=migration">归并本地导入<ArrowUpRight size={15} /></a> : null}
      </> : <p className="folio-home-pending">正在读取媒体库…</p>}
    </section>
    <section className="folio-home-jobs" aria-label="任务状态">
      <header><h2>队列{jobs?.length ? <span>{jobs.length}</span> : null}</h2><a href="#tasks">查看<ArrowUpRight size={15} /></a></header>
      {jobs?.length ? jobs.slice(0, 2).map(job => <a className={job.status === "failed" ? "folio-home-state-row has-issue" : "folio-home-state-row"} href="#tasks" key={job.id}><Workflow size={23} strokeWidth={1.25} /><span><strong>{jobTypeLabel(job.type)} · {statusLabel(job.status)}</strong><small>{job.meta?.title || String(job.target.library_name || job.target.title || targetLabel(job))}</small>{["running", "queued", "paused"].includes(job.status) ? <span className="folio-home-job-progress" role="progressbar" aria-label="任务进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress.percent}><i style={{ transform: `scaleX(${job.progress.percent / 100})` }} /></span> : null}</span><ArrowUpRight size={17} /></a>) : <div className="folio-home-quiet"><Workflow size={24} strokeWidth={1.25} /><span>{jobs ? "没有待处理任务" : "正在读取队列…"}</span></div>}
    </section>
    {error || updatesError ? <div className="folio-home-activity-error" role="alert"><span>{error || updatesError}</span><button type="button" aria-label="刷新首页活动" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /></button></div> : null}
  </div>;
}
