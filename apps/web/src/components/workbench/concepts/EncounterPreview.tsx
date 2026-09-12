import { ArrowRight, Bookmark, Check, MoveHorizontal } from "lucide-react";
import { animate, m, useMotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { ConceptCover } from "./HomeConcepts";

export function EncounterPreview({ hidden }: { hidden: boolean }) {
  const reduced = usePrefersReducedMotion();
  const pullX = useMotionValue(0);
  const [work, setWork] = useState<LibraryWork>();
  const [total, setTotal] = useState<number>();
  const [history, setHistory] = useState<LibraryWork[]>([]);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const locked = useRef(false), alive = useRef(true), previousPage = useRef(-1);
  const gesture = useRef<number | null>(null), swiped = useRef(false);
  const loadCount = useCallback(async () => {
    try { const data = await api.librarySearch({ per_page: 1, read_status: "unread" }); if (alive.current) { setTotal(data.total); setError(""); } }
    catch { if (alive.current) setError("未读作品加载失败"); }
  }, []);
  useEffect(() => { alive.current = true; void loadCount(); return () => { alive.current = false; }; }, [loadCount]);
  async function draw() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const count = await api.librarySearch({ per_page: 1, read_status: "unread" });
      if (!alive.current) return;
      setTotal(count.total);
      if (!count.total) { setWork(undefined); return; }
      // Sample a page across the full unread result, excluding the previous draw when possible.
      const previous = previousPage.current < count.total ? previousPage.current : -1;
      let page = Math.floor(Math.random() * (count.total - (previous >= 0 && count.total > 1 ? 1 : 0)));
      if (previous >= 0 && count.total > 1 && page >= previous) page++;
      const selected = page === 0 ? count.result[0] : (await api.librarySearch({ per_page: 1, page: page + 1, read_status: "unread" })).result[0];
      if (!alive.current) return;
      if (!selected) throw new Error("作品列表已变化，请再试一次");
      previousPage.current = page; setWork(selected);
      setHistory(items => [selected, ...items.filter(item => item.id !== selected.id)].slice(0, 6));
    } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "抽取失败，请重试"); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function keep() {
    if (!work || work.favorite || saving) return;
    const selected = work;
    setSaving(true); setError("");
    try { await api.setWorkFavorite(selected.id, true); if (alive.current) { setWork(current => current?.id === selected.id ? { ...current, favorite: true } : current); setHistory(items => items.map(item => item.id === selected.id ? { ...item, favorite: true } : item)); } }
    catch { if (alive.current) setError("收藏失败，请重试"); }
    finally { if (alive.current) setSaving(false); }
  }
  return <>
    <header className="concept-heading"><span>{total === undefined ? "—" : `${total} 部未读`}</span></header>
    <svg className="encounter-flow" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"><path d="M1200 20H540Q380 20 380 145V210M1200 495C1100 630 955 585 855 690S690 780 620 800" fill="none" stroke="var(--folio-red)" strokeWidth=".8" /></svg>
    <div className="encounter-layout">
      <div className="encounter-stage" aria-busy={busy}>
        <div className="encounter-thread" />
        {Array.from({ length: Math.min(total ?? 0, 5) }, (_, i) => <m.div key={i} className="encounter-slip" aria-hidden="true" initial={false} animate={{ x: `${(i - 2) * 34}%`, rotate: (i - 2) * 1.8, y: busy ? 18 + Math.abs(i - 2) * 12 : Math.abs(i - 2) * 10 }} transition={{ duration: reduced ? 0 : .45 }}><span className="encounter-page-rules"><i /><i /><i /><i /><i /></span><i /><i /><i /></m.div>)}
        <div className="encounter-selected">
          {work ? <m.div key={work.id} initial={reduced ? false : { opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .5 }}><ConceptCover key={work.id} work={work} hidden={hidden} /></m.div> : <span className="encounter-unopened">{total === 0 ? "暂无未读作品" : "未揭晓"}</span>}
        </div>
        <m.button type="button" className="encounter-pull" style={{ x: pullX }} whileHover={reduced ? undefined : { y: -5 }} disabled={busy || total === 0 || total === undefined} aria-label="抽取一部未读作品" onPointerDown={event => { if (event.button !== 0) return; gesture.current = event.clientX; swiped.current = false; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (gesture.current !== null) pullX.set(Math.max(-65, Math.min(65, event.clientX - gesture.current))); }} onPointerUp={event => { animate(pullX, 0, { duration: reduced ? 0 : .3 }); if (gesture.current !== null && Math.abs(event.clientX - gesture.current) > 35) { swiped.current = true; void draw(); } gesture.current = null; }} onPointerCancel={() => { gesture.current = null; pullX.set(0); }} onLostPointerCapture={() => { gesture.current = null; animate(pullX, 0, { duration: reduced ? 0 : .3 }); }} onClick={event => { if (event.detail && swiped.current) { swiped.current = false; return; } void draw(); }}><MoveHorizontal size={20} /></m.button>
      </div>
      <div className="encounter-result" aria-live="polite">
        <span className="concept-kicker">{busy ? "正在揭晓" : "未读"}</span>
        <h2>{work ? workTitle(work) : total === 0 ? "暂无未读作品" : "—"}</h2>
        {work ? <><p>{work.page_count} 页{work.language ? ` · ${work.language}` : ""}</p><div className="concept-actions"><button type="button" onClick={() => void keep()} disabled={saving || work.favorite}>{work.favorite ? <Check size={17} /> : <Bookmark size={17} />}{work.favorite ? "已收藏" : saving ? "正在收藏" : "收藏"}</button><a href={pageHref({ name: "reader", workId: work.id })}>阅读<ArrowRight size={16} /></a></div></> : null}
        <button type="button" className="concept-text-action" disabled={busy || !total} onClick={() => void draw()}>{work ? "换一部" : "抽取一部"}<ArrowRight size={16} /></button>
      </div>
    </div>
    {error ? <div className="concept-error" role="alert">{error}<button type="button" onClick={() => void (total === undefined ? loadCount() : draw())}>重试</button></div> : null}
    <footer className="encounter-history"><span>本次查看</span>{history.map(item => <button key={item.id} type="button" aria-label={`查看：${workTitle(item)}`} aria-pressed={item.id === work?.id} onClick={() => setWork(item)}><span className="encounter-mini-page" aria-hidden="true"><i /><i /><i /></span><span>{workTitle(item)}</span></button>)}</footer>
  </>;
}
