import { AlertTriangle, BookMarked, ClipboardList, HardDrive } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";

export function WorkbenchMetricStrip({ overview }: { overview: WorkbenchOverview }) {
  const metrics = [
    { label: "馆藏作品", value: overview.library.total, icon: BookMarked, tone: "muted" },
    { label: "待治理", value: overview.governance.total, icon: ClipboardList, tone: overview.governance.total > 0 ? "warn" : "ok" },
    { label: "失败任务", value: overview.jobs.failed, icon: AlertTriangle, tone: overview.jobs.failed > 0 ? "bad" : "ok" },
    { label: "缺失源文件", value: overview.files.missing_source, icon: HardDrive, tone: overview.files.missing_source > 0 ? "bad" : "ok" },
  ];

  return (
    <div className="workbench-summary">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div className={`workbench-summary-metric tone-${metric.tone}`} key={metric.label}>
            <span className="workbench-summary-icon">
              <Icon size={18} />
            </span>
            <div>
              <strong>{metric.value.toLocaleString("zh-CN")}</strong>
              <span>{metric.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
