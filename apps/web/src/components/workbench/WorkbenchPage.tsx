import { useCallback, useEffect, useState } from "react";
import { api, type LibraryWork } from "../../lib/api";
import { HomeHero } from "../folio/ui/HomeHero";
import "./WorkbenchPage.css";

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setWorks((await api.librarySearch({ per_page: 36, sort: "recent_added" })).result); }
    catch (error) { setError(error instanceof Error ? error.message : "无法加载作品"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="folio-workbench-page">
    <HomeHero works={works} blurCovers={blurCovers} />
    {loading || error || !works.length ? <div className="folio-home-feedback" role={error ? "alert" : "status"}>
      {error ? <><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></> : loading ? "正在加载封面…" : "暂无作品"}
    </div> : null}
  </div>;
}
