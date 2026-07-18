import { BookOpen, CalendarDays, Clock3, Heart, MousePointerClick, TimerReset } from "lucide-react";
import { m } from "motion/react";

import type { ReadingStatistics, ReadingTagRank, ReadingWorkRank } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { pageHref, tagSearchHref } from "../../lib/navigation";
import { NumberTicker } from "../effects/NumberTicker";
import { AmbientCover } from "../folio/ui/AmbientCover";
import { FolioMetricGrid, type FolioMetricItem } from "../folio/ui/FolioMetricGrid";

export function ReadingStatisticsReport({ statistics, loading }: { statistics: ReadingStatistics | null; loading: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const overview = statistics?.overview;
  const activity = statistics?.activity ?? [];
  const maxSeconds = Math.max(1, ...activity.map((day) => day.seconds));
  const metrics: FolioMetricItem[] = [
    { label: "累计阅读", value: overview ? <NumberTicker value={overview.total_seconds} format={formatDuration} /> : "—", detail: overview ? `${overview.active_days} 个活跃日` : "正在读取", icon: Clock3, tone: "active", valueKind: "text" },
    { label: "打开次数", value: overview ? <NumberTicker value={overview.sessions} /> : "—", detail: overview ? `平均 ${formatDuration(overview.average_session_seconds)}` : "正在读取", icon: MousePointerClick, tone: "neutral" },
    { label: "阅读作品", value: overview ? <NumberTicker value={overview.works_read} /> : "—", detail: overview ? `最长单次 ${formatDuration(overview.longest_session_seconds)}` : "正在读取", icon: BookOpen, tone: "good" },
    { label: "连续阅读", value: overview ? `${overview.current_streak_days} 天` : "—", detail: overview?.tracking_since ? `自 ${formatDate(overview.tracking_since)} 开始记录` : "从本版本开始记录", icon: CalendarDays, tone: overview?.current_streak_days ? "warning" : "muted", valueKind: "text" },
  ];

  return (
    <section className="folio-settings-reading-report" aria-label="阅读统计与偏好报表" aria-busy={loading}>
      <header className="folio-settings-report-head">
        <div><TimerReset size={17} /><span><strong>阅读行为</strong><small>仅累计阅读器处于前台可见状态的时间</small></span></div>
        <em>{overview?.tracking_since ? `TRACKING · ${formatDate(overview.tracking_since)}` : "TRACKING STARTS NOW"}</em>
      </header>

      <FolioMetricGrid ariaLabel="阅读行为摘要" className="folio-settings-stat-metrics" items={metrics} />

      <section className="folio-settings-activity" aria-label="最近三十天阅读活动">
        <header><span>最近 {statistics?.period_days ?? 30} 天</span><strong>{activity.reduce((sum, day) => sum + day.sessions, 0)} 次阅读</strong></header>
        <div className="folio-settings-activity-bars" role="img" aria-label="最近三十天每日阅读时长柱状图">
          {activity.map((day, index) => (
            <m.i
              key={day.date}
              className={day.seconds ? undefined : "is-empty"}
              title={`${day.date} · ${formatDuration(day.seconds)} · ${day.sessions} 次`}
              style={{ height: `${Math.max(3, (day.seconds / maxSeconds) * 100)}%` }}
              initial={{ scaleY: reduceMotion ? 1 : 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.012, duration: reduceMotion ? 0 : 0.34 }}
            />
          ))}
        </div>
        <footer><span>{activity[0]?.date.slice(5) ?? "—"}</span><span>每日可见阅读时长</span><span>{activity[activity.length - 1]?.date.slice(5) ?? "—"}</span></footer>
      </section>

      <div className="folio-settings-work-rankings">
        <WorkRanking title="阅读时长排行" empty="完成一次本地阅读后显示" rows={statistics?.top_by_time ?? []} value={(row) => formatDuration(row.reading_seconds)} />
        <WorkRanking title="阅读次数排行" empty="打开本地作品后显示" rows={statistics?.top_by_sessions ?? []} value={(row) => `${row.reading_sessions} 次`} />
      </div>

      <div className="folio-settings-affinity-rankings">
        <TagRanking title="作者馆藏" type="artist" empty="作品没有作者标签" rows={statistics?.top_authors ?? []} />
        <TagRanking title="喜爱 Tag" type="tag" empty="收藏作品后形成偏好" rows={statistics?.top_tags ?? []} />
      </div>
    </section>
  );
}

function WorkRanking({ title, empty, rows, value }: { title: string; empty: string; rows: ReadingWorkRank[]; value: (row: ReadingWorkRank) => string }) {
  return (
    <section className="folio-settings-work-ranking">
      <header><span>{title}</span><small>TOP {rows.length}</small></header>
      {rows.length ? (
        <ol>
          {rows.map((row, index) => (
            <li key={row.id}>
              <a href={pageHref({ name: "reader", workId: row.id })}>
                <em>{String(index + 1).padStart(2, "0")}</em>
                {row.cover_path ? (
                  <AmbientCover className="folio-settings-rank-cover" src={`/api/works/${row.id}/cover`} alt="" loading="lazy" />
                ) : <span className="folio-settings-rank-cover" />}
                <span><strong>{row.title_japanese || row.pretty_title || row.title}</strong><small>{row.reading_sessions} 次 · {formatDuration(row.reading_seconds)}</small></span>
                <b>{value(row)}</b>
              </a>
            </li>
          ))}
        </ol>
      ) : <p>{empty}</p>}
    </section>
  );
}

function TagRanking({ title, type, empty, rows }: { title: string; type: "artist" | "tag"; empty: string; rows: ReadingTagRank[] }) {
  return (
    <section className="folio-settings-tag-ranking">
      <header><span>{title}</span><small>{type === "artist" ? "按作品数量" : "按本地收藏"}</small></header>
      {rows.length ? (
        <ol>
          {rows.map((row, index) => (
            <li key={`${type}-${row.id ?? row.display}`}>
              <em>{String(index + 1).padStart(2, "0")}</em>
              <a href={tagSearchHref({ id: row.id, type, display: row.display })}>{row.display}</a>
              <span>{type === "artist" ? `${row.work_count} 部作品` : <><Heart size={11} fill="currentColor" />{row.favorite_count} 部</>}</span>
              <small>{formatDuration(row.reading_seconds)}</small>
            </li>
          ))}
        </ol>
      ) : <p>{empty}</p>}
    </section>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  const hours = seconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} 小时`;
}

function formatDate(value: string) {
  return value.slice(0, 10);
}
