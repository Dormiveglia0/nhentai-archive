import { IconPager } from "../discover/IconPager";
import { FadeIn } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { groupByBucket, progressLabel, timeOfDay } from "./historyHelpers";
import { useHistoryState } from "./useHistoryState";

export function HistoryPage({ blurCovers }: { blurCovers: boolean }) {
  const state = useHistoryState();
  const entries = state.data?.result ?? [];
  const buckets = groupByBucket(entries);

  return (
    <section className="page history-page">
      <header className="hero">
        <div>
          <h1>阅读历史</h1>
          <p>按日期排列的真实阅读轨迹,数据来自本地阅读记录。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </header>

      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.loading ? <div className="page-panel">正在读取阅读历史...</div> : null}

      {!state.loading && entries.length === 0 ? (
        <div className="page-panel boundary-panel">
          <strong>暂无阅读记录</strong>
          <p>开始阅读任意作品后,这里会按日期显示真实的阅读轨迹。</p>
        </div>
      ) : null}

      {!state.loading && entries.length ? (
        <FadeIn className="history-list" y={8}>
          {buckets.map((bucket) => (
            <div className="history-bucket" key={bucket.label}>
              <h2 className="history-bucket-label">{bucket.label}</h2>
              {bucket.entries.map((entry) => {
                const progress = progressLabel(entry);
                return (
                  <button
                    className="history-row"
                    type="button"
                    key={`${entry.id}-${entry.date}`}
                    onClick={() => navigate({ name: "reader", workId: entry.id })}
                  >
                    <span className="history-cover">
                      {entry.cover_path ? (
                        <img
                          className={blurCovers ? "blurred" : ""}
                          src={`/api/works/${entry.id}/cover`}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="history-cover-empty" aria-hidden="true" />
                      )}
                    </span>
                    <span className="history-main">
                      <strong>{entry.title_japanese || entry.pretty_title || entry.title}</strong>
                      <small>
                        {timeOfDay(entry.last_opened_at)} · 阅读 {entry.read_events} 次 · 最远第 {entry.furthest_page}/
                        {entry.page_count} 页
                      </small>
                    </span>
                    <span className={`history-progress ${progress.tone}`}>{progress.text}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <IconPager
            page={state.page}
            totalPages={state.data?.num_pages ?? 1}
            loading={state.loading}
            onPage={state.setPage}
          />
        </FadeIn>
      ) : null}
    </section>
  );
}
