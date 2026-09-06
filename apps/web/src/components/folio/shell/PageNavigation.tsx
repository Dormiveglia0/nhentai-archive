import { ArrowRight } from "lucide-react";
import { m } from "motion/react";

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
  const indicatorId = className ? "folio-nav-active-top" : "folio-nav-active-drawer";

  return (
    <nav className={`folio-nav${className ? ` ${className}` : ""}`} aria-label="全局导航">
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
            {page === item.id ? <m.span className="folio-nav-active" layoutId={indicatorId} transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
            <Icon size={17} />
            <strong>{item.label}</strong>
            <ArrowRight className="folio-nav-arrow" size={15} />
          </a>
        );
      })}
    </nav>
  );
}
