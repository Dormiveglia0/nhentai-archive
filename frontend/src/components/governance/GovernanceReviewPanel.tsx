import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, ShieldCheck } from "lucide-react";

import type { GovernanceAggregate } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";

type Props = {
  aggregate: GovernanceAggregate;
  changedCount: number;
  busy: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onReview: (action: "approve" | "reopen") => void;
};

export function GovernanceReviewPanel({ aggregate, changedCount, busy, note, onNoteChange, onReview }: Props) {
  const review = aggregate.review;
  const approved = review.state === "approved";
  const issueCount = aggregate.automatic_issues.length;

  return (
    <section className="folio-governance-review" aria-labelledby="governance-review-title">
      <header className="folio-governance-review-head">
        <div>
          <span>Automatic checks + human review</span>
          <h2 id="governance-review-title">检查与核对</h2>
          <p>系统只负责发现规则问题；“已核对”必须由你确认当前版本，并留下时间记录。</p>
        </div>
        <div className="folio-governance-review-badge" data-state={review.state}>
          {approved ? <CheckCircle2 size={17} /> : review.state === "stale" ? <AlertTriangle size={17} /> : <Clock3 size={17} />}
          <span>{reviewLabel(review.state)}</span>
        </div>
      </header>

      <Stagger className="folio-governance-check-grid">
        {aggregate.checks.map((check) => (
          <StaggerItem key={check.key}>
            <article className="folio-governance-check-card" data-status={check.status}>
              <header>
                <span>{check.label}</span>
                <strong>{check.issues.length ? `${check.issues.length} 项提示` : "自动检查通过"}</strong>
              </header>
              <p>{check.description}</p>
              {check.issues.length ? (
                <ul>
                  {check.issues.map((issue) => <li key={issue.code}>{issue.label}</li>)}
                </ul>
              ) : (
                <div className="folio-governance-check-pass"><CheckCircle2 size={14} />当前未发现规则问题</div>
              )}
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="folio-governance-review-decision">
        <div className="folio-governance-review-copy">
          <ShieldCheck size={20} />
          <div>
            <strong>{approved ? "当前数据快照已人工核对" : review.state === "stale" ? "核对记录已失效" : "等待人工核对"}</strong>
            <p>
              {approved
                ? `${formatReviewTime(review.reviewed_at)} 已确认。${issueCount ? `当前仍有 ${issueCount} 项系统提示，视为已在本次核对中知悉。` : "当前没有系统提示。"}`
                : review.state === "stale"
                  ? "核对后字段、词典或文件发生了变化，请重新检查并确认新版本。"
                  : "检查字段取舍、词典映射和文件状态后，再确认当前版本。"}
            </p>
            {approved && review.note ? <blockquote>{review.note}</blockquote> : null}
          </div>
        </div>

        {approved ? (
          <button className="folio-governance-review-reopen" type="button" disabled={busy} onClick={() => onReview("reopen")}>
            <RotateCcw size={14} />撤销核对
          </button>
        ) : (
          <div className="folio-governance-review-form">
            <label>
              <span>审核备注（可选）</span>
              <textarea
                rows={2}
                maxLength={1000}
                value={note}
                placeholder="记录保留差异、暂不修复的原因或下一步"
                onChange={(event) => onNoteChange(event.target.value)}
              />
            </label>
            <button type="button" disabled={busy || changedCount > 0 || (issueCount > 0 && !note.trim())} onClick={() => onReview("approve")}>
              <ShieldCheck size={15} />
              {busy ? "记录中…" : review.state === "stale" ? "重新核对当前版本" : "确认当前版本已核对"}
            </button>
            {changedCount ? <small>还有 {changedCount} 项字段修改未保存，保存后才能核对。</small> : null}
            {!changedCount && issueCount > 0 && !note.trim() ? <small>仍有系统提示，请在备注中说明保留或延期处理的原因。</small> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function reviewLabel(state: GovernanceAggregate["review"]["state"]) {
  if (state === "approved") return "已人工核对";
  if (state === "stale") return "内容变化 · 需重审";
  return "尚未人工核对";
}

function formatReviewTime(value?: string | null) {
  if (!value) return "此前";
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
