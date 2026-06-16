import { LibraryTag, LibraryWork } from "../../lib/api";

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[exponent]}`;
}

export function workTitle(work: LibraryWork): string {
  return work.title_japanese || work.pretty_title || work.title || `Work ${work.id}`;
}

export function tagOfType(tags: LibraryTag[] | undefined, type: string): LibraryTag | undefined {
  return tags?.find((tag) => tag.type === type);
}

export function authorLine(work: LibraryWork): string {
  const tags = work.tags ?? [];
  const artist = tagOfType(tags, "artist");
  const group = tagOfType(tags, "group");
  const parts = [artist?.display, group?.display].filter(Boolean) as string[];
  if (parts.length) return parts.join(" / ");
  return work.source === "remote" ? "作者标签待缓存" : "本地导入";
}

export function languageLabel(work: LibraryWork): string {
  return tagOfType(work.tags, "language")?.display || "语言未标注";
}

export function readStatusLabel(work: LibraryWork): { label: string; tone: "unread" | "reading" | "done" } {
  if (work.completed) return { label: "已读", tone: "done" };
  if ((work.progress_percent ?? 0) > 0) return { label: `阅读中 ${work.progress_percent}%`, tone: "reading" };
  return { label: "未读", tone: "unread" };
}

export const SORT_OPTIONS = [
  { value: "recent_updated", label: "最近更新" },
  { value: "recent_added", label: "最近添加" },
  { value: "recent_read", label: "最近阅读" },
  { value: "title", label: "标题 A–Z" },
  { value: "pages_desc", label: "页数最多" },
  { value: "pages_asc", label: "页数最少" },
];

export const READ_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unread", label: "未读" },
  { value: "reading", label: "阅读中" },
  { value: "completed", label: "已读" },
];

export const SOURCE_OPTIONS = [
  { value: "all", label: "全部来源" },
  { value: "remote", label: "远端入库" },
  { value: "local", label: "本地导入" },
];
