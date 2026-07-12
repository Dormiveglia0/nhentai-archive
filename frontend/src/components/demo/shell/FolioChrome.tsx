import { LockKeyhole, Menu, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { duration, ease, usePrefersReducedMotion } from "../../../lib/motion";
import { FOLIO_PAGES, type FolioPageId } from "../config";
import { ModuleBackdrop } from "./ModuleBackdrop";
import { PageHeading } from "./PageHeading";
import { PageNavigation } from "./PageNavigation";

export function FolioChrome({
  page,
  privacy,
  onPrivacyChange,
  onNavigate,
  children,
  footer,
  overlay,
  scrollKey,
}: {
  page: FolioPageId;
  privacy: boolean;
  onPrivacyChange: (value: boolean) => void;
  onNavigate: (page: FolioPageId) => void;
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  scrollKey?: string | number;
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
    <div className={`folio-demo folio-app folio-demo-page-${page}${footer ? "" : " folio-demo-no-command"}`}>
      <ModuleBackdrop page={page} reduceMotion={reduceMotion} />
      <div ref={bindingRef} className="folio-demo-binding" aria-hidden="true"><span className="folio-demo-binding-progress" /></div>

      <header className="folio-demo-topbar">
        <button className="folio-demo-brand" type="button" onClick={() => onNavigate("workbench")}>
          <span className="folio-demo-brand-mark" aria-hidden="true"><span className="folio-demo-monogram">NH</span><i /></span>
          <span className="folio-demo-brand-copy"><strong>Archive</strong><small>local collection</small></span>
        </button>
        <PageNavigation className="folio-demo-topnav" page={page} onNavigate={onNavigate} />
        <div className="folio-demo-top-actions">
          <button className={`folio-demo-privacy${privacy ? " is-on" : ""}`} type="button" aria-pressed={privacy} onClick={() => onPrivacyChange(!privacy)}>
            <span className="folio-demo-privacy-icon" aria-hidden="true"><LockKeyhole size={15} /></span>
            <span className="folio-demo-privacy-copy"><span>隐私模式</span><strong>{privacy ? "开启" : "关闭"}</strong></span>
          </button>
          <button className="folio-demo-menu-button" type="button" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="folio-demo-workspace">
        <AnimatePresence>
          {menuOpen ? (
            <m.div className="folio-demo-mobile-nav" initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }} transition={{ duration: duration.fast, ease: ease.standard }}>
              <PageNavigation page={page} onNavigate={onNavigate} />
            </m.div>
          ) : null}
        </AnimatePresence>
        <main ref={scrollRef} className="folio-demo-scroll" onScroll={updateBindingProgress}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={page} className="folio-demo-page" initial={{ opacity: 0, x: reduceMotion ? 0 : 28, scale: reduceMotion ? 1 : 0.992 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -18, scale: reduceMotion ? 1 : 1.006 }} transition={{ duration: duration.base, ease: ease.standard }} onAnimationComplete={updateBindingProgress}>
              <PageHeading page={current} />
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
