import { LibraryTag, LibraryWork } from "../../lib/api";

export { formatBytes, workTitle } from "../../lib/format";

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
  const language = work.tags?.find((tag) => tag.type === "language" && !isTranslationMarker(tag));
  if (language?.display) return language.display;
  if (work.language && !work.language.toLowerCase().includes("translat")) return work.language;
  return "语言未标注";
}

function isTranslationMarker(tag: LibraryTag): boolean {
  return [tag.name, tag.slug, tag.display].filter(Boolean).join(" ").toLowerCase().includes("translat");
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
