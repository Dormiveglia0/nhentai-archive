import { useState } from "react";

import { DictionaryEvidence } from "../../lib/api";

type Props = {
  evidence: DictionaryEvidence | null;
  loading: boolean;
};

const TABS = [
  ["works", "关联作品"],
  ["tags", "搭配与标签"],
  ["remote", "远端信息"],
  ["history", "历史记录"],
] as const;

export function DictionaryEvidencePanel({ evidence, loading }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("works");

  return (
    <section className="dictionary-pane evidence-panel">
      <header className="dictionary-pane-head">
        <div>
          <h2>证据面板</h2>
          <span>{loading ? "读取证据..." : evidence?.remote_tag ? "真实远端信息" : "未选择候选"}</span>
        </div>
      </header>
      <nav className="evidence-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "works" ? <RelatedWorks evidence={evidence} /> : null}
      {tab === "tags" ? <CoTags evidence={evidence} /> : null}
      {tab === "remote" ? <RemoteInfo evidence={evidence} /> : null}
      {tab === "history" ? <History evidence={evidence} /> : null}
    </section>
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

function Empty({ text }: { text: string }) {
  return <div className="dictionary-empty">{text}</div>;
}
