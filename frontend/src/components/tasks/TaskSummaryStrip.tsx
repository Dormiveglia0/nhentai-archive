import { AlertTriangle, CheckCircle2, Clock3, Loader2, RadioTower } from "lucide-react";

import { Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import type { TaskSummary } from "./useTasksState";

export function TaskSummaryStrip({ summary }: { summary: TaskSummary }) {
  const metrics = [
    { label: "正在运行", value: summary.running, icon: Loader2, tone: "running" },
    { label: "等待中", value: summary.queued, icon: Clock3, tone: "queued" },
    { label: "失败", value: summary.failed, icon: AlertTriangle, tone: "failed" },
    { label: "已完成", value: summary.completed, icon: CheckCircle2, tone: "completed" },
    { label: "今日吞吐", value: summary.today, icon: RadioTower, tone: "today" },
  ];

  return (
    <section className="folio-tasks-summary" aria-label="任务摘要">
      <Stagger className="folio-tasks-summary-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <StaggerItem className={`folio-tasks-metric is-${metric.tone}`} key={metric.label}>
              <span className="folio-tasks-metric-icon"><Icon size={17} className={metric.tone === "running" && metric.value > 0 ? "spin" : undefined} /></span>
              <div><strong><NumberTicker value={metric.value} /></strong><span>{metric.label}</span></div>
              <i aria-hidden="true" />
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
