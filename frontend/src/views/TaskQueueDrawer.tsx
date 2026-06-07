import type { Task } from '../lib/api';

export function progress(task: Task) {
  if (Number.isFinite(task.progress) && task.progress > 0) return Math.min(100, Math.max(0, Math.round(task.progress)));
  if (task.progress_total > 0) return Math.min(100, Math.round((task.progress_current / task.progress_total) * 100));
  if (['success', 'completed'].includes(task.status)) return 100;
  return 0;
}

export function statusText(status: string) {
  const map: Record<string, string> = {
    queued: '等待中',
    running: '正在运行',
    downloading: '下载中',
    success: '已完成',
    completed: '已完成',
    failed: '失败',
    canceled: '已取消'
  };
  return map[status] || status || '未知';
}

export function taskTypeName(value: string) {
  const map: Record<string, string> = {
    import: '远端下载',
    local_upload: '本地上传',
    scan: '目录扫描',
    export: 'CBZ 导出'
  };
  return map[value] || value || '任务';
}
