import { m } from "motion/react";
import type { FileOverview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";
import "./FileStorage.css";

export function FileOverviewStrip({ overview, category, onCategory }: { overview: FileOverview | null; category: string; onCategory: (value: string) => void }) {
  const folders = [
    { id: "work", label: "作品文件", count: overview?.work_count, bytes: overview?.source_bytes },
    { id: "orphan", label: "孤立文件", count: overview?.orphan_count, bytes: overview?.orphan_bytes },
    { id: "stale", label: "临时文件", count: overview?.stale_count, bytes: overview?.stale_bytes },
  ];
  const totalBytes = overview ? overview.source_bytes + overview.orphan_bytes + overview.stale_bytes : 0;
  return <section className="file-storage">
    <header><h1>文件</h1><div className="file-storage-health"><span>缺失源 <b>{overview?.missing_source ?? "—"}</b></span><span>缺失封面 <b>{overview?.missing_cover ?? "—"}</b></span><span>可清理 <b>{overview ? formatBytes(overview.reclaimable_bytes) : "—"}</b></span></div></header>
    <div className="file-storage-meter" aria-label={`源文件、孤立与临时文件合计 ${overview ? formatBytes(totalBytes) : "读取中"}`}>
      {folders.map(folder => <span key={folder.id} className={`is-${folder.id}`} style={{ flexGrow: totalBytes ? (folder.bytes ?? 0) / totalBytes : 0 }} title={`${folder.label} ${folder.bytes == null ? "—" : formatBytes(folder.bytes)}`} />)}
    </div>
    <div className="file-volumes" role="group" aria-label="文件类型">
      <button type="button" className="file-volume" aria-pressed={category === "all"} onClick={() => onCategory("all")}><span>全部文件</span>{category === "all" ? <m.i layoutId="file-category" /> : null}</button>
      {folders.map(folder => <button key={folder.id} type="button" className={`file-volume is-${folder.id}`} aria-pressed={category === folder.id} onClick={() => onCategory(folder.id)}><span>{folder.label}<strong>{folder.count ?? "—"}</strong></span><small>{folder.bytes == null ? "—" : formatBytes(folder.bytes)}</small>{category === folder.id ? <m.i layoutId="file-category" /> : null}</button>)}
    </div>
  </section>;
}
