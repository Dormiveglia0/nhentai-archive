import { Languages, RefreshCw, Upload } from "lucide-react";

import type { DictionaryCandidate } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { FolioSearchField, FolioSelect } from "../folio/ui/FolioPrimitives";

type Props = {
  query: string;
  typeFilter: string;
  status: string;
  candidates: DictionaryCandidate[];
  loading: boolean;
  suggesting: boolean;
  batchCount: number;
  selectedKey?: string | null;
  offset: number;
  limit: number;
  onQuery: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onStatus: (value: string) => void;
  onRefresh: () => void;
  onSuggest: () => void;
  onBulkImport: () => void;
  onSelect: (candidate: DictionaryCandidate) => void;
  onPage: (offset: number) => void;
  onLimit: (limit: number) => void;
};

const TYPE_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "tag", label: "标签" },
  { value: "artist", label: "作者" },
  { value: "group", label: "社团" },
  { value: "character", label: "角色" },
  { value: "parody", label: "原作" },
  { value: "language", label: "语言" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unconfigured", label: "未配置" },
  { value: "configured", label: "已配置" },
  { value: "suggested", label: "机器建议" },
  { value: "review", label: "待复核" },
  { value: "ignored", label: "已忽略" },
] as const;

const LIMIT_OPTIONS = [
  { value: "20", label: "20 条 / 页" },
  { value: "50", label: "50 条 / 页" },
  { value: "80", label: "80 条 / 页" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  tag: "标签",
  artist: "作者",
  group: "社团",
  character: "角色",
  parody: "原作",
  language: "语言",
  category: "分类",
};

export function DictionaryCandidatePool(props: Props) {
  const currentPage = Math.floor(props.offset / props.limit) + 1;

  return (
    <section className="folio-dictionary-candidates" aria-labelledby="folio-dictionary-candidate-title">
      <header className="folio-dictionary-panel-head">
        <div>
          <span>Candidate pool</span>
          <h2 id="folio-dictionary-candidate-title">候选术语池</h2>
          <p>{props.loading ? "正在读取真实缓存…" : `当前页 ${props.candidates.length} 项`}</p>
        </div>
        <div className="folio-dictionary-head-actions">
          <button className="folio-line-button" type="button" onClick={props.onBulkImport}>
            <Upload size={14} />
            批量导入
          </button>
          <button className="folio-dictionary-icon-button" type="button" onClick={props.onRefresh} aria-label="刷新候选">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="folio-dictionary-filters">
        <FolioSearchField value={props.query} onChange={props.onQuery} placeholder="搜索原文或中文词条" />
        <div className="folio-dictionary-filter-row">
          <FolioSelect label="类型" value={props.typeFilter} options={TYPE_OPTIONS} onChange={props.onTypeFilter} />
          <FolioSelect label="状态" value={props.status} options={STATUS_OPTIONS} onChange={props.onStatus} />
        </div>
        <button
          className="folio-dictionary-suggest"
          type="button"
          onClick={props.onSuggest}
          disabled={props.loading || props.suggesting || props.batchCount === 0}
        >
          <Languages size={15} />
          <span>{props.suggesting ? "生成建议中…" : `为当前候选生成建议${props.batchCount ? ` (${props.batchCount})` : ""}`}</span>
          <small>只生成待审核项，不直接应用到作品</small>
        </button>
      </div>

      <div className="folio-dictionary-table" aria-label="候选术语">
        <div className="folio-dictionary-table-head" aria-hidden="true">
          <span>原文</span>
          <span>建议翻译</span>
          <span>影响</span>
          <span>状态</span>
        </div>
        <Stagger className="folio-dictionary-row-list">
          {props.candidates.map((candidate) => {
            const label = candidate.name || candidate.slug || String(candidate.id ?? candidate.dictionary_id);
            const display = candidate.display && candidate.display !== label ? candidate.display : "未配置";
            const rowKey = candidateRowKey(candidate);
            return (
              <StaggerItem key={rowKey} className="folio-dictionary-row-motion">
                <button
                  type="button"
                  className={props.selectedKey === rowKey ? "folio-dictionary-row is-active" : "folio-dictionary-row"}
                  aria-pressed={props.selectedKey === rowKey}
                  onClick={() => props.onSelect(candidate)}
                >
                  <span className="folio-dictionary-term">
                    <i data-type={candidate.type || "tag"}>{typeLabel(candidate.type)}</i>
                    <strong title={label}>{label}</strong>
                  </span>
                  <span className={display === "未配置" ? "folio-dictionary-display is-muted" : "folio-dictionary-display"}>{display}</span>
                  <span className="folio-dictionary-impact">{candidate.impact_work_count ?? 0}</span>
                  <span className={`folio-dictionary-status is-${statusTone(candidate)}`}>
                    {candidate.ignored ? "已忽略" : candidate.configured ? statusLabel(candidate.status) : "待处理"}
                  </span>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
        {!props.loading && props.candidates.length === 0 ? (
          <div className="folio-dictionary-empty">暂无真实候选。先在发现页缓存远端标签，或使用批量导入创建本地词典。</div>
        ) : null}
      </div>

      <footer className="folio-dictionary-pager">
        <span>第 {currentPage} 页</span>
        <div>
          <button type="button" disabled={props.offset === 0} onClick={() => props.onPage(Math.max(0, props.offset - props.limit))}>上一页</button>
          <button type="button" disabled={props.candidates.length < props.limit} onClick={() => props.onPage(props.offset + props.limit)}>下一页</button>
        </div>
        <FolioSelect
          label="每页"
          value={String(props.limit)}
          options={LIMIT_OPTIONS}
          onChange={(value) => props.onLimit(Number(value))}
        />
      </footer>
    </section>
  );
}

function candidateRowKey(candidate: DictionaryCandidate) {
  if (candidate.id != null) return `remote-${candidate.id}`;
  if (candidate.dictionary_id != null) return `dict-${candidate.dictionary_id}`;
  return `${candidate.type ?? "tag"}:${candidate.name ?? candidate.slug ?? "unknown"}`;
}

function typeLabel(type?: string | null) {
  if (!type) return "标签";
  return TYPE_LABELS[type] ?? type;
}

function statusLabel(status?: string | null) {
  if (status === "review") return "待复核";
  if (status === "ignored") return "已忽略";
  if (status === "suggested") return "机器建议";
  return "已配置";
}

function statusTone(candidate: DictionaryCandidate) {
  if (candidate.ignored) return "muted";
  if (candidate.status === "review") return "review";
  if (candidate.configured) return "done";
  return "pending";
}
