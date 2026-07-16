import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Stagger, StaggerItem } from "../../../lib/motion";

export type FolioMetricTone = "neutral" | "active" | "good" | "warning" | "danger" | "muted";

export type FolioMetricItem = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  detail?: ReactNode;
  tone?: FolioMetricTone;
  valueKind?: "number" | "text";
  iconClassName?: string;
};

export function FolioMetricGrid({
  ariaLabel,
  className,
  items,
}: {
  ariaLabel: string;
  className?: string;
  items: FolioMetricItem[];
}) {
  return (
    <section className={["folio-metric-cluster", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      <Stagger className="folio-metric-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <StaggerItem
              key={item.label}
              className={`folio-metric-card is-${item.tone ?? "neutral"}${item.valueKind === "text" ? " has-text-value" : ""}`}
            >
              <span className="folio-metric-card-icon" aria-hidden="true">
                <Icon size={17} className={item.iconClassName} />
              </span>
              <div className="folio-metric-card-copy">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
