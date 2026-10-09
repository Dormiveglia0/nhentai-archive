import { ArrowUpRight, BookOpen } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type GallerySummary, type LibraryWork } from "../../lib/api";
import { pageHref } from "../../lib/navigation";
import { AmbientCover } from "../folio/ui/AmbientCover";
import { HomeHero } from "../folio/ui/HomeHero";
import { HomeActivity } from "./HomeActivity";
import "./WorkbenchPage.css";

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [latest, setLatest] = useState<GallerySummary[]>([]);
  const [error, setError] = useState("");
  const [remoteError, setRemoteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const request = useRef(0);
  const remoteRequest = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    setError(""); setLoading(true);
    const results = await Promise.allSettled([api.librarySearch({ per_page: 4, sort: "recent_added" }), api.libraryContinueReading(4)]);
    if (current !== request.current) return;
    const recent = results[0].status === "fulfilled" ? results[0].value.result : [];
    const continuing = results[1].status === "fulfilled" ? results[1].value.result : [];
    setWorks([...new Map([...continuing, ...recent].map(work => [work.id, work])).values()].slice(0, 6));
    if (results.some(result => result.status === "rejected")) setError("部分数据加载失败");
    setLoading(false);
  }, []);
  const loadLatest = useCallback(async () => {
    const current = ++remoteRequest.current;
    setRemoteLoading(true); setRemoteError("");
    try { const result = await api.latest(1, 6); if (current === remoteRequest.current) setLatest(result.result); }
    catch (reason) { if (current === remoteRequest.current) setRemoteError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (current === remoteRequest.current) setRemoteLoading(false); }
  }, []);
  useEffect(() => { void load(); void loadLatest(); return () => { request.current += 1; remoteRequest.current += 1; }; }, [load, loadLatest]);
  return <div className="folio-workbench-page">
    <HomeHero works={works} blurCovers={blurCovers} loading={loading} activity={<HomeActivity blurCovers={blurCovers} />} />
    {error ? <div className="folio-home-feedback" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}
    <section className="folio-home-latest" aria-label="最新远端作品" aria-busy={remoteLoading}>
      <header><h2>最新作品</h2><a href="#discover">发现作品<ArrowUpRight size={15} /></a></header>
      {remoteError ? <div className="folio-home-feedback" role="alert"><span>{remoteError}</span><button type="button" onClick={() => void loadLatest()}>重新读取</button></div> : null}
      {latest.length ? <div className="folio-home-latest-grid">{latest.map(item => {
        const title = item.title_japanese || item.pretty_title || item.title;
        return <a key={item.gallery_id} data-gallery-id={item.gallery_id} className="folio-home-latest-work" href={pageHref({ name: "gallery", galleryId: item.gallery_id, returnTo: "#workbench" })}>
          <div className="folio-home-latest-cover">{item.thumbnail.url ? <AmbientCover src={item.thumbnail.url} alt="作品封面" privateBlur={blurCovers} loading="lazy" /> : <BookOpen size={28} />}</div>
          <strong title={title}>{title}</strong><span>{item.page_count} 页<ArrowUpRight size={15} /></span>
        </a>;
      })}</div> : !remoteError ? <div className="folio-home-latest-pending" role="status">{remoteLoading ? "正在读取最新作品…" : "暂无最新作品"}</div> : null}
    </section>
  </div>;
}
