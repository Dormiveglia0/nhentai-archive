import { BookOpen, Check } from "lucide-react";

import { LibraryTag, LibraryWork } from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { TagScroller } from "../discover/TagScroller";
import { LibraryView } from "./LibraryToolbar";
import { authorLine, languageLabel, readStatusLabel, workTitle } from "./libraryHelpers";

type Props = {
  work: LibraryWork;
  view: LibraryView;
  blurCovers: boolean;
  selected: boolean;
  onSelect: () => void;
  onPickTag: (tag: LibraryTag) => void;
};

export function WorkCard({ work, view, blurCovers, selected, onSelect, onPickTag }: Props) {
  const status = readStatusLabel(work);
  const title = workTitle(work);

  return (
    <article className={`library-card ${view === "list" ? "list-card" : ""} ${selected ? "selected" : ""}`.trim()}>
      <button
        type="button"
        className="library-cover"
        onClick={onSelect}
        onDoubleClick={() => navigate({ name: "reader", workId: work.id })}
      >
        {work.cover_path ? (
          <img className={blurCovers ? "blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" loading="lazy" />
        ) : (
          <span className="cover-fallback">NO COVER</span>
        )}
        {work.completed ? (
          <span className="library-read-badge" aria-label="已读">
            <Check size={13} />
          </span>
        ) : null}
        <span className={`status-pill ${status.tone}`}>{status.label}</span>
      </button>
      <div
        className="library-card-body"
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => event.key === "Enter" && onSelect()}
      >
        <div className="card-meta">
          <span>{work.source === "remote" ? "远端" : "本地"}</span>
          <em>{languageLabel(work)}</em>
        </div>
        <h3 title={title}>{title}</h3>
        <p title={authorLine(work)}>{authorLine(work)}</p>
        <small>
          {work.page_count} 页{work.remote_gallery_id ? ` · ID ${work.remote_gallery_id}` : ""}
        </small>
        <progress max={100} value={work.progress_percent ?? 0} />
        <TagScroller tags={(work.tags ?? []) as LibraryTag[]} onPickTag={(tag) => onPickTag(tag as LibraryTag)} />
        <div className="card-actions">
          <button type="button" onClick={(event) => { event.stopPropagation(); navigate({ name: "reader", workId: work.id }); }}>
            <BookOpen size={15} />
            {(work.progress_percent ?? 0) > 0 && !work.completed ? "继续阅读" : "开始阅读"}
          </button>
        </div>
      </div>
    </article>
  );
}
