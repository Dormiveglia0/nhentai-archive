import { BookOpen, Filter, Info, PenTool, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { api, Work } from "../../lib/api";
import { navigate } from "../../lib/navigation";

type Props = {
  blurCovers: boolean;
};

export function LibraryPage({ blurCovers }: Props) {
  const [works, setWorks] = useState<Work[]>([]);
  const [selected, setSelected] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.works();
      setWorks(payload.result);
      setSelected(payload.result[0] ?? null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="page">
      <div className="hero">
        <div>
          <h1>我的库</h1>
          <p>专属的同人志档案馆，所有条目都来自真实入库的 CBZ。</p>
          <div className="stats">
            <span>总收藏 {works.length}</span>
            <span>阅读中 {works.filter((work) => (work.progress_percent ?? 0) > 0 && !work.completed).length}</span>
            <span>已读 {works.filter((work) => Boolean(work.completed)).length}</span>
          </div>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <div className="filter-ribbon">
        <button type="button">
          <Filter size={16} />
          全部作品
        </button>
        <button type="button" onClick={load}>
          <RefreshCw size={16} />
          重新读取
        </button>
      </div>

      {error ? <div className="notice error">{error}</div> : null}
      {!loading && !error && works.length === 0 ? (
        <div className="empty-state">
          <Info size={24} />
          <strong>库里还没有作品</strong>
          <p>请先在发现页导入真实 CBZ，或后续接入本地扫描后读取你的 archive 目录。</p>
        </div>
      ) : null}

      <div className="library-layout">
        <div className="work-grid">
          {works.map((work) => (
            <article className={selected?.id === work.id ? "work-card selected" : "work-card"} key={work.id}>
              <button type="button" className="cover-button" onClick={() => setSelected(work)}>
                {work.cover_path ? (
                  <img className={blurCovers ? "blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" loading="lazy" />
                ) : (
                  <span className="cover-fallback">NO COVER</span>
                )}
              </button>
              <div className="card-body">
                <h3>{work.title}</h3>
                <p>{work.title_japanese || work.source}</p>
                <small>{work.page_count} 页 · {work.progress_percent ?? 0}%</small>
                <progress max="100" value={work.progress_percent ?? 0} />
              </div>
            </article>
          ))}
        </div>

        <aside className="work-inspector">
          {!selected ? (
            <div className="empty-state compact">
              <Info size={20} />
              <strong>作品详情</strong>
              <p>选择作品后显示阅读进度和操作。</p>
            </div>
          ) : (
            <>
              <div className="drawer-head">
                {selected.cover_path ? (
                  <img className={blurCovers ? "blurred" : ""} src={`/api/works/${selected.id}/cover`} alt="" />
                ) : null}
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.title_japanese}</p>
                  <small>{selected.page_count} 页 · {selected.progress_percent ?? 0}%</small>
                </div>
              </div>
              <button className="primary-wide" type="button" onClick={() => navigate({ name: "reader", workId: selected.id })}>
                <BookOpen size={17} />
                继续阅读
              </button>
              <button className="secondary-wide" type="button" disabled>
                <PenTool size={17} />
                治理将在后续模块接入
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
