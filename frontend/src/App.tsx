import { lazy, Suspense, useEffect, useState } from "react";

import { ArchiveShell } from "./components/layout/ArchiveShell";
import { FolioRouteFallback, ReaderRouteFallback } from "./components/layout/RouteFallback";
import { api } from "./lib/api";
import { pageFromLocation, type Page } from "./lib/navigation";

const FrontendDemo = lazy(() =>
  import("./components/demo/FrontendDemo").then((module) => ({ default: module.FrontendDemo })),
);
const WorkbenchPage = lazy(() =>
  import("./components/workbench/WorkbenchPage").then((module) => ({ default: module.WorkbenchPage })),
);
const LibraryPage = lazy(() =>
  import("./components/library/LibraryPage").then((module) => ({ default: module.LibraryPage })),
);
const HistoryPage = lazy(() =>
  import("./components/history/HistoryPage").then((module) => ({ default: module.HistoryPage })),
);
const DiscoverPage = lazy(() =>
  import("./components/discover/DiscoverPage").then((module) => ({ default: module.DiscoverPage })),
);
const GalleryDetailPage = lazy(() =>
  import("./components/discover/GalleryDetailPage").then((module) => ({ default: module.GalleryDetailPage })),
);
const GovernancePage = lazy(() =>
  import("./components/governance/GovernancePage").then((module) => ({ default: module.GovernancePage })),
);
const DictionaryPage = lazy(() =>
  import("./components/dictionary/DictionaryPage").then((module) => ({ default: module.DictionaryPage })),
);
const TasksPage = lazy(() =>
  import("./components/tasks/TasksPage").then((module) => ({ default: module.TasksPage })),
);
const ExportPage = lazy(() =>
  import("./components/export/ExportPage").then((module) => ({ default: module.ExportPage })),
);
const FilesPage = lazy(() =>
  import("./components/files/FilesPage").then((module) => ({ default: module.FilesPage })),
);
const SettingsPage = lazy(() =>
  import("./components/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const ReaderPage = lazy(() =>
  import("./components/reader/ReaderPage").then((module) => ({ default: module.ReaderPage })),
);

export default function App() {
  const isDemo = window.location.pathname === "/demo" || window.location.hash === "#demo";
  return isDemo ? (
    <Suspense fallback={<div role="status" aria-label="正在载入前端演示" style={{ minHeight: "100vh", background: "#f3efe5" }} />}>
      <FrontendDemo />
    </Suspense>
  ) : (
    <ArchiveApp />
  );
}

function ArchiveApp() {
  const [page, setPage] = useState<Page>(() => pageFromLocation());
  const [privacyMode, setPrivacyMode] = useState(true);
  const [blurCovers, setBlurCovers] = useState(true);

  useEffect(() => {
    const sync = () => setPage(pageFromLocation());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .settings()
      .then((payload) => {
        if (!alive) return;
        setPrivacyMode(payload.privacy.privacy_mode_default);
        setBlurCovers(payload.privacy.blur_covers_default);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (page.name === "reader") {
    return (
      <Suspense fallback={<ReaderRouteFallback />}>
        <ReaderPage source={{ kind: "local", workId: page.workId }} privacyMode={privacyMode} />
      </Suspense>
    );
  }

  if (page.name === "readerRemote") {
    return (
      <Suspense fallback={<ReaderRouteFallback />}>
        <ReaderPage source={{ kind: "remote", galleryId: page.galleryId }} privacyMode={privacyMode} />
      </Suspense>
    );
  }

  const shellScrollKey = page.name === "gallery" ? `gallery:${page.galleryId}` : page.name;

  return (
    <ArchiveShell
      activePage={page.name}
      scrollKey={shellScrollKey}
      privacyMode={privacyMode}
      onPrivacyModeChange={setPrivacyMode}
    >
      <Suspense fallback={<FolioRouteFallback />}>
        {page.name === "workbench" ? <WorkbenchPage blurCovers={blurCovers} /> : null}
        {page.name === "discover" ? <DiscoverPage blurCovers={blurCovers} initialTag={page.tag} /> : null}
        {page.name === "gallery" ? <GalleryDetailPage galleryId={page.galleryId} returnTo={page.returnTo} blurCovers={blurCovers} /> : null}
        {page.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}
        {page.name === "history" ? <HistoryPage blurCovers={blurCovers} /> : null}
        {page.name === "governance" ? <GovernancePage initialWorkId={page.workId} blurCovers={blurCovers} /> : null}
        {page.name === "dictionary" ? <DictionaryPage /> : null}
        {page.name === "tasks" ? <TasksPage /> : null}
        {page.name === "export" ? <ExportPage initialWorkId={page.workId} blurCovers={blurCovers} /> : null}
        {page.name === "files" ? <FilesPage blurCovers={blurCovers} /> : null}
        {page.name === "settings" ? (
          <SettingsPage onPrivacyModeChange={setPrivacyMode} onBlurCoversChange={setBlurCovers} />
        ) : null}
      </Suspense>
    </ArchiveShell>
  );
}
