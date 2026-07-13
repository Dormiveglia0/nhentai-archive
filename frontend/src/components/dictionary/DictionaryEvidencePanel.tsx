import { ArrowRight, BookOpen, Link2, ShieldAlert, Tags } from "lucide-react";

import type { DictionaryApplyPayload, DictionaryEvidence, DictionaryPreview } from "../../lib/api";
import { FadeIn, Stagger, StaggerItem } from "../../lib/motion";

type Props = {
  evidence: DictionaryEvidence | null;
  loading: boolean;
  preview: DictionaryPreview | null;
  form: DictionaryApplyPayload;
};

export function DictionaryEvidencePanel({ evidence, loading, preview, form }: Props) {
  const remote = evidence?.remote_tag ?? null;
  const relatedWorks = evidence?.related_works ?? [];
  const coTags = evidence?.co_tags ?? [];
  const conflicts = preview?.conflicts ?? [];
  const aliases = form.aliases ?? [];
  const hasContext = Boolean(preview || remote || relatedWorks.length || coTags.length);
  const contextKey = `${remote?.id ?? "local"}:${preview?.will_update_tags ?? 0}:${preview?.will_update_works ?? 0}:${form.original_text}:${form.zh_name}`;

  return (
    <section className="folio-dictionary-evidence" aria-labelledby="folio-dictionary-evidence-title">
      <header className="folio-dictionary-evidence-head">
        <div><BookOpen size={17} /><strong id="folio-dictionary-evidence-title">应用预览与证据</strong></div>
        <p>{loading ? "正在读取关联信息…" : "基于当前真实词条、远端标签与本地作品生成。"}</p>
      </header>

      {!hasContext ? (
        <FadeIn key="empty" className="folio-dictionary-evidence-empty" y={8}>
          <span aria-hidden="true"><i /><i /><i /></span>
          <p>选择候选或新建词条；点击「预览影响」后，这里会列出更新范围、冲突与关联作品。</p>
        </FadeIn>
      ) : (
        <FadeIn key={contextKey} className="folio-dictionary-evidence-body" y={8}>
          <div className="folio-dictionary-preview-metrics">
            <Metric label="将更新标签" value={preview ? preview.will_update_tags : "—"} />
            <Metric label="将影响作品" value={preview ? preview.will_update_works : "—"} />
            <Metric label="潜在冲突" value={preview ? conflicts.length : "—"} danger={conflicts.length > 0} />
            <Metric label="忽略项" value={preview ? preview.ignored : "—"} />
          </div>

          <div className="folio-dictionary-evidence-grid">
            <article className="folio-dictionary-diff-card">
              <header><Link2 size={15} /><h3>标签更新对比</h3></header>
              <div><span>{form.original_text || "原文"}</span><ArrowRight size={15} /><strong>{form.zh_name || "中文名"}</strong></div>
              <p>{aliases.length ? aliases.map((alias) => <span key={alias}>{alias}</span>) : <em>暂无别名</em>}</p>
            </article>

            <article>
              <header><Tags size={15} /><h3>常见搭配</h3></header>
              {coTags.length ? (
                <div className="folio-dictionary-co-tags">
                  {coTags.map((tag) => <span key={tag.id}>{tag.display}<b>{tag.count}</b></span>)}
                </div>
              ) : <em>暂无真实搭配标签。</em>}
            </article>

            <article>
              <header><ShieldAlert size={15} /><h3>冲突项</h3></header>
              {conflicts.length ? conflicts.map((conflict, index) => <p key={`${conflict.type}-${index}`} className="is-conflict">{conflict.message}</p>) : <em>未发现冲突。</em>}
            </article>

            <article>
              <header><Link2 size={15} /><h3>远端信息</h3></header>
              {remote ? (
                <dl>
                  <div><dt>远端 ID</dt><dd>{remote.id}</dd></div>
                  <div><dt>类型</dt><dd>{remote.type || "tag"}</dd></div>
                  <div><dt>原词</dt><dd>{remote.name || "—"}</dd></div>
                </dl>
              ) : <em>本地词条，无远端映射。</em>}
            </article>
          </div>

          <section className="folio-dictionary-related">
            <header><h3>关联作品</h3><span>{relatedWorks.length} 部真实作品</span></header>
            {relatedWorks.length ? (
              <Stagger className="folio-dictionary-work-grid">
                {relatedWorks.map((work) => (
                  <StaggerItem key={work.id} className="folio-dictionary-work-cell">
                    <article>
                      {work.cover_path ? <img src={`/api/works/${work.id}/cover`} alt="" loading="lazy" decoding="async" /> : <div aria-hidden="true" />}
                      <span><strong title={work.title_japanese || work.title}>{work.title_japanese || work.title}</strong><small>{work.remote_gallery_id ? `ID ${work.remote_gallery_id}` : "本地"} · {work.page_count}P</small></span>
                    </article>
                  </StaggerItem>
                ))}
              </Stagger>
            ) : <em className="folio-dictionary-related-empty">暂无真实关联作品。</em>}
          </section>
        </FadeIn>
      )}
    </section>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number | string; danger?: boolean }) {
  return <div><span>{label}</span><strong className={danger ? "is-danger" : ""}>{value}</strong></div>;
}
