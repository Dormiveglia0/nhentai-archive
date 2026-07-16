import { BookOpen, CheckCheck, Circle, Database, HardDrive, Tags } from "lucide-react";

import type { LibrarySummary } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { FolioMetricGrid, type FolioMetricTone } from "../folio/ui/FolioMetricGrid";
import { formatBytes } from "./libraryHelpers";

export function LibrarySummaryStrip({ summary }: { summary: LibrarySummary | null }) {
  if (!summary) {
    return <div className="folio-library-summary-loading" role="status">正在读取真实馆藏摘要…</div>;
  }

  const metrics = [
    { label: "总收藏", value: summary.total, icon: Database, tone: "active" },
    { label: "已读", value: summary.completed, icon: CheckCheck, tone: "good" },
    { label: "阅读中", value: summary.reading, icon: BookOpen, tone: "active" },
    { label: "未读", value: summary.unread, icon: Circle, tone: "neutral" },
    { label: "待补标签", value: summary.untagged, icon: Tags, tone: summary.untagged ? "warning" : "good" },
    { label: "占用容量", value: summary.total_size_bytes, icon: HardDrive, format: formatBytes, tone: "muted" },
  ];

  return (
    <FolioMetricGrid
      ariaLabel="馆藏真实摘要"
      className="folio-library-summary"
      items={metrics.map((metric) => ({
        label: metric.label,
        icon: metric.icon,
        tone: metric.tone as FolioMetricTone,
        value: <NumberTicker value={metric.value} format={metric.format} />,
      }))}
    />
  );
}
