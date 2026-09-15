import type { FileOverview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";
import "./FileStorage.css";
export function FileOverviewStrip({overview}:{overview:FileOverview|null}) {
  const total = (overview?.source_bytes ?? 0) + (overview?.reclaimable_bytes ?? 0);
  return <header className="file-storage"><div><h1>文件</h1><span>{overview?.work_count ?? "—"} 部作品</span></div><div className="file-storage-capacity"><strong>{overview ? formatBytes(overview.source_bytes) : "—"}</strong><span>源文件占用</span></div><div className="file-storage-health"><span>索引异常 <strong>{overview ? overview.missing_source+overview.missing_cover : "—"}</strong></span><span>可回收 <strong>{overview ? formatBytes(overview.reclaimable_bytes) : "—"}</strong></span></div><div className="file-storage-bar" aria-hidden="true"><i style={{flex:overview?.source_bytes ?? 0}}/><i style={{flex:overview?.reclaimable_bytes ?? 0}}/>{!total && <i/>}</div></header>;
}
