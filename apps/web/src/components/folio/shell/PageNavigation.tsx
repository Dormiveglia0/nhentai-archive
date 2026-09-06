import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";

import { pageHref } from "../../../lib/navigation";
import { FOLIO_PAGES, type FolioPageId } from "../config";

export function PageNavigation({
  page,
  onNavigate,
  className = "",
}: {
  page: FolioPageId;
  onNavigate: (page: FolioPageId) => void;
  className?: string;
}) {
  return (
    <nav className={`folio-nav${className ? ` ${className}` : ""}`} aria-label="全局导航" style={{ "--folio-nav-index": FOLIO_PAGES.findIndex((item) => item.id === page) } as CSSProperties}>
      {FOLIO_PAGES.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={item.id}
            href={pageHref({ name: item.id })}
            className={page === item.id ? "is-active" : ""}
            aria-current={page === item.id ? "page" : undefined}
            onClick={(event) => {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(item.id);
            }}
          >
            {page === item.id ? <span className="folio-nav-active" /> : null}
            <Icon size={17} />
            <strong>{item.label}</strong>
            <ArrowRight className="folio-nav-arrow" size={15} />
          </a>
        );
      })}
    </nav>
  );
}
