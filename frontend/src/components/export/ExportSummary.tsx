import { AlertTriangle, CheckSquare, FileArchive, FolderOpen, Layers } from "lucide-react";
import type { ReactNode } from "react";

import type { ExportQueue, ExportSummaryStats } from "../../lib/api";
import exportHeroSketch from "../../assets/export-hero-sketch.png";
import { compactPath } from "./exportHelpers";

type ExportSummaryProps = {
  queue: ExportQueue;
  summary: ExportSummaryStats | null;
  selectedCount: number;
  exportableCount: number;
  presetCount: number;
  activePresetName: string;
};

export function ExportSummary({
  queue,
  summary,
  selectedCount,
  exportableCount,
  presetCount,
  activePresetName,
}: ExportSummaryProps) {
  return (
    <>
      <header className="export-hero">
        <div className="export-hero-head">
          <h1>导出中心</h1>
          <p>批量导出你的作品为 CBZ 格式，或按预设规则打包与整理。</p>
        </div>
        <div className="export-hero-note" aria-hidden="true">
          <img className="export-hero-sketch" src={exportHeroSketch} alt="" />
          <p>在纸与墨的世界里，归档收藏的是秩序、心意与时光。</p>
          <span>— NH Archive</span>
        </div>
      </header>

      <section className="export-summary">
        <Metric icon={<FileArchive size={20} />} label="导出记录" value={summary?.generated ?? 0} caption="查看历史记录" />
        <Metric icon={<Layers size={20} />} label="导出预设" value={presetCount} caption={activePresetName} />
        <Metric icon={<CheckSquare size={20} />} label="批量导出" value={selectedCount} caption={`${exportableCount} 项可处理`} tone="green" />
        <Metric icon={<AlertTriangle size={20} />} label="失败重试" value={queue.summary.blocked} caption="需修复阻塞项" tone="warn" />
        <Metric
          icon={<FolderOpen size={20} />}
          label="输出目录"
          text={summary?.output_dir ? compactPath(summary.output_dir) : "-"}
          title={summary?.output_dir}
          caption={`可用 ${summary?.available ?? 0} 个文件`}
        />
      </section>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  text,
  title,
  caption,
  tone = "",
}: {
  icon: ReactNode;
  label: string;
  value?: number;
  text?: string;
  title?: string;
  caption: string;
  tone?: string;
}) {
  return (
    <div className={`export-metric ${tone}`}>
      <span className="export-metric-icon">{icon}</span>
      <div className="export-metric-body">
        <strong title={title ?? text}>{text ?? value}</strong>
        <small>{label}</small>
        <em>{caption}</em>
      </div>
    </div>
  );
}
