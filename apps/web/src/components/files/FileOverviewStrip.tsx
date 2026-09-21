import { m } from "motion/react";
import type { FileOverview } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { formatBytes } from "./fileHelpers";
import "./FileStorage.css";
export function FileOverviewStrip({overview,category,onCategory}:{overview:FileOverview|null;category:string;onCategory:(value:string)=>void}) {
  const reduce=usePrefersReducedMotion();
  const folders=[{id:"work",label:"作品文件",count:overview?.work_count,bytes:overview?.source_bytes},{id:"orphan",label:"孤立文件",count:overview?.orphan_count,bytes:overview?.orphan_bytes},{id:"stale",label:"临时文件",count:overview?.stale_count,bytes:overview?.stale_bytes}];
  return <section className="file-storage"><header><h1>文件</h1><span>索引异常 {overview ? overview.missing_source+overview.missing_cover : "—"}</span><button type="button" onClick={()=>onCategory("all")} aria-pressed={category==="all"}>全部文件</button></header><div className="file-volumes" role="group" aria-label="文件类型">{folders.map((folder,index)=><m.button key={folder.id} type="button" className="file-volume" aria-pressed={category===folder.id} onClick={()=>onCategory(folder.id)} initial={false} animate={{y:reduce?0:category===folder.id?-12:0}} transition={reduce?{duration:0}:{type:"spring",stiffness:160,damping:24}}><span className="file-volume-tab">0{index+1} / {folder.label}</span><span className="file-volume-sheets" aria-hidden="true"><i/><i/><i/></span><span className="file-volume-face"><span>{folder.label}<strong>{folder.count ?? "—"}<small>项</small></strong></span><b>{folder.bytes == null ? "—" : formatBytes(folder.bytes)}</b></span></m.button>)}</div></section>;
}
