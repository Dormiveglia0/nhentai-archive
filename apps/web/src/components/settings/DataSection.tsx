import { AlertTriangle, Archive, BookOpen, CheckCircle2, Circle, Database, DownloadCloud, FolderInput, HardDrive, Recycle, Tags } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api, type FileOverview, type LibrarySummary } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { FolioMetricGrid, type FolioMetricItem } from "../folio/ui/FolioMetricGrid";
import { formatBytes } from "../../lib/format";

type Metric = {
  label: string;
  value: number | null;
  icon: typeof Database;
  format?: (value: number) => string;
  warn?: boolean;
};

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

  const readingMetrics: Metric[] = [
    { label: "已读", value: library?.completed ?? null, icon: CheckCircle2 },
    { label: "阅读中", value: library?.reading ?? null, icon: BookOpen },
    { label: "未读", value: library?.unread ?? null, icon: Circle },
  ];
  const maintenanceMetrics: Metric[] = [
    { label: "待补标签", value: library?.untagged ?? null, icon: Tags, warn: Boolean(library?.untagged) },
    { label: "缺失源文件", value: files?.missing_source ?? null, icon: HardDrive, warn: Boolean(files?.missing_source) },
    {
      label: "孤立 / 残留",
      value: files ? files.orphan_count + files.stale_count : null,
      icon: Archive,
      warn: Boolean(files && files.orphan_count + files.stale_count),
    },
    {
      label: "可回收空间",
      value: files?.reclaimable_bytes ?? null,
      icon: Recycle,
      format: formatBytes,
      warn: Boolean(files?.reclaimable_bytes),
    },
  ];
  const readingTotal = library ? library.completed + library.reading + library.unread : 0;
  const sourceTotal = library ? library.sources.remote + library.sources.local : 0;
  const remoteShare = sourceTotal && library ? Math.round((library.sources.remote / sourceTotal) * 100) : 0;
  const localShare = sourceTotal ? 100 - remoteShare : 0;
  const maintenanceItems: FolioMetricItem[] = maintenanceMetrics.map((metric) => ({
    label: metric.label,
    value: metric.value === null ? "—" : <NumberTicker value={metric.value} format={metric.format} />,
    detail: metric.value === null ? "正在读取" : metric.warn ? "需要处理" : "状态正常",
    icon: metric.icon,
    tone: metric.value === null ? "muted" : metric.warn ? "danger" : "good",
  }));

  return (
    <section className="folio-settings-section" aria-label="本地馆藏概览" aria-busy={loading}>
      {error ? (
        <div className="folio-settings-fetch-error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>无法读取馆藏概览</strong><small>{error}</small></span>
        </div>
      ) : null}

      <div className="folio-settings-data-dashboard">
        <m.article
          className="folio-settings-data-lead"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : undefined }}
        >
          <header>
            <span><Database size={15} />馆藏规模</span>
            <small>LOCAL COLLECTION</small>
          </header>
          <div className="folio-settings-data-total">
            <strong>{library ? <NumberTicker value={library.total} /> : "—"}</strong>
            <span>部已入库作品</span>
          </div>
          <dl>
            <div><dt>页面总量</dt><dd>{library ? <NumberTicker value={library.total_pages} /> : "—"}</dd></div>
            <div><dt>源文件占用</dt><dd>{library ? <NumberTicker value={library.total_size_bytes} format={formatBytes} /> : "—"}</dd></div>
          </dl>
        </m.article>

        <m.section
          className="folio-settings-reading-overview"
          aria-label="阅读状态分布"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.04, duration: reduceMotion ? 0 : undefined }}
        >
          <header>
            <div><span>阅读进度</span><strong>{library ? `${library.completed + library.reading} 部已开始` : "正在读取"}</strong></div>
            <small>{library ? `共 ${library.total.toLocaleString()} 部` : "—"}</small>
          </header>
          <div
            className="folio-settings-reading-bar"
            role="img"
            aria-label={library ? `已读 ${library.completed}，阅读中 ${library.reading}，未读 ${library.unread}` : "正在读取阅读状态"}
          >
            {readingMetrics.map((metric) => (
              <i
                key={metric.label}
                className={`is-${metric.label === "已读" ? "done" : metric.label === "阅读中" ? "reading" : "unread"}`}
                style={{ width: `${readingTotal && metric.value !== null ? (metric.value / readingTotal) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="folio-settings-reading-metrics">
            {readingMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label}>
                  <Icon size={16} />
                  <span>{metric.label}</span>
                  <strong>{metric.value === null ? "—" : <NumberTicker value={metric.value} />}</strong>
                </article>
              );
            })}
          </div>
        </m.section>
      </div>

      <section className="folio-settings-maintenance" aria-label="馆藏维护状态">
        <header>
          <div><span>维护状态</span><strong>需要处理的项目会单独标红</strong></div>
          <small>{loading ? "正在读取状态" : error || !library || !files ? "状态不可用" : maintenanceMetrics.some((metric) => metric.warn) ? "存在待处理项" : "当前状态正常"}</small>
        </header>
        <FolioMetricGrid ariaLabel="馆藏维护指标" className="folio-settings-maintenance-grid" items={maintenanceItems} />
      </section>

      <div className="folio-settings-data-details">
        <section className="folio-settings-source-section">
          <div className="folio-settings-subhead"><h3><Database size={16} />来源分布</h3></div>
          <div className="folio-settings-source-card">
            <div
              className="folio-settings-source-bar"
              role="img"
              aria-label={library ? `远端入库 ${library.sources.remote}，本地导入 ${library.sources.local}` : "正在读取来源分布"}
            >
              <i className="is-remote" style={{ width: `${remoteShare}%` }} />
              <i className="is-local" style={{ width: `${localShare}%` }} />
            </div>
            <div className="folio-settings-source-items">
              <article>
                <span className="folio-settings-source-icon is-remote"><DownloadCloud size={17} /></span>
                <div><span>远端入库</span><strong>{library ? <NumberTicker value={library.sources.remote} /> : "—"}</strong></div>
                <small>{library ? `${remoteShare}%` : "读取中"}</small>
              </article>
              <article>
                <span className="folio-settings-source-icon is-local"><FolderInput size={17} /></span>
                <div><span>本地导入</span><strong>{library ? <NumberTicker value={library.sources.local} /> : "—"}</strong></div>
                <small>{library ? `${localShare}%` : "读取中"}</small>
              </article>
            </div>
          </div>
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
