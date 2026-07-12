import { PenLine, Tag } from "lucide-react";
import { useState } from "react";

import { DemoField, PanelHeading } from "../ui/DemoPrimitives";

export function GovernanceDemo() {
  const [onlyDiff, setOnlyDiff] = useState(true);

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-governance-layout">
        <aside className="folio-demo-queue-rail">
          <PanelHeading title="待编辑作品" description="真实入库后自动生成队列。" />
          <div className="folio-demo-rail-empty"><PenLine size={20} /><span>暂无待编辑作品</span></div>
        </aside>

        <section className="folio-demo-editor-stage">
          <div className="folio-demo-editor-head">
            <div>
              <span>Metadata</span>
              <h2>元数据对照编辑</h2>
            </div>
            <button className={"folio-demo-filter-toggle" + (onlyDiff ? " is-active" : "")} type="button" aria-pressed={onlyDiff} onClick={() => setOnlyDiff((value) => !value)}>
              仅看差异
            </button>
          </div>
          <div className="folio-demo-field-matrix">
            <DemoField label="标题" placeholder="选择作品后显示" readOnly />
            <DemoField label="日文标题" placeholder="选择作品后显示" readOnly />
            <DemoField label="作者 / 社团" placeholder="选择作品后显示" readOnly />
            <DemoField label="语言" placeholder="选择作品后显示" readOnly />
          </div>
          <div className="folio-demo-tag-board">
            <div><Tag size={17} /><strong>标签</strong></div>
            <p>选中作品后，对照远端原始标签与本地词典译名。</p>
          </div>
        </section>

        <aside className="folio-demo-source-rail">
          <span>Source check</span>
          <h2>来源对照</h2>
          <p>标题、标签、页数与远端画廊信息会在此并列展示。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}


