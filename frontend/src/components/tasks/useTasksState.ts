import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../../lib/api";
import type { Job, JobLog } from "../../lib/api";
import { canRetry, isToday, jobTypeLabel, stageLabel, targetLabel, type JobStatusFilter } from "./taskHelpers";

export type TaskSummary = {
  total: number;
  running: number;
  queued: number;
  cancelling: number;
  failed: number;
  completed: number;
  paused: number;
  cancelled: number;
  today: number;
};

export type TasksViewModel = {
  jobs: Job[];
  visibleJobs: Job[];
  focus: Job | null;
  logs: JobLog[];
  summary: TaskSummary;
  loading: boolean;
  refreshing: boolean;
  logsLoading: boolean;
  error: string | null;
  notice: string | null;
  query: string;
  statusFilter: JobStatusFilter;
  retryingId: number | null;
  actingId: number | null;
  finishedCount: number;
  setQuery: (query: string) => void;
  setStatusFilter: (status: JobStatusFilter) => void;
  focusJob: (id: number) => void;
  retryJob: (id: number) => Promise<void>;
  pauseJob: (id: number) => Promise<void>;
  resumeJob: (id: number) => Promise<void>;
  cancelJob: (id: number) => Promise<void>;
  deleteJob: (id: number) => Promise<void>;
  clearFinished: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useTasksState(): TasksViewModel {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const jobsRequestRef = useRef(0);
  const logsRequestRef = useRef(0);

  const load = useCallback(async (preferredFocusId?: number | null, initial = false, showRefreshing = false) => {
    const requestId = ++jobsRequestRef.current;
    if (initial) setLoading(true);
    else if (showRefreshing) setRefreshing(true);
    try {
      const payload = await api.jobs();
      if (requestId !== jobsRequestRef.current) return;
      setJobs(payload.result);
      setError(null);
      setFocusId((current) => {
        const ids = new Set(payload.result.map((job) => job.id));
        if (preferredFocusId && ids.has(preferredFocusId)) return preferredFocusId;
        if (current && ids.has(current)) return current;
        return payload.result[0]?.id ?? null;
      });
    } catch (err) {
      if (requestId === jobsRequestRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === jobsRequestRef.current) {
        setLoading(false);
      }
      if (showRefreshing) setRefreshing(false);
    }
  }, []);

  const loadLogs = useCallback(async (jobId: number | null) => {
    const requestId = ++logsRequestRef.current;
    if (!jobId) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    try {
      const payload = await api.jobLogs(jobId);
      if (requestId === logsRequestRef.current) setLogs(payload.result);
    } catch (err) {
      if (requestId === logsRequestRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === logsRequestRef.current) setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(undefined, true);
    return () => {
      jobsRequestRef.current += 1;
      logsRequestRef.current += 1;
    };
  }, [load]);

  const hasActiveJobs = jobs.some((job) => job.status === "queued" || job.status === "running" || job.status === "cancelling");

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, load]);

  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (!normalized) return true;
      const haystack = [
        String(job.id),
        job.type,
        jobTypeLabel(job.type),
        job.status,
        job.stage,
        stageLabel(job.stage),
        targetLabel(job),
        job.error ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [jobs, query, statusFilter]);

  const focus = useMemo(() => {
    if (!focusId) return visibleJobs[0] ?? null;
    return visibleJobs.find((job) => job.id === focusId) ?? visibleJobs[0] ?? null;
  }, [focusId, visibleJobs]);

  useEffect(() => {
    void loadLogs(focus?.id ?? null);
  }, [focus?.id, loadLogs]);

  const summary = useMemo<TaskSummary>(() => {
    const base: TaskSummary = {
      total: jobs.length,
      running: 0,
      queued: 0,
      paused: 0,
      cancelling: 0,
      failed: 0,
      completed: 0,
      cancelled: 0,
      today: 0,
    };
    for (const job of jobs) {
      base[job.status] += 1;
      if (isToday(job.updated_at)) base.today += 1;
    }
    return base;
  }, [jobs]);

  const retryJob = useCallback(
    async (id: number) => {
      const job = jobs.find((item) => item.id === id);
      if (!job || !canRetry(job)) return;
      setRetryingId(id);
      setError(null);
      setNotice(null);
      try {
        const payload = await api.retryJob(id);
        setNotice(`任务 #${id} 已重新加入队列。`);
        await load(payload.id);
        await loadLogs(payload.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRetryingId(null);
      }
    },
    [jobs, load, loadLogs],
  );

  const runAction = useCallback(
    async (id: number, action: "pause" | "resume" | "cancel") => {
      setActingId(id);
      setError(null);
      setNotice(null);
      try {
        const payload =
          action === "pause"
            ? await api.pauseJob(id)
            : action === "resume"
              ? await api.resumeJob(id)
              : await api.cancelJob(id);
        const labels = { pause: "已暂停", resume: "已恢复", cancel: "已取消" };
        setNotice(`任务 #${id} ${labels[action]}。`);
        await load(payload.id);
        await loadLogs(payload.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActingId(null);
      }
    },
    [load, loadLogs],
  );

  const finishedCount = useMemo(
    () => jobs.filter((job) => job.status === "completed" || job.status === "failed" || job.status === "cancelled").length,
    [jobs],
  );

  const deleteJob = useCallback(
    async (id: number) => {
      if (!window.confirm(`确定删除任务 #${id} 的记录吗？此操作不可撤销。`)) return;
      setActingId(id);
      setError(null);
      setNotice(null);
      try {
        await api.deleteJob(id);
        setNotice(`任务 #${id} 记录已删除。`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActingId(null);
      }
    },
    [load],
  );

  const clearFinished = useCallback(async () => {
    setError(null);
    setNotice(null);
    try {
      const payload = await api.clearJobs();
      setNotice(`已清空 ${payload.deleted} 条已结束记录。`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [load]);

  const refresh = useCallback(() => load(focusId, false, true), [focusId, load]);

  return {
    jobs,
    visibleJobs,
    focus,
    logs,
    summary,
    loading,
    refreshing,
    logsLoading,
    error,
    notice,
    query,
    statusFilter,
    retryingId,
    actingId,
    finishedCount,
    setQuery,
    setStatusFilter,
    focusJob: setFocusId,
    retryJob,
    pauseJob: (id) => runAction(id, "pause"),
    resumeJob: (id) => runAction(id, "resume"),
    cancelJob: (id) => runAction(id, "cancel"),
    deleteJob,
    clearFinished,
    refresh,
  };
}
