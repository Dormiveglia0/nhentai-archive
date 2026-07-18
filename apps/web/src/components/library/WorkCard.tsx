import { BookOpen, Check } from "lucide-react";

import type { LibraryTag, LibraryWork } from "../../lib/api";
import { navigate, pageHref } from "../../lib/navigation";
import { TagScroller } from "../folio/ui/TagScroller";
import type { LibraryView } from "./LibraryToolbar";
import { authorLine, languageLabel, readStatusLabel, workTitle } from "./libraryHelpers";

type Props = {
  work: LibraryWork;
  view: LibraryView;
  blurCovers: boolean;
  selected: boolean;
  onSelect: () => void;
  onPickTag: (tag: LibraryTag) => void;
  multiSelect?: boolean;
  checked?: boolean;
  onToggle?: () => void;
};

export function WorkCard({
  work,
  view,
  blurCovers,
  selected,
  onSelect,
  onPickTag,
  multiSelect = false,
  checked = false,
  onToggle,
}: Props) {
  const status = readStatusLabel(work);
  const title = workTitle(work);
  const progress = work.progress_percent ?? 0;
  const contentTags = (work.tags ?? []).filter((tag) => tag.type === "tag");
  const select = multiSelect ? (onToggle ?? onSelect) : onSelect;
  const readerHref = pageHref({ name: "reader", workId: work.id });
  const selectCurrent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select();
  };
  const className = [
    "folio-library-card",
    view === "list" ? "is-list" : "",
    selected ? "is-selected" : "",
    multiSelect && checked ? "is-batch-selected" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={className}>
      <a
        href={readerHref}
        className="folio-library-cover"
        onClick={selectCurrent}
        onDoubleClick={() => {
          if (!multiSelect) navigate({ name: "reader", workId: work.id });
        }}
        aria-label={multiSelect ? `${checked ? "取消选择" : "选择"}${title}` : `查看${title}的详情`}
      >
        {multiSelect ? (
          <span className={checked ? "folio-library-check is-on" : "folio-library-check"} aria-hidden="true">
            {checked ? <Check size={14} /> : null}
          </span>
        ) : null}
        {work.cover_path ? (
          <img className={blurCovers ? "folio-media-blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" loading="lazy" />
        ) : (
          <span className="folio-cover-fallback">NO COVER</span>
        )}
        {work.completed ? <span className="folio-library-read-mark" aria-label="已读"><Check size={13} /></span> : null}
        <span className={`folio-library-status tone-${status.tone}`}>{status.label}</span>
      </a>

      <div className="folio-library-card-body">
        <div className="folio-library-card-meta">
          <span>{work.source === "remote" ? "远端入库" : "本地导入"}</span>
          <em>{languageLabel(work)}</em>
        </div>

        <a href={readerHref} className="folio-library-card-title" onClick={selectCurrent}>
          {title}
        </a>
        <p title={authorLine(work)}>{authorLine(work)}</p>
        <small>{work.page_count} 页{work.remote_gallery_id ? ` · Gallery ${work.remote_gallery_id}` : ""}</small>

        <div
          className="folio-library-progress"
          role="progressbar"
          aria-label="阅读进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        <TagScroller
          className="folio-library-card-tags"
          tags={contentTags as LibraryTag[]}
          emptyLabel="暂无内容 Tag"
          onPickTag={(tag) => onPickTag(tag as LibraryTag)}
        />

        <a className="folio-library-read-action" href={readerHref}>
          <BookOpen size={15} />
          {progress > 0 && !work.completed ? "继续阅读" : "开始阅读"}
        </a>
      </div>
    </article>
  );
}
