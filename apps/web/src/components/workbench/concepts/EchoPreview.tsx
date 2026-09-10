import { ArrowRight, BookOpen, Clock3, Tag, UserRound } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { api, type LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { ConceptCover } from "./HomeConcepts";

type Relation = { label: string; detail: string; works: LibraryWork[]; error?: boolean };
const icons = [UserRound, Tag, Clock3];
export function EchoPreview({ hidden }: { hidden: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [root, setRoot] = useState<LibraryWork>();
  const [recent, setRecent] = useState<LibraryWork[]>([]);
  const [trail, setTrail] = useState<LibraryWork[]>([]);
  const [groups, setGroups] = useState<Relation[]>([]);
  const [owner, setOwner] = useState<number>();
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      try {
        const result = await api.libraryRecentRead(12);
        const first = result.result[0] ?? (await api.librarySearch({ per_page: 1, sort: "recent_added" })).result[0];
        if (active) { setRecent(result.result); setRoot(first); if (!first) setLoading(false); }
      } catch { if (active) { setError("阅读记录加载失败"); setLoading(false); } }
    }
    void load(); return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (!root) return;
    let active = true;
    const id = root.id;
    async function connect() {
      setLoading(true); setError("");
      try {
        const work = await api.work(id);
        const artist = work.tags?.find(tag => tag.type === "artist");
        const tag = work.tags?.find(tag => !["artist", "group", "language", "category"].includes(tag.type ?? ""));
        const results = await Promise.allSettled([
          artist ? api.librarySearch({ tag_ids: [artist.id], per_page: 4 }) : Promise.resolve({ result: [] as LibraryWork[] }),
          tag ? api.librarySearch({ tag_ids: [tag.id], per_page: 4 }) : Promise.resolve({ result: [] as LibraryWork[] }),
        ]);
        if (!active) return;
        setRoot(work);
        setGroups([
          { label: "同作者", detail: artist?.display ?? "暂无作者信息", works: results[0].status === "fulfilled" ? results[0].value.result.filter(item => item.id !== id).slice(0, 3) : [], error: results[0].status === "rejected" },
          { label: "共同标签", detail: tag?.display ?? "暂无标签信息", works: results[1].status === "fulfilled" ? results[1].value.result.filter(item => item.id !== id).slice(0, 3) : [], error: results[1].status === "rejected" },
          { label: "曾经读过", detail: "最近阅读", works: recent.filter(item => item.id !== id).slice(0, 3) },
        ]);
        setOwner(id);
      } catch { if (active) setError("作品关系加载失败"); }
      finally { if (active) setLoading(false); }
    }
    void connect(); return () => { active = false; };
  }, [root?.id, recent, revision]);
  function follow(work: LibraryWork) {
    if (root && root.id !== work.id) setTrail(items => [...items.filter(item => item.id !== root.id), root].slice(-5));
    setRoot(work);
  }
  const visible = owner === root?.id ? groups : [];
  return <>
    <header className="concept-heading"><h1>阅读回声</h1><span>{root?.last_read_at ? new Date(root.last_read_at).toLocaleDateString("zh-CN") : "最近添加"}</span></header>
    {!root ? <div className="concept-empty" role="status">{loading ? "正在寻找阅读痕迹…" : error || "暂无作品"}</div> : <div className="echo-map" aria-busy={loading}>
      <svg className="echo-lines" viewBox="0 0 1200 650" preserveAspectRatio="none" aria-hidden="true">{visible.map((_, index) => <m.path key={`${root.id}-${index}`} d={`M340 330C530 330 460 ${35 + index * 215} 645 ${35 + index * 215}`} fill="none" stroke={index === 1 ? "var(--folio-red)" : "var(--folio-line-strong)"} strokeWidth="1" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .7, delay: reduced ? 0 : index * .1 }} />)}</svg>
      <div className="echo-origin" key={root.id}><BookOpen className="echo-origin-icon" size={28} strokeWidth={1} /><ConceptCover key={root.id} work={root} hidden={hidden} /><h2>{workTitle(root)}</h2><a href={pageHref({ name: "reader", workId: root.id })}>阅读<ArrowRight size={15} /></a></div>
      <div className="echo-branches">{visible.map((group, index) => {
        const Icon = icons[index];
        return <section className="echo-branch" key={`${root.id}-${group.label}`}><h2><Icon size={17} strokeWidth={1.3} />{group.label}<small>{group.detail}</small></h2>{group.error ? <p>暂时无法加载</p> : group.works.length ? <div>{group.works.map(work => <button type="button" key={work.id} onClick={() => follow(work)} aria-label={`追溯：${workTitle(work)}`}><span>{workTitle(work)}</span><ArrowRight size={15} /></button>)}</div> : <p>暂无关联作品</p>}</section>;
      })}{loading ? <p className="echo-loading" role="status">正在连接…</p> : null}</div>
    </div>}
    {error || visible.some(group => group.error) ? <div className="concept-error" role="alert">{error || "部分关系未能加载"}<button type="button" onClick={() => setRevision(value => value + 1)}>重试</button></div> : null}
    {trail.length ? <nav className="echo-trail" aria-label="本次探索路径">{trail.map(work => <button key={work.id} type="button" onClick={() => follow(work)}>{workTitle(work)}</button>)}</nav> : null}
    <footer className="echo-timeline" aria-label="最近阅读记录">{recent.map(work => <button type="button" key={work.id} aria-label={`回到阅读记录：${workTitle(work)}`} aria-pressed={work.id === root?.id} onClick={() => follow(work)}><i /><span>{work.last_read_at ? new Date(work.last_read_at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "—"}</span></button>)}</footer>
  </>;
}
