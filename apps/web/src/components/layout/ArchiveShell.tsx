import { ReactNode } from "react";

import { FOLIO_PAGES, type FolioPageId } from "../folio/config";
import { FolioChrome } from "../folio/shell/FolioChrome";
import { navigate, type Page } from "../../lib/navigation";
import { TaskDock } from "./TaskDock";

type ShelledPageName = Exclude<Page["name"], "reader" | "readerRemote">;

type Props = {
  activePage: ShelledPageName;
  scrollKey: string;
  onLogout: () => Promise<void>;
  suspended?: boolean;
  children: ReactNode;
};

const FOLIO_PAGE_IDS = new Set<FolioPageId>(FOLIO_PAGES.map((page) => page.id));

function chromeRoute(activePage: ShelledPageName): FolioPageId {
  if (activePage === "history" || activePage === "export" || activePage === "scrape") return "library";
  if (activePage === "gallery") return "discover";
  return FOLIO_PAGE_IDS.has(activePage as FolioPageId) ? activePage as FolioPageId : "workbench";
}

export function ArchiveShell({
  activePage,
  scrollKey,
  onLogout,
  suspended = false,
  children
}: Props) {
  const route = chromeRoute(activePage);

  return (
    <>
      <FolioChrome
        page={route}
        onNavigate={(name: FolioPageId) => navigate({ name } as Parameters<typeof navigate>[0])}
        scrollKey={scrollKey}
        onLogout={onLogout}
      >
        {children}
      </FolioChrome>
      {activePage === "tasks" || suspended ? null : <TaskDock />}
    </>
  );
}
