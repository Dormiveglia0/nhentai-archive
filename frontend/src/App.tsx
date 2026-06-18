import { useEffect, useState } from "react";

import { ArchiveShell } from "./components/layout/ArchiveShell";
import { DictionaryPage } from "./components/dictionary/DictionaryPage";
import { DiscoverPage } from "./components/discover/DiscoverPage";
import { GalleryDetailPage } from "./components/discover/GalleryDetailPage";
import { GovernancePage } from "./components/governance/GovernancePage";
import { LibraryPage } from "./components/library/LibraryPage";
import { ReaderPage } from "./components/reader/ReaderPage";
import { SettingsPage } from "./components/settings/SettingsPage";
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
      {page.name === "tasks" ? (
        <BoundaryPage title="任务中心" description="底部任务坞站已读取真实 /api/jobs；完整任务列表、暂停、恢复、取消后续接入。" />
      ) : null}
      {page.name === "export" ? (
        <BoundaryPage title="导出中心" description="导出 preview 与 CBZ 生成未实现；不会渲染假导出记录或假文件名。" />
      ) : null}
      {page.name === "files" ? (
        <BoundaryPage title="文件管理" description="文件健康检查、重复检测、清理预览尚未实现；不会展示假容量和假问题数。" />
      ) : null}
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
