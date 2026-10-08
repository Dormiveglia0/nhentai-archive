import { BookOpen, Download, Heart, PenTool, X } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { api, type LibraryTag, type LibraryWork } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { libraryTagHref, pageHref } from "../../lib/navigation";
import { AmbientCover } from "../folio/ui/AmbientCover";
import { WorkDeleteAction } from "../folio/ui/WorkDeleteAction";
import { authorLine, formatBytes, languageLabel, readStatusLabel, workTitle } from "./libraryHelpers";
import "../folio/ui/WorkDetail.css";

type Props = {
  work: LibraryWork;
  blurCovers: boolean;
  onClose: () => void;
  onPickTag: (tag: LibraryTag) => void;
  onToggleFavorite: (work: LibraryWork) => void;
  onDeleted: () => void;
};

const TAG_GROUPS = [
  { label: "作者", types: ["artist", "group"] },
  { label: "原作 / 角色", types: ["parody", "character"] },
  { label: "内容标签", types: ["tag"] },
  { label: "分类 / 语言", types: ["category", "language"] },
];

export function WorkInspector({ work, blurCovers, onClose, onPickTag, onToggleFavorite, onDeleted }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reduced = usePrefersReducedMotion();
  const [detail, setDetail] = useState<LibraryWork | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [coverRatio, setCoverRatio] = useState(.75);
  const [coverFailed, setCoverFailed] = useState(false);
  const title = workTitle(work);
  const progress = work.completed ? 100 : work.progress_percent ?? 0;
  const tags = detail?.id === work.id ? detail.tags ?? [] : work.tags ?? [];

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const close = () => { dialogRef.current?.close(); onClose(); };
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    setError("");
    api.work(work.id).then(value => { if (alive) setDetail(value); }).catch(() => {
      if (alive) setError("完整标签读取失败");
    });
    return () => { alive = false; };
  }, [work.id, retry]);

  return (
    <m.dialog ref={dialogRef} className="folio-work-dialog" aria-labelledby={titleId}
      initial={{ opacity: 0, y: reduced ? 0 : 24, scale: reduced ? 1 : .97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : .98 }}
      transition={{ duration: reduced ? 0 : .25, ease: [.22, 1, .36, 1] }}
      onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <header className="folio-work-detail-head">
        <span>作品详情</span><strong>{readStatusLabel(work).label}</strong>
        <button type="button" onClick={onClose} aria-label="关闭作品详情" autoFocus><X size={20} /></button>
      </header>
      <div className="folio-work-detail">
        <div className="folio-work-detail-cover" style={{ "--work-cover-ratio": coverRatio } as CSSProperties}>
          <span className="folio-work-cover-register" aria-hidden="true"><i /><i /><i /><i /></span>
          {work.cover_path && !coverFailed ? <AmbientCover src={`/api/works/${work.id}/cover?w=768`} alt="作品封面" privateBlur={blurCovers}
            onLoad={event => setCoverRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} onError={() => setCoverFailed(true)} />
            : <span className="folio-cover-fallback">{coverFailed ? <>封面读取失败<button type="button" onClick={() => setCoverFailed(false)}>重新加载</button></> : "暂无封面"}</span>}
        </div>
        <div className="folio-work-detail-copy">
          <h2 id={titleId}>{title}</h2>
          <p className="folio-work-detail-author">{authorLine(work)}</p>
          <dl className="folio-work-detail-facts">
            <div><dt>页数 / 文件</dt><dd>{work.page_count} 页 · {formatBytes(work.size_bytes)}</dd></div>
            <div><dt>语言</dt><dd>{languageLabel(work)}</dd></div>
            <div><dt>来源</dt><dd>{work.source === "remote" ? "远端导入" : "本地导入"}{work.remote_gallery_id ? ` · #${work.remote_gallery_id}` : ""}</dd></div>
            <div><dt>阅读进度</dt><dd>{Math.round(progress)}% · 第 {work.reader_page_index || 1} 页</dd></div>
          </dl>
          <div className="folio-work-detail-progress" role="progressbar" aria-label="阅读进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ transform: `scaleX(${progress / 100})` }} /></div>
          <div className="folio-work-detail-actions">
            <div className="folio-work-detail-main-actions">
              <a className="is-primary" href={pageHref({ name: "reader", workId: work.id })}><BookOpen size={17} />{progress > 0 && !work.completed ? "继续阅读" : "开始阅读"}</a>
              <button className={work.favorite ? "is-favorite" : ""} type="button" onClick={() => onToggleFavorite(work)} aria-pressed={work.favorite}><Heart size={16} fill={work.favorite ? "currentColor" : "none"} />{work.favorite ? "已收藏" : "收藏"}</button>
            </div>
            <div className="folio-work-detail-tools">
              <a href={pageHref({ name: "governance", workId: work.id })} aria-label="编辑作品信息"><PenTool size={16} />编辑</a>
              <a href={pageHref({ name: "export", workId: work.id })} aria-label="导出 CBZ"><Download size={16} />导出</a>
              <WorkDeleteAction workId={work.id} title={title} onDeleted={() => { onClose(); onDeleted(); }} />
            </div>
          </div>
        </div>
      </div>
      {tags.length ? <div className="folio-work-detail-tags">
        {TAG_GROUPS.map(group => {
          const items = tags.filter(tag => group.types.includes(tag.type ?? ""));
          return items.length ? <section className="folio-work-detail-tag-group" key={group.label}>
            <h3>{group.label}</h3><div>{items.map(tag => <a key={tag.id} href={libraryTagHref(tag)} onClick={event => {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); onClose(); onPickTag(tag);
            }}>{tag.display}</a>)}</div>
          </section> : null;
        })}
      </div> : null}
      {error ? <div className="folio-work-detail-error" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>重试</button></div> : null}
    </m.dialog>
  );
}
