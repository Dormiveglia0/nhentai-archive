import { ArrowRight } from "lucide-react";
import { SlidingIndicator } from "../../../lib/motion";

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
            {page === item.id ? <SlidingIndicator className="folio-nav-active" layoutId={indicatorId} /> : null}
            <NavigationIcon page={item.id} />
            <strong>{item.label}</strong>
            <ArrowRight className="folio-nav-arrow" size={15} />
          </a>
        );
      })}
    </nav>
  );
}

const ICON_PATHS: Record<FolioPageId, [string, string]> = {
  workbench: ["M3 10L12 3L21 10V21H3Z", "M9 21V13H15V21"],
  library: ["M4 4V21M9 3V21M14 6V21", "M17 5L22 20"],
  discover: ["M16 10A6 6 0 1 1 4 10A6 6 0 1 1 16 10Z", "M15 15L21 21M7 10H13"],
  governance: ["M14 3H4V21H20V13M8 16H12", "M11 11L19 3L22 6L14 14H11Z"],
  dictionary: ["M12 6Q7 3 3 5V20Q7 18 12 21Q17 18 21 20V5Q17 3 12 6Z", "M12 6V21M6 9H9M15 9H18"],
  tasks: ["M3 3H9V9H3ZM15 15H21V21H15ZM3 15H9V21H3Z", "M9 6H18V15M6 9V15"],
  export: ["M4 15V21H20V15M4 6V3H9", "M12 4V16M7 11L12 16L17 11"],
  files: ["M6 3H15L20 8V21H6ZM15 3V8H20M3 7V21", "M10 12H16M10 16H16"],
  settings: ["M12 5V2M12 22V19M5 12H2M22 12H19M7 7L5 5M19 19L17 17M7 17L5 19M19 5L17 7M19 12A7 7 0 1 1 5 12A7 7 0 1 1 19 12Z", "M15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12Z"],
};

function NavigationIcon({ page }: { page: FolioPageId }) {
  return <svg className="folio-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#171815" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[page][0]} /><path className="folio-nav-icon-accent" d={ICON_PATHS[page][1]} pathLength="1" /></svg>;
}
