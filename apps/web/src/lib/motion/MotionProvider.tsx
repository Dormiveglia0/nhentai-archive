import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";

// Shared navigation indicators need layout projection from domMax.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
