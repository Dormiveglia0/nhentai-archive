import { LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const bindingRef = useRef<HTMLDivElement>(null);
  const current = FOLIO_PAGES.find((item) => item.id === page) ?? FOLIO_PAGES[0];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
      updateBindingProgress();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [page, scrollKey]);

  function updateBindingProgress() {
    const scroll = scrollRef.current;
    const binding = bindingRef.current;
    if (!scroll || !binding) return;
    const max = scroll.scrollHeight - scroll.clientHeight;
    const size = max <= 1 ? 1 : Math.max(0.12, scroll.clientHeight / scroll.scrollHeight);
    const offset = max <= 1 ? 0 : (scroll.scrollTop / max) * (1 - size);
    binding.style.setProperty("--folio-scroll-size", String(size));
    binding.style.setProperty("--folio-scroll-offset", String(offset));
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
          <button className="folio-menu-button" type="button" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="folio-workspace">
        <AnimatePresence>
          {menuOpen ? (
            <m.div className="folio-mobile-nav" initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }} transition={{ duration: duration.fast, ease: ease.standard }}>
              <PageNavigation page={page} onNavigate={onNavigate} />
            </m.div>
          ) : null}
        </AnimatePresence>
        <main ref={scrollRef} className="folio-scroll" onScroll={updateBindingProgress}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={`${page}:${String(scrollKey ?? "")}`} className="folio-page" initial={{ opacity: 0, x: reduceMotion ? 0 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -18 }} transition={{ duration: duration.base, ease: ease.standard }} onAnimationComplete={updateBindingProgress}>
              {heading === false ? null : <PageHeading page={current} title={heading?.title} description={heading?.description} />}
              {children}
            </m.div>
          </AnimatePresence>
        </main>
      </div>
      {footer}
      {overlay}
    </div>
  );
}
