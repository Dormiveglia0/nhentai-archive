import type { FileDeleteTarget, FileEntry } from "../../lib/api";

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const STATUS_LABELS: Record<string, string> = {
  ok: "正常",
  missing_source: "缺失源",
  missing_cover: "缺失封面",
  orphan: "孤立文件",
  stale: "临时残留",
  size_mismatch: "体积不符",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function targetKey(entry: FileEntry): string {
  return entry.id;
}

export function kindLabel(kind: string): string {
  if (kind === "work") return "作品";
  if (kind === "orphan") return "孤立文件";
  if (kind === "stale") return "临时文件";
  return kind;
}

export function statusTone(status: string): "ok" | "warn" | "loose" {
  if (status === "missing_source" || status === "missing_cover") return "warn";
  if (status === "orphan" || status === "stale") return "loose";
  return "ok";
}

export function entryToTarget(entry: FileEntry): FileDeleteTarget {
  if (entry.kind === "work") return { kind: "work", work_id: entry.work_id };
  return { kind: entry.kind, path: entry.path };
}
