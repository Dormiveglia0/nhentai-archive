import { Settings } from "lucide-react";

import { DictionarySummary } from "../../lib/api";

type Props = {
  summary: DictionarySummary | null;
};

const ITEMS = [
  { key: "unconfigured", label: "未配置", tone: "warn", note: "待映射中文" },
  { key: "configured", label: "已配置", tone: "done", note: "已映射" },
  { key: "review", label: "待复核", tone: "review", note: "需人工确认" },
  { key: "ignored", label: "已忽略", tone: "muted", note: "不参与映射" },
  { key: "suggestions", label: "机器建议", tone: "muted", note: "未接入" },
] as const;

export function DictionarySummaryStrip({ summary }: Props) {
  return (
    <section className="dictionary-summary-strip" aria-label="词典摘要">
      {ITEMS.map((item) => (
        <div key={item.key} className={`dict-metric tone-${item.tone}`}>
          <strong>{(summary?.[item.key] ?? 0).toLocaleString()}</strong>
          <span>{item.label}</span>
          <small>{item.note}</small>
        </div>
      ))}
      <button type="button" className="dict-summary-action" disabled title="后续治理设置接入后开放">
        <Settings size={15} />
        治理设置
      </button>
    </section>
  );
}
