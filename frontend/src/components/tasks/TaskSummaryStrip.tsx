import { AlertTriangle, CheckCircle2, Clock3, Loader2, RadioTower } from "lucide-react";

import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import type { TaskSummary } from "./useTasksState";

export function TaskSummaryStrip({ summary }: { summary: TaskSummary }) {
  const metrics = [
    { label: "正在运行", value: summary.running, icon: Loader2, tone: "ok" },
    { label: "等待中", value: summary.queued, icon: Clock3, tone: "warn" },
    { label: "失败", value: summary.failed, icon: AlertTriangle, tone: "bad" },
    { label: "已完成", value: summary.completed, icon: CheckCircle2, tone: "ok" },
    { label: "今日吞吐量", value: summary.today, icon: RadioTower, tone: "muted" },
  ];

  return (
    <Stagger className="tasks-summary">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <StaggerItem className={`tasks-summary-metric tone-${metric.tone}`} key={metric.label}>
            <span className="tasks-summary-icon">
              <Icon size={18} />
            </span>
            <div>
              <strong><NumberTicker value={metric.value} /></strong>
              <span>{metric.label}</span>
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
