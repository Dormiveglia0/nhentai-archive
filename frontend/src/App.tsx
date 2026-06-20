import { useEffect, useState } from "react";

import { ArchiveShell } from "./components/layout/ArchiveShell";
import { DictionaryPage } from "./components/dictionary/DictionaryPage";
import { DiscoverPage } from "./components/discover/DiscoverPage";
import { ExportPage } from "./components/export/ExportPage";
import { FilesPage } from "./components/files/FilesPage";
import { GalleryDetailPage } from "./components/discover/GalleryDetailPage";
import { GovernancePage } from "./components/governance/GovernancePage";
import { LibraryPage } from "./components/library/LibraryPage";
import { ReaderPage } from "./components/reader/ReaderPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { TasksPage } from "./components/tasks/TasksPage";
import { Page, pageFromLocation } from "./lib/navigation";

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromLocation());
  const [privacyMode, setPrivacyMode] = useState(true);
  const [blurCovers, setBlurCovers] = useState(true);

  useEffect(() => {
    const sync = () => setPage(pageFromLocation());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <ArchiveShell
      activePage={page.name}
      privacyMode={privacyMode}
      blurCovers={blurCovers}
      onPrivacyModeChange={setPrivacyMode}
      onBlurCoversChange={setBlurCovers}
    >
      {page.name === "workbench" ? (
        <BoundaryPage
          title="工作台"
          description="工作台聚合馆藏、任务、治理与文件健康状态；当前阶段未接入真实聚合数据。"
        />
      ) : null}
      {page.name === "discover" ? <DiscoverPage blurCovers={blurCovers} initialTag={page.tag} /> : null}
      {page.name === "gallery" ? <GalleryDetailPage galleryId={page.galleryId} returnTo={page.returnTo} blurCovers={blurCovers} /> : null}
      {page.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}
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

function BoundaryPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="page">
      <div className="hero">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>
      <div className="page-panel boundary-panel">
        <strong>未接入真实能力</strong>
        <p>该模块只保留导航边界。实现前不会显示样例作品、模拟任务、随机统计或假操作结果。</p>
      </div>
    </section>
  );
}
