import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, type LibraryWork, type LibrarySummary, type ReadingStatistics } from "../../lib/api";
import { HomeHero } from "../folio/ui/HomeHero";
import "./WorkbenchPage.css";

const HomeLayoutPreview = lazy(() => import("./HomeLayoutPreview").then(module => ({ default: module.HomeLayoutPreview })));

const HomePlayPreview = lazy(() => import("./HomePlayPreview").then(module => ({ default: module.HomePlayPreview })));
const HomeConcepts = lazy(() => import("./concepts/HomeConcepts").then(module => ({ default: module.HomeConcepts })));

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const preview = new URLSearchParams(window.location.search).get("home-preview");
  if (preview && ["encounter", "echo", "imprint"].includes(preview)) return <Suspense fallback={<p role="status">正在加载…</p>}><HomeConcepts kind={preview} blurCovers={blurCovers} /></Suspense>;
  if (preview === "play") return <Suspense fallback={<p role="status">正在加载…</p>}><HomePlayPreview /></Suspense>;
  return <WorkbenchData blurCovers={blurCovers} />;
}

function WorkbenchData({ blurCovers }: { blurCovers: boolean }) {
  const preview = new URLSearchParams(window.location.search).get("home-preview") === "1";
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [summary, setSummary] = useState<LibrarySummary>();
  const [statistics, setStatistics] = useState<ReadingStatistics>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  const load = useCallback(async () => {
    const current = ++request.current;
    setError("");
    setLoading(true);
    const results = await Promise.allSettled([
      api.librarySearch({ per_page: preview ? 36 : 4, sort: "recent_added" }),
      api.libraryContinueReading(1),
      preview ? api.librarySummary() : Promise.resolve(undefined),
      preview ? api.libraryStatistics(30) : Promise.resolve(undefined),
    ]);
    if (current !== request.current) return;
    setSummary(results[2].status === "fulfilled" ? results[2].value : undefined);
    setStatistics(results[3].status === "fulfilled" ? results[3].value : undefined);
    const recent = results[0].status === "fulfilled" ? results[0].value.result : [];
    const continuing = results[1].status === "fulfilled" ? results[1].value.result : [];
    setWorks(preview ? recent : Array.from(new Map([...continuing, ...recent].map(work => [work.id, work])).values()).slice(0, 4));
    if (results.some(result => result.status === "rejected")) setError("部分数据加载失败");
    setLoading(false);
  }, [preview]);
  useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);
  return <div className="folio-workbench-page">
    {preview ? <Suspense fallback={<p role="status">正在加载…</p>}><HomeLayoutPreview works={works} summary={summary} statistics={statistics} blurCovers={blurCovers} /></Suspense> : <HomeHero works={works} blurCovers={blurCovers} loading={loading} />}
    {error ? <div className="folio-home-feedback" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}
  </div>;
}
