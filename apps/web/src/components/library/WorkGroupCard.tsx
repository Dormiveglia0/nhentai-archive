import { Check, FolderOpen, Minus } from 'lucide-react';
import { useState } from 'react';
import type { LibraryWorkGroup } from '../../lib/api';
import { librarySearchHref } from '../../lib/navigation';
import { AmbientCover } from '../folio/ui/AmbientCover';
import { TagScroller } from '../folio/ui/TagScroller';
import { workCoverHref } from './libraryHelpers';
import type { LibraryView } from './LibraryToolbar';

export function WorkGroupCard({ group, view, blurCovers, multiSelect, checked, partial, onOpen, onToggle }: {
  group: LibraryWorkGroup; view: LibraryView; blurCovers: boolean; multiSelect: boolean;
  checked: boolean; partial: boolean; onOpen: () => void; onToggle: () => void;
}) {
  const [coverId] = useState(() => {
    const covers = group.covers.filter(cover => cover.cover_path);
    return covers[Math.floor(Math.random() * covers.length)]?.id;
  });
  const [failedSrc, setFailedSrc] = useState('');
  const cover = group.covers.find(cover => cover.id === coverId && cover.cover_path) || group.covers.find(cover => cover.cover_path);
  const src = cover ? workCoverHref(cover) : '';
  const total = group.total_count ?? group.count;

  return <article className={`folio-library-card folio-library-group-card${view === 'list' ? ' is-list' : ''}${checked ? ' is-batch-selected' : ''}`}>
    <button type="button" className="folio-library-cover" onClick={multiSelect ? onToggle : onOpen}
      aria-label={multiSelect ? `${checked ? '取消选择' : '选择'}分组${group.name}中的${group.count}部作品` : `打开分组${group.name}`}
      aria-pressed={multiSelect ? partial ? 'mixed' : checked : undefined}>
      {src && failedSrc !== src ? <AmbientCover className="is-fill-portrait" src={src} alt="" privateBlur={blurCovers} loading="lazy" onError={() => setFailedSrc(src)} />
        : <span className="folio-cover-fallback">{src ? '封面不可用' : '暂无封面'}</span>}
      {multiSelect ? <span className={`folio-library-check${checked || partial ? ' is-on' : ''}`} aria-hidden="true">{checked ? <Check size={14} /> : partial ? <Minus size={14} /> : null}</span> : null}
    </button>
    <div className="folio-library-card-body">
      <div className="folio-library-card-meta"><span>{group.kind === 'manual' ? '作品分组' : '同作者作品'}</span></div>
      <button type="button" className="folio-library-card-title" onClick={multiSelect ? onToggle : onOpen}>{group.name}</button>
      <p>共 {total} 部作品{total > group.count ? ` · 匹配 ${group.count} 部` : ''}</p>
      <small title={cover?.title}>{cover ? `封面：${cover.title}` : '暂无可用封面'}</small>
      <TagScroller className="folio-library-card-tags folio-library-group-tags"
        tags={(group.tags ?? []).map(tag => ({ ...tag, id: null }))} emptyLabel="暂无内容标签"
        hrefForTag={tag => librarySearchHref(tag.display)}
        displayTag={tag => <>{tag.display}<span className="folio-library-group-tag-count" aria-label={`${tag.count} 部作品`}>{tag.count}</span></>} />
      <button type="button" className="folio-library-read-action" onClick={onOpen}><FolderOpen size={15} />打开分组</button>
    </div>
  </article>;
}
