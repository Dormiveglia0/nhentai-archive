import { LayoutGroup, m } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { Job } from "../../lib/api";
import { jobTypeLabel, statusLabel, type JobStatusFilter } from "../../lib/jobs";
import { usePrefersReducedMotion } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";

const columns: { key:JobStatusFilter; label:string; statuses:Job['status'][] }[] = [
  {key:'queued',label:'等待',statuses:['queued']},
  {key:'active',label:'进行中',statuses:['running','cancelling']},
  {key:'attention',label:'需处理',statuses:['paused','failed']},
  {key:'finished',label:'已结束',statuses:['completed','cancelled']},
];
export function TaskFlow({jobs,focusId,onFocus,onFilter,loading,filter}:{jobs:Job[];focusId:number|null;onFocus:(id:number)=>void;onFilter:(status:JobStatusFilter)=>void;loading:boolean;filter:JobStatusFilter}) {
  const reduce=usePrefersReducedMotion();
  const running=jobs.filter(job=>job.status==='running').length;
  return <section className={`task-flow${running ? ' is-running':''}`} aria-label="任务流">
    <header><div><span>PROCESS / {String(jobs.length).padStart(2,'0')}</span><h1>队列</h1></div><div className="task-flow-live"><i/>{loading?'读取中':running?`${running} 项运行中`:'当前无运行任务'}</div></header>
    <LayoutGroup id="task-flow">
      <div className="task-flow-columns">
        {columns.map((column,index)=>{
          const items=jobs.filter(job=>column.statuses.includes(job.status));
          return <div key={column.key} className={`task-flow-column flow-${column.key}${filter===column.key?" is-filtered":""}`}>
            <header><button type="button" aria-pressed={filter===column.key} onClick={()=>onFilter(filter===column.key?"all":column.key)}>{column.label}<span><NumberTicker value={items.length}/></span></button>{index===0 && <ArrowRight size={18} aria-hidden="true"/>}</header>
            <div className="task-flow-items">
              {items.slice(0,3).map(job=><m.button layout={!reduce} layoutId={`flow-job-${job.id}`} key={job.id} type="button" onClick={()=>onFocus(job.id)} className={focusId===job.id?'is-selected':''} aria-pressed={focusId===job.id}
                initial={{opacity:0,y:reduce?0:10}} animate={{opacity:1,y:0}} transition={reduce?{duration:0}:{type:'spring',stiffness:260,damping:30}}>
                <span>#{job.id}</span><strong>{jobTypeLabel(job.type)}</strong><small>{statusLabel(job.status)}</small><i style={{transform:`scaleX(${Math.max(0,Math.min(100,job.progress.percent))/100})`}}/>
              </m.button>)}
              {!items.length && <div className="task-flow-empty"><span/>{loading?'读取中':'暂无任务'}</div>}
              {items.length>3 && <button className="task-flow-rest" type="button" onClick={()=>onFilter(column.key)}>查看其余 {items.length-3} 项</button>}
            </div>
          </div>;
        })}
      </div>
    </LayoutGroup>
  </section>;
}
