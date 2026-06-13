import {
  ChevronLeft,
  ChevronRight,
  Download,
  Grid2X2,
  Info,
  List,
  Search,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import { api, GalleryDetail, GallerySummary } from "../../lib/api";
import { navigate } from "../../lib/navigation";

type Props = {
  blurCovers: boolean;
};

type Mode = "latest" | "popular" | "random" | "search" | "gallery";
type ViewMode = "grid" | "list";

const PER_PAGE = 24;

export function DiscoverPage({ blurCovers }: Props) {
  const [mode, setMode] = useState<Mode>("latest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [galleryId, setGalleryId] = useState("");
  const [language, setLanguage] = useState("all");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("date");
  const [unimportedOnly, setUnimportedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [selected, setSelected] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setSelected(null);
    setError(null);
    setNotice(null);
    if (mode === "latest") void loadLatest(1);
    if (mode === "popular") void loadPopular();
    if (mode === "random") void loadRandom();
    if (mode === "search" || mode === "gallery") {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    }
  }, [mode]);

  const visibleItems = useMemo(
    () => (unimportedOnly ? items.filter((item) => !item.imported) : items),
    [items, unimportedOnly]
  );

  const heading = useMemo(() => {
    if (mode === "popular") return "热门";
    if (mode === "random") return "随机";
    if (mode === "search") return "远端搜索";
    if (mode === "gallery") return "画廊 ID";
    return "最新";
  }, [mode]);

  async function loadLatest(nextPage = page) {
    await withLoad(async () => {
      const payload = await api.latest(nextPage, PER_PAGE);
      setItems(payload.result);
      setTotal(payload.total);
      setTotalPages(payload.num_pages ?? 1);
      setPage(nextPage);
      setSelected(null);
    });
  }

  async function loadPopular() {
    await withLoad(async () => {
      const payload = await api.popular();
      setItems(payload.result);
      setTotal(payload.total);
      setTotalPages(1);
      setSelected(null);
    });
  }

  async function loadRandom() {
    await withLoad(async () => {
      const detail = await api.random();
      setSelected(detail);
      setItems([]);
      setTotal(1);
      setTotalPages(1);
    });
  }

  async function submitSearch(event?: FormEvent, nextPage = 1) {
    event?.preventDefault();
    await withLoad(async () => {
      const payload = await api.search({
        q: query,
        page: nextPage,
        per_page: PER_PAGE,
        sort,
        language,
        type: kind,
        unimported_only: unimportedOnly,
      });
      setItems(payload.result);
      setTotal(payload.total);
      setTotalPages(payload.num_pages || 1);
      setPage(nextPage);
      setSelected(null);
      if (payload.reason === "min_query_length") {
        setNotice("请输入关键词，或使用语言/类型筛选组成远端查询。");
      } else if (payload.query) {
        setNotice(`远端查询：${payload.query}`);
      }
    });
  }

  async function submitGallery(event: FormEvent) {
    event.preventDefault();
    const id = Number(galleryId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("请输入有效的 Gallery ID。");
      setItems([]);
      setSelected(null);
      return;
    }
    setItems([]);
    setTotal(1);
    setTotalPages(1);
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
      await api.importGallery(selected.gallery_id);
      setNotice(`Gallery ${selected.gallery_id} 已加入真实导入队列。`);
    });
  }

  async function goPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    if (mode === "latest") await loadLatest(nextPage);
    if (mode === "search") await submitSearch(undefined, nextPage);
  }

  async function withLoad(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page discover-page">
      <div className="hero">
        <div>
          <h1>发现 / 导入</h1>
          <p>从远端源发现同人志，支持画廊 ID、真实搜索、CBZ 导入队列。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <div className="workspace-frame">
        <div className="mode-tabs">
          <ModeButton active={mode === "latest"} onClick={() => setMode("latest")} icon={<Sparkles size={16} />} label="最新" />
          <ModeButton active={mode === "popular"} onClick={() => setMode("popular")} icon={<Grid2X2 size={16} />} label="热门" />
          <ModeButton active={mode === "random"} onClick={() => setMode("random")} icon={<Shuffle size={16} />} label="随机" />
          <ModeButton active={mode === "search"} onClick={() => setMode("search")} icon={<Search size={16} />} label="远端搜索" />
          <ModeButton active={mode === "gallery"} onClick={() => setMode("gallery")} icon={<Info size={16} />} label="画廊 ID" />
        </div>

        <form className="discover-filters" onSubmit={mode === "gallery" ? submitGallery : submitSearch}>
          <label>
            <span>关键词</span>
            <input
              value={mode === "gallery" ? galleryId : query}
              onChange={(event) => (mode === "gallery" ? setGalleryId(event.target.value) : setQuery(event.target.value))}
              placeholder={mode === "gallery" ? "输入 Gallery ID" : "搜索标题、社团、角色、标签..."}
            />
          </label>
          <label>
            <span>语言</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={mode !== "search"}>
              <option value="all">全部</option>
              <option value="japanese">日语</option>
              <option value="english">英语</option>
              <option value="chinese">中文</option>
            </select>
          </label>
          <label>
            <span>类型</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)} disabled={mode !== "search"}>
              <option value="all">全部</option>
              <option value="doujinshi">同人志</option>
              <option value="manga">漫画</option>
              <option value="artist-cg">Artist CG</option>
              <option value="game-cg">Game CG</option>
            </select>
          </label>
          <label>
            <span>排序</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)} disabled={mode !== "search"}>
              <option value="date">最新发布</option>
              <option value="popular">总热度</option>
              <option value="popular-today">今日热门</option>
              <option value="popular-week">本周热门</option>
              <option value="popular-month">本月热门</option>
            </select>
          </label>
          <label className="switch-field">
            <span>仅未入库</span>
            <input type="checkbox" checked={unimportedOnly} onChange={(event) => setUnimportedOnly(event.target.checked)} />
            <i />
          </label>
          <div className="view-actions">
            <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
              <Grid2X2 size={16} />
              网格
            </button>
            <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
              <List size={16} />
              列表
            </button>
            <button type="submit">{mode === "gallery" ? "打开预览" : "搜索"}</button>
          </div>
        </form>

        <div className="content-grid discover-grid">
          <section className="result-panel">
            <div className="section-title">
              <h2>{heading}</h2>
              <span>{loading ? "读取中" : `显示 ${visibleItems.length} / 远端 ${total}`}</span>
            </div>
            {error ? <div className="notice error">{error}</div> : null}
            {notice ? <div className="notice slim">{notice}</div> : null}
            {!loading && !error && visibleItems.length === 0 ? (
              <div className="empty-state">
                <Info size={22} />
                <strong>暂无结果</strong>
                <p>这里不会填充样例作品；请配置 NH API Key 后搜索，或输入 Gallery ID。</p>
              </div>
            ) : null}
            <div className={viewMode === "grid" ? "gallery-grid" : "gallery-list"}>
              {visibleItems.map((item) => (
                <GalleryCard
                  key={item.gallery_id}
                  item={item}
                  blurCovers={blurCovers}
                  viewMode={viewMode}
                  onOpen={() => openDetail(item.gallery_id)}
                />
              ))}
            </div>
            {(mode === "latest" || mode === "search") && totalPages > 1 ? (
              <div className="pager">
                <button type="button" onClick={() => goPage(page - 1)} disabled={page <= 1 || loading}>
                  <ChevronLeft size={16} />
                  上一页
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button type="button" onClick={() => goPage(page + 1)} disabled={page >= totalPages || loading}>
                  下一页
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </section>

          <DetailDrawer selected={selected} blurCovers={blurCovers} onImport={importSelected} />
        </div>
      </div>
    </section>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function GalleryCard({
  item,
  blurCovers,
  viewMode,
  onOpen,
}: {
  item: GallerySummary;
  blurCovers: boolean;
  viewMode: ViewMode;
  onOpen: () => void;
}) {
  const tags = item.tags ?? [];
  const author = tags.find((tag) => tag.type === "artist")?.name ?? tags.find((tag) => tag.type === "group")?.name ?? "作者未缓存";
  const language = tags.find((tag) => tag.type === "language")?.name ?? "语言未缓存";
  const title = item.title_japanese || item.pretty_title || item.title || `Gallery ${item.gallery_id}`;

  return (
    <article className={viewMode === "grid" ? "gallery-card" : "gallery-card list-card"}>
      <button type="button" className="cover-button" onClick={onOpen}>
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
        <h3>{title}</h3>
        <p>{author}</p>
        <small>
          {item.page_count} 页 · {language} · ID {item.gallery_id}
        </small>
        <div className="tag-scroll" aria-label="远端标签">
          {tags.length === 0 ? <span>标签未缓存</span> : tags.slice(0, 18).map((tag) => <span key={tag.id}>{tag.name}</span>)}
        </div>
        <div className="card-actions">
          {item.imported && item.work_id ? (
            <button type="button" onClick={() => navigate({ name: "reader", workId: item.work_id! })}>
              打开本地
            </button>
          ) : (
            <button type="button" onClick={onOpen}>
              预览
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function DetailDrawer({
  selected,
  blurCovers,
  onImport,
}: {
  selected: GalleryDetail | null;
  blurCovers: boolean;
  onImport: () => void;
}) {
  if (!selected) {
    return (
      <aside className="detail-drawer">
        <div className="empty-state compact">
          <Info size={20} />
          <strong>作品详情</strong>
          <p>选择远端结果、随机作品，或输入 Gallery ID 后显示真实详情。</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="detail-drawer">
      <div className="drawer-head">
        {selected.thumbnail?.url ? <img className={blurCovers ? "blurred" : ""} src={selected.thumbnail.url} alt="" /> : null}
        <div>
          <span className="age">R-18</span>
          <h2>{selected.title.japanese || selected.title.pretty || selected.title.english || selected.gallery_id}</h2>
          <p>{selected.title.english || selected.title.pretty}</p>
          <small>
            Gallery ID {selected.gallery_id} · {selected.page_count} 页 · 收藏 {selected.favorites}
          </small>
        </div>
      </div>
      <div className="tag-list">
        {selected.tags.slice(0, 24).map((tag) => (
          <span key={tag.id}>{tag.name}</span>
        ))}
      </div>
      <div className="drawer-actions">
        {selected.imported && selected.work_id ? (
          <button type="button" onClick={() => navigate({ name: "reader", workId: selected.work_id! })}>
            打开本地
          </button>
        ) : (
          <button type="button" onClick={onImport}>
            <Download size={17} />
            加入导入队列
          </button>
        )}
      </div>
    </aside>
  );
}
