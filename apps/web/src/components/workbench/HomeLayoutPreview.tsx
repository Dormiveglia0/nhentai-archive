import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type LibrarySummary, type LibraryWork, type ReadingStatistics } from "../../lib/api";
import { workTitle } from "../../lib/format";
import { pageHref } from "../../lib/navigation";
import "./HomeLayoutPreview.css";

function PreviewWork({ work, hidden, primary = false }: { work: LibraryWork; hidden: boolean; primary?: boolean }) {
  const [failed, setFailed] = useState(false);
  const progress = Math.max(0, Math.min(100, work.completed ? 100 : work.progress_percent ?? 0));
  return <a className={`home-proof-work${primary ? " is-primary" : ""}`} href={pageHref({ name: "reader", workId: work.id })}>
    <div className="home-proof-cover">
      {failed ? <span className="home-proof-cover-error">封面加载失败</span> : <img className={hidden ? "is-private" : ""} src={`/api/works/${work.id}/cover?w=${primary ? 768 : 384}`} alt="" decoding="async" onError={() => setFailed(true)} />}
    </div>
    <div className="home-proof-caption"><h3>{workTitle(work)}</h3><div className="home-proof-work-meta"><span>{work.page_count} 页</span><span>{progress ? `已读 ${Math.round(progress)}%` : "未读"}</span></div><div className="home-proof-progress"><i style={{ width: `${progress}%` }} /></div></div>
  </a>;
}

export function HomeLayoutPreview({ works, summary, statistics, blurCovers }: { works: LibraryWork[]; summary?: LibrarySummary; statistics?: ReadingStatistics; blurCovers: boolean }) {
  const [continuing, setContinuing] = useState<LibraryWork[]>([]);
  const [readingError, setReadingError] = useState(false);
  const [hidden, setHidden] = useState(blurCovers);
  useEffect(() => setHidden(blurCovers), [blurCovers]);
  useEffect(() => {
    let active = true;
    api.libraryContinueReading(3).then(data => { if (active) setContinuing(data.result); }).catch(() => { if (active) setReadingError(true); });
    return () => { active = false; };
  }, []);
  const lead = continuing[0] ?? works[0];
  const recent = works.filter(work => work.id !== lead?.id).slice(0, 4);
  const activity = statistics?.activity ?? [];
  const maxSeconds = Math.max(1, ...activity.map(day => day.seconds));
  return <section className="home-proof" aria-label="首页构图预览">
    <h1 className="home-proof-sr">首页</h1>
    <div className="home-proof-overview"><dl>{[["作品", summary?.total], ["在读", summary?.reading], ["读完", summary?.completed]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl><button type="button" onClick={() => setHidden(value => !value)} aria-pressed={!hidden}>{hidden ? <Eye size={16} /> : <EyeOff size={16} />}{hidden ? "显示封面" : "隐藏封面"}</button></div>
    <div className="home-proof-layout">
      <section className="home-proof-reading"><header><h2>{continuing.length ? "继续阅读" : "最近添加"}</h2><span>{lead?.last_read_at ? new Date(lead.last_read_at).toLocaleDateString("zh-CN") : ""}</span></header>
        {lead ? <PreviewWork key={lead.id} work={lead} hidden={hidden} primary /> : <p className="home-proof-empty">暂无作品</p>}
        {readingError ? <p role="status" className="home-proof-empty">阅读记录暂时无法加载</p> : null}
        {continuing.length > 1 ? <div className="home-proof-in-progress">{continuing.slice(1).map(work => <PreviewWork key={work.id} work={work} hidden={hidden} />)}</div> : null}
      </section>
      <section className="home-proof-recent"><header><h2>最近添加</h2><span>{recent.length ? `${recent.length} 部` : ""}</span></header><div className="home-proof-recent-grid">{recent.map(work => <PreviewWork key={work.id} work={work} hidden={hidden} />)}</div></section>
    </div>
    <section className="home-proof-history"><div className="home-proof-history-label"><h2>阅读轨迹</h2><p>近 30 天</p><strong>{statistics ? Math.round(statistics.overview.total_seconds / 60).toLocaleString("zh-CN") : "—"}<small>分钟</small></strong></div><div className="home-proof-rhythm" role="img" aria-label={statistics ? `近30天阅读${Math.round(statistics.overview.total_seconds / 60)}分钟，${statistics.overview.active_days}天有阅读记录` : "阅读统计尚未加载"}>{activity.map(day => <span key={day.date} title={`${day.date} · ${Math.round(day.seconds / 60)} 分钟`}><i style={{ height: `${Math.max(2, day.seconds / maxSeconds * 100)}%` }} /></span>)}</div><div className="home-proof-history-end"><span>活跃天数</span><strong>{statistics?.overview.active_days ?? "—"}<small>天</small></strong><span>{statistics?.period.end_date ?? "—"}</span></div></section>
  </section>;
}
