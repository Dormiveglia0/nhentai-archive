import { Workflow } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";

import { FolioEmptyState as EmptyCanvas, FolioSearchField as SearchField } from "../../folio/ui/FolioPrimitives";

export function TasksDemo() {
  const [tab, setTab] = useState<"all" | "queued" | "running" | "completed" | "failed">("all");
  const [query, setQuery] = useState("");
  const tabs = [
    { id: "all" as const, label: "全部" },
    { id: "queued" as const, label: "等待中" },
    { id: "running" as const, label: "运行中" },
    { id: "completed" as const, label: "已完成" },
    { id: "failed" as const, label: "失败" },
  ];

  return (
    <div className="folio-page-body">
      <section className="folio-task-summary">
        {tabs.slice(1).map((item) => (
          <article key={item.id}><span>{item.label}</span><strong>—</strong><small>未连接任务队列</small></article>
        ))}
      </section>

      <div className="folio-toolbar folio-toolbar-wide">
        <div className="folio-tabs" role="tablist" aria-label="任务状态筛选">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
              {tab === item.id ? <m.span className="folio-control-active" layoutId="folio-task-tab-active" /> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="搜索任务 ID、Gallery ID、阶段或错误" />
      </div>

      <div className="folio-split-layout">
        <section className="folio-ruled-panel">
          <div className="folio-table-head"><span>任务</span><span>阶段</span><span>进度</span><span>状态</span></div>
          <EmptyCanvas icon={Workflow} title="没有真实任务" copy="导入、扫描、治理或导出开始后，任务会按时间顺序出现在这里。" />
        </section>
        <aside className="folio-inspector">
          <span>Task log</span>
          <h2>运行详情</h2>
          <p>选择任务后显示阶段、进度、开始时间与错误日志。</p>
          <div className="folio-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}

