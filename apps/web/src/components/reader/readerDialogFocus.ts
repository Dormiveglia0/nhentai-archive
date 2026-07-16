import type { KeyboardEvent } from "react";

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/** Keep keyboard focus inside elements that declare themselves as modal dialogs. */
export function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (control) => !control.hidden && control.getClientRects().length > 0
  );
  if (controls.length === 0) return;

  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
