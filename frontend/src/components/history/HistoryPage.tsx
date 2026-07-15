import { ArrowLeft, ArrowUpRight, CalendarDays, Clock3, History, RotateCw } from "lucide-react";
import type { CSSProperties } from "react";

import { FadeIn, Stagger, StaggerItem } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { IconPager } from "../folio/ui/IconPager";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { groupByBucket, progressLabel, timeOfDay } from "./historyHelpers";
import { useHistoryState } from "./useHistoryState";
import "./HistoryPage.css";

export function HistoryPage({ blurCovers }: { blurCovers: boolean }) {
  const state = useHistoryState();
  const entries = state.data?.result ?? [];
  const buckets = groupByBucket(entries);
  const completedOnPage = entries.filter((entry) => entry.completed).length;

  return (
    <section className="folio-page-body folio-history-page">
      <header className="folio-history-context">
        <button type="button" onClick={() => navigate({ name: "library" })}>
          <ArrowLeft size={15} />
          返回我的库
        </button>
        <span>{state.loading && !state.data ? "正在读取真实记录…" : `${(state.data?.total ?? 0).toLocaleString()} 条阅读记录`}</span>
      </header>

      <section className="folio-history-summary" aria-label="阅读历史摘要">
        <article>
          <History size={18} />
          <span><small>全部记录</small><strong>{state.data ? state.data.total.toLocaleString() : "—"}</strong></span>
        </article>
        <article>
          <CalendarDays size={18} />
          <span><small>当前页</small><strong>{state.data ? `${state.page} / ${state.data.num_pages || 1}` : "—"}</strong></span>
        </article>
        <article>
          <Clock3 size={18} />
          <span><small>本页作品</small><strong>{state.data ? entries.length.toLocaleString() : "—"}</strong></span>
        </article>
        <article>
          <span className="folio-history-complete-mark" aria-hidden="true" />
          <span><small>本页已读完</small><strong>{state.data ? completedOnPage.toLocaleString() : "—"}</strong></span>
        </article>
      </section>

      {state.error ? (
        <div className="folio-history-error" role="alert">
          <span>{state.error}</span>
          <button type="button" onClick={state.reload}><RotateCw size={14} />重新读取</button>
        </div>
      ) : null}

      {state.loading ? (
        <div className="folio-history-loading" role="status" aria-label="正在读取阅读历史">
          <i /><i /><i />
        </div>
      ) : null}

      {!state.loading && !state.error && entries.length === 0 ? (
        <section className="folio-ruled-panel folio-history-empty">
          <FolioEmptyState
            icon={History}
            title="还没有阅读轨迹"
            copy="打开任意已入库作品后，这里会按真实日期记录阅读进度。"
            action="浏览我的库"
            onAction={() => navigate({ name: "library" })}
          />
        </section>
      ) : null}

      {!state.loading && !state.error && entries.length > 0 ? (
        <FadeIn className="folio-history-timeline" y={10}>
          {buckets.map((bucket) => (
            <section className="folio-history-bucket" key={bucket.label}>
              <header className="folio-history-bucket-head">
                <span />
                <h2>{bucket.label}</h2>
                <small>{bucket.entries.length} 项</small>
              </header>
              <Stagger className="folio-history-rows">
                {bucket.entries.map((entry) => {
                  const progress = progressLabel(entry);
                  const percent = Math.max(0, Math.min(100, entry.progress_percent));
                  return (
                    <StaggerItem key={`${entry.id}-${entry.date}`} className="folio-history-row-wrap">
                      <button
                        className="folio-history-row"
                        type="button"
                        onClick={() => navigate({ name: "reader", workId: entry.id })}
                      >
                        <span className="folio-history-cover">
                          {entry.cover_path ? (
                            <img
                              className={blurCovers ? "is-blurred" : ""}
                              src={`/api/works/${entry.id}/cover`}
                              alt=""
                              loading="lazy"
                            />
                          ) : <span className="folio-history-cover-empty" aria-hidden="true" />}
                        </span>
                        <span className="folio-history-main">
                          <strong>{entry.title_japanese || entry.pretty_title || entry.title}</strong>
                          <small>
                            <span>{timeOfDay(entry.last_opened_at)}</span>
                            <span>打开 {entry.read_events} 次</span>
                            <span>最远第 {entry.furthest_page} / {entry.page_count} 页</span>
                          </small>
                        </span>
                        <span className={`folio-history-progress is-${progress.tone}`}>
                          <span><strong>{progress.text}</strong><small>{percent}%</small></span>
                          <i style={{ "--folio-history-progress": `${percent}%` } as CSSProperties}><span /></i>
                        </span>
                        <ArrowUpRight className="folio-history-open" size={17} />
                      </button>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </section>
          ))}
          <IconPager
            className="folio-history-pager"
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
