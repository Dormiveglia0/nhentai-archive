import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../../lib/motion";

export function FolioSheet({ open, label, onClose, children, className = "", origin }: { open: boolean; label: string; onClose: () => void; children: ReactNode; className?: string; origin?: HTMLElement | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const content = useRef(children);
  const reduce = usePrefersReducedMotion();
  const motions = useRef<Animation[]>([]);
  const originRef = useRef(origin);
  originRef.current = origin;
  const source = useRef<HTMLElement | null>(null);
  if (open) content.current = children;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const entering = open && !node.open;
    if (entering) node.showModal();
    if (!node.open) return;
    const anchor = node.querySelector<HTMLElement>("[data-sheet-anchor]");
    const surface = node.querySelector<HTMLElement>("[data-sheet-surface]") ?? node;
    const body = node.querySelector<HTMLElement>("[data-sheet-content]");
    const fromOpacity = entering ? "0" : getComputedStyle(surface).opacity;
    const liveAnchor = anchor && !entering ? getComputedStyle(anchor).transform : null;
    const liveBody = body && !entering ? getComputedStyle(body).opacity : "0";
    const liveBodyTransform = body && !entering ? getComputedStyle(body).transform : "translateX(28px)";
    const liveSurfaceTransform = entering ? "translateX(32px)" : getComputedStyle(node).transform;
    motions.current.forEach(item => item.cancel());
    motions.current = [];
    const animate = (element: HTMLElement, frames: Keyframe[], duration: number, delay = 0) => {
      const motion = element.animate(frames, { duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
      motions.current.push(motion);
      return motion;
    };
    let completion: Animation;
    if (anchor) {
      const target = anchor.getBoundingClientRect();
      const origin = originRef.current;
      const rect = origin?.isConnected ? origin.getBoundingClientRect() : null;
      const visible = rect && rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;
      const home = visible ? `translate(${rect.x - target.x}px, ${rect.y - target.y}px) scale(${rect.width / target.width}, ${rect.height / target.height})` : "translateY(16px) scale(.96)";
      source.current?.classList.remove("is-detail-source");
      source.current = origin ?? null;
      source.current?.classList.add("is-detail-source");
      anchor.style.transformOrigin = "0 0";
      completion = animate(anchor, [{ transform: liveAnchor ?? home, opacity: entering && !visible ? 0 : 1 }, { transform: open ? "none" : home, opacity: open || visible ? 1 : 0 }], open ? 620 : 440);
      animate(surface, [{ opacity: fromOpacity }, { opacity: open ? 1 : 0 }], open ? 450 : 380);
      if (body) animate(body, [{ opacity: liveBody, transform: liveBodyTransform }, { opacity: open ? 1 : 0, transform: open ? "none" : "translateX(12px)" }], open ? 420 : 180, entering ? 130 : 0);
    } else {
      const transform = liveSurfaceTransform;
      completion = animate(node, [{ opacity: fromOpacity, transform }, { opacity: open ? 1 : 0, transform: open ? "none" : "translateX(20px)" }], open ? 280 : 180);
    }
    node.dataset.phase = open ? "opening" : "closing";
    void completion.finished.then(() => {
      node.dataset.phase = open ? "open" : "closed";
      if (!open) { source.current?.classList.remove("is-detail-source"); node.close(); }
    }).catch(() => {});
    // Keep in-flight values until the next transition can sample them.
  }, [open, reduce]);
  useLayoutEffect(() => () => { motions.current.forEach(item => item.cancel()); source.current?.classList.remove("is-detail-source"); }, []);
  return <dialog ref={ref} className={`folio-sheet ${className}`} aria-label={label} onKeyDown={event => {
    if (event.key !== "Tab" || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    {open ? children : content.current}
  </dialog>;
}
