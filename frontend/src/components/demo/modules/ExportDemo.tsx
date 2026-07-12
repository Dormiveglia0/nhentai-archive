import { Archive, PackageOpen } from "lucide-react";
import { useState } from "react";

import { DemoField, EmptyCanvas, PanelHeading, SearchField, ToggleRow } from "../ui/DemoPrimitives";

export function ExportDemo() {
  const [query, setQuery] = useState("");
  const [comicInfo, setComicInfo] = useState(true);
  const [json, setJson] = useState(true);
  const [compress, setCompress] = useState(true);

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-export-layout">
        <section className="folio-demo-export-source">
          <PanelHeading title="选择作品" description="只从真实本地馆藏中选择导出项。" />
          <SearchField value={query} onChange={setQuery} placeholder="搜索作品" />
          <EmptyCanvas icon={Archive} title="没有可导出的作品" copy="公开演示不会创建假馆藏。导入真实作品后即可多选并生成任务。" />
        </section>

        <section className="folio-demo-export-recipe">
          <div className="folio-demo-recipe-head">
            <div>
              <span>Export recipe</span>
              <h2>CBZ 配方</h2>
            </div>
            <PackageOpen size={27} />
          </div>
          <DemoField label="输出名称" placeholder="选择作品后自动生成" readOnly />
          <div className="folio-demo-toggle-list">
            <ToggleRow label="写入 ComicInfo.xml" copy="生成标准漫画元数据。" checked={comicInfo} onChange={setComicInfo} />
            <ToggleRow label="保留原始 JSON" copy="保留源归档中的 JSON。" checked={json} onChange={setJson} />
            <ToggleRow label="标准压缩" copy="以平衡体积和速度的方式生成。" checked={compress} onChange={setCompress} />
          </div>
          <div className="folio-demo-manifest">
            <span>内容预览</span>
            <p>页面文件</p><strong>—</strong>
            <p>ComicInfo.xml</p><strong>{comicInfo ? "写入" : "跳过"}</strong>
            <p>原始 JSON</p><strong>{json ? "保留" : "跳过"}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}


