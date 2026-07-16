import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { m } from "motion/react";

import { FadeIn } from "../../lib/motion";
import { FolioSearchField } from "../folio/ui/FolioPrimitives";
import { STATUS_TABS } from "../../lib/jobs";
import { TaskInspector } from "./TaskInspector";
import { TaskList } from "./TaskList";
import { TaskSummaryStrip } from "./TaskSummaryStrip";
import { useTasksState } from "./useTasksState";
import "./TasksPage.css";

export function TasksPage() {
  const tasks = useTasksState();

  function openLogs(id: number) {
    tasks.focusJob(id);
    window.requestAnimationFrame(() => document.querySelector(".folio-tasks-log-section")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function clearFinished() {
    if (!tasks.finishedCount) return;
    if (!window.confirm(`确定清空 ${tasks.finishedCount} 条已结束任务记录吗？此操作不可撤销。`)) return;
    void tasks.clearFinished();
  }

  return (
    <section className="folio-page-body folio-tasks-page">
      <TaskSummaryStrip summary={tasks.summary} />

      {tasks.error ? <FadeIn key={tasks.error} className="folio-tasks-message is-error" role="alert" y={6}><AlertCircle size={15} /><p>{tasks.error}</p></FadeIn> : null}
      {tasks.notice ? <FadeIn key={tasks.notice} className="folio-tasks-message" role="status" y={6}><span aria-hidden="true" /><p>{tasks.notice}</p></FadeIn> : null}

      <section className="folio-tasks-toolbar">
        <div className="folio-tasks-tabs" role="group" aria-label="任务状态筛选">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} type="button" aria-pressed={tasks.statusFilter === tab.key} className={tasks.statusFilter === tab.key ? "is-active" : ""} onClick={() => tasks.setStatusFilter(tab.key)}>
              {tasks.statusFilter === tab.key ? <m.span className="folio-tasks-tab-active" layoutId="folio-formal-task-tab" /> : null}
              <span>{tab.label}</span><small>{tab.key === "all" ? tasks.summary.total : tasks.summary[tab.key]}</small>
            </button>
          ))}
        </div>
        <FolioSearchField value={tasks.query} onChange={tasks.setQuery} placeholder="搜索任务 ID、Gallery ID、阶段或错误" />
        <div className="folio-tasks-toolbar-actions">
          <button type="button" onClick={() => void tasks.refresh()} disabled={tasks.refreshing} aria-busy={tasks.refreshing}><RefreshCw size={15} className={tasks.refreshing ? "spin" : ""} />刷新</button>
          <button className="is-danger" type="button" onClick={clearFinished} disabled={!tasks.finishedCount}><Trash2 size={15} />清空已结束{tasks.finishedCount ? ` (${tasks.finishedCount})` : ""}</button>
        </div>
      </section>

      <FadeIn className="folio-tasks-layout" y={8}>
        <main className="folio-tasks-main">
          <TaskList
            jobs={tasks.visibleJobs}
            focusId={tasks.focus?.id ?? null}
            loading={tasks.loading}
            emptyLabel={tasks.jobs.length ? "没有匹配当前筛选条件的任务。" : "导入、扫描、治理或导出开始后，任务会按真实时间顺序出现在这里。"}
            retryingId={tasks.retryingId}
            actingId={tasks.actingId}
            onFocus={tasks.focusJob}
            onOpenLogs={openLogs}
            onRetry={(id) => void tasks.retryJob(id)}
            onPause={(id) => void tasks.pauseJob(id)}
            onResume={(id) => void tasks.resumeJob(id)}
            onCancel={(id) => void tasks.cancelJob(id)}
            onDelete={(id) => void tasks.deleteJob(id)}
          />
        </main>
        <TaskInspector
          job={tasks.focus}
          logs={tasks.logs}
          logsLoading={tasks.logsLoading}
          retryingId={tasks.retryingId}
          actingId={tasks.actingId}
          onRetry={(id) => void tasks.retryJob(id)}
          onPause={(id) => void tasks.pauseJob(id)}
          onResume={(id) => void tasks.resumeJob(id)}
          onCancel={(id) => void tasks.cancelJob(id)}
          onDelete={(id) => void tasks.deleteJob(id)}
        />
      </FadeIn>
    </section>
  );
}
