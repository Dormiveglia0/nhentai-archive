import { AlertTriangle, Archive, BookOpen, CheckCircle2, Circle, Database, DownloadCloud, FolderInput, HardDrive, Languages, Recycle, Tags } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api, type FileOverview, type LibrarySummary, type ReadingStatistics } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { FolioMetricGrid, type FolioMetricItem } from "../folio/ui/FolioMetricGrid";
import { formatBytes } from "../../lib/format";
import { CollectionStatistics, ReadingStatisticsReport } from "./ReadingStatisticsReport";

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
  const [statistics, setStatistics] = useState<ReadingStatistics | null>(null);
  const [statisticsDays, setStatisticsDays] = useState(30);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);
  const statisticsRequestRef = useRef(0);

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

  useEffect(() => {
    let alive = true;
    const requestId = ++statisticsRequestRef.current;
    setStatisticsLoading(true);
    setStatisticsError(null);
    setStatistics(null);
    api.libraryStatistics(statisticsDays)
      .then((payload) => {
        if (alive && requestId === statisticsRequestRef.current) setStatistics(payload);
      })
      .catch((exc: Error) => {
        if (alive && requestId === statisticsRequestRef.current) setStatisticsError(exc.message);
      })
      .finally(() => {
        if (alive && requestId === statisticsRequestRef.current) setStatisticsLoading(false);
      });
    return () => {
      alive = false;
      if (requestId === statisticsRequestRef.current) statisticsRequestRef.current += 1;
    };
  }, [statisticsDays]);

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
    <section className="folio-settings-section" aria-label="本地馆藏概览" aria-busy={loading || statisticsLoading}>
      {error ? (
        <div className="folio-settings-fetch-error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>无法读取馆藏概览</strong><small>{error}</small></span>
        </div>
      ) : null}

      <ReadingStatisticsReport
        statistics={statistics}
        loading={statisticsLoading}
        error={statisticsError}
        periodDays={statisticsDays}
        onPeriodDays={setStatisticsDays}
      />

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

      <CollectionStatistics statistics={statistics} loading={statisticsLoading} />

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
        <LanguageDistribution languages={library?.languages ?? []} loading={loading} reduceMotion={reduceMotion} />
      </div>
    </section>
  );
}

function LanguageDistribution({ languages, loading, reduceMotion }: { languages: LibrarySummary["languages"]; loading: boolean; reduceMotion: boolean }) {
  const visible = languages.slice(0, 10);
  const total = languages.reduce((sum, language) => sum + language.count, 0);
  const maxCount = Math.max(1, ...visible.map((language) => language.count));

  return (
    <section className="folio-settings-language-section">
      <div className="folio-settings-subhead">
        <h3><Languages size={16} />语言分布</h3>
        <span>{visible.length ? `${languages.length} 种 · ${total} 部标注` : "本地元数据"}</span>
      </div>
      {visible.length ? (
        <div className="folio-settings-language-map">
          {visible.map((language, index) => {
            const share = Math.round((language.count / Math.max(1, total)) * 100);
            return (
              <article key={language.value} className={index === 0 ? "is-leading" : undefined}>
                <em>{String(index + 1).padStart(2, "0")}</em>
                <div>
                  <span><strong>{language.label}</strong><small>{language.count} 部</small></span>
                  <i role="img" aria-label={`${language.label} ${language.count} 部，占语言标注 ${share}%`}>
                    <m.b
                      initial={{ scaleX: reduceMotion ? language.count / maxCount : 0 }}
                      animate={{ scaleX: language.count / maxCount }}
                      transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: reduceMotion ? 0 : 0.5 }}
                    />
                  </i>
                </div>
                <b>{share}%</b>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="folio-settings-data-empty">{loading ? "正在读取分布…" : "当前馆藏没有语言统计"}</p>
      )}
    </section>
  );
}
