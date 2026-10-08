import type { ReadingHistoryEntry } from "../../lib/api";
import { parseUtcTimestamp } from "../../lib/format";

// The API groups records by the browser's local date.
export function dateBucket(date: string): string {
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  const weekAgoStr = toLocalDateStr(weekAgo);

  if (date === todayStr) return "今天";
  if (date === yesterdayStr) return "昨天";
  if (date >= weekAgoStr) return "本周";
  return date;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function timeOfDay(iso: string): string {
  const date = parseUtcTimestamp(iso);
  return date ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date) : iso;
}

export type HistoryBucket = { label: string; entries: ReadingHistoryEntry[] };

export function groupByBucket(entries: ReadingHistoryEntry[]): HistoryBucket[] {
  const buckets: HistoryBucket[] = [];
  for (const entry of entries) {
    const label = dateBucket(entry.date);
    const last = buckets[buckets.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      buckets.push({ label, entries: [entry] });
    }
  }
  return buckets;
}

export function progressLabel(entry: ReadingHistoryEntry): { text: string; tone: "reading" | "done" } {
  if (entry.completed) return { text: "已读完", tone: "done" };
  return { text: `${entry.progress_percent}%`, tone: "reading" };
}
