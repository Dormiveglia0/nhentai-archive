import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Native focus/inert handling, shared backdrop dismissal and a finite exit. */
export function useNativeDialog(ref: RefObject<HTMLDialogElement>, onClose: () => void, open = true, busy = false, returnFocus?: RefObject<HTMLElement>) {
  const state = useRef({ onClose, busy });
  state.current = { onClose, busy };
  const closing = useRef(false);
  const dismiss = useCallback(() => {
    const dialog = ref.current;
    if (!dialog?.open || closing.current || state.current.busy) return;
    closing.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      if (!dialog.isConnected) return;
      dialog.close();
      state.current.onClose();
      closing.current = false;
    };
    if (reduced) finish();
    else void dialog.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(12px)" }],
      { duration: 160, easing: "ease-in", fill: "forwards" }).finished.then(finish, () => undefined);
  }, [ref]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    closing.current = false;
    const previous = returnFocus?.current ?? document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-dialog-focus]")?.focus({ preventScroll: true });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 240, easing: "cubic-bezier(.22,1,.36,1)" });
    }
    let outsideDown = false;
    const outside = (event: MouseEvent) => {
      const r = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
    };
    const pointerDown = (event: MouseEvent) => { outsideDown = outside(event); };
    const click = (event: MouseEvent) => { if (outsideDown && outside(event)) dismiss(); outsideDown = false; };
    const cancel = (event: Event) => { if (event.target === dialog) { event.preventDefault(); event.stopPropagation(); dismiss(); } };
    dialog.addEventListener("pointerdown", pointerDown);
    dialog.addEventListener("click", click);
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("pointerdown", pointerDown);
      dialog.removeEventListener("click", click);
      dialog.removeEventListener("cancel", cancel);
      dialog.getAnimations().forEach(animation => animation.cancel());
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [dismiss, open, ref, returnFocus]);
  return dismiss;
}
