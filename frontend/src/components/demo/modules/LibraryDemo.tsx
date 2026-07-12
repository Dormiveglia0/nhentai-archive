import { Grid2X2, Library, List } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";

import type { FolioPageId } from "../config";
import { DemoSelect, EmptyCanvas, PanelHeading, SearchField } from "../ui/DemoPrimitives";

export function LibraryDemo({ onNavigate }: { onNavigate: (page: FolioPageId) => void }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"all" | "zh" | "ja">("all");
  const [status, setStatus] = useState<"all" | "unread" | "reading" | "read">("all");
  const [sort, setSort] = useState<"recent" | "title" | "progress">("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-toolbar folio-demo-library-toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="搜索标题、作者、标签或画廊 ID" />
        <DemoSelect label="语言" value={language} onChange={setLanguage} options={[
          { value: "all", label: "全部语言" },
          { value: "zh", label: "中文" },
          { value: "ja", label: "日文" },
        ]} />
        <DemoSelect label="阅读状态" value={status} onChange={setStatus} options={[
          { value: "all", label: "全部状态" },
          { value: "unread", label: "未读" },
          { value: "reading", label: "阅读中" },
          { value: "read", label: "已读" },
        ]} />
        <DemoSelect label="排序" value={sort} onChange={setSort} options={[
          { value: "recent", label: "最近添加" },
          { value: "title", label: "标题" },
          { value: "progress", label: "阅读进度" },
        ]} />
        <div className="folio-demo-view-switch" aria-label="视图方式">
          <button className={view === "grid" ? "is-active" : ""} type="button" aria-label="封面墙视图" onClick={() => setView("grid")}>
            {view === "grid" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-view-active" /> : null}
            <Grid2X2 size={16} />
          </button>
          <button className={view === "list" ? "is-active" : ""} type="button" aria-label="列表视图" onClick={() => setView("list")}>
            {view === "list" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-view-active" /> : null}
            <List size={17} />
          </button>
        </div>
      </div>

      <div className="folio-demo-split-layout">
        <section className="folio-demo-ruled-panel">
          <PanelHeading title="馆藏" description={query ? "当前搜索不会发送到服务器。" : "全部真实入库作品会显示在这里。"} />
          <EmptyCanvas
            icon={Library}
            title="库里还没有作品"
            copy="公开演示不生成假作品。前往发现页后，仍可体验完整的检索与导入界面。"
            action="打开发现页"
            onAction={() => onNavigate("discover")}
          />
        </section>
        <aside className="folio-demo-inspector">
          <span>Inspector</span>
          <h2>作品详情</h2>
          <p>选择一部真实作品后，这里显示封面、阅读进度、来源与标签。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}


