import { AlertCircle, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SlidingIndicator, FadeIn, transitionTabs } from "../../lib/motion";
import { FolioSearchField } from "../folio/ui/FolioPrimitives";
import { STATUS_TABS } from "../../lib/jobs";
import { TaskInspector } from "./TaskInspector";
import { TaskList } from "./TaskList";
import { TaskSummaryStrip } from "./TaskSummaryStrip";
import { useTasksState } from "./useTasksState";
import { useNativeDialog } from "../../lib/useNativeDialog";
import "./TasksPage.css";

export function TasksPage({ blurCovers }: { blurCovers: boolean }) {
  const tasks = useTasksState();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const dismiss = useNativeDialog(dialogRef, () => setInspectorOpen(false), mobile && inspectorOpen);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const change = () => { setInspectorOpen(false); setMobile(media.matches); };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  function focusJob(id: number) {
    tasks.focusJob(id);
    if (window.matchMedia("(max-width: 900px)").matches) {
      setInspectorOpen(true);
    }
  }

  const inspector = <TaskInspector
    job={tasks.focus} blurCovers={blurCovers} logs={tasks.logs} logsLoading={tasks.logsLoading}
    retryingId={tasks.retryingId} actingId={tasks.actingId}
    onRetry={(id) => void tasks.retryJob(id)} onPause={(id) => void tasks.pauseJob(id)}
    onResume={(id) => void tasks.resumeJob(id)} onCancel={(id) => void tasks.cancelJob(id)} onDelete={(id) => void tasks.deleteJob(id)}
  />;

  function clearFinished() {
    if (!tasks.finishedCount) return;
    if (!window.confirm(`确定清空 ${tasks.finishedCount} 条已结束任务记录吗？此操作不可撤销。`)) return;
    void tasks.clearFinished();
  }

  return (
    <section className="folio-page-body folio-tasks-page">
      {tasks.error ? <FadeIn key={tasks.error} className="folio-tasks-message is-error" role="alert" y={6}><AlertCircle size={15} /><p>{tasks.error}</p></FadeIn> : null}
      {tasks.notice ? <FadeIn key={tasks.notice} className="folio-tasks-message" role="status" y={6}><span aria-hidden="true" /><p>{tasks.notice}</p></FadeIn> : null}

      <section className="folio-tasks-toolbar">
        <div className="folio-tasks-tabs" role="group" aria-label="任务状态筛选">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} type="button" aria-pressed={tasks.statusFilter === tab.key} className={tasks.statusFilter === tab.key ? "is-active" : ""} onClick={() => transitionTabs(STATUS_TABS.map(item => item.key), tasks.statusFilter, tab.key, tasks.setStatusFilter, "tasks")}>
              {tasks.statusFilter === tab.key ? <SlidingIndicator className="folio-tasks-tab-active" layoutId="folio-formal-task-tab" /> : null}
              <span>{tab.label}</span><small>{tab.key === "all" ? tasks.summary.total : tasks.summary[tab.key]}</small>
            </button>
          ))}
        </div>
        <FolioSearchField value={tasks.query} onChange={tasks.setQuery} placeholder="搜索任务、编号或错误" />
        <div className="folio-tasks-toolbar-actions">
          <button type="button" onClick={() => void tasks.refresh()} disabled={tasks.refreshing} aria-busy={tasks.refreshing}><RefreshCw size={15} className={tasks.refreshing ? "spin" : ""} />刷新</button>
          <button className="is-danger" type="button" onClick={clearFinished} disabled={!tasks.finishedCount}><Trash2 size={15} />清空已结束{tasks.finishedCount ? ` (${tasks.finishedCount})` : ""}</button>
        </div>
      </section>
      <TaskSummaryStrip summary={tasks.summary} />

      <FadeIn className="folio-tasks-layout" y={8}>
        <section className="folio-tasks-main" aria-label="任务列表">
          <TaskList
            jobs={tasks.visibleJobs}
            focusId={tasks.focus?.id ?? null}
            loading={tasks.loading}
            blurCovers={blurCovers}
            emptyLabel={tasks.jobs.length ? "没有符合筛选条件的任务。" : "导入或导出作品后，可在这里查看进度。"}
            retryingId={tasks.retryingId}
            actingId={tasks.actingId}
            onFocus={focusJob}
            onRetry={(id) => void tasks.retryJob(id)}
            onPause={(id) => void tasks.pauseJob(id)}
            onResume={(id) => void tasks.resumeJob(id)}
            onCancel={(id) => void tasks.cancelJob(id)}
            onDelete={(id) => void tasks.deleteJob(id)}
          />
        </section>
        {mobile ? null : inspector}
      </FadeIn>
      {mobile ? <dialog ref={dialogRef} className="folio-tasks-dialog" aria-label="任务详情">
        <header><span>任务详情</span><button type="button" aria-label="关闭任务详情" onClick={dismiss}><X size={18} /></button></header>
        {inspector}
      </dialog> : null}
    </section>
  );
}
