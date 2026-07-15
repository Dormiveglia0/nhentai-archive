import { AlertTriangle, BookMarked, ClipboardList, HardDrive } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { formatBytes } from "./workbenchHelpers";

export function WorkbenchMetricStrip({ overview }: { overview: WorkbenchOverview }) {
  const metrics = [
    { label: "馆藏作品", value: overview.library.total, detail: `${overview.library.reading} 部阅读中`, icon: BookMarked, tone: "muted" },
    { label: "待核对", value: overview.governance.total, detail: `${overview.governance.automatic_issues} 部有系统提示`, icon: ClipboardList, tone: overview.governance.total > 0 ? "warn" : "ok" },
    { label: "失败任务", value: overview.jobs.failed, detail: `${overview.jobs.running} 运行 · ${overview.jobs.queued} 等待`, icon: AlertTriangle, tone: overview.jobs.failed > 0 ? "bad" : "ok" },
    { label: "缺失源文件", value: overview.files.missing_source, detail: `${formatBytes(overview.files.reclaimable_bytes)} 可回收`, icon: HardDrive, tone: overview.files.missing_source > 0 ? "bad" : "ok" },
  ];

  return (
    <section className="folio-status-band" aria-label="工作台真实状态">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label} className={`tone-${metric.tone}`}>
            <Icon size={17} />
            <span>{metric.label}</span>
            <strong><NumberTicker value={metric.value} /></strong>
            <small>{metric.detail}</small>
          </article>
        );
      })}
    </section>
  );
}
