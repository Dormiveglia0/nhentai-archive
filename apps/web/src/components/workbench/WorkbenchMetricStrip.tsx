import { AlertTriangle, BookMarked, ClipboardList, HardDrive } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { FolioMetricGrid, type FolioMetricTone } from "../folio/ui/FolioMetricGrid";
import { formatBytes } from "./workbenchHelpers";

export function WorkbenchMetricStrip({ overview }: { overview: WorkbenchOverview }) {
  const metrics = [
    { label: "馆藏作品", value: overview.library.total, detail: `${overview.library.reading} 部阅读中`, icon: BookMarked, tone: "active" },
    { label: "待核对", value: overview.governance.total, detail: `${overview.governance.automatic_issues} 部有系统提示`, icon: ClipboardList, tone: overview.governance.total > 0 ? "warning" : "good" },
    { label: "失败任务", value: overview.jobs.failed, detail: `${overview.jobs.running} 运行 · ${overview.jobs.queued} 等待`, icon: AlertTriangle, tone: overview.jobs.failed > 0 ? "danger" : "good" },
    { label: "缺失源文件", value: overview.files.missing_source, detail: `${formatBytes(overview.files.reclaimable_bytes)} 可回收`, icon: HardDrive, tone: overview.files.missing_source > 0 ? "danger" : "good" },
  ];

  return (
    <FolioMetricGrid
      ariaLabel="工作台真实状态"
      className="folio-workbench-summary"
      items={metrics.map((metric) => ({
        ...metric,
        tone: metric.tone as FolioMetricTone,
        value: <NumberTicker value={metric.value} />,
      }))}
    />
  );
}
