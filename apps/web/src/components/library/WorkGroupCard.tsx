import { Check, ChevronLeft, ChevronRight, FolderOpen, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LibraryWorkGroup } from '../../lib/api';
import { usePrefersReducedMotion } from '../../lib/motion';
import { AmbientCover } from '../folio/ui/AmbientCover';
import { workCoverHref } from './libraryHelpers';
import type { LibraryView } from './LibraryToolbar';

export function WorkGroupCard({ group, view, blurCovers, multiSelect, checked, partial, onOpen, onToggle }: {
  group: LibraryWorkGroup; view: LibraryView; blurCovers: boolean; multiSelect: boolean;
  checked: boolean; partial: boolean; onOpen: () => void; onToggle: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const reduced = usePrefersReducedMotion();
  const covers = group.covers;
  const current = covers.length ? index % covers.length : 0;
  const cover = covers[current];
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    if (root.current) observer.observe(root.current);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (reduced || paused || hidden || !visible || covers.length < 2 || multiSelect) return;
    const timer = window.setInterval(() => {
      if (!root.current?.closest('[inert]')) setIndex(value => value + 1);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [reduced, paused, hidden, visible, covers.length, multiSelect]);
  return <article ref={root} className={`folio-library-card folio-library-group-card${view === 'list' ? ' is-list' : ''}${checked ? ' is-batch-selected' : ''}`}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(Boolean(root.current?.contains(document.activeElement)))}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(event.currentTarget.matches(':hover')); }}>
    <button type="button" className="folio-library-cover" onClick={multiSelect ? onToggle : onOpen}
      aria-label={multiSelect ? `${checked ? '取消选择' : '选择'}分组${group.name}中的${group.count}部作品` : `打开分组${group.name}`}
      aria-pressed={multiSelect ? partial ? 'mixed' : checked : undefined}>
      {cover?.cover_path ? <AmbientCover key={cover.id} className="is-fill-portrait" src={workCoverHref(cover)} alt="" privateBlur={blurCovers} loading="lazy" /> : <span className="folio-cover-fallback">暂无封面</span>}
      {multiSelect ? <span className={`folio-library-check${checked || partial ? ' is-on' : ''}`} aria-hidden="true">{checked ? <Check size={14} /> : partial ? <Minus size={14} /> : null}</span> : null}
      <span className="folio-library-group-count"><FolderOpen size={14} />{group.count} 部</span>
    </button>
    <div className="folio-library-card-body">
      <div className="folio-library-card-meta"><span>{group.kind === 'manual' ? '作品分组' : '同作者作品'}</span>{(group.total_count ?? group.count) > group.count ? <em>共 {group.total_count} 部</em> : null}</div>
      <button type="button" className="folio-library-card-title" onClick={multiSelect ? onToggle : onOpen}>{group.name}</button>
      <p title={cover?.title}>{cover?.title ?? '查看组内作品'}</p>
      <div className="folio-library-group-carousel" aria-label="分组封面">
        {covers.length > 1 && !multiSelect ? <><button type="button" aria-label="上一张封面" onClick={() => setIndex(value => (value + covers.length - 1) % covers.length)}><ChevronLeft size={15} /></button><span>{current + 1} / {covers.length}</span><button type="button" aria-label="下一张封面" onClick={() => setIndex(value => value + 1)}><ChevronRight size={15} /></button></> : <span>组内 {group.count} 部作品</span>}
        {multiSelect ? <button type="button" className="folio-library-group-open" onClick={onOpen}>查看</button> : null}
      </div>
    </div>
  </article>;
}
