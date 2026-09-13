import { ArrowRight, ChevronRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { api, type LibraryTagFilter, type LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { EchoConnections } from "./EchoConnections";
import { ConceptCover } from "./HomeConcepts";

type Relation = { label: string; detail: string; works: LibraryWork[] };
function stamp(work: LibraryWork) {
  return work.last_read_at ? new Date(work.last_read_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "尚未阅读";
}
export function EchoPreview({ hidden }: { hidden: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [root, setRoot] = useState<LibraryWork>();
  const [recent, setRecent] = useState<LibraryWork[]>([]);
  const [trail, setTrail] = useState<LibraryWork[]>([]);
  const [groups, setGroups] = useState<Relation[]>([]);
  const [active, setActive] = useState<number>();
  const [owner, setOwner] = useState<number>();
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<number, Relation[]>());
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    let visible = true;
    const sync = () => node.classList.toggle("is-paused", !visible || document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(node); document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [Boolean(root)]);
  const frequencies = useRef<Promise<LibraryTagFilter[]> | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      setError(""); setLoading(true);
      try {
        const result = await api.libraryRecentRead(12);
        const first = result.result[0] ?? (await api.librarySearch({ per_page: 1, sort: "recent_added" })).result[0];
        if (active) { setRecent(result.result); setRoot(first); if (!first) setLoading(false); }
      } catch { if (active) { setError("阅读记录加载失败"); setLoading(false); } }
    }
    void load(); return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!root) return;
    let active = true;
    const id = root.id;
    async function connect() {
      setError("");
      const cached = cache.current.get(id);
      if (cached) { setGroups(cached); setOwner(id); setLoading(false); return; }
      setLoading(true);
      try {
        frequencies.current ??= api.libraryTagFilters("", 200).then(result => result.result).catch(() => { frequencies.current = null; return []; });
        const [work, counts] = await Promise.all([api.work(id), frequencies.current]);
        if (!active) return;
        const tags = work.tags ?? [];
        const count = new Map(counts.map(tag => [tag.id, tag.count]));
        // Prefer specific, shared tags over the most common labels; unknown counts are verified by search.
        const themes = tags.filter(tag => tag.type === "tag" && count.get(tag.id) !== 1)
          .sort((a, b) => (count.get(a.id) ?? 2) - (count.get(b.id) ?? 2)).slice(0, 2);
        const candidates = [
          ...["artist", "parody", "character"].flatMap(type => {
            const tag = tags.find(item => item.type === type && !(type === "parody" && (item.name ?? item.slug)?.toLowerCase() === "original")); return tag ? [tag] : [];
          }), ...themes,
        ];
        const results = await Promise.allSettled(candidates.map(tag => api.librarySearch({ tag_ids: [tag.id], per_page: 7 })));
        if (!active) return;
        const seen = new Set([id]);
        const next: Relation[] = [];
        results.forEach((result, index) => {
          if (result.status !== "fulfilled" || next.length === 3) return;
          const works = result.value.result.filter(item => !seen.has(item.id)).slice(0, 3);
          if (!works.length) return;
          works.forEach(item => seen.add(item.id));
          const tag = candidates[index];
          next.push({ label: tag.type === "artist" ? "同作者" : tag.type === "parody" ? "同系列" : tag.type === "character" ? "同角色" : "共同标签", detail: tag.display, works });
        });
        if (results.every(result => result.status === "fulfilled")) {
          if (cache.current.size >= 20) cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(id, next);
        }
        setGroups(next); setOwner(id);
        if (results.some(result => result.status === "rejected")) setError("部分关联作品加载失败");
      } catch { if (active) setError("作品关系加载失败"); }
      finally { if (active) setLoading(false); }
    }
    void connect(); return () => { active = false; };
  }, [root?.id, revision]);
  function follow(work: LibraryWork) {
    if (!root || root.id === work.id) return;
    setTrail(items => [...items.filter(item => item.id !== root.id && item.id !== work.id), root].slice(-5));
    setRoot(work);
  }
  const visible = owner === root?.id ? groups : [];
  const transition = { duration: reduced ? 0 : .32, ease: "easeOut" as const };
  return <>
    <header className="concept-heading"><time>{root ? stamp(root) : ""}</time></header>
    {!root ? <div className="concept-empty" role="status">{loading ? "正在加载阅读记录" : error || "暂无作品"}</div> : <div ref={stage} className="echo-map" aria-busy={loading}>
      <EchoConnections stage={stage} revision={`${root.id}:${owner}:${visible.map(group => group.works.map(work => work.id).join(',')).join(';')}`} active={active ?? root.id} reduced={reduced} />
      <nav className="echo-past" aria-label="阅读记录">{recent.map((work, index) => <button type="button" key={work.id} style={{ "--record-x": `${[0, 5, 2, 7][index % 4]}%`, "--record-y": `${4 + index * 7.5}%` } as CSSProperties} onMouseEnter={() => setActive(work.id)} onMouseLeave={() => setActive(undefined)} onFocus={() => setActive(work.id)} onBlur={() => setActive(undefined)} onClick={() => follow(work)} aria-pressed={work.id === root.id} aria-label={`回到阅读记录：${workTitle(work)}`}>
        {work.id === root.id ? <m.i className="echo-record-active" layoutId="echo-record-active" transition={transition} /> : null}
        <i className="echo-record-dot" data-echo-anchor={`past:${work.id}`} data-work={work.id} /><time>{stamp(work)}</time><span>{workTitle(work)}</span><small>{Math.round(work.progress_percent ?? 0)}%</small>
      </button>)}</nav>
      <div className="echo-center"><i className="echo-root-dot" data-echo-anchor="root" /><AnimatePresence mode="wait" initial={false}><m.div className="echo-origin" key={root.id} initial={reduced ? false : { opacity: 0, y: 12, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -8 }} transition={transition}>
        <a className="echo-cover-link" href={pageHref({ name: "reader", workId: root.id })} aria-label={`阅读：${workTitle(root)}`}><ConceptCover key={root.id} work={root} hidden={hidden} /></a>
        <h2 title={workTitle(root)}>{workTitle(root)}</h2><a className="echo-read" href={pageHref({ name: "reader", workId: root.id })}>阅读<ArrowRight size={15} /></a>
      </m.div></AnimatePresence></div>
      <div className="echo-branches" style={{ "--group-count": Math.max(1, visible.length) } as CSSProperties}>
        {visible.map((group, index) => <section className="echo-branch" key={`${group.label}-${group.detail}`} style={{ "--group-index": index } as CSSProperties}>
          <h2><i className="echo-branch-dot" data-echo-anchor={`group:${index}`} />{group.label}<small>{group.detail}</small></h2>
          <div className="echo-related">{group.works.map((work, workIndex) => <button type="button" key={work.id} style={{ "--work-index": workIndex } as CSSProperties} onMouseEnter={() => setActive(work.id)} onMouseLeave={() => setActive(undefined)} onFocus={() => setActive(work.id)} onBlur={() => setActive(undefined)} onClick={() => follow(work)} aria-label={`追溯：${workTitle(work)}`}>
            <i className="echo-node-dot" data-echo-anchor={`work:${work.id}`} data-group={index} data-work={work.id} />
            <ConceptCover key={work.id} work={work} hidden={hidden} /><span>{workTitle(work)}</span><small>{work.page_count} 页{work.favorite ? " · 已收藏" : ""}</small>
          </button>)}</div>
        </section>)}
        {loading ? <p className="echo-loading" role="status">正在加载…</p> : !visible.length && !error ? <p className="echo-loading">暂无关联作品</p> : null}
      </div>
    </div>}
    {error ? <div className="concept-error" role="alert">{error}<button type="button" onClick={() => root ? setRevision(value => value + 1) : window.location.reload()}>重试</button></div> : null}
    {trail.length ? <nav className="echo-trail" aria-label="本次浏览">{trail.map((work, index) => <button key={work.id} type="button" onClick={() => follow(work)} title={workTitle(work)}><small>{String(index + 1).padStart(2, "0")}</small><span>{workTitle(work)}</span><ChevronRight size={14} /></button>)}</nav> : null}
  </>;
}
