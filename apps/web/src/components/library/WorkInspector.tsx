import { BookOpen, Download, Heart, Info, PenTool, X } from "lucide-react";

import type { LibraryTag, LibraryWork } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { pageHref, tagSearchHref } from "../../lib/navigation";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { WorkDeleteAction } from "../folio/ui/WorkDeleteAction";
import { authorLine, formatBytes, languageLabel, readStatusLabel, workTitle } from "./libraryHelpers";

type Props = {
  work: LibraryWork | null;
  blurCovers: boolean;
  onClose: () => void;
  onPickTag: (tag: LibraryTag) => void;
  onToggleFavorite: (work: LibraryWork) => void;
  onDeleted: () => void;
};

export function WorkInspector({ work, blurCovers, onClose, onPickTag, onToggleFavorite, onDeleted }: Props) {
  if (!work) {
    return (
      <aside className="folio-library-inspector is-empty" aria-label="作品详情">
        <FolioEmptyState
          icon={Info}
          title="选择一部作品"
          copy="这里会显示真实封面、来源、文件信息、阅读进度与本地标签。"
        />
      </aside>
    );
  }

  const status = readStatusLabel(work);
  const tags = work.tags ?? [];
  const title = workTitle(work);

  return (
    <>
      <button className="folio-library-inspector-backdrop" type="button" onClick={onClose} aria-label="关闭作品详情" />
      <aside className="folio-library-inspector is-open" aria-label={`${title}的详情`}>
        <FadeIn key={work.id} y={8}>
          <header className="folio-library-inspector-head">
            <span>Inspector</span>
            <strong className={`tone-${status.tone}`}>{status.label}</strong>
            <button type="button" onClick={onClose} aria-label="关闭详情"><X size={16} /></button>
          </header>

          <div className="folio-library-inspector-cover">
            {work.cover_path ? (
              <img className={blurCovers ? "folio-media-blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" />
            ) : (
              <span className="folio-cover-fallback">NO COVER</span>
            )}
          </div>

          <h2 title={title}>{title}</h2>
          <p className="folio-library-inspector-author">{authorLine(work)}</p>

          <dl className="folio-library-inspector-facts">
            <div><dt>文件</dt><dd>{formatBytes(work.size_bytes)} · {work.page_count} 页</dd></div>
            <div><dt>来源</dt><dd>{work.source === "remote" ? "远端入库" : "本地导入"}{work.remote_gallery_id ? ` · ${work.remote_gallery_id}` : ""}</dd></div>
            <div><dt>语言</dt><dd>{languageLabel(work)}</dd></div>
            <div><dt>阅读</dt><dd>{work.progress_percent ?? 0}% · 第 {work.reader_page_index || 0} 页</dd></div>
          </dl>

          {tags.length ? (
            <section className="folio-library-inspector-tags">
              <span>标签 · {work.tag_count ?? tags.length}</span>
              <div>
                {tags.slice(0, 18).map((tag) => (
                  <a
                    key={tag.id}
                    href={tagSearchHref(tag)}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onPickTag(tag);
                    }}
                  >{tag.display}</a>
                ))}
              </div>
            </section>
          ) : (
            <p className="folio-library-inspector-note">该作品暂无缓存标签，可在治理或词典模块补充。</p>
          )}

          <div className="folio-library-inspector-actions">
            <a className="is-primary" href={pageHref({ name: "reader", workId: work.id })}>
              <BookOpen size={17} />
              {(work.progress_percent ?? 0) > 0 && !work.completed ? "继续阅读" : "开始阅读"}
            </a>
            <a href={pageHref({ name: "governance", workId: work.id })}><PenTool size={16} />进入治理</a>
            <a href={pageHref({ name: "export", workId: work.id })}><Download size={16} />导出 CBZ</a>
            <button className={work.favorite ? "is-favorite" : ""} type="button" onClick={() => onToggleFavorite(work)} aria-pressed={work.favorite}>
              <Heart size={16} fill={work.favorite ? "currentColor" : "none"} />{work.favorite ? "已收藏" : "收藏作品"}
            </button>
            <WorkDeleteAction workId={work.id} title={title} onDeleted={onDeleted} />
          </div>
        </FadeIn>
      </aside>
    </>
  );
}
