import { CircleX, Flame, RotateCcw, Settings, ShieldCheck } from "lucide-react";

import { DictionarySummary } from "../../lib/api";

type Props = {
  summary: DictionarySummary | null;
};

const ITEMS = [
  { key: "unconfigured", label: "未配置", icon: Settings },
  { key: "configured", label: "已配置", icon: ShieldCheck },
  { key: "ignored", label: "已忽略", icon: CircleX },
  { key: "review", label: "待复核", icon: RotateCcw },
  { key: "suggestions", label: "机器建议", icon: Flame },
] as const;

export function DictionarySummaryStrip({ summary }: Props) {
  return (
    <section className="dictionary-summary-strip" aria-label="词典摘要">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key}>
            <Icon size={19} />
            <span>{item.label}</span>
            <strong>{summary?.[item.key] ?? 0}</strong>
            {item.key === "suggestions" ? <small>今日新增 0</small> : null}
          </div>
        );
      })}
      <button type="button" disabled title="后续治理设置接入后开放">
        <Settings size={16} />
        治理设置
      </button>
    </section>
  );
}
