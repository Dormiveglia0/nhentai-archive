import { RefreshCw } from "lucide-react";

import { ContinueReadingRow } from "../library/ContinueReadingRow";
import { WorkbenchMetricStrip } from "./WorkbenchMetricStrip";
import { WorkbenchModuleCards } from "./WorkbenchModuleCards";
import { useWorkbenchState } from "./useWorkbenchState";

export function WorkbenchPage({ blurCovers }: { blurCovers: boolean }) {
  const { overview, loading, refreshing, error, refresh } = useWorkbenchState();

  return (
    <section className="page workbench-page">
      <div className="hero">
        <div>
          <h1>工作台</h1>
          <p>聚合真实馆藏、治理、任务、文件与导出状态，作为每日入口。</p>
        </div>
        <button className="workbench-refresh" type="button" onClick={() => void refresh()} disabled={refreshing || loading}>
          <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
          刷新
        </button>
      </div>

      {error ? <div className="workbench-error">{error}</div> : null}

      {loading && !overview ? (
        <div className="workbench-empty">正在加载工作台数据...</div>
      ) : overview ? (
        <>
          <WorkbenchMetricStrip overview={overview} />
          <ContinueReadingRow title="继续阅读" works={overview.continue_reading} blurCovers={blurCovers} />
          <ContinueReadingRow title="最近导入" works={overview.recent_added} blurCovers={blurCovers} />
          <WorkbenchModuleCards overview={overview} />
        </>
      ) : (
        <div className="workbench-empty">暂无工作台数据。</div>
      )}
    </section>
  );
}
