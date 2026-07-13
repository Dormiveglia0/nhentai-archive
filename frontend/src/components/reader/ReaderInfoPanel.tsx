import { ArrowUpRight, Check, Download, LoaderCircle, Star, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { FadeInOut, Presence } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import "./ReaderPanels.css";

type ReaderInfoPanelProps = {
  open: boolean;
  title: string;
  coverSrc: string | null;
  tags: { id: number; type: string; display: string }[];
  progressPercent: number;
  isRemote: boolean;
  importing: boolean;
  queued: boolean;
  completed: boolean;
  workId: number | null;
  galleryId: number | null;
  returnTo: string;
  onMarkCompleted: () => void;
  onImport: () => void;
  onClose: () => void;
  onHoverChange: (hovering: boolean) => void;
};

export function ReaderInfoPanel({
  open,
  title,
  coverSrc,
  tags,
  progressPercent,
  isRemote,
  importing,
  queued,
  completed,
  workId,
  galleryId,
  returnTo,
  onMarkCompleted,
  onImport,
  onClose,
  onHoverChange,
}: ReaderInfoPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  return (
    <Presence>
      {open ? (
        <FadeInOut
          x={22}
          className="reader-chrome reader-panel reader-info-panel"
          role="dialog"
          aria-label="作品信息"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <header className="reader-panel-head">
            <span><small>READER INDEX</small><strong>作品信息</strong></span>
            <button ref={closeButton} type="button" onClick={onClose} aria-label="关闭作品信息"><X size={17} /></button>
          </header>

          <div className="reader-info-meta">
            {coverSrc ? <div className="reader-info-cover"><img src={coverSrc} alt="" draggable={false} /></div> : null}
            <h2>{title}</h2>
            <div className="reader-info-progress">
              <span><strong>{progressPercent}%</strong><small>{isRemote ? "远端只读预览" : "本地阅读进度"}</small></span>
              <i><span style={{ width: `${progressPercent}%` }} /></i>
            </div>
            {isRemote ? <p>远端预览不会保存阅读位置；入库后可持续记录进度。</p> : null}
            {tags.length > 0 ? (
              <ul className="reader-info-tags">
                {tags.map((tag) => <li key={tag.id} data-type={tag.type}>{tag.display}</li>)}
              </ul>
            ) : null}
          </div>

          <div className="reader-info-actions">
            {!isRemote ? (
              <button type="button" onClick={onMarkCompleted} disabled={completed}>
                {completed ? <Check size={16} /> : <Star size={16} />}
                <span>{completed ? "已标记读完" : "标记为已读"}</span>
              </button>
            ) : (
              <button type="button" onClick={onImport} disabled={importing || queued} aria-busy={importing}>
                {importing ? <LoaderCircle className="reader-loading-icon" size={16} /> : queued ? <Check size={16} /> : <Download size={16} />}
                <span>{queued ? "已加入导入队列" : importing ? "正在加入" : "加入导入队列"}</span>
              </button>
            )}
            {galleryId != null ? (
              <button type="button" onClick={() => navigate({ name: "gallery", galleryId, returnTo })}>
                <span>查看作品展示页</span><ArrowUpRight size={14} />
              </button>
            ) : null}
            {!isRemote && workId != null ? <button type="button" onClick={() => navigate({ name: "governance", workId })}>进入元数据治理</button> : null}
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
