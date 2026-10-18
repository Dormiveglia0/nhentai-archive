import { AnimatePresence, m } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { AuthGate } from "./components/auth/AuthGate";
import { AuthWakeDemo } from "./components/auth/AuthWakeDemo";
import { ArchiveShell } from "./components/layout/ArchiveShell";
import { FolioRouteFallback, ReaderRouteFallback } from "./components/layout/RouteFallback";
import { api, type GalleryDetail } from "./lib/api";
import { cancelPageTransition, duration, ease, transitionPage, transitionTabs, usePrefersReducedMotion } from "./lib/motion";
import { FOLIO_PAGES } from "./components/folio/config";
import { pageFromLocation, pageHref, type Page } from "./lib/navigation";

const FrontendDemo = lazy(() =>
  import("./components/demo/FrontendDemo").then((module) => ({ default: module.FrontendDemo })),
);
const WorkbenchPage = lazy(() =>
  import("./components/workbench/WorkbenchPage").then((module) => ({ default: module.WorkbenchPage })),
);
const LibraryPage = lazy(() =>
  import("./components/library/LibraryPage").then((module) => ({ default: module.LibraryPage })),
);
const ScrapeReviewPage = lazy(() =>
  import("./components/library/ScrapeReviewPage").then(module => ({ default: module.ScrapeReviewPage })),
);
const HistoryPage = lazy(() =>
  import("./components/history/HistoryPage").then((module) => ({ default: module.HistoryPage })),
);
const DiscoverPage = lazy(() =>
  import("./components/discover/DiscoverPage").then((module) => ({ default: module.DiscoverPage })),
);
let loadedGalleryPage: typeof import("./components/discover/GalleryDetailPage").GalleryDetailPage | undefined;
const loadGalleryPage = () => import("./components/discover/GalleryDetailPage").then(module => {
  loadedGalleryPage = module.GalleryDetailPage;
  return { default: module.GalleryDetailPage };
});
const GalleryDetailPage = lazy(loadGalleryPage);
const GovernancePage = lazy(() =>
  import("./components/governance/GovernancePage").then((module) => ({ default: module.GovernancePage })),
);
const DictionaryPage = lazy(() =>
  import("./components/dictionary/DictionaryPage").then((module) => ({ default: module.DictionaryPage })),
);
const TasksPage = lazy(() =>
  import("./components/tasks/TasksPage").then((module) => ({ default: module.TasksPage })),
);
const LegacyExportEntry = lazy(() =>
  import("./components/export/LegacyExportEntry").then((module) => ({ default: module.LegacyExportEntry })),
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
  if (window.location.pathname === "/auth-concept") return <AuthWakeDemo preview />;
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
  const GalleryPage = loadedGalleryPage ?? GalleryDetailPage;
  const reduceMotion = usePrefersReducedMotion();
  const [page, setPage] = useState<Page>(() => pageFromLocation());
  const routeRef = useRef(page);
  const readerEntry = useRef(0);
  routeRef.current = page;
  const [blurCovers, setBlurCovers] = useState(true);
  const [preparedGallery, setPreparedGallery] = useState<GalleryDetail>();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    let navigation = 0;
    const sync = async () => {
      const current = ++navigation;
      const next = pageFromLocation();
      const previous = routeRef.current;
      const wasReader = previous.name === "reader" || previous.name === "readerRemote";
      const isReader = next.name === "reader" || next.name === "readerRemote";
      cancelPageTransition();
      setNavigating(false);
      delete document.documentElement.dataset.folioLoading;
      let detail: GalleryDetail | undefined;
      if (next.name === "gallery" && !wasReader) {
        setNavigating(true);
        document.documentElement.dataset.folioLoading = "gallery";
        const results = await Promise.allSettled([api.gallery(next.galleryId), loadGalleryPage()]);
        if (current !== navigation) return;
        if (results[0].status === "fulfilled") detail = results[0].value;
        setNavigating(false);
        delete document.documentElement.dataset.folioLoading;
      }
      const commit = () => { setPreparedGallery(detail); setPage(next); };
      if (isReader && !wasReader) readerEntry.current += 1;
      if (wasReader || isReader) {
        flushSync(commit);
      } else if (previous.name === "gallery" || next.name === "gallery") {
        void transitionPage(commit, next.name === "gallery" ? 1 : -1, "detail");
      } else {
        transitionTabs<Page["name"]>(FOLIO_PAGES.map(item => item.id), previous.name, next.name, commit);
      }
    };
    window.addEventListener("hashchange", sync);
    return () => { navigation += 1; window.removeEventListener("hashchange", sync); delete document.documentElement.dataset.folioLoading; };
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
  const lastArchivePage = useRef<Exclude<Page, { name: "reader" } | { name: "readerRemote" }> | null>(
    page.name === "reader" || page.name === "readerRemote" ? null : page,
  );
  const archiveRouteRef = useRef<HTMLDivElement>(null);
  const archiveFocusRef = useRef<HTMLElement | null>(null);
  const archiveFocusPageRef = useRef("");
  const archivePage = page.name === "reader" || page.name === "readerRemote" ? lastArchivePage.current : page;
  const readerFocusKey = readerSource
    ? `${readerSource.kind}:${readerSource.kind === "local" ? readerSource.workId : readerSource.galleryId}`
    : "";
  const routeTransition = { duration: reduceMotion ? 0 : duration.slow, ease: ease.standard };
  const readerRest = { opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0%)" };

  useEffect(() => {
    if (page.name !== "reader" && page.name !== "readerRemote") lastArchivePage.current = page;
  }, [page]);

  useEffect(() => {
    const archiveRoute = archiveRouteRef.current;
    if (readerFocusKey) {
      archiveFocusRef.current = document.activeElement instanceof HTMLElement && archiveRoute?.contains(document.activeElement)
        ? document.activeElement
        : null;
      archiveFocusPageRef.current = lastArchivePage.current ? pageHref(lastArchivePage.current) : "";
      if (archiveRoute) archiveRoute.inert = true;
      document.querySelector<HTMLElement>(".app-route-reader")?.focus({ preventScroll: true });
      return;
    }
    if (archiveRoute) archiveRoute.inert = false;
    const focusTarget = archiveFocusRef.current;
    const shouldRestore = focusTarget?.isConnected
      && page.name !== "reader"
      && page.name !== "readerRemote"
      && archiveFocusPageRef.current === pageHref(page);
    archiveFocusRef.current = null;
    archiveFocusPageRef.current = "";
    if (shouldRestore) focusTarget.focus({ preventScroll: true });
  }, [page, readerFocusKey]);

  return (
    <>
      {archivePage ? (
        <div
          ref={archiveRouteRef}
          className="app-route-archive"
          aria-hidden={readerSource ? true : undefined}
          style={readerSource ? { pointerEvents: "none" } : undefined}
        >
          <ArchiveShell
            activePage={archivePage.name}
            scrollKey={archivePage.name === "gallery" ? `gallery:${archivePage.galleryId}` : archivePage.name}
            onLogout={onLogout}
            suspended={Boolean(readerSource)}
          >
            {navigating ? <div className="folio-detail-pending" role="status" aria-label="正在打开作品详情" /> : null}
            <Suspense fallback={<FolioRouteFallback />}>
              {archivePage.name === "workbench" ? <WorkbenchPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "discover" ? <DiscoverPage blurCovers={blurCovers} initialTag={archivePage.tag} /> : null}
              {archivePage.name === "gallery" ? <GalleryPage initialDetail={preparedGallery?.gallery_id === archivePage.galleryId ? preparedGallery : undefined} galleryId={archivePage.galleryId} returnTo={archivePage.returnTo} blurCovers={blurCovers} /> : null}
              {archivePage.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "scrape" ? <ScrapeReviewPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "history" ? <HistoryPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "governance" ? <GovernancePage initialWorkId={archivePage.workId} blurCovers={blurCovers} /> : null}
              {archivePage.name === "dictionary" ? <DictionaryPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "tasks" ? <TasksPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "export" ? <LegacyExportEntry initialWorkId={archivePage.workId} blurCovers={blurCovers} /> : null}
              {archivePage.name === "files" ? <FilesPage blurCovers={blurCovers} /> : null}
              {archivePage.name === "settings" ? <SettingsPage onBlurCoversChange={setBlurCovers} /> : null}
            </Suspense>
          </ArchiveShell>
        </div>
      ) : null}

      <AnimatePresence key={readerEntry.current} initial={readerEntry.current > 0} mode="sync">
        {readerSource ? (
          <m.div
            className="app-route-reader"
            key="reader"
            role="main"
            aria-label="阅读器"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 1, x: 34, clipPath: "inset(0% 0% 0% 100%)" }}
            animate={readerRest}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 1, x: -28, clipPath: "inset(0% 100% 0% 0%)" }}
            transition={routeTransition}
            style={{ position: "fixed", zIndex: 200, inset: 0, overflow: "hidden", background: "#0d0e0c", outline: "none" }}
          >
            <Suspense fallback={<ReaderRouteFallback />}>
              <ReaderPage source={readerSource} />
            </Suspense>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
