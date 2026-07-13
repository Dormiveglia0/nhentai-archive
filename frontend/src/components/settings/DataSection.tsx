import { AlertTriangle, Database } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api, type FileOverview, type LibrarySummary } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { formatBytes } from "../library/libraryHelpers";

type Metric = { label: string; value: number | null; format?: (value: number) => string; warn?: boolean };

export function DataSection() {
  const reduceMotion = usePrefersReducedMotion();
  const [library, setLibrary] = useState<LibrarySummary | null>(null);
  const [files, setFiles] = useState<FileOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    Promise.all([api.librarySummary(), api.filesOverview()])
      .then(([libraryPayload, filePayload]) => {
        if (!alive || requestId !== requestRef.current) return;
        setLibrary(libraryPayload);
        setFiles(filePayload);
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

  const metrics: Metric[] = [
    { label: "总收藏", value: library?.total ?? null },
    { label: "已读", value: library?.completed ?? null },
    { label: "阅读中", value: library?.reading ?? null },
    { label: "未读", value: library?.unread ?? null },
    { label: "待补标签", value: library?.untagged ?? null, warn: Boolean(library?.untagged) },
    { label: "总页数", value: library?.total_pages ?? null },
    { label: "占用容量", value: library?.total_size_bytes ?? null, format: formatBytes },
    { label: "可回收", value: files?.reclaimable_bytes ?? null, format: formatBytes, warn: Boolean(files?.reclaimable_bytes) },
    { label: "缺失源文件", value: files?.missing_source ?? null, warn: Boolean(files?.missing_source) },
    { label: "孤立 / 残留", value: files ? files.orphan_count + files.stale_count : null, warn: Boolean(files && files.orphan_count + files.stale_count) },
  ];

  return (
    <section className="folio-settings-section" aria-label="本地馆藏概览" aria-busy={loading}>
      {error ? (
        <div className="folio-settings-fetch-error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>无法读取馆藏概览</strong><small>{error}</small></span>
        </div>
      ) : null}

      <div className="folio-settings-data-grid">
        {metrics.map((metric, index) => (
          <m.article
            key={metric.label}
            className={metric.warn ? "is-warning" : ""}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.035, duration: reduceMotion ? 0 : undefined }}
          >
            <strong>{metric.value === null ? "—" : <NumberTicker value={metric.value} format={metric.format} />}</strong>
            <span>{metric.label}</span>
          </m.article>
        ))}
      </div>

      <div className="folio-settings-data-details">
        <section>
          <div className="folio-settings-subhead"><h3><Database size={16} />来源分布</h3></div>
          <dl className="folio-settings-kv is-compact">
            <div><dt>远端入库</dt><dd>{library ? library.sources.remote : "—"}</dd></div>
            <div><dt>本地导入</dt><dd>{library ? library.sources.local : "—"}</dd></div>
          </dl>
        </section>
        <section>
          <div className="folio-settings-subhead"><h3>语言分布</h3></div>
          {library?.languages.length ? (
            <div className="folio-settings-chip-row">
              {library.languages.slice(0, 12).map((language) => (
                <span key={language.value}>{language.label}<em>{language.count}</em></span>
              ))}
            </div>
          ) : (
            <p className="folio-settings-data-empty">{loading ? "正在读取真实分布…" : "当前馆藏没有语言统计"}</p>
          )}
        </section>
      </div>
    </section>
  );
}
