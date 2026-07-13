import { AlertTriangle, ArrowUpRight, Folder, HardDrive } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api, type FileOverview } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { usePrefersReducedMotion } from "../../lib/motion";
import { FolioField } from "../folio/ui/FolioPrimitives";
import { formatBytes } from "../library/libraryHelpers";
import type { SettingsVM } from "./useSettingsState";

const PATH_LABELS: Record<string, string> = {
  data_dir: "数据目录",
  library_dir: "馆藏目录",
  covers_dir: "封面目录",
  page_cache_dir: "页面缓存目录",
  export_dir: "兼容导出目录",
};

export function StorageSection({ vm }: { vm: SettingsVM }) {
  const reduceMotion = usePrefersReducedMotion();
  const [files, setFiles] = useState<FileOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const requestId = ++requestRef.current;
    setLoading(true);
    api.filesOverview()
      .then((payload) => {
        if (alive && requestId === requestRef.current) setFiles(payload);
      })
      .catch((exc: Error) => {
        if (alive && requestId === requestRef.current) setError(exc.message);
      })
      .finally(() => {
        if (alive && requestId === requestRef.current) setLoading(false);
      });
    return () => {
      alive = false;
      requestRef.current += 1;
    };
  }, []);

  const usage = [
    { label: "作品源文件", value: files ? `${files.work_count} 部 · ${formatBytes(files.source_bytes)}` : "—" },
    { label: "封面", value: files ? `正常 ${files.cover_ok} · 缺失 ${files.missing_cover}` : "—", warn: Boolean(files?.missing_cover) },
    { label: "缺失源文件", value: files ? String(files.missing_source) : "—", warn: Boolean(files?.missing_source) },
    { label: "孤立文件", value: files ? `${files.orphan_count} 项 · ${formatBytes(files.orphan_bytes)}` : "—", warn: Boolean(files?.orphan_count) },
    { label: "临时残留", value: files ? `${files.stale_count} 项 · ${formatBytes(files.stale_bytes)}` : "—", warn: Boolean(files?.stale_count) },
    { label: "可回收合计", value: files ? formatBytes(files.reclaimable_bytes) : "—", warn: Boolean(files?.reclaimable_bytes) },
  ];

  return (
    <section className="folio-settings-section" aria-label="存储与路径" aria-busy={loading}>
      {error ? (
        <div className="folio-settings-fetch-error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>无法读取文件概览</strong><small>{error}</small></span>
        </div>
      ) : null}

      <div className="folio-settings-storage-head">
        <div className="folio-settings-subhead"><h3><HardDrive size={16} />磁盘占用</h3></div>
        <button className="folio-line-button" type="button" onClick={() => navigate({ name: "files" })}>
          打开文件管理
          <ArrowUpRight size={15} />
        </button>
      </div>
      <dl className="folio-settings-kv folio-settings-storage-grid">
        {usage.map((item, index) => (
          <m.div key={item.label} className={item.warn ? "is-warning" : ""} initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : index * 0.04, duration: reduceMotion ? 0 : undefined }}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </m.div>
        ))}
      </dl>

      <div className="folio-settings-subhead"><h3><Folder size={16} />数据目录</h3><span>只读</span></div>
      <div className="folio-field-matrix folio-settings-path-grid">
        {vm.settings
          ? Object.entries(vm.settings.storage).map(([key, value]) => (
              <FolioField key={key} label={PATH_LABELS[key] ?? key} value={value} readOnly wide />
            ))
          : <p className="folio-settings-data-empty">正在读取真实路径…</p>}
      </div>
      <p className="folio-settings-note">清理与删除必须在文件管理中先预览影响范围；本页不会修改或扫描目录。</p>
    </section>
  );
}
