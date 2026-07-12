import { lazy, Suspense, useEffect, useState } from "react";

import { ArchiveShell } from "./components/layout/ArchiveShell";
import { DictionaryPage } from "./components/dictionary/DictionaryPage";
import { DiscoverPage } from "./components/discover/DiscoverPage";
import { ExportPage } from "./components/export/ExportPage";
import { FilesPage } from "./components/files/FilesPage";
import { GalleryDetailPage } from "./components/discover/GalleryDetailPage";
import { GovernancePage } from "./components/governance/GovernancePage";
import { HistoryPage } from "./components/history/HistoryPage";
import { LibraryPage } from "./components/library/LibraryPage";
import { ReaderPage } from "./components/reader/ReaderPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { TasksPage } from "./components/tasks/TasksPage";
import { WorkbenchPage } from "./components/workbench/WorkbenchPage";
import { api } from "./lib/api";
import { Page, pageFromLocation } from "./lib/navigation";

const FrontendDemo = lazy(() =>
  import("./components/demo/FrontendDemo").then((module) => ({ default: module.FrontendDemo })),
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

  return (
    <ArchiveShell
      activePage={page.name}
      privacyMode={privacyMode}
      blurCovers={blurCovers}
      onPrivacyModeChange={setPrivacyMode}
      onBlurCoversChange={setBlurCovers}
    >
      {page.name === "workbench" ? <WorkbenchPage blurCovers={blurCovers} /> : null}
      {page.name === "discover" ? <DiscoverPage blurCovers={blurCovers} initialTag={page.tag} /> : null}
      {page.name === "gallery" ? <GalleryDetailPage galleryId={page.galleryId} returnTo={page.returnTo} blurCovers={blurCovers} /> : null}
      {page.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}
      {page.name === "history" ? <HistoryPage blurCovers={blurCovers} /> : null}
      {page.name === "reader" ? <ReaderPage source={{ kind: "local", workId: page.workId }} privacyMode={privacyMode} /> : null}
      {page.name === "readerRemote" ? <ReaderPage source={{ kind: "remote", galleryId: page.galleryId }} privacyMode={privacyMode} /> : null}
      {page.name === "governance" ? <GovernancePage initialWorkId={page.workId} blurCovers={blurCovers} /> : null}
      {page.name === "dictionary" ? <DictionaryPage /> : null}
      {page.name === "tasks" ? <TasksPage /> : null}
      {page.name === "export" ? <ExportPage initialWorkId={page.workId} blurCovers={blurCovers} /> : null}
      {page.name === "files" ? <FilesPage blurCovers={blurCovers} /> : null}
      {page.name === "settings" ? (
        <SettingsPage />
      ) : null}
    </ArchiveShell>
  );
}
