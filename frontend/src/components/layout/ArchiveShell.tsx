import { ReactNode } from "react";

import { FOLIO_PAGES, type FolioPageId } from "../folio/config";
import { FolioChrome, type FolioHeading } from "../folio/shell/FolioChrome";
import { navigate, type Page } from "../../lib/navigation";
import { TaskDock } from "./TaskDock";

type ShelledPageName = Exclude<Page["name"], "reader" | "readerRemote">;

type Props = {
  activePage: ShelledPageName;
  scrollKey: string;
  children: ReactNode;
};

const FOLIO_PAGE_IDS = new Set<FolioPageId>(FOLIO_PAGES.map((page) => page.id));

function chromeRoute(activePage: ShelledPageName): { page: FolioPageId; heading?: FolioHeading } {
  if (activePage === "history") {
    return {
      page: "library",
      heading: {
        title: "阅读轨迹",
        description: "按真实打开时间回看阅读进度，并从上次停留处继续。",
      },
    };
  }
  if (activePage === "gallery") return { page: "discover", heading: false };
  if (FOLIO_PAGE_IDS.has(activePage as FolioPageId)) return { page: activePage as FolioPageId };
  return { page: "workbench" };
}

export function ArchiveShell({
  activePage,
  scrollKey,
  children
}: Props) {
  const route = chromeRoute(activePage);

  return (
    <>
      <FolioChrome
        page={route.page}
        heading={route.heading}
        onNavigate={(name: FolioPageId) => navigate({ name } as Parameters<typeof navigate>[0])}
        scrollKey={scrollKey}
      >
        {children}
      </FolioChrome>
      {activePage === "tasks" ? null : <TaskDock />}
    </>
  );
}
