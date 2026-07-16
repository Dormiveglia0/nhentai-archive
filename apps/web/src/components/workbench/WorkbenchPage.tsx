import { BookOpen, RefreshCw } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { FolioEmptyState, FolioPanelHeading } from "../folio/ui/FolioPrimitives";
import { ContinueReadingRow } from "../folio/ui/ContinueReadingRow";
import { WorkbenchMetricStrip } from "./WorkbenchMetricStrip";
import { WorkbenchModuleCards } from "./WorkbenchModuleCards";
import { useWorkbenchState } from "./useWorkbenchState";
import "./WorkbenchPage.css";

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const { overview, loading, refreshing, error, refresh } = useWorkbenchState();

  return (
    <section className="folio-page-body folio-workbench-page">
      <div className="folio-workbench-toolbar">
        <span><strong>实时状态</strong><small>馆藏 · 治理 · 任务 · 文件</small></span>
        <button type="button" onClick={() => void refresh()} disabled={refreshing || loading}>
          <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
          刷新
        </button>
      </div>

      {error ? <div className="folio-workbench-error" role="alert">{error}</div> : null}

      {loading && !overview ? (
        <div className="folio-workbench-loading" role="status">正在加载工作台数据...</div>
      ) : overview ? (
        <FadeIn className="folio-workbench-body" y={8}>
          <WorkbenchMetricStrip overview={overview} />
          <div className="folio-workbench-content">
            <div className="folio-workbench-shelves">
              {overview.continue_reading.length ? (
                <ContinueReadingRow title="继续阅读" works={overview.continue_reading} blurCovers={blurCovers} />
              ) : (
                <section className="folio-ruled-panel folio-workbench-empty-shelf">
                  <FolioPanelHeading title="继续阅读" description="阅读进度会在打开真实馆藏后回到这里。" />
                  <FolioEmptyState icon={BookOpen} title="还没有可继续的阅读" copy="从我的库打开作品后，阅读器会自动保存真实进度。" />
                </section>
              )}
              <ContinueReadingRow title="最近导入" works={overview.recent_added} blurCovers={blurCovers} />
            </div>
            <WorkbenchModuleCards overview={overview} />
          </div>
        </FadeIn>
      ) : (
        <div className="folio-workbench-loading">暂无工作台数据。</div>
      )}
    </section>
  );
}
