import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../../lib/motion";

export function FolioSheet({ open, label, onClose, children }: { open: boolean; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const content = useRef(children);
  const reduce = usePrefersReducedMotion();
  if (open) content.current = children;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!node.open) return;
    const motion = node.animate(open ? [{ opacity: 0, transform: "translateX(32px)" }, { opacity: 1, transform: "translateX(0)" }] : [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(20px)" }], { duration: reduce ? 0 : open ? 280 : 180, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    if (!open) void motion.finished.then(() => node.close()).catch(() => {});
    return () => motion.cancel();
  }, [open, reduce]);
  return <dialog ref={ref} className="folio-sheet" aria-label={label} onKeyDown={event => {
    if (event.key !== "Tab" || (event.target as HTMLElement).closest("dialog") !== event.currentTarget) return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    {open ? children : content.current}
  </dialog>;
}
