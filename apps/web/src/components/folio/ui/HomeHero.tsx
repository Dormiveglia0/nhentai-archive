import { ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import { m } from "motion/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { LibraryWork } from "../../../lib/api";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { workTitle, workCoverHref } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import { AmbientCover } from "./AmbientCover";
import "./HomeHero.css";

export function HomeHero({ works = [], blurCovers = true, loading = false, activity }: {
  works?: LibraryWork[]; blurCovers?: boolean; loading?: boolean; activity?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const [failedCovers, setFailedCovers] = useState<number[]>([]);
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const featured = works[0], recent = works.slice(1, 4);
  const continuing = featured && !featured.completed && (featured.progress_percent ?? 0) > 0;
  const progress = Math.min(100, Math.max(0, featured?.progress_percent ?? 0));
  const readHref = (work: LibraryWork) => pageHref({ name: "reader", workId: work.id });
  function cover(work: LibraryWork, primary = false) {
    return work.cover_path && !failedCovers.includes(work.id)
      ? <AmbientCover src={workCoverHref(work, primary ? 768 : 384)} alt="作品封面" privateBlur={blurCovers} loading={primary ? "eager" : "lazy"} draggable={false}
        onLoad={event => {
          const image = event.currentTarget;
          setRatios(value => ({ ...value, [work.id]: image.naturalWidth / image.naturalHeight }));
        }} onError={() => setFailedCovers(value => [...value, work.id])} />
      : <span className="folio-home-cover-empty">{failedCovers.includes(work.id) ? "封面读取失败" : "暂无封面"}</span>;
  }
  function retry(work: LibraryWork) {
    return failedCovers.includes(work.id) ? <button className="folio-home-cover-retry" type="button" onClick={() => setFailedCovers(value => value.filter(id => id !== work.id))}>重新加载封面</button> : null;
  }
  return <section className={`folio-home${featured ? "" : " is-empty"}`} aria-label="阅读与最近作品" aria-busy={loading}>
    {featured ? <div className="folio-home-hero">
      <section className="folio-home-current" aria-label={continuing ? "继续阅读" : featured.completed ? "再次阅读" : "开始阅读"}>
        <header><h1>{continuing ? "继续阅读" : featured.completed ? "再次阅读" : "开始阅读"}</h1><a href={pageHref({ name: "history" })}>阅读历史<ArrowUpRight size={15} /></a></header>
        <m.article className="folio-home-book folio-home-featured" data-work-id={featured.id}
          initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease: [.22, 1, .36, 1] }}>
          <div className="folio-home-cover-slot">
            <a className="folio-home-cover" href={readHref(featured)} aria-label={`阅读 ${workTitle(featured)}`} style={{ "--home-cover-ratio": ratios[featured.id] ?? .75 } as CSSProperties}>
              {cover(featured, true)}<span className="folio-home-cover-mark" aria-hidden="true" />
            </a>
            {retry(featured)}
          </div>
          <div className="folio-home-featured-copy">
            <a className="folio-home-book-title" href={readHref(featured)} title={workTitle(featured)}>{workTitle(featured)}</a>
            <div className="folio-home-reading-progress">
              <span>{featured.completed ? "已读完" : continuing ? `第 ${featured.reader_page_index || 1} 页` : "尚未阅读"}</span><span>{featured.page_count} 页</span>
              <svg viewBox="0 0 100 2" preserveAspectRatio="none" fill="none" role="progressbar" aria-label="阅读进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                <path className="folio-home-progress-track" d="M0 1H100" /><m.path d="M0 1H100" pathLength="1" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: progress / 100 }} transition={{ duration: .6, delay: .15 }} />
              </svg>
            </div>
            <div className="folio-home-entry"><a className="folio-home-read" href={readHref(featured)}><BookOpen size={17} />{continuing ? "继续阅读" : featured.completed ? "再次阅读" : "开始阅读"}<ArrowRight size={18} /></a></div>
          </div>
        </m.article>
      </section>
      {activity ?? (recent.length ? <section className="folio-home-recent" aria-label="最近添加的作品">
        <header><h2>最近添加</h2><a href={pageHref({ name: "library" })}>查看全部<ArrowUpRight size={15} /></a></header>
        <div className="folio-home-recent-list">{recent.map((work, index) => <m.article className="folio-home-book" key={work.id} data-work-id={work.id}
          initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: reduced ? 0 : (index + 1) * .06, ease: [.22, 1, .36, 1] }}>
          <div className="folio-home-cover-slot"><a className="folio-home-cover" href={readHref(work)} aria-label={`阅读 ${workTitle(work)}`} style={{ "--home-cover-ratio": ratios[work.id] ?? .75 } as CSSProperties}>{cover(work)}</a>{retry(work)}</div>
          <a className="folio-home-recent-work" href={readHref(work)}><strong title={workTitle(work)}>{workTitle(work)}</strong><span>{work.page_count} 页<ArrowUpRight size={16} /></span></a>
        </m.article>)}</div>
      </section> : null)}
      <a className="folio-home-discover" href={pageHref({ name: "discover" })}>发现作品<ArrowRight size={18} /></a>
    </div> : <div className={activity ? "folio-home-hero" : undefined}><div className="folio-home-empty">
      <BookOpen size={42} strokeWidth={1} aria-hidden="true" />
      <h1 role={loading ? "status" : undefined}>{loading ? "正在读取作品…" : "库里还没有作品"}</h1>
      <div className="folio-home-entry"><a className="folio-home-read" href={pageHref({ name: "discover" })}>发现作品<ArrowRight size={18} /></a><a className="folio-home-files" href={pageHref({ name: "files" })}>扫描本地文件<ArrowUpRight size={16} /></a></div>
    </div>{!loading && activity}</div>}
  </section>;
}
