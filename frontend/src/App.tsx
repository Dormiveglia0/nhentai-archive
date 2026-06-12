import { useEffect, useState } from "react";

import { ArchiveShell } from "./components/layout/ArchiveShell";
import { DiscoverPage } from "./components/discover/DiscoverPage";
import { LibraryPage } from "./components/library/LibraryPage";
import { ReaderPage } from "./components/reader/ReaderPage";
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
      {page.name === "discover" ? <DiscoverPage blurCovers={blurCovers} /> : null}
      {page.name === "library" ? <LibraryPage blurCovers={blurCovers} /> : null}
      {page.name === "reader" ? <ReaderPage workId={page.workId} privacyMode={privacyMode} /> : null}
      {page.name === "tasks" ? (
        <section className="page-panel">
          <h1>任务中心</h1>
          <p>任务中心已由底部任务坞站实时展示；完整列表页将在文件与任务统一阶段接入。</p>
        </section>
      ) : null}
      {page.name === "settings" ? (
        <section className="page-panel">
          <h1>设置</h1>
          <p>第一阶段读取环境变量和本地数据目录；图形化设置将在核心闭环稳定后接入。</p>
        </section>
      ) : null}
    </ArchiveShell>
  );
}
