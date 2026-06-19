import { AlertTriangle, CheckSquare, FileArchive, Layers, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import type { ExportQueue } from "../../lib/api";
import exportHeroSketch from "../../assets/export-hero-sketch.png";

type ExportSummaryProps = {
  queue: ExportQueue;
  selectedCount: number;
  exportableCount: number;
};

export function ExportSummary({ queue, selectedCount, exportableCount }: ExportSummaryProps) {
  const { total, ready, warnings, blocked } = queue.summary;
  return (
    <>
      <header className="export-hero">
        <div className="export-hero-head">
          <h1>导出中心</h1>
          <p>挑选作品，写入整理后的 ComicInfo，打包为 CBZ 下载到你的设备。</p>
        </div>
        <div className="export-hero-note" aria-hidden="true">
          <img className="export-hero-sketch" src={exportHeroSketch} alt="" />
          <p>在纸与墨的世界里，归档收藏的是秩序、心意与时光。</p>
          <span>— NH Archive</span>
        </div>
      </header>

      <section className="export-summary">
        <Metric icon={<FileArchive size={20} />} label="待导出作品" value={total} caption="队列中的全部作品" />
        <Metric icon={<CheckSquare size={20} />} label="就绪可下载" value={ready} caption="可直接打包下载" tone="green" />
        <Metric icon={<Layers size={20} />} label="已选择" value={selectedCount} caption={`${exportableCount} 项可下载`} />
        <Metric icon={<AlertTriangle size={20} />} label="含警告" value={warnings} caption="导出仍可进行" />
        <Metric icon={<XCircle size={20} />} label="阻塞" value={blocked} caption="需修复源文件" tone="warn" />
      </section>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  caption,
  tone = "",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  caption: string;
  tone?: string;
}) {
  return (
    <div className={`export-metric ${tone}`}>
      <span className="export-metric-icon">{icon}</span>
      <div className="export-metric-body">
        <strong>{value}</strong>
        <small>{label}</small>
        <em>{caption}</em>
      </div>
    </div>
  );
}
