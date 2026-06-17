import { useEffect, useState } from "react";

import { DictionaryApplyPayload, DictionaryEvidence, DictionaryPreview } from "../../lib/api";

type Props = {
  evidence: DictionaryEvidence | null;
  loading: boolean;
  preview: DictionaryPreview | null;
  form: DictionaryApplyPayload;
};

const TABS = [
  ["impact", "应用影响"],
  ["works", "关联作品"],
  ["tags", "搭配与标签"],
  ["remote", "远端信息"],
  ["history", "历史记录"],
] as const;

export function DictionaryEvidencePanel({ evidence, loading, preview, form }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("impact");

  useEffect(() => {
    if (preview) setTab("impact");
  }, [preview]);

  return (
    <section className="dictionary-pane evidence-panel">
      <header className="dictionary-pane-head">
        <div>
          <h2>证据与应用预览</h2>
          <span>{loading ? "读取证据..." : evidence?.remote_tag ? "真实远端信息与影响范围" : "选择候选后显示"}</span>
        </div>
      </header>
      <nav className="evidence-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "impact" ? <ApplyImpact preview={preview} form={form} /> : null}
      {tab === "works" ? <RelatedWorks evidence={evidence} /> : null}
      {tab === "tags" ? <CoTags evidence={evidence} /> : null}
      {tab === "remote" ? <RemoteInfo evidence={evidence} /> : null}
      {tab === "history" ? <History evidence={evidence} /> : null}
    </section>
  );
}

function ApplyImpact({ preview, form }: { preview: DictionaryPreview | null; form: DictionaryApplyPayload }) {
  if (!preview) {
    return <Empty text="在编辑器点击「预览影响」后，这里显示将更新的标签、受影响作品与潜在冲突。" />;
  }
  return (
    <div className="impact-view">
      <div className="preview-metrics">
        <Metric label="将更新标签" value={preview.will_update_tags} />
        <Metric label="将影响作品" value={preview.will_update_works} />
        <Metric label="潜在冲突" value={preview.conflicts.length} danger={preview.conflicts.length > 0} />
        <Metric label="忽略项" value={preview.ignored} />
      </div>
      <div className="preview-detail-grid">
        <section>
          <h3>受影响作品</h3>
          {preview.samples.length ? (
            preview.samples.map((work) => (
              <p key={work.id}>
                <strong>{work.title_japanese || work.title}</strong>
                <span>{work.page_count}P</span>
              </p>
            ))
          ) : (
            <em>暂无真实作品受影响。</em>
          )}
        </section>
        <section>
          <h3>标签更新对比</h3>
          <div className="tag-diff">
            <span>{form.original_text || "原文"}</span>
            <b>→</b>
            <strong>{form.zh_name || "中文名"}</strong>
          </div>
          {(form.aliases ?? []).map((alias) => (
            <small key={alias}>别名：{alias}</small>
          ))}
        </section>
        <section>
          <h3>冲突项</h3>
          {preview.conflicts.length ? (
            preview.conflicts.map((conflict, index) => (
              <p key={`${conflict.type}-${index}`} className="conflict-row">
                {conflict.message}
              </p>
            ))
          ) : (
            <em>未发现冲突。</em>
          )}
        </section>
      </div>
    </div>
  );
}

function RelatedWorks({ evidence }: { evidence: DictionaryEvidence | null }) {
  if (!evidence?.related_works.length) return <Empty text="暂无真实关联作品。" />;
  return (
    <div className="evidence-work-grid">
      {evidence.related_works.map((work) => (
        <article key={work.id}>
          {work.cover_path ? <img src={`/api/works/${work.id}/cover`} alt="" /> : <div />}
          <strong title={work.title_japanese || work.title}>{work.title_japanese || work.title}</strong>
          <span>
            {work.remote_gallery_id ? `ID ${work.remote_gallery_id}` : "本地"} · {work.page_count}P
          </span>
        </article>
      ))}
    </div>
  );
}

function CoTags({ evidence }: { evidence: DictionaryEvidence | null }) {
  if (!evidence?.co_tags.length) return <Empty text="暂无真实搭配 tag。" />;
  return (
    <div className="co-tag-list">
      {evidence.co_tags.map((tag) => (
        <span key={tag.id}>
          {tag.display}
          <b>{tag.count}</b>
        </span>
      ))}
    </div>
  );
}

function RemoteInfo({ evidence }: { evidence: DictionaryEvidence | null }) {
  const tag = evidence?.remote_tag;
  if (!tag) return <Empty text="暂无远端 tag 信息。" />;
  return (
    <dl className="remote-info">
      <div>
        <dt>远端 ID</dt>
        <dd>{tag.id}</dd>
      </div>
      <div>
        <dt>类型</dt>
        <dd>{tag.type || "tag"}</dd>
      </div>
      <div>
        <dt>原词</dt>
        <dd>{tag.name || "-"}</dd>
      </div>
      <div>
        <dt>Slug</dt>
        <dd>{tag.slug || "-"}</dd>
      </div>
    </dl>
  );
}

function History({ evidence }: { evidence: DictionaryEvidence | null }) {
  if (!evidence?.history.length) return <Empty text="暂无真实历史记录。" />;
  return (
    <div className="history-list">
      {evidence.history.map((item, index) => (
        <p key={`${item.status}-${index}`}>
          <strong>{item.message}</strong>
          <span>
            {item.source} · {item.updated_at}
          </span>
        </p>
      ))}
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={danger ? "danger" : ""}>{value}</strong>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="dictionary-empty">{text}</div>;
}
