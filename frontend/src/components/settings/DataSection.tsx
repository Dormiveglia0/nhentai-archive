import { useEffect, useState } from "react";

import { api, FileOverview, LibrarySummary } from "../../lib/api";
import { formatBytes } from "../library/libraryHelpers";
import { NumberTicker } from "../effects/NumberTicker";

export function DataSection() {
  const [library, setLibrary] = useState<LibrarySummary | null>(null);
  const [files, setFiles] = useState<FileOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.librarySummary(), api.filesOverview()])
      .then(([lib, file]) => {
        if (!alive) return;
        setLibrary(lib);
        setFiles(file);
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  const metrics: { label: string; value: number; format?: (n: number) => string; tone?: "warn" }[] = [
    { label: "总收藏", value: library?.total ?? 0 },
    { label: "已读", value: library?.completed ?? 0 },
    { label: "阅读中", value: library?.reading ?? 0 },
    { label: "未读", value: library?.unread ?? 0 },
    { label: "待补标签", value: library?.untagged ?? 0, tone: (library?.untagged ?? 0) > 0 ? "warn" : undefined },
    { label: "总页数", value: library?.total_pages ?? 0 },
    { label: "占用容量", value: library?.total_size_bytes ?? 0, format: formatBytes },
    { label: "可回收", value: files?.reclaimable_bytes ?? 0, format: formatBytes, tone: (files?.reclaimable_bytes ?? 0) > 0 ? "warn" : undefined },
    { label: "缺失源文件", value: files?.missing_source ?? 0, tone: (files?.missing_source ?? 0) > 0 ? "warn" : undefined },
    { label: "孤立 / 残留", value: (files?.orphan_count ?? 0) + (files?.stale_count ?? 0) },
  ];

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>数据概览</h2>
        <p>来自真实馆藏与文件清单的统计；用于快速判断库的健康度。明细维护请前往「文件管理」与「治理」。</p>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="settings-data-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className={`settings-data-metric${metric.tone ? ` tone-${metric.tone}` : ""}`}>
            <strong>
              <NumberTicker value={metric.value} format={metric.format} />
            </strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>

      {library ? (
        <>
          <div className="settings-subhead">
            <h3>来源分布</h3>
          </div>
          <dl className="settings-kv">
            <div>
              <dt>远端入库</dt>
              <dd>{library.sources.remote}</dd>
            </div>
            <div>
              <dt>本地导入</dt>
              <dd>{library.sources.local}</dd>
            </div>
          </dl>
        </>
      ) : null}

      {library && library.languages.length ? (
        <>
          <div className="settings-subhead">
            <h3>语言分布</h3>
          </div>
          <div className="settings-chip-row">
            {library.languages.slice(0, 12).map((lang) => (
              <span key={lang.value} className="settings-chip">
                {lang.label} <em>{lang.count}</em>
              </span>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
