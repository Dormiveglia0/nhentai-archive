import { ArrowUpRight, CircleCheck, Clock3, Pause, Workflow } from "lucide-react";
import { m } from "motion/react";
import type { Job } from "../../lib/api";
import { JOB_STATUS_GROUPS, jobTypeLabel, stageLabel, targetLabel, type JobStatusFilter } from "../../lib/jobs";
import { usePrefersReducedMotion } from "../../lib/motion";

const lanes = [
  { key: "queued", label: "等待", icon: Clock3 },
  { key: "active", label: "运行", icon: Workflow },
  { key: "attention", label: "需处理", icon: Pause },
  { key: "finished", label: "已结束", icon: CircleCheck },
] as const;

export function TaskBoard({ jobs, filter, onFilter, onOpen }: { jobs: Job[]; filter: JobStatusFilter; onFilter: (value: JobStatusFilter) => void; onOpen: (id: number, origin: HTMLElement) => void }) {
  const reduced = usePrefersReducedMotion();
  return <div className="task-board task-ledger-states" aria-label="任务状态分布">
    {lanes.map(({ key, label, icon: Icon }, index) => {
      const statuses: Job["status"][] = JOB_STATUS_GROUPS[key] ?? ["queued"];
      const items = jobs.filter(job => statuses.includes(job.status));
      return <m.section layout="position" transition={reduced?{duration:0}:{type:"spring",stiffness:130,damping:26}} key={key} className={`task-lane is-${key}${filter === key ? " is-selected" : ""}`}>
        <button className="task-lane-heading" type="button" onClick={() => onFilter(filter === key ? "all" : key)} aria-pressed={filter === key}>
          <span className="task-lane-index">0{index + 1}</span><Icon size={18}/><span>{label}</span><strong>{items.length}</strong>
        </button>
        <div className={`task-state-symbol${items.length?" has-jobs":""}`} aria-hidden="true"><Icon strokeWidth={.65}/><span>{String(items.length).padStart(2,"0")}</span></div>
        <div className="task-lane-stack">
          {items.length ? items.slice(0, 1).map((job, slot) => <m.button key={job.id} layoutId={`task-object-${job.id}`} className={`task-object is-${job.status}`} type="button" aria-label={`展开任务 ${job.id}：${jobTypeLabel(job.type)}`} onClick={event => onOpen(job.id, event.currentTarget)} initial={false} whileHover={reduced ? undefined : { y: -8, rotate: 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 23 }} style={{ zIndex: 4 - slot }}>
            <span className="task-object-number">#{job.id}<ArrowUpRight size={15}/></span>
            <strong>{jobTypeLabel(job.type)}</strong><span className="task-object-target">{job.meta?.title || targetLabel(job)}</span>
            <span className="task-object-progress"><m.i initial={false} animate={{scaleX:Math.max(0,Math.min(100,job.progress.percent))/100}} transition={{duration:reduced ? 0 : .5}}/></span>
            <span className="task-object-stage">{stageLabel(job.stage)}<b>{job.progress.percent}%</b></span>
          </m.button>) : <div className="task-lane-empty"><span/><span/><small>暂无{label}任务</small></div>}
        </div>
        {items.length > 1 && <button className="task-lane-more" type="button" onClick={() => onFilter(key)}>查看全部 {items.length} 项 <ArrowUpRight size={14}/></button>}
      </m.section>;
    })}
  </div>;
}
