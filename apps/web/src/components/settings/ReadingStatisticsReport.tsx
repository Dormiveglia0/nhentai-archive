import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock3,
  History,
  LibraryBig,
  MousePointerClick,
  Tags,
  TimerReset,
  Users,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type CSSProperties, useState } from "react";

import type { ReadingSessionRank, ReadingStatistics, ReadingTagRank, ReadingWorkRank } from "../../lib/api";
import { duration, ease, stagger, usePrefersReducedMotion } from "../../lib/motion";
import { libraryTagHref, pageHref } from "../../lib/navigation";
import { NumberTicker } from "../effects/NumberTicker";
import { AmbientCover } from "../folio/ui/AmbientCover";

const PERIODS = [
  { value: 7, label: "7 天" },
  { value: 30, label: "30 天" },
  { value: 90, label: "90 天" },
  { value: 365, label: "1 年" },
] as const;
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SESSION_DATE_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type Props = {
  statistics: ReadingStatistics | null;
  loading: boolean;
  error: string | null;
  periodDays: number;
  onPeriodDays: (days: number) => void;
};

type CssVars = CSSProperties & Record<`--${string}`, string | number>;

export function ReadingStatisticsReport({ statistics, loading, error, periodDays, onPeriodDays }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const overview = statistics?.overview;
  const activity = statistics?.activity ?? [];
  const period = statistics?.period;

  return (
    <section className={`folio-reading-atlas${loading ? " is-loading" : ""}`} aria-label="阅读统计与馆藏报表" aria-busy={loading}>
      <header className="folio-reading-atlas-head">
        <div>
          <span className="folio-reading-atlas-kicker"><Activity size={14} />READING ATLAS</span>
          <h2>阅读图谱</h2>
          <p>把本地阅读记录整理成趋势、节奏与馆藏结构；所有排行都只指向你的本地库。</p>
        </div>
        <div className="folio-reading-period" aria-label="统计周期">
          {PERIODS.map((periodOption) => (
            <button
              key={periodOption.value}
              type="button"
              className={periodDays === periodOption.value ? "is-active" : ""}
              onClick={() => onPeriodDays(periodOption.value)}
              aria-pressed={periodDays === periodOption.value}
            >
              {periodDays === periodOption.value ? <m.i layoutId={reduceMotion ? undefined : "folio-reading-period"} /> : null}
              <span>{periodOption.label}</span>
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="folio-reading-atlas-error" role="alert">{error}</p> : null}

      <section className="folio-reading-pulse" aria-label="周期阅读概览">
        <div className="folio-reading-pulse-total">
          <span>{period ? `${formatShortDate(period.start_date)} — ${formatShortDate(period.end_date)}` : `最近 ${periodDays} 天`}</span>
          <strong>{overview ? <NumberTicker value={overview.total_seconds} format={formatDuration} /> : "—"}</strong>
          <TrendLine statistics={statistics} />
          <span className="folio-reading-pulse-glyph" aria-hidden="true"><Activity size={150} strokeWidth={0.7} /></span>
          <footer>
            <span>累计记录 {overview ? formatDuration(overview.all_time_seconds) : "—"}</span>
            <span>{overview?.tracking_since ? `始于 ${formatDate(overview.tracking_since)}` : "等待首次本地阅读"}</span>
          </footer>
        </div>
        <ActivityCalendar activity={activity} />
      </section>

      <div className="folio-reading-metrics" aria-label="周期关键指标">
        <Metric icon={MousePointerClick} label="阅读会话" value={overview?.sessions} detail={overview ? `平均 ${formatDuration(overview.average_session_seconds)}` : "正在读取"} />
        <Metric icon={BookOpen} label="触达作品" value={overview?.works_read} detail={overview ? `馆藏内有 ${overview.all_time_works_read} 部留下记录` : "正在读取"} />
        <Metric icon={CalendarDays} label="活跃天数" value={overview?.active_days} detail={overview ? `${Math.round((overview.active_days / Math.max(1, periodDays)) * 100)}% 周期覆盖` : "正在读取"} />
        <Metric icon={TimerReset} label="连续阅读" value={overview?.current_streak_days} suffix="天" detail={overview ? `最长单次 ${formatDuration(overview.longest_session_seconds)}` : "正在读取"} />
      </div>

      <ReadingRhythm statistics={statistics} />

      <div className="folio-reading-deep-dive">
        <WorkRanking statistics={statistics} />
        <RecentSessions sessions={statistics?.recent_sessions ?? []} />
      </div>

    </section>
  );
}

export function CollectionStatistics({ statistics, loading }: { statistics: ReadingStatistics | null; loading: boolean }) {
  return (
    <section className={`folio-collection-map${loading ? " is-loading" : ""}`} aria-label="本地馆藏组成" aria-busy={loading}>
      <header>
        <div><LibraryBig size={17} /><span><strong>馆藏构成</strong><small>按本地库中的作品数量统计，不从收藏结果推测偏好</small></span></div>
        <em>{statistics ? `${statistics.collection_total_works} WORKS INDEXED` : "LOCAL INDEX"}</em>
      </header>
      <div>
        <DistributionRanking kind="artist" rows={statistics?.top_authors ?? []} loading={loading} />
        <DistributionRanking kind="tag" rows={statistics?.top_tags ?? []} loading={loading} />
      </div>
    </section>
  );
}

function TrendLine({ statistics }: { statistics: ReadingStatistics | null }) {
  if (!statistics) return <p className="folio-reading-trend">正在读取真实会话…</p>;
  const current = statistics.overview.total_seconds;
  const previous = statistics.period.previous_total_seconds;
  const change = statistics.period.seconds_change_percent;
  if (!current && !previous) return <p className="folio-reading-trend">这个周期还没有阅读记录</p>;
  if (!previous) return <p className="folio-reading-trend is-new"><ArrowUpRight size={13} />本周期开始形成记录</p>;
  return (
    <p className={`folio-reading-trend${(change ?? 0) >= 0 ? " is-up" : " is-down"}`}>
      <ArrowUpRight size={13} />较前一等长周期 {(change ?? 0) > 0 ? "+" : ""}{change}%
    </p>
  );
}

function ActivityCalendar({ activity }: { activity: ReadingStatistics["activity"] }) {
  const reduceMotion = usePrefersReducedMotion();
  const maxSeconds = Math.max(1, ...activity.map((day) => day.seconds));
  const periodSeconds = activity.reduce((sum, day) => sum + day.seconds, 0);
  const activeDays = activity.filter((day) => day.seconds > 0).length;

  return (
    <div className="folio-reading-calendar">
      <header><span>阅读活跃度</span><strong>{activeDays} 个活跃日 · {formatDuration(periodSeconds)}</strong></header>
      <div className="folio-reading-calendar-scroll">
        <div className="folio-reading-calendar-grid" style={{ "--day-count": Math.max(1, activity.length) } as CssVars} role="img" aria-label="按天显示的阅读活跃度图">
          {activity.map((day, index) => {
            const intensity = day.seconds ? 0.2 + (day.seconds / maxSeconds) * 0.8 : 0;
            return (
              <m.i
                key={day.date}
                className={day.seconds ? "is-active" : "is-empty"}
                title={`${day.date} · ${formatDuration(day.seconds)} · ${day.sessions} 次`}
                style={{ "--intensity": intensity, height: `${day.seconds ? intensity * 100 : 3}%` } as CssVars}
                initial={{ opacity: reduceMotion ? 1 : 0, scaleY: reduceMotion ? 1 : 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: reduceMotion ? 0 : Math.min(index, 70) * (stagger.base / 5), duration: reduceMotion ? 0 : duration.base, ease: ease.standard }}
              />
            );
          })}
        </div>
      </div>
      <footer><span>{activity[0] ? formatShortDate(activity[0].date) : "—"}</span><span className="folio-reading-calendar-scale">少 <i /><i /><i /><i /> 多</span><span>{activity.length ? formatShortDate(activity[activity.length - 1].date) : "—"}</span></footer>
    </div>
  );
}

function Metric({ icon: Icon, label, value, suffix, detail }: { icon: typeof Clock3; label: string; value?: number; suffix?: string; detail: string }) {
  return (
    <article>
      <span><Icon size={15} />{label}</span>
      <strong>{value === undefined ? "—" : <NumberTicker value={value} />}{value !== undefined && suffix ? <small>{suffix}</small> : null}</strong>
      <p>{detail}</p>
    </article>
  );
}

function ReadingRhythm({ statistics }: { statistics: ReadingStatistics | null }) {
  const reduceMotion = usePrefersReducedMotion();
  const weekdays = statistics?.weekdays ?? [];
  const hours = statistics?.hours ?? [];
  const maxWeekday = Math.max(1, ...weekdays.map((item) => item.seconds));
  const maxHour = Math.max(1, ...hours.map((item) => item.seconds));
  const peakWeekday = weekdays.reduce<typeof weekdays[number] | null>((peak, item) => !peak || item.seconds > peak.seconds ? item : peak, null);
  const peakHour = hours.reduce<typeof hours[number] | null>((peak, item) => !peak || item.seconds > peak.seconds ? item : peak, null);

  return (
    <section className="folio-reading-rhythm" aria-label="阅读时间规律">
      <header>
        <div><Clock3 size={17} /><span><strong>阅读节奏</strong><small>从会话开始时间观察一周与一天中的阅读习惯</small></span></div>
        <em>{peakHour?.seconds ? `${WEEKDAYS[peakWeekday?.weekday ?? 0]} · ${String(peakHour.hour).padStart(2, "0")}:00 最活跃` : "AWAITING RHYTHM"}</em>
      </header>
      <div className="folio-reading-rhythm-grid">
        <div className="folio-reading-weekdays">
          {WEEKDAYS.map((label, index) => {
            const item = weekdays[index] ?? { seconds: 0, sessions: 0 };
            return (
              <div key={label}>
                <span>{label}</span>
                <i><m.b initial={{ scaleX: reduceMotion ? 1 : 0 }} animate={{ scaleX: item.seconds / maxWeekday }} transition={{ duration: reduceMotion ? 0 : duration.slow, delay: reduceMotion ? 0 : index * stagger.base, ease: ease.standard }} /></i>
                <small>{item.sessions} 次</small>
              </div>
            );
          })}
        </div>
        <div className="folio-reading-hours" role="img" aria-label="一天二十四小时阅读会话分布">
          <div>
            {Array.from({ length: 24 }, (_, hour) => {
              const item = hours[hour] ?? { seconds: 0, sessions: 0 };
              return <m.i key={hour} title={`${String(hour).padStart(2, "0")}:00 · ${formatDuration(item.seconds)} · ${item.sessions} 次`} className={item.seconds ? "is-active" : "is-empty"} initial={{ scaleY: reduceMotion ? 1 : 0 }} animate={{ scaleY: Math.max(0.05, item.seconds / maxHour) }} transition={{ duration: reduceMotion ? 0 : duration.slow, delay: reduceMotion ? 0 : hour * (stagger.base / 3), ease: ease.standard }} />;
            })}
          </div>
          <footer><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></footer>
        </div>
      </div>
    </section>
  );
}

function WorkRanking({ statistics }: { statistics: ReadingStatistics | null }) {
  const reduceMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<"time" | "sessions">("time");
  const rows = mode === "time" ? statistics?.top_by_time ?? [] : statistics?.top_by_sessions ?? [];

  return (
    <section className="folio-reading-work-ranking">
      <header>
        <span><strong>作品深读榜</strong><small>点击直接回到本地阅读器</small></span>
        <div aria-label="作品排行口径">
          <button type="button" className={mode === "time" ? "is-active" : ""} onClick={() => setMode("time")}>按时长</button>
          <button type="button" className={mode === "sessions" ? "is-active" : ""} onClick={() => setMode("sessions")}>按次数</button>
        </div>
      </header>
      {rows.length ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <m.ol
            key={mode}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
            transition={{ duration: reduceMotion ? 0 : duration.base, ease: ease.standard }}
          >
            {rows.slice(0, 6).map((row, index) => <WorkRankRow key={row.id} row={row} index={index} mode={mode} />)}
          </m.ol>
        </AnimatePresence>
      ) : <p className="folio-reading-empty">完成一次本地阅读后，这里才会出现真实排行。</p>}
    </section>
  );
}

function WorkRankRow({ row, index, mode }: { row: ReadingWorkRank; index: number; mode: "time" | "sessions" }) {
  const title = row.title_japanese || row.pretty_title || row.title;
  return (
    <li className={index === 0 ? "is-leader" : ""}>
      <a href={pageHref({ name: "reader", workId: row.id })}>
        <em>{String(index + 1).padStart(2, "0")}</em>
        {row.cover_path ? <AmbientCover className="folio-reading-rank-cover" src={`/api/works/${row.id}/cover`} alt="" loading="lazy" /> : <span className="folio-reading-rank-cover" />}
        <span><strong>{title}</strong><small>{formatDuration(row.reading_seconds)} · {row.reading_sessions} 次会话</small></span>
        <b>{mode === "time" ? formatDuration(row.reading_seconds) : `${row.reading_sessions} 次`}</b>
        <ArrowUpRight size={14} />
      </a>
    </li>
  );
}

function RecentSessions({ sessions }: { sessions: ReadingSessionRank[] }) {
  return (
    <section className="folio-reading-recent">
      <header><span><strong>最近足迹</strong><small>本周期最新的阅读会话</small></span><a href={pageHref({ name: "history" })}>完整历史 <History size={13} /></a></header>
      {sessions.length ? (
        <ol>
          {sessions.slice(0, 6).map((session) => (
            <li key={session.id}>
              <time>{formatTimestamp(session.started_at)}</time>
              <i />
              <a href={pageHref({ name: "reader", workId: session.work_id })}>
                <strong>{session.title_japanese || session.pretty_title || session.title}</strong>
                <small>{formatDuration(session.duration_seconds)} · 停在第 {session.last_page_index} 页</small>
              </a>
            </li>
          ))}
        </ol>
      ) : <p className="folio-reading-empty">这个周期还没有本地阅读足迹。</p>}
    </section>
  );
}

function DistributionRanking({ kind, rows, loading }: { kind: "artist" | "tag"; rows: ReadingTagRank[]; loading: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const maxCount = Math.max(1, ...rows.map((row) => row.work_count));
  const Icon = kind === "artist" ? Users : Tags;
  const title = kind === "artist" ? "作者作品分布" : "馆藏 Tag 占比";

  return (
    <section className="folio-reading-distribution">
      <header><span><Icon size={15} />{title}</span><small>{kind === "tag" ? "一部作品可含多个 Tag" : "按作品数量排列"}</small></header>
      {rows.length ? (
        <ol>
          {rows.map((row, index) => (
            <li key={`${kind}-${row.id ?? row.display}`} style={{ "--rank-width": `${(row.work_count / maxCount) * 100}%` } as CssVars}>
              <m.i initial={{ scaleX: reduceMotion ? 1 : 0 }} animate={{ scaleX: 1 }} transition={{ delay: reduceMotion ? 0 : index * stagger.base, duration: reduceMotion ? 0 : duration.slow, ease: ease.standard }} />
              <em>{String(index + 1).padStart(2, "0")}</em>
              <a href={libraryTagHref({ id: row.id, type: kind, display: row.display })}>{row.display}</a>
              <span><strong>{row.work_count}</strong> 部</span>
              <small>{row.share_percent}%</small>
            </li>
          ))}
        </ol>
      ) : <p className="folio-reading-empty">{loading ? "正在读取本地馆藏…" : `本地馆藏还没有可统计的${kind === "artist" ? "作者" : "作品 Tag"}。`}</p>}
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

function formatShortDate(value: string) {
  return value.slice(5).replace("-", "/");
}

function formatTimestamp(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(5, 16);
  return SESSION_DATE_FORMAT.format(date);
}
