import { ArrowRight, ClipboardList, Download, FolderCog, ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import type { WorkbenchOverview } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { navigate, type Page } from "../../lib/navigation";
import { NumberTicker } from "../effects/NumberTicker";
import { FolioPanelHeading } from "../folio/ui/FolioPrimitives";
import { formatBytes, targetLabel } from "./workbenchHelpers";

type Stat = { label: string; value: number; format?: (n: number) => string };

type CardDef = {
  key: string;
  icon: typeof ClipboardList;
  title: string;
  headline: number;
  tone: "muted" | "warn" | "bad" | "ok";
  stats: Stat[];
  go: Page;
  goLabel: string;
  attention: boolean;
  extra?: ReactNode;
};

export function WorkbenchModuleCards({ overview }: { overview: WorkbenchOverview }) {
  const { governance, jobs, files, exports } = overview;

  const cards: CardDef[] = [
    {
      key: "governance",
      icon: ClipboardList,
      title: "治理",
      headline: governance.total,
      tone: governance.total > 0 ? "warn" : "muted",
      stats: [
        { label: "未人工核对", value: governance.unreviewed },
        { label: "内容已变化", value: governance.stale },
        { label: "系统有提示", value: governance.automatic_issues },
      ],
      go: { name: "governance" },
      goLabel: "进入治理",
      attention: false,
    },
    {
      key: "tasks",
      icon: ListChecks,
      title: "任务",
      headline: jobs.failed,
      tone: jobs.failed > 0 ? "bad" : "muted",
      stats: [
        { label: "正在运行", value: jobs.running },
        { label: "等待中", value: jobs.queued },
        { label: "失败", value: jobs.failed },
      ],
      go: { name: "tasks" },
      goLabel: "打开任务中心",
      attention: jobs.failed > 0,
      extra:
        jobs.failed_recent.length > 0 ? (
          <ul className="folio-workbench-fail-list">
            {jobs.failed_recent.map((job) => (
              <li key={job.id}>
                <strong>{targetLabel(job.target)}</strong>
                <small>{job.error ?? "失败"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="folio-workbench-module-empty">无失败任务。</p>
        ),
    },
    {
      key: "files",
      icon: FolderCog,
      title: "文件",
      headline: files.work_count,
      tone: files.missing_source > 0 ? "bad" : "muted",
      stats: [
        { label: "缺失源", value: files.missing_source },
        { label: "孤立 / 残留", value: files.orphan_count + files.stale_count },
        { label: "可回收", value: files.reclaimable_bytes, format: formatBytes },
      ],
      go: { name: "files" },
      goLabel: "打开文件管理",
      attention: false,
    },
    {
      key: "exports",
      icon: Download,
      title: "导出",
      headline: exports.ready,
      tone: exports.blocked > 0 ? "warn" : "muted",
      stats: [
        { label: "可导出", value: exports.ready },
        { label: "受阻", value: exports.blocked },
        { label: "有警告", value: exports.warnings },
      ],
      go: { name: "export" },
      goLabel: "打开导出中心",
      attention: false,
    },
  ];

  return (
    <section className="folio-workbench-ledger">
      <FolioPanelHeading title="模块状态" description="真实摘要与下一步操作。" />
      <Stagger className="folio-workbench-module-list">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
          <StaggerItem key={card.key} className="folio-workbench-module-cell">
            <article className={`tone-${card.tone}${card.attention ? " needs-attention" : ""}`}>
              <header>
                <Icon size={17} />
                <h3>{card.title}</h3>
                <strong><NumberTicker value={card.headline} /></strong>
              </header>
              <dl>
                {card.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>
                      <NumberTicker value={stat.value} format={stat.format} />
                    </dd>
                  </div>
                ))}
              </dl>
              {card.extra}
              <button type="button" onClick={() => navigate(card.go)}>
                {card.goLabel} <ArrowRight size={14} />
              </button>
            </article>
          </StaggerItem>
        )})}
      </Stagger>
    </section>
  );
}
