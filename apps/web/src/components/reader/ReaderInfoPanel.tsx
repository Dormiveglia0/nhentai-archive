import { ArrowUpRight, Check, Download, Heart, LoaderCircle, Star, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { FadeInOut, Presence } from "../../lib/motion";
import { pageHref, tagSearchHref } from "../../lib/navigation";
import { AmbientCover } from "../folio/ui/AmbientCover";
import "./ReaderPanels.css";

type ReaderInfoPanelProps = {
  open: boolean;
  title: string;
  coverSrc: string | null;
  tags: { id: number; type: string; name?: string; slug?: string; display: string }[];
  progressPercent: number;
  isRemote: boolean;
  importing: boolean;
  queued: boolean;
  completed: boolean;
  favorite: boolean;
  workId: number | null;
  galleryId: number | null;
  returnTo: string;
  onMarkCompleted: () => void;
  onToggleFavorite: () => void;
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
  favorite,
  workId,
  galleryId,
  returnTo,
  onMarkCompleted,
  onToggleFavorite,
  onImport,
  onClose,
  onHoverChange,
}: ReaderInfoPanelProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const tagGroups = READER_TAG_GROUPS.map((group) => ({
    ...group,
    tags: tags.filter((tag) => group.types.includes(tag.type)),
  })).filter((group) => group.tags.length);

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
            {coverSrc ? (
              <div className="reader-info-cover">
                <AmbientCover className="reader-info-cover-artwork" src={coverSrc} alt="" draggable={false} />
              </div>
            ) : null}
            <h2>{title}</h2>
            <div className="reader-info-progress">
              <span><strong>{progressPercent}%</strong><small>{isRemote ? "远端只读预览" : "本地阅读进度"}</small></span>
              <i><span style={{ width: `${progressPercent}%` }} /></i>
            </div>
            {isRemote ? <p>远端预览不会保存阅读位置；入库后可持续记录进度。</p> : null}
            {tagGroups.length ? (
              <div className="reader-info-tag-groups">
                {tagGroups.map((group) => (
                  <section key={group.label}>
                    <small>{group.label}</small>
                    <ul>
                      {group.tags.map((tag) => (
                        <li key={`${tag.type}-${tag.id}-${tag.display}`} data-type={tag.type}>
                          <a href={tagSearchHref(tag)}>{tag.display}</a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}
          </div>

          <div className="reader-info-actions">
            {!isRemote ? (
              <>
                <button type="button" onClick={onMarkCompleted} disabled={completed}>
                  {completed ? <Check size={16} /> : <Star size={16} />}
                  <span>{completed ? "已标记读完" : "标记为已读"}</span>
                </button>
                <button className={favorite ? "is-favorite" : ""} type="button" onClick={onToggleFavorite} aria-pressed={favorite}>
                  <Heart size={16} fill={favorite ? "currentColor" : "none"} />
                  <span>{favorite ? "已收藏" : "收藏作品"}</span>
                </button>
              </>
            ) : (
              <button type="button" onClick={onImport} disabled={importing || queued} aria-busy={importing}>
                {importing ? <LoaderCircle className="reader-loading-icon" size={16} /> : queued ? <Check size={16} /> : <Download size={16} />}
                <span>{queued ? "已加入导入队列" : importing ? "正在加入" : "加入导入队列"}</span>
              </button>
            )}
            {galleryId != null ? (
              <a href={pageHref({ name: "gallery", galleryId, returnTo })}>
                <span>查看作品展示页</span><ArrowUpRight size={14} />
              </a>
            ) : null}
            {!isRemote && workId != null ? <a href={pageHref({ name: "governance", workId })}>进入元数据治理</a> : null}
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}

const READER_TAG_GROUPS = [
  { label: "作者 / 社团", types: ["artist", "group"] },
  { label: "原作 / 角色", types: ["parody", "character"] },
  { label: "内容标签", types: ["tag"] },
  { label: "分类 / 语言", types: ["category", "language"] },
];
