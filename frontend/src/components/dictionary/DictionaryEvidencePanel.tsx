import { DictionaryApplyPayload, DictionaryEvidence, DictionaryPreview } from "../../lib/api";
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
  const contextKey = hasContext
    ? `${remote?.id ?? "local"}:${preview?.will_update_tags ?? 0}:${preview?.will_update_works ?? 0}:${form.original_text}:${form.zh_name}`
    : "empty";
  const worksKey = relatedWorks.map((work) => work.id).join(":") || "none";

  return (
    <section className="dictionary-pane preview-pane">
      <header className="dictionary-pane-head">
        <div>
          <h2>应用预览</h2>
          <span>{loading ? "读取中..." : "基于当前编辑内容，写入前确认影响范围与证据。"}</span>
        </div>
      </header>

      {!hasContext ? (
        <FadeIn key="empty" y={8}>
          <div className="dictionary-empty">选择候选词条并点击「预览影响」后，这里显示影响范围、关联作品与冲突。</div>
        </FadeIn>
      ) : (
        <FadeIn key={contextKey} y={8}>
            <div className="preview-metrics">
              <Metric label="将更新标签" value={preview?.will_update_tags ?? 0} />
              <Metric label="将影响作品" value={preview?.will_update_works ?? 0} />
              <Metric label="潜在冲突" value={conflicts.length} danger={conflicts.length > 0} />
              <Metric label="忽略项" value={preview?.ignored ?? 0} />
            </div>

            <div className="preview-split">
              <section>
                <h3>标签更新对比</h3>
                <div className="tag-diff">
                  <span>{form.original_text || "原文"}</span>
                  <b>→</b>
                  <strong>{form.zh_name || "中文名"}</strong>
                </div>
                {aliases.length ? aliases.map((alias) => <small key={alias}>别名：{alias}</small>) : <em>无别名</em>}
              </section>

              <section>
                <h3>常见搭配</h3>
                {coTags.length ? (
                  <div className="co-tag-list">
                    {coTags.map((tag) => (
                      <span key={tag.id}>
                        {tag.display}
                        <b>{tag.count}</b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <em>暂无真实搭配 tag。</em>
                )}
              </section>

              <section>
                <h3>冲突项</h3>
                {conflicts.length ? (
                  conflicts.map((conflict, index) => (
                    <p key={`${conflict.type}-${index}`} className="conflict-row">
                      {conflict.message}
                    </p>
                  ))
                ) : (
                  <em>未发现冲突。</em>
                )}
              </section>

              <section>
                <h3>远端信息</h3>
                {remote ? (
                  <dl className="remote-info">
                    <div>
                      <dt>远端 ID</dt>
                      <dd>{remote.id}</dd>
                    </div>
                    <div>
                      <dt>类型</dt>
                      <dd>{remote.type || "tag"}</dd>
                    </div>
                    <div>
                      <dt>原词</dt>
                      <dd>{remote.name || "-"}</dd>
                    </div>
                  </dl>
                ) : (
                  <em>本地词条，无远端映射。</em>
                )}
              </section>
            </div>

            <section className="preview-works">
              <h3>关联作品</h3>
              {relatedWorks.length ? (
                <Stagger key={worksKey} className="evidence-work-grid">
                  {relatedWorks.map((work) => (
                    <StaggerItem key={work.id} className="evidence-work-cell">
                      <article>
                        {work.cover_path ? <img src={`/api/works/${work.id}/cover`} alt="" /> : <div />}
                        <strong title={work.title_japanese || work.title}>{work.title_japanese || work.title}</strong>
                        <span>
                          {work.remote_gallery_id ? `ID ${work.remote_gallery_id}` : "本地"} · {work.page_count}P
                        </span>
                      </article>
                    </StaggerItem>
                  ))}
                </Stagger>
              ) : (
                <em className="preview-works-empty">暂无真实关联作品。</em>
              )}
            </section>
        </FadeIn>
      )}
    </section>
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
