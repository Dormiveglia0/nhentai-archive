import { AlertTriangle, Archive, Database, Recycle } from "lucide-react";

import type { FileOverview } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { FolioMetricGrid, type FolioMetricTone } from "../folio/ui/FolioMetricGrid";
import { formatBytes } from "./fileHelpers";

export function FileOverviewStrip({ overview }: { overview: FileOverview | null }) {
  const metrics = [
    { label: "馆藏作品", value: overview?.work_count, icon: Archive, tone: "active" },
    { label: "源文件占用", value: overview?.source_bytes, format: formatBytes, icon: Database, tone: "neutral" },
    {
      label: "索引异常",
      value: overview ? overview.missing_source + overview.missing_cover : undefined,
      tone: overview && overview.missing_source + overview.missing_cover > 0 ? "danger" : "good",
      icon: AlertTriangle,
    },
    { label: "可回收空间", value: overview?.reclaimable_bytes, format: formatBytes, icon: Recycle, tone: overview?.reclaimable_bytes ? "warning" : "good" },
  ];

  return (
    <FolioMetricGrid
      ariaLabel="文件概览"
      className="folio-files-summary"
      items={metrics.map(({ label, value, format, tone, icon }) => ({
        label,
        icon,
        tone: tone as FolioMetricTone,
        value: value == null ? "—" : <NumberTicker value={value} format={format} />,
      }))}
    />
  );
}
