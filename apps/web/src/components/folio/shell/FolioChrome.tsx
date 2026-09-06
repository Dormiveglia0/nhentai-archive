import { LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { duration, ease, usePrefersReducedMotion } from "../../../lib/motion";
import { pageHref } from "../../../lib/navigation";
import { FOLIO_PAGES, type FolioPageId } from "../config";
import { ModuleBackdrop } from "./ModuleBackdrop";
import { PageHeading } from "./PageHeading";
import { PageNavigation } from "./PageNavigation";
import "../Folio.css";

export type FolioHeading = false | { title: string; description: string };

export function FolioChrome({
  page,
  onNavigate,
  children,
  footer,
  overlay,
  scrollKey,
  heading,
  onLogout,
}: {
  page: FolioPageId;
  onNavigate: (page: FolioPageId) => void;
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  scrollKey?: string | number;
  heading?: FolioHeading;
  onLogout?: () => void | Promise<void>;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const bindingRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const current = FOLIO_PAGES.find((item) => item.id === page) ?? FOLIO_PAGES[0];
  const routeKey = `${page}:${String(scrollKey ?? "")}`;

  useEffect(() => {
    if (!menuOpen) return;
    const scroll = scrollRef.current;
    if (scroll) scroll.inert = true;
    drawerRef.current?.querySelector<HTMLElement>("a.is-active")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const controls = [menuRef.current, ...Array.from(drawerRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])].filter((node): node is HTMLButtonElement | HTMLAnchorElement => Boolean(node));
      const index = controls.indexOf(document.activeElement as HTMLButtonElement | HTMLAnchorElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    };
    const desktop = window.matchMedia("(min-width: 981px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      desktop.removeEventListener("change", closeOnDesktop);
      if (scroll) scroll.inert = false;
      menuRef.current?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [page, scrollKey]);

  const updateBindingProgress = useCallback(() => {
    const scroll = scrollRef.current;
    const binding = bindingRef.current;
    if (!scroll || !binding) return;
    const max = scroll.scrollHeight - scroll.clientHeight;
    const size = max <= 1 ? 1 : Math.max(0.12, scroll.clientHeight / scroll.scrollHeight);
    const offset = max <= 1 ? 0 : (scroll.scrollTop / max) * (1 - size);
    binding.style.setProperty("--folio-scroll-size", String(size));
    binding.style.setProperty("--folio-scroll-offset", String(offset));
  }, []);

  const restoreRouteScroll = useCallback((node: HTMLDivElement | null) => {
    if (!node || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollPositionsRef.current.get(routeKey) ?? 0;
    window.requestAnimationFrame(updateBindingProgress);
  }, [routeKey, updateBindingProgress]);

  function handleScroll() {
    if (scrollRef.current) scrollPositionsRef.current.set(routeKey, scrollRef.current.scrollTop);
    updateBindingProgress();
  }

  return (
    <div className={`folio folio-app folio-page-${page}${footer ? "" : " folio-no-command"}`}>
      <ModuleBackdrop page={page} reduceMotion={reduceMotion} />
      <div ref={bindingRef} className="folio-binding" aria-hidden="true"><span className="folio-binding-progress" /></div>

      <header className="folio-topbar">
        <a
          className="folio-brand"
          href={pageHref({ name: "workbench" })}
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setMenuOpen(false);
            onNavigate("workbench");
          }}
        >
          <span className="folio-brand-mark" aria-hidden="true"><span className="folio-monogram">NH</span><i /></span>
          <span className="folio-brand-copy"><strong>Archive</strong><small>local collection</small></span>
        </a>
        <PageNavigation className="folio-topnav" page={page} onNavigate={onNavigate} />
        <div className="folio-top-actions">
          {onLogout ? (
            <button className="folio-session-button" type="button" aria-label="登出并锁定本地馆藏" title="登出" onClick={() => void onLogout()}>
              <LogOut size={17} />
              <span>登出</span>
            </button>
          ) : null}
          <button ref={menuRef} className="folio-menu-button" type="button" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-controls={menuOpen ? "folio-mobile-nav" : undefined} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="folio-workspace">
        <AnimatePresence>
          {menuOpen ? (
            <m.div key="scrim" className="folio-nav-scrim" aria-hidden="true" onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast }} />
          ) : null}
          {menuOpen ? (
            <m.div key="drawer" id="folio-mobile-nav" className="folio-mobile-nav" initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }} transition={{ duration: duration.fast, ease: ease.standard }}>
              <div ref={drawerRef}><PageNavigation page={page} onNavigate={(next) => { setMenuOpen(false); onNavigate(next); }} /></div>
            </m.div>
          ) : null}
        </AnimatePresence>
        <main ref={scrollRef} className="folio-scroll" tabIndex={-1} onScroll={handleScroll}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={routeKey} className="folio-page" initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -8, transition: { duration: reduceMotion ? 0 : duration.pageExit } }} transition={{ duration: reduceMotion ? 0 : duration.pageEnter, ease: ease.standard }} onAnimationComplete={updateBindingProgress}>
              {/* Keep refs below AnimatePresence: Motion reads props.ref, which warns in React 18. */}
              <div ref={restoreRouteScroll}>
                {heading === false ? null : <PageHeading page={current} title={heading?.title} description={heading?.description} />}
                {children}
              </div>
            </m.div>
          </AnimatePresence>
        </main>
      </div>
      {footer}
      {overlay}
    </div>
  );
}
