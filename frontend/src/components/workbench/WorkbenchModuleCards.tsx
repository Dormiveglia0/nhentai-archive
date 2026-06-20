import { ArrowRight, ClipboardList, Download, FolderCog, ListChecks } from "lucide-react";

import type { WorkbenchOverview } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { formatBytes, targetLabel } from "./workbenchHelpers";

export function WorkbenchModuleCards({ overview }: { overview: WorkbenchOverview }) {
  const { governance, jobs, files, exports } = overview;
  return (
    <div className="workbench-cards">
      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><ClipboardList size={18} /></span>
          <h3>治理</h3>
          <strong>{governance.total}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>缺失元数据</dt><dd>{governance.missing_metadata}</dd></div>
          <div><dt>未打标签</dt><dd>{governance.untagged}</dd></div>
          <div><dt>词典待复核</dt><dd>{governance.dictionary_review}</dd></div>
        </dl>
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "governance" })}>
          进入治理 <ArrowRight size={14} />
        </button>
      </section>

      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><ListChecks size={18} /></span>
          <h3>任务</h3>
          <strong>{jobs.failed}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>正在运行</dt><dd>{jobs.running}</dd></div>
          <div><dt>等待中</dt><dd>{jobs.queued}</dd></div>
          <div><dt>失败</dt><dd>{jobs.failed}</dd></div>
        </dl>
        {jobs.failed_recent.length > 0 ? (
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
        )}
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "tasks" })}>
          打开任务中心 <ArrowRight size={14} />
        </button>
      </section>

      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><FolderCog size={18} /></span>
          <h3>文件</h3>
          <strong>{files.work_count}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>缺失源</dt><dd>{files.missing_source}</dd></div>
          <div><dt>孤立 / 残留</dt><dd>{files.orphan_count + files.stale_count}</dd></div>
          <div><dt>可回收</dt><dd>{formatBytes(files.reclaimable_bytes)}</dd></div>
        </dl>
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "files" })}>
          打开文件管理 <ArrowRight size={14} />
        </button>
      </section>

      <section className="workbench-card">
        <header>
          <span className="workbench-card-icon"><Download size={18} /></span>
          <h3>导出</h3>
          <strong>{exports.ready}</strong>
        </header>
        <dl className="workbench-card-stats">
          <div><dt>可导出</dt><dd>{exports.ready}</dd></div>
          <div><dt>受阻</dt><dd>{exports.blocked}</dd></div>
          <div><dt>有警告</dt><dd>{exports.warnings}</dd></div>
        </dl>
        <button type="button" className="workbench-card-go" onClick={() => navigate({ name: "export" })}>
          打开导出中心 <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}
