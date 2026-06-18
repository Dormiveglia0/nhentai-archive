import { RefreshCw, Search, Upload } from "lucide-react";

import { DictionaryCandidate } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { FilterMenu } from "../discover/FilterMenu";

type Props = {
  query: string;
  typeFilter: string;
  status: string;
  candidates: DictionaryCandidate[];
  loading: boolean;
  selectedKey?: string | null;
  offset: number;
  limit: number;
  onQuery: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onStatus: (value: string) => void;
  onRefresh: () => void;
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
];

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unconfigured", label: "未配置" },
  { value: "configured", label: "已配置" },
  { value: "review", label: "待复核" },
  { value: "ignored", label: "已忽略" },
];

const TYPE_LABELS: Record<string, string> = {
  tag: "标签",
  artist: "作者",
  group: "社团",
  character: "角色",
  parody: "原作",
  language: "语言",
  category: "分类",
};

function typeLabel(type?: string | null) {
  if (!type) return "标签";
  return TYPE_LABELS[type] ?? type;
}

export function DictionaryCandidatePool({
  query,
  typeFilter,
  status,
  candidates,
  loading,
  selectedKey,
  offset,
  limit,
  onQuery,
  onTypeFilter,
  onStatus,
  onRefresh,
  onBulkImport,
  onSelect,
  onPage,
  onLimit,
}: Props) {
  const firstKey = candidates[0] ? candidateRowKey(candidates[0]) : "none";
  const lastKey = candidates[candidates.length - 1] ? candidateRowKey(candidates[candidates.length - 1]) : "none";
  const resultKey = `${query}:${typeFilter}:${status}:${offset}:${limit}:${candidates.length}:${firstKey}:${lastKey}`;

  return (
    <section className="dictionary-pane candidate-pool">
      <header className="dictionary-pane-head">
        <div>
          <h2>候选术语池</h2>
          <span>{loading ? "读取真实缓存..." : `${candidates.length} 项`}</span>
        </div>
        <div className="pane-head-actions">
          <button type="button" className="head-action" onClick={onBulkImport}>
            <Upload size={14} />
            批量导入
          </button>
          <button type="button" className="icon-btn" onClick={onRefresh} aria-label="刷新候选">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="candidate-filters">
        <label className="candidate-search">
          <Search size={15} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索原文或中文词条" />
        </label>
        <FilterMenu value={typeFilter} options={TYPE_OPTIONS} onChange={onTypeFilter} />
        <FilterMenu value={status} options={STATUS_OPTIONS} onChange={onStatus} />
      </div>

      <div className="candidate-table" role="table" aria-label="候选术语">
        <div className="candidate-row candidate-head" role="row">
          <span>原文</span>
          <span>建议翻译</span>
          <span>影响</span>
          <span>状态</span>
        </div>
        <Stagger key={resultKey} className="candidate-row-list">
          {candidates.map((candidate) => {
            const label = candidate.name || candidate.slug || String(candidate.id ?? candidate.dictionary_id);
            const display = candidate.display && candidate.display !== label ? candidate.display : "未配置";
            const rowKey = candidateRowKey(candidate);
            const active = selectedKey === rowKey;
            return (
              <StaggerItem key={rowKey} className="candidate-row-motion">
                <button
                  type="button"
                  className={active ? "candidate-row active" : "candidate-row"}
                  onClick={() => onSelect(candidate)}
                  role="row"
                >
                  <span className="candidate-term">
                    <i className={`type-badge type-${candidate.type || "tag"}`}>{typeLabel(candidate.type)}</i>
                    <strong title={label}>{label}</strong>
                  </span>
                  <span className={display === "未配置" ? "candidate-display muted" : "candidate-display"}>{display}</span>
                  <span className="candidate-impact">{candidate.impact_work_count ?? 0}</span>
                  <span className="candidate-status">
                    <em className={statusTone(candidate)}>
                      {candidate.ignored ? "已忽略" : candidate.configured ? statusLabel(candidate.status) : "待处理"}
                    </em>
                  </span>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
        {!loading && candidates.length === 0 ? (
          <div className="dictionary-empty">暂无真实候选。先在发现页缓存远端 tag，或使用批量导入创建本地词典。</div>
        ) : null}
      </div>

      <footer className="candidate-pager">
        <span>第 {Math.floor(offset / limit) + 1} 页</span>
        <button type="button" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>
          上一页
        </button>
        <button type="button" disabled={candidates.length < limit} onClick={() => onPage(offset + limit)}>
          下一页
        </button>
        <select value={limit} onChange={(event) => onLimit(Number(event.target.value))}>
          <option value={20}>20 条/页</option>
          <option value={50}>50 条/页</option>
          <option value={80}>80 条/页</option>
        </select>
      </footer>
    </section>
  );
}

function candidateRowKey(candidate: DictionaryCandidate) {
  return candidate.id ? `remote-${candidate.id}` : `dict-${candidate.dictionary_id}`;
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
