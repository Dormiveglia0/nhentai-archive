import { RefreshCw, Trash2 } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { STATUS_TABS } from "./taskHelpers";
import { TaskInspector } from "./TaskInspector";
import { TaskList } from "./TaskList";
import { TaskSummaryStrip } from "./TaskSummaryStrip";
import { useTasksState } from "./useTasksState";

export function TasksPage() {
  const vm = useTasksState();
  const openLogs = (id: number) => {
    vm.focusJob(id);
    window.requestAnimationFrame(() => {
      document.querySelector(".tasks-inspector")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  const clearFinished = () => {
    if (vm.finishedCount === 0) return;
    if (!window.confirm(`确定要清空 ${vm.finishedCount} 条已结束任务记录吗？此操作不可撤销。`)) return;
    void vm.clearFinished();
  };

  return (
    <section className="page tasks-page">
      <div className="hero">
        <div>
          <h1>任务中心</h1>
          <p>追踪所有真实任务的状态与进度，确保每一次处理都可靠完成。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <TaskSummaryStrip summary={vm.summary} />

      {vm.error ? <div className="tasks-error">{vm.error}</div> : null}
      {vm.notice ? <div className="tasks-notice">{vm.notice}</div> : null}

      <FadeIn className="tasks-layout" y={8}>
        <div className="tasks-main">
          <div className="tasks-toolbar">
            <div className="tasks-tabs" role="tablist" aria-label="任务状态筛选">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={vm.statusFilter === tab.key ? "is-active" : ""}
                  type="button"
                  onClick={() => vm.setStatusFilter(tab.key)}
                >
                  {tab.label}
                  <span>{tab.key === "all" ? vm.summary.total : vm.summary[tab.key]}</span>
                </button>
              ))}
            </div>
            <input
              className="tasks-search"
              type="search"
              value={vm.query}
              onChange={(event) => vm.setQuery(event.target.value)}
              placeholder="搜索任务 ID、Gallery ID、阶段或错误..."
            />
            <button className="tasks-refresh" type="button" onClick={() => void vm.refresh()} disabled={vm.refreshing}>
              <RefreshCw size={15} className={vm.refreshing ? "spin" : undefined} />
              刷新
            </button>
            <button
              className="tasks-clear"
              type="button"
              onClick={clearFinished}
              disabled={vm.finishedCount === 0}
              title="删除所有已完成/失败/已取消的任务记录"
            >
              <Trash2 size={15} />
              清空已结束{vm.finishedCount > 0 ? ` (${vm.finishedCount})` : ""}
            </button>
          </div>

          <TaskList
            jobs={vm.visibleJobs}
            focusId={vm.focus?.id ?? null}
            loading={vm.loading}
            emptyLabel={
              vm.jobs.length === 0
                ? "当前没有真实任务。导入远端作品后，这里会显示下载与解析进度。"
                : "没有匹配的任务。"
            }
            retryingId={vm.retryingId}
            actingId={vm.actingId}
            onFocus={vm.focusJob}
            onOpenLogs={openLogs}
            onRetry={(id) => void vm.retryJob(id)}
            onPause={(id) => void vm.pauseJob(id)}
            onResume={(id) => void vm.resumeJob(id)}
            onCancel={(id) => void vm.cancelJob(id)}
            onDelete={(id) => void vm.deleteJob(id)}
          />
        </div>

        <TaskInspector
          job={vm.focus}
          logs={vm.logs}
          logsLoading={vm.logsLoading}
          retryingId={vm.retryingId}
          actingId={vm.actingId}
          onRetry={(id) => void vm.retryJob(id)}
          onPause={(id) => void vm.pauseJob(id)}
          onResume={(id) => void vm.resumeJob(id)}
          onCancel={(id) => void vm.cancelJob(id)}
          onDelete={(id) => void vm.deleteJob(id)}
        />
      </FadeIn>
    </section>
  );
}
