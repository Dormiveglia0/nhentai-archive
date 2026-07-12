import { ArrowRight, BookOpen, HardDrive, Library, PenLine, Workflow } from "lucide-react";

import { FOLIO_PAGES, type FolioPageId } from "../../folio/config";
import { FolioEmptyState as EmptyCanvas, FolioPanelHeading as PanelHeading } from "../../folio/ui/FolioPrimitives";

export function WorkbenchDemo({ onNavigate }: { onNavigate: (page: FolioPageId) => void }) {
  const states = [
    { label: "馆藏", value: "未连接", detail: "等待本地索引", icon: Library },
    { label: "治理", value: "等待入库", detail: "暂无待处理作品", icon: PenLine },
    { label: "任务", value: "队列为空", detail: "没有运行中任务", icon: Workflow },
    { label: "存储", value: "未读取", detail: "公开演示不访问磁盘", icon: HardDrive },
  ];

  return (
    <div className="folio-page-body">
      <section className="folio-status-band" aria-label="工作台状态">
        {states.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label}>
              <Icon size={17} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          );
        })}
      </section>

      <div className="folio-workbench-grid">
        <section className="folio-ruled-panel folio-reading-panel">
          <PanelHeading title="继续阅读" description="阅读进度会在接入真实馆藏后出现在这里。" />
          <EmptyCanvas icon={BookOpen} title="还没有可继续的阅读" copy="导入真实 CBZ 并打开阅读器后，进度会自动回到工作台。" />
        </section>

        <section className="folio-module-ledger">
          <PanelHeading title="模块索引" description="从一个工作面进入完整流程。" />
          {FOLIO_PAGES.filter((item) => item.id !== "workbench" && item.id !== "settings").map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => onNavigate(item.id)}>
                <Icon size={17} />
                <strong>{item.label}</strong>
                <small>{item.description}</small>
                <ArrowRight size={15} />
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

