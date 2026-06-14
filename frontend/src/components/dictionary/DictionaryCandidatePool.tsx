import { RefreshCw, Search } from "lucide-react";

import { DictionaryCandidate } from "../../lib/api";

type Props = {
  query: string;
  typeFilter: string;
  status: string;
  candidates: DictionaryCandidate[];
  loading: boolean;
  selectedId?: number | null;
  offset: number;
  limit: number;
  onQuery: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onStatus: (value: string) => void;
  onRefresh: () => void;
  onSelect: (candidate: DictionaryCandidate) => void;
  onPage: (offset: number) => void;
  onLimit: (limit: number) => void;
};

const TYPES = [
  ["all", "全部"],
  ["tag", "标签"],
  ["artist", "作者"],
  ["group", "社团"],
  ["character", "角色"],
  ["parody", "原作"],
  ["language", "语言"],
] as const;

const STATUSES = [
  ["all", "全部"],
  ["unconfigured", "未配置"],
  ["configured", "已配置"],
  ["review", "待复核"],
  ["ignored", "已忽略"],
] as const;

export function DictionaryCandidatePool({
  query,
  typeFilter,
  status,
  candidates,
  loading,
  selectedId,
  offset,
  limit,
  onQuery,
  onTypeFilter,
  onStatus,
  onRefresh,
  onSelect,
  onPage,
  onLimit,
}: Props) {
  return (
    <section className="dictionary-pane candidate-pool">
      <header className="dictionary-pane-head">
        <div>
          <h2>候选术语池</h2>
          <span>{loading ? "读取真实缓存..." : `${candidates.length} 项`}</span>
        </div>
        <button type="button" onClick={onRefresh} aria-label="刷新候选">
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="candidate-filters">
        <label className="candidate-search">
          <Search size={15} />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索原文或中文词条" />
        </label>
        <label>
          <span>类型</span>
          <select value={typeFilter} onChange={(event) => onTypeFilter(event.target.value)}>
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select value={status} onChange={(event) => onStatus(event.target.value)}>
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="candidate-table" role="table" aria-label="候选术语">
        <div className="candidate-row candidate-head" role="row">
          <span>原文</span>
          <span>建议翻译</span>
          <span>影响</span>
          <span>状态</span>
        </div>
        {candidates.map((candidate) => {
          const label = candidate.name || candidate.slug || String(candidate.id);
          const display = candidate.display && candidate.display !== label ? candidate.display : "未配置";
          return (
            <button
              key={candidate.id}
              type="button"
              className={selectedId === candidate.id ? "candidate-row active" : "candidate-row"}
              onClick={() => onSelect(candidate)}
              role="row"
            >
              <span>
                <i>{candidate.type || "tag"}</i>
                <strong>{label}</strong>
              </span>
              <span>{display}</span>
              <span>{candidate.impact_work_count ?? 0}</span>
              <span>
                <em className={candidate.configured ? "done" : "pending"}>
                  {candidate.ignored ? "已忽略" : candidate.configured ? statusLabel(candidate.status) : "待处理"}
                </em>
              </span>
            </button>
          );
        })}
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

function statusLabel(status?: string | null) {
  if (status === "review") return "待复核";
  if (status === "ignored") return "已忽略";
  if (status === "suggested") return "机器建议";
  return "已配置";
}
