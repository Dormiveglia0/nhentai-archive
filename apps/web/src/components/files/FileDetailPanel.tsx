import { ArrowUpRight, BookOpen, Check, Clipboard, Download, FileQuestion, Images, PenLine, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { FileEntry } from "../../lib/api";
import { SelectionStage } from "../../lib/motion";
import { pageHref, tagSearchHref } from "../../lib/navigation";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { entryStatusLabel, entryStatusTone, formatBytes, kindLabel } from "./fileHelpers";

type Props = {
  focus: FileEntry | null;
  blurCovers: boolean;
  busy: boolean;
  onClose: () => void;
  onDelete: (entry: FileEntry) => void;
};

function shortTime(value?: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export function FileDetailPanel({ focus, blurCovers, busy, onClose, onDelete }: Props) {
  return (
    <section className={`folio-files-detail${focus ? " is-active" : ""}`} aria-label="文件详情">
      <header className="folio-files-column-head">
        <h2>文件详情</h2>
        <button className="folio-files-detail-close" type="button" onClick={onClose} aria-label="关闭文件详情"><X size={17} /></button>
      </header>

      <SelectionStage selection={focus?.id ?? null}>
        {focus ? <FileDetail focus={focus} blurCovers={blurCovers} busy={busy} onClose={onClose} onDelete={onDelete} /> : <FolioEmptyState icon={FileQuestion} title="尚未选择文件" copy="选择文件以查看路径、状态和可用操作。" />}
      </SelectionStage>
    </section>
  );
}

function FileDetail({ focus, blurCovers, busy, onDelete }: Props & { focus: FileEntry }) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const isWork = focus.kind === "work";
  const title = isWork ? focus.title ?? "(无标题)" : focus.name ?? "(未命名)";
  const path = (isWork ? focus.source_path : focus.path) ?? "—";
  const tone = entryStatusTone(focus);

  useEffect(() => setCopyState("idle"), [focus.id]);

  async function copyPath() {
    if (path === "—") return;
    try {
      await navigator.clipboard.writeText(path);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  }

  const fields = isWork
    ? [
        { label: "文件大小", value: formatBytes(focus.size_bytes) },
        { label: "页数", value: String(focus.page_count ?? 0) },
        { label: "修改时间", value: shortTime(focus.updated_at) },
        { label: "来源", value: focus.source ?? "—" },
        { label: "关联 ID", value: focus.remote_gallery_id ? String(focus.remote_gallery_id) : "—" },
      ]
    : [
        { label: "文件大小", value: formatBytes(focus.size_bytes) },
        { label: "类型", value: kindLabel(focus.kind) },
        { label: "目录", value: focus.dir ?? "—" },
        { label: "状态", value: entryStatusLabel(focus) },
      ];

  return (
    <div className="folio-files-detail-content">
      <div className="folio-files-detail-primary">
        <div className="folio-files-detail-cover">
          {isWork && focus.cover_path && focus.work_id ? (
            <img
              className={blurCovers ? "folio-media-blurred" : ""}
              src={"/api/works/" + focus.work_id + "/cover"}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span>{isWork ? "无封面" : kindLabel(focus.kind)}</span>
          )}
        </div>
        <div className="folio-files-detail-copy">
          <p><span className={"folio-files-status is-" + tone}>{entryStatusLabel(focus)}</span>{kindLabel(focus.kind)}</p>
          <h3>{title}</h3>
          <small title={path}>{path}</small>
        </div>
      </div>

      <div className="folio-files-detail-actions">
        {isWork && focus.work_id ? (
          <>
            <a href={pageHref({ name: "reader", workId: focus.work_id })}>
              <BookOpen size={15} />开始阅读<ArrowUpRight size={13} />
            </a>
            {focus.remote_gallery_id ? (
              <a href={pageHref({ name: "gallery", galleryId: focus.remote_gallery_id, returnTo: "files" })}>
                <Images size={15} />作品展示<ArrowUpRight size={13} />
              </a>
            ) : null}
            <a href={pageHref({ name: "governance", workId: focus.work_id })}>
              <PenLine size={15} />进入治理<ArrowUpRight size={13} />
            </a>
            <a href={pageHref({ name: "export", workId: focus.work_id })}>
              <Download size={15} />进入导出<ArrowUpRight size={13} />
            </a>
          </>
        ) : null}
        <button type="button" onClick={() => void copyPath()} disabled={path === "—"} aria-live="polite">
          {copyState === "done" ? <Check size={15} /> : <Clipboard size={15} />}
          {copyState === "done" ? "已复制路径" : copyState === "error" ? "复制失败" : "复制路径"}
        </button>
        <button type="button" className="is-danger" onClick={() => onDelete(focus)} disabled={busy}>
          <Trash2 size={15} />预览删除影响
        </button>
      </div>

      <dl className="folio-files-detail-grid">
        {fields.map((field) => (
          <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>
        ))}
      </dl>

      {isWork ? (
        <div className="folio-files-tags">
          <span>标签</span>
          <div>
            {focus.tag_items?.length
              ? focus.tag_items.map((tag) => <a key={`${tag.type}-${tag.id}-${tag.display}`} href={tagSearchHref(tag)}>{tag.display}</a>)
              : focus.tags?.length
                ? focus.tags.map((tag) => <a key={tag} href={tagSearchHref({ display: tag })}>{tag}</a>)
                : <small>无标签</small>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
