import type { Job } from "../../lib/api";

export type JobStatusFilter = "all" | Job["status"];

export const STATUS_TABS: Array<{ key: JobStatusFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "running", label: "正在运行" },
  { key: "paused", label: "已暂停" },
  { key: "queued", label: "等待中" },
  { key: "cancelling", label: "取消中" },
  { key: "failed", label: "失败" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];

export function statusLabel(status: Job["status"]) {
  const labels: Record<Job["status"], string> = {
    queued: "等待中",
    running: "正在运行",
    paused: "已暂停",
    cancelling: "取消中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

export function jobTypeLabel(type: string) {
  const labels: Record<string, string> = {
    remote_import: "远端下载",
    bulk_export: "批量导出",
    library_scan: "扫描库",
  };
  return labels[type] ?? type;
}

export function jobTypeDescription(type: string) {
  const labels: Record<string, string> = {
    remote_import: "从远端存储下载并解析入库",
    bulk_export: "打包多部作品为可下载合集（临时产物·下载即删）",
    library_scan: "扫描库目录并把未索引的 CBZ 入库",
  };
  return labels[type] ?? "任务";
}

export function statusTone(status: Job["status"]): "ok" | "warn" | "bad" | "muted" {
  if (status === "running") return "ok";
  if (status === "queued" || status === "paused" || status === "cancelling") return "warn";
  if (status === "failed") return "bad";
  return "muted";
}

export function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    queued: "等待中",
    fetching_gallery: "获取作品信息",
    requesting_download_url: "请求下载地址",
    downloading_cbz: "下载 CBZ",
    indexing_archive: "解析入库",
    packaging: "打包合集",
    ingesting: "入库中",
    completed: "已完成",
    failed: "失败",
    cancelling: "取消中",
    cancelled: "已取消",
  };
  return labels[stage] ?? stage;
}

export function targetLabel(job: Job) {
  if (job.type === "bulk_export") {
    const total = numberTarget(job, "total") ?? 0;
    const packaged = numberTarget(job, "packaged") ?? 0;
    return job.status === "completed" ? `已打包 ${packaged} 部` : `${packaged}/${total} 部`;
  }
  if (job.type === "library_scan") {
    const total = numberTarget(job, "total") ?? 0;
    const ingested = numberTarget(job, "ingested") ?? 0;
    return job.status === "completed" ? `已入库 ${ingested} 个` : `${ingested}/${total} 个`;
  }
  const galleryId = numberTarget(job, "gallery_id");
  const workId = numberTarget(job, "work_id");
  const alreadyImported = Boolean(job.target.already_imported);
  if (galleryId && workId && alreadyImported) return `Gallery ID ${galleryId} · 已入库 Work ${workId}`;
  if (galleryId) return `Gallery ID ${galleryId}`;
  if (workId) return `Work ${workId}`;
  return jobTypeLabel(job.type);
}

export function canRetry(job: Job) {
  if (job.status !== "failed") return false;
  if (job.type === "bulk_export") return true;
  return job.type === "remote_import" && Boolean(numberTarget(job, "gallery_id"));
}

export function bulkExportExpired(job: Job): boolean {
  const expiresAt = job.target.expires_at;
  if (typeof expiresAt !== "string" || !expiresAt) return false;
  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export function canDownloadBulkExport(job: Job): boolean {
  return (
    job.type === "bulk_export" &&
    job.status === "completed" &&
    !job.target.downloaded &&
    !bulkExportExpired(job)
  );
}

export function bulkExportSkipped(job: Job): Array<{ work_id: number; reason: string }> {
  const skipped = job.target.skipped;
  if (!Array.isArray(skipped)) return [];
  return skipped.filter((item): item is { work_id: number; reason: string } => "work_id" in item);
}

export function libraryScanSkipped(job: Job): Array<{ path: string; reason: string }> {
  const skipped = job.target.skipped;
  if (!Array.isArray(skipped)) return [];
  return skipped.filter((item): item is { path: string; reason: string } => "path" in item);
}

export function canPause(job: Job) {
  return job.status === "queued" || job.status === "running";
}

export function canResume(job: Job) {
  return job.status === "paused";
}

export function canCancel(job: Job) {
  return job.status === "queued" || job.status === "running" || job.status === "paused";
}

export function canDelete(job: Job) {
  return job.status === "completed" || job.status === "failed" || job.status === "cancelled";
}

export function numberTarget(job: Job, key: string) {
  const raw = job.target[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function formatTime(value?: string | null) {
  if (!value) return "未知";
  const date = parseJobDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDurationHint(job: Job) {
  if (job.retry_after && job.status === "failed") return `约 ${job.retry_after} 秒后可重试`;
  if (job.progress.total > 0) return `${job.progress.current} / ${job.progress.total}`;
  return statusLabel(job.status);
}

export function isToday(value?: string | null) {
  const date = parseJobDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function parseJobDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
