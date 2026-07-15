import { AlertTriangle, Archive, Database, Recycle } from "lucide-react";

import type { FileOverview } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { formatBytes } from "./fileHelpers";

export function FileOverviewStrip({ overview }: { overview: FileOverview | null }) {
  const metrics = [
    { label: "馆藏作品", value: overview?.work_count, icon: Archive },
    { label: "源文件占用", value: overview?.source_bytes, format: formatBytes, icon: Database },
    {
      label: "索引异常",
      value: overview ? overview.missing_source + overview.missing_cover : undefined,
      tone: "warn",
      icon: AlertTriangle,
    },
    { label: "可回收空间", value: overview?.reclaimable_bytes, format: formatBytes, icon: Recycle },
  ];

  return (
    <section className="folio-files-summary" aria-label="文件概览">
      <Stagger className="folio-files-summary-grid">
        {metrics.map(({ label, value, format, tone, icon: Icon }) => (
          <StaggerItem key={label} className={"folio-files-metric" + (tone && value ? " is-warn" : "")}>
            <span className="folio-files-metric-icon"><Icon size={16} /></span>
            <div>
              <strong>{value == null ? "—" : <NumberTicker value={value} format={format} />}</strong>
              <span>{label}</span>
            </div>
            <i aria-hidden="true" />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
