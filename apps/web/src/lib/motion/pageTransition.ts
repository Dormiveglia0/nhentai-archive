import { flushSync } from "react-dom";

let active: ViewTransition | undefined;
let revision = 0;
type Scope = "page" | "settings" | "tasks" | "discover" | "files";

export function cancelPageTransition() {
  revision += 1;
  active?.skipTransition();
  delete document.documentElement.dataset.folioSlide;
}

export async function transitionPage(update: () => void, direction = 1, scope: Scope = "page") {
  cancelPageTransition();
  const current = revision;
  const apply = () => { if (current === revision) flushSync(update); };
  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(); return; }
  const root = document.documentElement;
  root.dataset.folioSlide = scope;
  root.style.setProperty("--folio-page-direction", direction < 0 ? "-1" : "1");
  const transition = document.startViewTransition(apply);
  active = transition;
  void transition.ready.catch(() => undefined);
  await transition.finished.catch(() => undefined);
  if (active === transition) active = undefined;
  if (current === revision) delete root.dataset.folioSlide;
}

export function transitionTabs<T>(items: readonly T[], current: T, next: T, update: (item: T) => void, scope: Scope = "page") {
  const from = items.indexOf(current), to = items.indexOf(next);
  if (current === next) { cancelPageTransition(); flushSync(() => update(next)); return; }
  const direction = to < from ? -1 : 1;
  void transitionPage(() => update(next), direction, scope);
}
