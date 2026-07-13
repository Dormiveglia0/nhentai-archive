import type { DictionarySummary } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";

const ITEMS = [
  { key: "unconfigured", label: "未配置", tone: "warn" },
  { key: "configured", label: "已配置", tone: "ink" },
  { key: "review", label: "待复核", tone: "ink" },
  { key: "ignored", label: "已忽略", tone: "muted" },
  { key: "suggestions", label: "机器建议", tone: "muted" },
] as const;

export function DictionarySummaryStrip({ summary }: { summary: DictionarySummary | null }) {
  return (
    <section className="folio-dictionary-summary" aria-label="词典摘要">
      <Stagger className="folio-dictionary-summary-grid">
        {ITEMS.map((item) => (
          <StaggerItem key={item.key} className={`folio-dictionary-metric is-${item.tone}`}>
            <strong>{summary ? summary[item.key].toLocaleString() : "—"}</strong>
            <span>{item.label}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
