import { AlertTriangle, BookMarked, ClipboardList, HardDrive } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";

export function WorkbenchMetricStrip({ overview }: { overview: WorkbenchOverview }) {
  const metrics = [
    { label: "馆藏作品", value: overview.library.total, icon: BookMarked, tone: "muted" },
    { label: "待治理", value: overview.governance.total, icon: ClipboardList, tone: overview.governance.total > 0 ? "warn" : "ok" },
    { label: "失败任务", value: overview.jobs.failed, icon: AlertTriangle, tone: overview.jobs.failed > 0 ? "bad" : "ok" },
    { label: "缺失源文件", value: overview.files.missing_source, icon: HardDrive, tone: overview.files.missing_source > 0 ? "bad" : "ok" },
  ];

  return (
    <Stagger className="workbench-summary">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <StaggerItem key={metric.label} className={`workbench-summary-metric tone-${metric.tone}`}>
            <span className="workbench-summary-icon">
              <Icon size={18} />
            </span>
            <div className="workbench-summary-text">
              <strong>
                <NumberTicker value={metric.value} />
              </strong>
              <span>{metric.label}</span>
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
