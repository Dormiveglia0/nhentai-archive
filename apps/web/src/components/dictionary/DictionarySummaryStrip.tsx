import { Bot, CheckCheck, CircleHelp, Clock3, EyeOff } from "lucide-react";

import type { DictionarySummary } from "../../lib/api";
import { FolioMetricGrid, type FolioMetricTone } from "../folio/ui/FolioMetricGrid";

const ITEMS = [
  { key: "unconfigured", label: "未配置", tone: "warning", icon: CircleHelp },
  { key: "configured", label: "已配置", tone: "good", icon: CheckCheck },
  { key: "review", label: "待复核", tone: "active", icon: Clock3 },
  { key: "ignored", label: "已忽略", tone: "muted", icon: EyeOff },
  { key: "suggestions", label: "机器建议", tone: "neutral", icon: Bot },
] as const;

export function DictionarySummaryStrip({ summary }: { summary: DictionarySummary | null }) {
  return (
    <FolioMetricGrid
      ariaLabel="词典摘要"
      className="folio-dictionary-summary"
      items={ITEMS.map((item) => ({
        label: item.label,
        value: summary ? summary[item.key].toLocaleString() : "—",
        icon: item.icon,
        tone: item.tone as FolioMetricTone,
      }))}
    />
  );
}
