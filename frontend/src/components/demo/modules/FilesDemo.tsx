import { Folder, RefreshCw } from "lucide-react";
import { useState } from "react";

import { DemoSelect, EmptyCanvas, SearchField } from "../ui/DemoPrimitives";

export function FilesDemo() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "healthy" | "missing" | "mismatch">("all");
  const [sort, setSort] = useState<"recent" | "size" | "title">("recent");

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="搜索标题或路径" />
        <DemoSelect label="文件状态" value={status} onChange={setStatus} options={[
          { value: "all", label: "全部状态" },
          { value: "healthy", label: "正常" },
          { value: "missing", label: "源文件缺失" },
          { value: "mismatch", label: "体积不一致" },
        ]} />
        <DemoSelect label="排序" value={sort} onChange={setSort} options={[
          { value: "recent", label: "最近更新" },
          { value: "size", label: "文件体积" },
          { value: "title", label: "标题" },
        ]} />
        <button className="folio-demo-line-button" type="button"><RefreshCw size={15} />扫描目录</button>
      </div>

      <div className="folio-demo-split-layout">
        <section className="folio-demo-ruled-panel">
          <div className="folio-demo-table-head folio-demo-files-head"><span>作品 / 路径</span><span>状态</span><span>体积</span><span>更新</span></div>
          <EmptyCanvas icon={Folder} title="未读取本机目录" copy="路径、文件体积和可回收空间在公开演示中保持空白。" />
        </section>
        <aside className="folio-demo-inspector">
          <span>File health</span>
          <h2>文件详情</h2>
          <p>选择文件后显示哈希、源路径、索引状态与维护操作。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}


