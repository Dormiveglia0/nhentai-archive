import { AlertTriangle, CheckCircle2, Clock3, Loader2, RadioTower } from "lucide-react";

import { NumberTicker } from "../effects/NumberTicker";
import { FolioMetricGrid, type FolioMetricTone } from "../folio/ui/FolioMetricGrid";
import type { TaskSummary } from "./useTasksState";

export function TaskSummaryStrip({ summary }: { summary: TaskSummary }) {
  const metrics = [
    { label: "正在运行", value: summary.running, icon: Loader2, tone: "active" },
    { label: "等待中", value: summary.queued, icon: Clock3, tone: summary.queued ? "warning" : "neutral" },
    { label: "失败", value: summary.failed, icon: AlertTriangle, tone: summary.failed ? "danger" : "good" },
    { label: "已完成", value: summary.completed, icon: CheckCircle2, tone: "good" },
    { label: "今日吞吐", value: summary.today, icon: RadioTower, tone: "neutral" },
  ];

  return (
    <FolioMetricGrid
      ariaLabel="任务摘要"
      className="folio-tasks-summary"
      items={metrics.map((metric) => ({
        label: metric.label,
        icon: metric.icon,
        tone: metric.tone as FolioMetricTone,
        iconClassName: metric.label === "正在运行" && metric.value > 0 ? "spin" : undefined,
        value: <NumberTicker value={metric.value} />,
      }))}
    />
  );
}
