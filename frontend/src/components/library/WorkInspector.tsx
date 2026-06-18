import { BookOpen, Download, Info, PenTool, X } from "lucide-react";

import { LibraryTag, LibraryWork } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { authorLine, formatBytes, languageLabel, readStatusLabel, workTitle } from "./libraryHelpers";

type Props = {
  work: LibraryWork | null;
  blurCovers: boolean;
  onClose: () => void;
  onPickTag: (tag: LibraryTag) => void;
};

export function WorkInspector({ work, blurCovers, onClose, onPickTag }: Props) {
  if (!work) {
    return (
      <aside className="work-inspector">
        <FadeIn key="empty" y={8}>
          <div className="empty-state compact">
            <Info size={20} />
            <strong>作品详情</strong>
            <p>选择封面后显示文件信息、标签与阅读进度。</p>
          </div>
        </FadeIn>
      </aside>
    );
  }

  const status = readStatusLabel(work);
  const tags = work.tags ?? [];

  return (
    <aside className="work-inspector">
      <FadeIn key={work.id} y={8}>
      <div className="inspector-head">
        <span className={`status-pill ${status.tone}`}>{status.label}</span>
        <button type="button" className="inspector-close" onClick={onClose} aria-label="关闭详情">
          <X size={15} />
        </button>
      </div>

      <div className="inspector-cover">
        {work.cover_path ? (
          <img className={blurCovers ? "blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" />
        ) : (
          <span className="cover-fallback">NO COVER</span>
        )}
      </div>

      <h2 title={workTitle(work)}>{workTitle(work)}</h2>
      <p className="inspector-author">{authorLine(work)}</p>

      <dl className="inspector-facts">
        <div>
          <dt>文件信息</dt>
          <dd>{formatBytes(work.size_bytes)} · {work.page_count} 页</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{work.source === "remote" ? "远端入库" : "本地导入"}{work.remote_gallery_id ? ` · ID ${work.remote_gallery_id}` : ""}</dd>
        </div>
        <div>
          <dt>语言</dt>
          <dd>{languageLabel(work)}</dd>
        </div>
        <div>
          <dt>阅读进度</dt>
          <dd>{work.progress_percent ?? 0}%（第 {work.reader_page_index || 0} / {work.page_count} 页）</dd>
        </div>
      </dl>

      {tags.length ? (
        <div className="inspector-tags">
          <span className="inspector-section-label">标签 {work.tag_count ?? tags.length}</span>
          <div className="inspector-tag-wrap">
            {tags.slice(0, 18).map((tag) => (
              <button key={tag.id} type="button" onClick={() => onPickTag(tag)}>
                {tag.display}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="inspector-empty-tags">该作品暂无缓存标签，可在治理/词典模块补充。</p>
      )}

      <button className="primary-wide" type="button" onClick={() => navigate({ name: "reader", workId: work.id })}>
        <BookOpen size={17} />
        {(work.progress_percent ?? 0) > 0 && !work.completed ? "继续阅读" : "开始阅读"}
      </button>
      <button className="secondary-wide" type="button" onClick={() => navigate({ name: "governance", workId: work.id })}>
        <PenTool size={16} />
        进入治理
      </button>
      <button className="secondary-wide" type="button" disabled title="导出中心未接入">
        <Download size={16} />
        导出 CBZ（未接入）
      </button>
      </FadeIn>
    </aside>
  );
}
