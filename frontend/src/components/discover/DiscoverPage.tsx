import { Download, Grid2X2, Info, Search, Shuffle, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, GalleryDetail, GallerySummary } from "../../lib/api";
import { navigate } from "../../lib/navigation";

type Props = {
  blurCovers: boolean;
};

type Mode = "latest" | "popular" | "search" | "gallery";

export function DiscoverPage({ blurCovers }: Props) {
  const [mode, setMode] = useState<Mode>("latest");
  const [query, setQuery] = useState("");
  const [galleryId, setGalleryId] = useState("");
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [selected, setSelected] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "latest") void loadLatest();
    if (mode === "popular") void loadPopular();
  }, [mode]);

  const heading = useMemo(() => {
    if (mode === "popular") return "热门";
    if (mode === "search") return "远端搜索";
    if (mode === "gallery") return "画廊 ID";
    return "最新";
  }, [mode]);

  async function loadLatest() {
    await withLoad(async () => {
      const payload = await api.latest();
      setItems(payload.result);
      setSelected(null);
    });
  }

  async function loadPopular() {
    await withLoad(async () => {
      const payload = await api.popular();
      setItems(payload.result);
      setSelected(null);
    });
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    await withLoad(async () => {
      const payload = await api.search(query);
      setItems(payload.result);
      setSelected(null);
      if (payload.reason === "min_query_length") {
        setError("远端搜索至少需要 3 个字符；短词请优先使用后续词典 selector。");
      }
    });
  }

  async function submitGallery(event: FormEvent) {
    event.preventDefault();
    const id = Number(galleryId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("请输入有效的 Gallery ID。");
      return;
    }
    await openDetail(id);
  }

  async function openDetail(id: number) {
    await withLoad(async () => {
      setSelected(await api.gallery(id));
    });
  }

  async function importSelected() {
    if (!selected) return;
    await withLoad(async () => {
      const job = await api.importGallery(selected.gallery_id);
      setSelected({ ...selected, imported: Boolean(job.target.work_id), work_id: Number(job.target.work_id) || null });
    });
  }

  async function withLoad(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page">
      <div className="hero">
        <div>
          <h1>发现 / 导入</h1>
          <p>从远端源发现同人志，支持画廊 ID、远端搜索与真实导入队列。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <div className="mode-tabs">
        <button className={mode === "latest" ? "active" : ""} type="button" onClick={() => setMode("latest")}>
          <Sparkles size={16} />
          最新
        </button>
        <button className={mode === "popular" ? "active" : ""} type="button" onClick={() => setMode("popular")}>
          <Grid2X2 size={16} />
          热门
        </button>
        <button className={mode === "search" ? "active" : ""} type="button" onClick={() => setMode("search")}>
          <Search size={16} />
          远端搜索
        </button>
        <button className={mode === "gallery" ? "active" : ""} type="button" onClick={() => setMode("gallery")}>
          <Shuffle size={16} />
          画廊 ID
        </button>
      </div>

      {mode === "search" ? (
        <form className="search-row" onSubmit={submitSearch}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="标题、社团、角色、标签..." />
          <button type="submit">搜索</button>
        </form>
      ) : null}

      {mode === "gallery" ? (
        <form className="search-row" onSubmit={submitGallery}>
          <input value={galleryId} onChange={(event) => setGalleryId(event.target.value)} placeholder="输入 Gallery ID" />
          <button type="submit">打开预览</button>
        </form>
      ) : null}

      <div className="content-grid">
        <section className="result-panel">
          <div className="section-title">
            <h2>{heading}</h2>
            {loading ? <span>读取中</span> : <span>{items.length} 项</span>}
          </div>
          {error ? <div className="notice error">{error}</div> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="empty-state">
              <Info size={22} />
              <strong>暂无结果</strong>
              <p>配置 API key 后可拉取远端内容；搜索结果不会使用本地样例填充。</p>
            </div>
          ) : null}
          <div className="gallery-grid">
            {items.map((item) => (
              <article className="gallery-card" key={item.gallery_id}>
                <button type="button" className="cover-button" onClick={() => openDetail(item.gallery_id)}>
                  {item.thumbnail.url ? (
                    <img className={blurCovers ? "blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
                  ) : (
                    <span className="cover-fallback">NO COVER</span>
                  )}
                </button>
                <div className="card-body">
                  <div className="card-meta">
                    <span>R-18</span>
                    <em>{item.imported ? "已入库" : "未入库"}</em>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.title_japanese || "无日文标题"}</p>
                  <small>{item.page_count} 页 · Gallery ID {item.gallery_id}</small>
                  <div className="card-actions">
                    {item.imported && item.work_id ? (
                      <button type="button" onClick={() => navigate({ name: "reader", workId: item.work_id! })}>
                        打开本地
                      </button>
                    ) : (
                      <button type="button" onClick={() => openDetail(item.gallery_id)}>
                        预览
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="detail-drawer">
          {!selected ? (
            <div className="empty-state compact">
              <Info size={20} />
              <strong>作品详情</strong>
              <p>选择远端结果或输入 Gallery ID 后显示真实详情。</p>
            </div>
          ) : (
            <>
              <div className="drawer-head">
                {selected.thumbnail?.url ? (
                  <img className={blurCovers ? "blurred" : ""} src={selected.thumbnail.url} alt="" />
                ) : null}
                <div>
                  <span className="age">R-18</span>
                  <h2>{selected.title.pretty || selected.title.english || selected.gallery_id}</h2>
                  <p>{selected.title.japanese}</p>
                  <small>Gallery ID {selected.gallery_id} · {selected.page_count} 页</small>
                </div>
              </div>
              <div className="tag-list">
                {selected.tags.slice(0, 14).map((tag) => (
                  <span key={tag.id}>{tag.name}</span>
                ))}
              </div>
              <div className="drawer-actions">
                {selected.imported && selected.work_id ? (
                  <button type="button" onClick={() => navigate({ name: "reader", workId: selected.work_id! })}>
                    打开本地
                  </button>
                ) : (
                  <button type="button" onClick={importSelected}>
                    <Download size={17} />
                    加入导入队列
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
