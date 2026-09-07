import { useSyncExternalStore } from "react";

const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (notify: () => void) => {
  preference.addEventListener("change", notify);
  return () => preference.removeEventListener("change", notify);
};

/** Keep mounted animations in sync when the system preference changes. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => preference.matches);
}
