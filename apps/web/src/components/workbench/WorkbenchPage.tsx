import { BookOpen, RefreshCw } from "lucide-react";
import { FadeIn } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { ContinueReadingRow } from "../folio/ui/ContinueReadingRow";
import { HomeHero } from "../folio/ui/HomeHero";
import { WorkbenchMetricStrip } from "./WorkbenchMetricStrip";
import { useWorkbenchState } from "./useWorkbenchState";
import "./WorkbenchPage.css";

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const { overview, loading, refreshing, error, refresh } = useWorkbenchState();
  return (
    <section className="folio-page-body folio-workbench-page">
      <HomeHero works={overview?.recent_added} total={overview?.library.total} blurCovers={blurCovers} />
      {error ? <div className="folio-workbench-error" role="alert">{error}</div> : null}
      {loading && !overview ? <div className="folio-workbench-loading" role="status">正在加载作品...</div> : overview ? (
        <FadeIn className="folio-workbench-body" y={8}>
          <div className="folio-workbench-shelves">
            {overview.continue_reading.length ? <ContinueReadingRow title="继续阅读" works={overview.continue_reading} blurCovers={blurCovers} /> :
              <FolioEmptyState icon={BookOpen} title="还没有阅读记录" copy="" />}
          </div>
          <section className="folio-home-status" aria-label="作品状态">
            <div className="folio-workbench-toolbar"><h2>作品概览</h2><button type="button" onClick={() => void refresh()} disabled={refreshing || loading}><RefreshCw size={15} className={refreshing ? "spin" : undefined} />刷新</button></div>
            <WorkbenchMetricStrip overview={overview} />
          </section>
        </FadeIn>
      ) : <button className="folio-home-retry" type="button" onClick={() => void refresh()} disabled={refreshing}>重新加载</button>}
    </section>
  );
}
