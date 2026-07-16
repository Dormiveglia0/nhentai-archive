import type { FileDeleteTarget, FileEntry } from "../../lib/api";

export { formatCompactBytes as formatBytes } from "../../lib/format";

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

export function entryStatusLabel(entry: Pick<FileEntry, "flags" | "status">): string {
  return entry.flags.includes("size_mismatch") ? "体积不符" : statusLabel(entry.status);
}

export function kindLabel(kind: string): string {
  if (kind === "work") return "作品";
  if (kind === "orphan") return "孤立文件";
  if (kind === "stale") return "临时文件";
  return kind;
}

export function entryStatusTone(entry: Pick<FileEntry, "flags" | "status">): "ok" | "warn" | "loose" {
  if (entry.flags.includes("size_mismatch") || entry.status === "missing_source" || entry.status === "missing_cover") return "warn";
  if (entry.status === "orphan" || entry.status === "stale") return "loose";
  return "ok";
}

export function entryToTarget(entry: FileEntry): FileDeleteTarget {
  if (entry.kind === "work") return { kind: "work", work_id: entry.work_id };
  return { kind: entry.kind, path: entry.path };
}
