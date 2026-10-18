import { LibraryTag, LibraryWork } from "../../lib/api";

export { formatBytes, workTitle, workCoverHref } from "../../lib/format";

export function tagOfType(tags: LibraryTag[] | undefined, type: string): LibraryTag | undefined {
  return tags?.find((tag) => tag.type === type);
}

export function authorLine(work: LibraryWork): string {
  const tags = work.tags ?? [];
  const artist = tagOfType(tags, "artist");
  const group = tagOfType(tags, "group");
  const parts = [artist?.display, group?.display ? "社团 " + group.display : null].filter(Boolean) as string[];
  if (parts.length) return parts.join(" / ");
  return "未知作者";
}

export function languageLabel(work: LibraryWork): string {
  const values = (work.tags ?? []).filter(tag => tag.type === "language" && !isTranslationMarker(tag)).map(tag => tag.display);
  if (!values.length && work.language) values.push(...work.language.split(/[,，;/]+/));
  const labels: Record<string, string> = { chinese: "中文", zh: "中文", "zh-cn": "中文", "zh-tw": "中文", cn: "中文", chi: "中文", japanese: "日文", ja: "日文", jp: "日文", jpn: "日文", english: "英文", en: "英文", eng: "英文" };
  return [...new Set(values.filter(value => !value.toLowerCase().includes("translat")).map(value => labels[value.trim().toLowerCase()] || value.trim()))].join(" / ") || "语言未标注";
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
