import type { FileOverview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";

export function FileOverviewStrip({ overview }: { overview: FileOverview | null }) {
  if (!overview) return null;
  const metrics: { label: string; value: string; tone?: "warn" | "muted" }[] = [
    { label: "作品", value: String(overview.work_count) },
    { label: "源文件占用", value: formatBytes(overview.source_bytes) },
    { label: "缺失源", value: String(overview.missing_source), tone: overview.missing_source ? "warn" : "muted" },
    { label: "缺失封面", value: String(overview.missing_cover), tone: overview.missing_cover ? "warn" : "muted" },
    { label: "孤立文件", value: String(overview.orphan_count), tone: overview.orphan_count ? undefined : "muted" },
    { label: "临时残留", value: String(overview.stale_count), tone: overview.stale_count ? undefined : "muted" },
    { label: "可回收", value: formatBytes(overview.reclaimable_bytes) },
  ];
  return (
    <div className="files-summary">
      {metrics.map((m) => (
        <div key={m.label} className={`files-summary-metric${m.tone ? ` tone-${m.tone}` : ""}`}>
          <strong>{m.value}</strong>
          <span>{m.label}</span>
        </div>
      ))}
    </div>
  );
}
