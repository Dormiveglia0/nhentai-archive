import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { duration, ease, usePrefersReducedMotion } from "../../../lib/motion";
import type { PreviewPageItem } from "./galleryDetailModel";

export function GalleryLightbox({
  pages,
  activeIndex,
  blurCovers,
  onClose,
  onSelect,
}: {
  pages: PreviewPageItem[];
  activeIndex: number;
  blurCovers: boolean;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const page = pages[activeIndex];
  const [measuredPage, setMeasuredPage] = useState<{ src: string; ratio: number } | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "ArrowLeft") onSelect(Math.max(0, activeIndex - 1));
      if (event.key === "ArrowRight") onSelect(Math.min(pages.length - 1, activeIndex + 1));
      if (event.key !== "Tab") return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activeIndex, onSelect, pages.length]);

  if (!page) return null;
  const sourceRatio = page.width && page.height
    ? page.width / page.height
    : measuredPage?.src === page.src
      ? measuredPage.ratio
      : null;
  const pageRatio = Math.max(0.42, Math.min(1.9, sourceRatio || 0.72));

  return (
    <m.div
      ref={dialog}
      className="folio-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`第 ${page.pageIndex} 页预览`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration.fast }}
    >
      <button className="folio-gallery-lightbox-backdrop" type="button" aria-label="关闭预览" onClick={onClose} />
      <m.div
        className="folio-gallery-lightbox-stage"
        style={{ "--folio-gallery-page-ratio": pageRatio } as CSSProperties}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 22, scale: reduceMotion ? 1 : 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.98 }}
        transition={{ duration: duration.base, ease: ease.standard }}
      >
        <header>
          <span>PAGE {String(page.pageIndex).padStart(3, "0")}</span>
          <small>{activeIndex + 1} / {pages.length}</small>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="关闭预览"><X size={18} /></button>
        </header>
        <div className="folio-gallery-lightbox-media">
          <img
            className={blurCovers ? "is-blurred" : ""}
            src={page.src}
            alt={`第 ${page.pageIndex} 页`}
            onLoad={(event) => setMeasuredPage({
              src: page.src,
              ratio: event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
            })}
          />
        </div>
        <footer>
          <button type="button" disabled={activeIndex <= 0} onClick={() => onSelect(activeIndex - 1)}>
            <ChevronLeft size={17} />上一页
          </button>
          <span>使用方向键切换 · ESC 关闭</span>
          <button type="button" disabled={activeIndex >= pages.length - 1} onClick={() => onSelect(activeIndex + 1)}>
            下一页<ChevronRight size={17} />
          </button>
        </footer>
      </m.div>
    </m.div>
  );
}
