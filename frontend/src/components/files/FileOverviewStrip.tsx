import type { FileOverview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";

export function FileOverviewStrip({ overview }: { overview: FileOverview | null }) {
  if (!overview) return null;
  const metrics: { label: string; value: string; tone?: string }[] = [
    { label: "作品数", value: String(overview.work_count) },
    { label: "源占用", value: formatBytes(overview.source_bytes) },
    { label: "缺失源", value: String(overview.missing_source), tone: overview.missing_source ? "warn" : undefined },
    { label: "缺失封面", value: String(overview.missing_cover), tone: overview.missing_cover ? "warn" : undefined },
    { label: "孤立文件", value: String(overview.orphan_count) },
    { label: "临时残留", value: String(overview.stale_count) },
    { label: "可回收", value: formatBytes(overview.reclaimable_bytes), tone: "accent" },
  ];
  return (
    <div className="files-overview">
      {metrics.map((m) => (
        <div key={m.label} className={`files-metric${m.tone ? ` files-metric-${m.tone}` : ""}`}>
          <span className="files-metric-value">{m.value}</span>
          <span className="files-metric-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
