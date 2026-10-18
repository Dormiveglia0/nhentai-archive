import { ArrowUpRight, Check, FolderOpen, Minus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const reduced = usePrefersReducedMotion();
  const covers = useMemo(() => group.covers.filter(cover => cover.cover_path), [group.covers]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    if (root.current) observer.observe(root.current);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <article ref={root} className={`folio-library-card folio-library-group-card${view === 'list' ? ' is-list' : ''}${checked ? ' is-batch-selected' : ''}`}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(Boolean(root.current?.contains(document.activeElement)))}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(event.currentTarget.matches(':hover')); }}>
    <button type="button" className="folio-library-cover" onClick={multiSelect ? onToggle : onOpen}
      aria-label={multiSelect ? `${checked ? '取消选择' : '选择'}分组${group.name}中的${group.count}部作品` : `打开分组${group.name}`}
      aria-pressed={multiSelect ? partial ? 'mixed' : checked : undefined}>
      {covers.length ? <GroupCovers key={covers.map(cover => workCoverHref(cover)).join('|')} covers={covers} blurCovers={blurCovers}
        preload={visible && !hidden} playing={visible && !hidden && !paused && !reduced && !multiSelect} /> : <span className="folio-cover-fallback">暂无封面</span>}
      {multiSelect ? <span className={`folio-library-check${checked || partial ? ' is-on' : ''}`} aria-hidden="true">{checked ? <Check size={14} /> : partial ? <Minus size={14} /> : null}</span> : null}
      <span className="folio-library-group-count"><FolderOpen size={14} />{group.count} 部</span>
    </button>
    <div className="folio-library-card-body">
      <div className="folio-library-card-meta"><span>{group.kind === 'manual' ? '作品分组' : '同作者作品'}</span>{(group.total_count ?? group.count) > group.count ? <em>共 {group.total_count} 部</em> : null}</div>
      <button type="button" className="folio-library-card-title" onClick={multiSelect ? onToggle : onOpen}>{group.name}</button>
      <div className="folio-library-group-tags" aria-label="分组标签" tabIndex={group.tags?.length ? 0 : undefined}>
        {group.tags?.length ? group.tags.map(tag => <span key={tag.key} title={`${tag.display} · ${tag.count} 部作品`}>
          <span>{tag.display}</span><sup>{tag.count}</sup>
        </span>) : <small>暂无内容标签</small>}
      </div>
      <button type="button" className="folio-library-group-open" onClick={onOpen}>打开分组<ArrowUpRight size={15} /></button>
    </div>
  </article>;
}

function GroupCovers({ covers, blurCovers, preload, playing }: {
  covers: LibraryWorkGroup['covers']; blurCovers: boolean; preload: boolean; playing: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const ready = useRef(new Map<string, HTMLImageElement>());
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const next = Array.from({ length: covers.length - 1 }, (_, offset) => (index + offset + 1) % covers.length).find(value => !failed.has(value));

  useEffect(() => {
    if (!playing || next === undefined) return;
    const timer = window.setInterval(() => {
      const image = ready.current.get(workCoverHref(covers[next]));
      if (!root.current?.closest('[inert]') && image?.isConnected && image.complete && image.naturalWidth > 0) {
        setPrevious(index);
        setIndex(next);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [playing, covers, index, next]);

  useEffect(() => {
    if (previous === null) return;
    const timer = window.setTimeout(() => setPrevious(null), 600);
    return () => window.clearTimeout(timer);
  }, [previous]);

  const layers = [...new Set([previous, index, preload ? next : undefined].filter((value): value is number => value !== null && value !== undefined))];
  return <span ref={root} className="folio-library-group-covers" aria-hidden="true">
    {failed.has(index) ? <span className="folio-cover-fallback">封面不可用</span> : null}
    {layers.map(value => <span key={workCoverHref(covers[value])} className={`folio-library-group-cover${value === index ? ' is-active' : value === previous ? ' is-previous' : ''}${failed.has(value) ? ' is-failed' : ''}`}>
      <AmbientCover className="is-fill-portrait" src={workCoverHref(covers[value])} alt="" privateBlur={blurCovers} loading={value === index ? 'lazy' : 'eager'}
        onLoad={event => {
          const image = event.currentTarget;
          void image.decode().then(() => {
            if (image.isConnected && image.naturalWidth > 0) ready.current.set(image.getAttribute('src')!, image);
          }).catch(() => { if (image.isConnected) setFailed(current => new Set(current).add(value)); });
        }}
        onError={() => setFailed(current => new Set(current).add(value))} />
    </span>)}
  </span>;
}
