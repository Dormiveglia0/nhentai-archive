import { useEffect, useState } from "react";

import { api, FileOverview } from "../../lib/api";
import { formatBytes } from "../library/libraryHelpers";
import type { SettingsVM } from "./useSettingsState";

export function StorageSection({ vm }: { vm: SettingsVM }) {
  const [files, setFiles] = useState<FileOverview | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .filesOverview()
      .then((data) => alive && setFiles(data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const usage: { label: string; value: string }[] = files
    ? [
        { label: "作品源文件", value: `${files.work_count} 部 · ${formatBytes(files.source_bytes)}` },
        { label: "封面", value: `正常 ${files.cover_ok} · 缺失 ${files.missing_cover}` },
        { label: "缺失源文件", value: String(files.missing_source) },
        { label: "孤立文件", value: `${files.orphan_count} 项 · ${formatBytes(files.orphan_bytes)}` },
        { label: "临时残留", value: `${files.stale_count} 项 · ${formatBytes(files.stale_bytes)}` },
        { label: "可回收合计", value: formatBytes(files.reclaimable_bytes) },
      ]
    : [];

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>存储与路径</h2>
        <p>数据目录与真实磁盘占用；删除/清理请前往「文件管理」，此处只读展示。</p>
      </div>

      <div className="settings-subhead">
        <h3>磁盘占用</h3>
      </div>
      <dl className="settings-kv">
        {usage.length
          ? usage.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))
          : (
              <div>
                <dt>读取中</dt>
                <dd>…</dd>
              </div>
            )}
      </dl>

      <div className="settings-subhead">
        <h3>数据目录</h3>
      </div>
      <div className="path-grid">
        {vm.settings
          ? Object.entries(vm.settings.storage).map(([key, value]) => (
              <label key={key}>
                <span>{key}</span>
                <input value={value} readOnly />
              </label>
            ))
          : null}
      </div>
    </section>
  );
}
