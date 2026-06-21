import { ArrowRight, ClipboardList, Download, FolderCog, ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import type { WorkbenchOverview } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { navigate, type Page } from "../../lib/navigation";
import { NumberTicker } from "../effects/NumberTicker";
import { ShineBorder } from "../effects/ShineBorder";
import { formatBytes, targetLabel } from "./workbenchHelpers";

type Stat = { label: string; value: number; format?: (n: number) => string };

type CardDef = {
  key: string;
  icon: ReactNode;
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
      icon: <ClipboardList size={18} />,
      title: "治理",
      headline: governance.total,
      tone: governance.total > 0 ? "warn" : "muted",
      stats: [
        { label: "缺失元数据", value: governance.missing_metadata },
        { label: "未打标签", value: governance.untagged },
        { label: "词典待复核", value: governance.dictionary_review },
      ],
      go: { name: "governance" },
      goLabel: "进入治理",
      attention: false,
    },
    {
      key: "tasks",
      icon: <ListChecks size={18} />,
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
          <ul className="workbench-fail-list">
            {jobs.failed_recent.map((job) => (
              <li key={job.id}>
                <strong>{targetLabel(job.target)}</strong>
                <small>{job.error ?? "失败"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="workbench-card-empty">无失败任务。</p>
        ),
    },
    {
      key: "files",
      icon: <FolderCog size={18} />,
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
      icon: <Download size={18} />,
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
    <Stagger className="workbench-cards">
      {cards.map((card) => (
        <StaggerItem key={card.key} className="workbench-card-cell">
          <CardShell attention={card.attention}>
            <article className={`workbench-card tone-${card.tone}${card.attention ? " is-shine" : ""}`}>
              <header>
                <span className="workbench-card-icon">{card.icon}</span>
                <h3>{card.title}</h3>
                <strong>
                  <NumberTicker value={card.headline} />
                </strong>
              </header>
              <dl className="workbench-card-stats">
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
              <button type="button" className="workbench-card-go" onClick={() => navigate(card.go)}>
                {card.goLabel} <ArrowRight size={14} />
              </button>
            </article>
          </CardShell>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function CardShell({ attention, children }: { attention: boolean; children: ReactNode }) {
  if (attention) return <ShineBorder>{children}</ShineBorder>;
  return <>{children}</>;
}
