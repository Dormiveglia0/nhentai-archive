// Adapted from magicui Number Ticker under effects/README.md.
// Keep the actual value readable; animate its arrival instead of counting through false totals.
import { m } from "motion/react";

import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";

type Props = {
  value: number;
  format?: (n: number) => string;
};

export function NumberTicker({ value, format }: Props) {
  const reduce = usePrefersReducedMotion();
  const text = format ? format(value) : Math.round(value).toLocaleString("zh-CN");
  return (
    <m.span key={text} className="fx-scope" initial={reduce ? false : { opacity: 0.45 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast, ease: ease.standard }}>
      {text}
    </m.span>
  );
}
