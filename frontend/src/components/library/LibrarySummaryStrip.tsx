import { BookOpen, CheckCheck, Circle, Database, HardDrive, Tags } from "lucide-react";

import type { LibrarySummary } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { formatBytes } from "./libraryHelpers";

export function LibrarySummaryStrip({ summary }: { summary: LibrarySummary | null }) {
  if (!summary) {
    return <div className="folio-library-summary-loading" role="status">正在读取真实馆藏摘要…</div>;
  }

  const metrics = [
    { label: "总收藏", value: summary.total, icon: Database },
    { label: "已读", value: summary.completed, icon: CheckCheck },
    { label: "阅读中", value: summary.reading, icon: BookOpen },
    { label: "未读", value: summary.unread, icon: Circle },
    { label: "待补标签", value: summary.untagged, icon: Tags },
    { label: "占用容量", value: summary.total_size_bytes, icon: HardDrive, format: formatBytes },
  ];

  return (
    <section className="folio-library-summary" aria-label="馆藏真实摘要">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label}>
            <Icon size={16} />
            <span>{metric.label}</span>
            <strong><NumberTicker value={metric.value} format={metric.format} /></strong>
          </article>
        );
      })}
    </section>
  );
}
