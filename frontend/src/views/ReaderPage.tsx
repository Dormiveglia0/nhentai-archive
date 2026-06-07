import { ArrowLeft, BookOpen, ChevronsLeft, ChevronsRight, EyeOff, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero } from '../components/Shell';
import type { ApiClient, ReaderManifest } from '../lib/api';

export function ReaderPage({ api, workId, back, openGovernance }: { api: ApiClient; workId: number; back: () => void; openGovernance: (id: number) => void }) {
  const [manifest, setManifest] = useState<ReaderManifest | null>(null);
  const [page, setPage] = useState(0);
  const [fit, setFit] = useState<'width' | 'single'>('width');
  const [dim, setDim] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.reader(workId)
      .then((next) => {
        setManifest(next);
        setPage(0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '阅读器加载失败'));
  }, [workId, api]);

  const current = manifest?.pages[page] || null;

  if (!manifest) {
    return <section className="page reader-page"><PageHero title="阅读器" subtitle="正在打开 CBZ..." />{error ? <p className="notice error">{error}</p> : null}</section>;
  }

  return (
    <section className={`page reader-page ${dim ? 'dimmed' : ''}`}>
      <PageHero title="阅读器" seal="私藏" subtitle="沉浸阅读，专注每一个故事。">
        <div className="hero-actions">
          <button type="button" className="ghost-button" onClick={back}><ArrowLeft size={16} />返回库</button>
          <button type="button" className="ghost-button" onClick={() => openGovernance(manifest.work.id)}><Settings size={16} />进入治理</button>
        </div>
      </PageHero>

      <div className="reader-layout">
        <aside className="paper-panel reader-sidebar">
          <button type="button" className="ghost-button full" onClick={back}><ArrowLeft size={16} />返回作品页</button>
          <Cover src={manifest.work.cover_url} title={manifest.work.display_title} token={api.token} />
          <h2>{manifest.work.display_title}</h2>
          <p>已读 {page + 1} / {manifest.pages.length} 页</p>
          <div className="chapter-list">
            {manifest.pages.map((item) => (
              <button className={item.index === page ? 'active' : ''} type="button" key={item.index} onClick={() => setPage(item.index)}>
                <span>{item.index + 1}</span>{item.name}
              </button>
            ))}
          </div>
        </aside>

        <main className="reader-stage">
          <div className="reader-toolbar paper-panel">
            <button type="button" onClick={() => setPage(Math.max(0, page - 1))}><ChevronsLeft size={16} />上一页</button>
            <strong>{page + 1} / {manifest.pages.length}</strong>
            <button type="button" onClick={() => setPage(Math.min(manifest.pages.length - 1, page + 1))}>下一页<ChevronsRight size={16} /></button>
            <button type="button" onClick={() => setFit(fit === 'width' ? 'single' : 'width')}><BookOpen size={16} />{fit === 'width' ? '适宽' : '原始'}</button>
            <button type="button" onClick={() => setDim(!dim)}><EyeOff size={16} />遮罩</button>
          </div>
          {current ? <AuthorizedPageImage className={`reader-image ${fit}`} src={current.url} token={api.token} alt={`${manifest.work.display_title} 第 ${page + 1} 页`} /> : <p className="empty-panel">没有可阅读页面</p>}
        </main>

        <aside className="paper-panel reader-info">
          <h2>作品信息</h2>
          <dl className="meta-list">
            <div><dt>页数</dt><dd>{manifest.pages.length}</dd></div>
            <div><dt>来源</dt><dd>{manifest.work.source_type}</dd></div>
            <div><dt>路径</dt><dd>{manifest.work.local_cbz_path}</dd></div>
          </dl>
          <button type="button" className="primary-button full" onClick={() => openGovernance(manifest.work.id)}>进入治理</button>
        </aside>
      </div>
    </section>
  );
}

function AuthorizedPageImage({ src, token, alt, className }: { src: string; token: string | null; alt: string; className: string }) {
  const [objectURL, setObjectURL] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let nextURL = '';
    setObjectURL('');
    setFailed(false);
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        nextURL = URL.createObjectURL(blob);
        setObjectURL(nextURL);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (nextURL) URL.revokeObjectURL(nextURL);
    };
  }, [src, token]);

  if (failed) return <p className="empty-panel">页面加载失败</p>;
  if (!objectURL) return <p className="empty-panel">正在加载页面...</p>;
  return <img className={className} src={objectURL} alt={alt} />;
}
