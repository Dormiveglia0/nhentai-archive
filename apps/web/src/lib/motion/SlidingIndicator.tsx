import { useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./useReducedMotion";

const positions = new WeakMap<HTMLElement, { id: string; x: number; y: number; width: number; height: number }>();

export function SlidingIndicator({ layoutId, className = "" }: { layoutId: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const group = node?.parentElement?.parentElement;
    if (!node || !group) return;
    // Measure within the control group: a list shrinking must not animate a page scroll.
    const measure = () => {
      const rect = node.getBoundingClientRect(), origin = group.getBoundingClientRect();
      return { id: layoutId, x: rect.x - origin.x + group.scrollLeft, y: rect.y - origin.y + group.scrollTop, width: rect.width, height: rect.height };
    };
    const previous = positions.get(group), target = measure();
    const animation = !reduced && previous?.id === layoutId && target.width && target.height
      ? node.animate([
        { transform: `translate(${previous.x - target.x}px, ${previous.y - target.y}px) scale(${previous.width / target.width}, ${previous.height / target.height})` },
        { transform: "none" },
      ], { duration: 450, easing: "cubic-bezier(.22, 1, .36, 1)" }) : undefined;
    positions.set(group, target);
    return () => {
      positions.set(group, measure());
      animation?.cancel();
    };
  }, [layoutId, reduced]);
  return <span ref={ref} className={`folio-slide-indicator ${className}`} style={{ transformOrigin: "0 0" }} />;
}
