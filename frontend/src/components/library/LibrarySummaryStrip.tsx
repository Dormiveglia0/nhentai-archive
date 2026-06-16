import { LibrarySummary } from "../../lib/api";
import { formatBytes } from "./libraryHelpers";

type Props = {
  summary: LibrarySummary | null;
};

export function LibrarySummaryStrip({ summary }: Props) {
  const items: Array<{ label: string; value: string }> = summary
    ? [
        { label: "总收藏", value: summary.total.toLocaleString() },
        { label: "已读", value: summary.completed.toLocaleString() },
        { label: "阅读中", value: summary.reading.toLocaleString() },
        { label: "未读", value: summary.unread.toLocaleString() },
        { label: "待补标签", value: summary.untagged.toLocaleString() },
        { label: "占用容量", value: formatBytes(summary.total_size_bytes) },
      ]
    : [];

  return (
    <div className="library-summary">
      {items.map((item) => (
        <span key={item.label}>
          <strong>{item.value}</strong>
          {item.label}
        </span>
      ))}
      {!summary ? <span className="library-summary-loading">读取馆藏摘要…</span> : null}
    </div>
  );
}
