import { AnimatePresence, m } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";

import { AuthGate } from "./components/auth/AuthGate";
import { ArchiveShell } from "./components/layout/ArchiveShell";
import { FolioRouteFallback, ReaderRouteFallback } from "./components/layout/RouteFallback";
import { api } from "./lib/api";
import { duration, ease, usePrefersReducedMotion } from "./lib/motion";
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
  return <AuthGate>{(logout) => <AuthenticatedApp onLogout={logout} />}</AuthGate>;
}

function AuthenticatedApp({ onLogout }: { onLogout: () => Promise<void> }) {
  const isDemo = window.location.pathname === "/demo" || window.location.hash === "#demo";
  return isDemo ? (
    <Suspense fallback={<div role="status" aria-label="正在载入前端演示" style={{ minHeight: "100vh", background: "#f3efe5" }} />}>
      <FrontendDemo onLogout={onLogout} />
    </Suspense>
  ) : (
    <ArchiveApp onLogout={onLogout} />
  );
}

function ArchiveApp({ onLogout }: { onLogout: () => Promise<void> }) {
  const reduceMotion = usePrefersReducedMotion();
  const [page, setPage] = useState<Page>(() => pageFromLocation());
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
        setBlurCovers(payload.privacy.blur_covers_default);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const readerSource = page.name === "reader"
    ? { kind: "local" as const, workId: page.workId }
    : page.name === "readerRemote"
      ? { kind: "remote" as const, galleryId: page.galleryId }
      : null;
  const archivePage = page.name === "reader" || page.name === "readerRemote" ? null : page;
  const routeTransition = { duration: reduceMotion ? 0 : duration.slow, ease: ease.standard };
  const readerRest = { opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0%)" };

  return (
    <AnimatePresence initial={false} mode="sync">
      {readerSource ? (
        <m.div
          className="app-route-reader"
          key="reader"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 1, x: 34, clipPath: "inset(0% 0% 0% 100%)" }}
          animate={readerRest}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 1, x: -28, clipPath: "inset(0% 100% 0% 0%)" }}
          transition={routeTransition}
          style={{ position: "fixed", zIndex: 200, inset: 0, overflow: "hidden", background: "#0d0e0c" }}
        >
          <Suspense fallback={<ReaderRouteFallback />}>
            <ReaderPage source={readerSource} />
          </Suspense>
        </m.div>
      ) : archivePage ? (
        <m.div
          className="app-route-archive"
          key="archive"
          initial={{ opacity: 0.99 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.99 }}
          transition={routeTransition}
        >
          <ArchiveShell
            activePage={archivePage.name}
            scrollKey={archivePage.name === "gallery" ? `gallery:${archivePage.galleryId}` : archivePage.name}
            onLogout={onLogout}
          >
            <Suspense fallback={<FolioRouteFallback />}>
              {archivePage.name === "workbench" ? <WorkbenchPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "discover" ? <DiscoverPage blurCovers={blurCovers} initialTag={archivePage.tag} /> : null}
              {archivePage.name === "gallery" ? <GalleryDetailPage galleryId={archivePage.galleryId} returnTo={archivePage.returnTo} blurCovers={blurCovers} /> : null}
              {archivePage.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "history" ? <HistoryPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "governance" ? <GovernancePage initialWorkId={archivePage.workId} blurCovers={blurCovers} /> : null}
              {archivePage.name === "dictionary" ? <DictionaryPage /> : null}
              {archivePage.name === "tasks" ? <TasksPage /> : null}
              {archivePage.name === "export" ? <ExportPage initialWorkId={archivePage.workId} blurCovers={blurCovers} /> : null}
              {archivePage.name === "files" ? <FilesPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "settings" ? <SettingsPage onBlurCoversChange={setBlurCovers} /> : null}
            </Suspense>
          </ArchiveShell>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
