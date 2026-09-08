import { useCallback, useEffect, useState } from "react";
import { api, type LibraryWork, type LibrarySummary, type ReadingStatistics } from "../../lib/api";
import { HomeHero } from "../folio/ui/HomeHero";
import "./WorkbenchPage.css";

export function WorkbenchPage(_props: { blurCovers: boolean }) {
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [summary, setSummary] = useState<LibrarySummary>();
  const [statistics, setStatistics] = useState<ReadingStatistics>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const results = await Promise.allSettled([api.librarySummary(), api.libraryStatistics(30), api.librarySearch({ per_page: 36, sort: "recent_added" })]);
    if (results[0].status === "fulfilled") setSummary(results[0].value);
    if (results[1].status === "fulfilled") setStatistics(results[1].value);
    if (results[2].status === "fulfilled") setWorks(results[2].value.result);
    if (results.some(result => result.status === "rejected")) setError("部分数据加载失败");
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="folio-workbench-page">
    <HomeHero works={works} summary={summary} statistics={statistics} />
    {error ? <div className="folio-home-feedback" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}
  </div>;
}
