import { m } from "motion/react";
import { useId } from "react";
import { usePrefersReducedMotion } from "../../../lib/motion";

export function SectionSwitch<T extends string>({ label, value, items, onChange }: {
  label: string; value: T; items: readonly { value: T; label: string; count?: number }[]; onChange: (value: T) => void;
}) {
  const id = useId();
  const reduce = usePrefersReducedMotion();
  return <div className="folio-section-switch" role="group" aria-label={label}>
    {items.map(item => <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)}>
      {value === item.value && <m.i layoutId={id} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 38 }} />}
      <span>{item.label}</span>{item.count != null && <small>{item.count.toLocaleString()}</small>}
    </button>)}
  </div>;
}
