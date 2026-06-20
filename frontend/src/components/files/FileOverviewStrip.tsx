import type { FileOverview } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { formatBytes } from "./fileHelpers";

export function FileOverviewStrip({ overview }: { overview: FileOverview | null }) {
  if (!overview) return null;
  const metrics: { label: string; value: number; format?: (n: number) => string; tone?: "warn" | "muted" }[] = [
    { label: "作品", value: overview.work_count },
    { label: "源文件占用", value: overview.source_bytes, format: formatBytes },
    { label: "缺失源", value: overview.missing_source, tone: overview.missing_source ? "warn" : "muted" },
    { label: "缺失封面", value: overview.missing_cover, tone: overview.missing_cover ? "warn" : "muted" },
    { label: "孤立文件", value: overview.orphan_count, tone: overview.orphan_count ? undefined : "muted" },
    { label: "临时残留", value: overview.stale_count, tone: overview.stale_count ? undefined : "muted" },
    { label: "可回收", value: overview.reclaimable_bytes, format: formatBytes },
  ];
  return (
    <Stagger className="files-summary">
      {metrics.map((m) => (
        <StaggerItem key={m.label} className={`files-summary-metric${m.tone ? ` tone-${m.tone}` : ""}`}>
          <strong><NumberTicker value={m.value} format={m.format} /></strong>
          <span>{m.label}</span>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
