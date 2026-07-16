import { useReducedMotion } from "motion/react";

/** 系统开启「减少动态」时返回 true;原语据此降级。 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
