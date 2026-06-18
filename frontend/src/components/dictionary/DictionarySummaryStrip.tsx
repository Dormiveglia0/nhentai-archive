import { Settings } from "lucide-react";

import { DictionarySummary } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";

type Props = {
  summary: DictionarySummary | null;
};

const ITEMS = [
  { key: "unconfigured", label: "未配置", tone: "warn" },
  { key: "configured", label: "已配置", tone: "ink" },
  { key: "review", label: "待复核", tone: "ink" },
  { key: "ignored", label: "已忽略", tone: "muted" },
  { key: "suggestions", label: "机器建议", tone: "muted" },
] as const;

export function DictionarySummaryStrip({ summary }: Props) {
  return (
    <section aria-label="词典摘要">
      <Stagger className="dictionary-summary-strip">
        {ITEMS.map((item) => (
          <StaggerItem key={item.key} className={`dict-metric tone-${item.tone}`}>
            <strong>{(summary?.[item.key] ?? 0).toLocaleString()}</strong>
            <span>{item.label}</span>
          </StaggerItem>
        ))}
        <StaggerItem className="dict-summary-action-cell">
          <button type="button" className="dict-summary-action" disabled title="后续治理设置接入后开放">
            <Settings size={15} />
            治理设置
          </button>
        </StaggerItem>
      </Stagger>
    </section>
  );
}
