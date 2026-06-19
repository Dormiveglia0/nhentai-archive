import { CheckSquare, Plus, Square, Trash2, XCircle } from "lucide-react";

import type { ExportPreset, ExportQueueItem } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { formatBytes, workTitle } from "../library/libraryHelpers";
import { Cover, presetSummaryLines } from "./exportHelpers";

type ExportQueueTableProps = {
  items: ExportQueueItem[];
  selectedIds: Set<number>;
  focusId: number | null;
  outputNames: Record<number, string>;
  activePreset: ExportPreset | null;
  blurCovers: boolean;
  selectedCount: number;
  selectedSize: number;
  onToggle: (id: number) => void;
  onFocus: (id: number) => void;
  onRename: (id: number, value: string) => void;
  onSelectReady: () => void;
  onRemoveSelected: () => void;
  onClear: () => void;
};

const STAGGER_CAP = 12;

export function ExportQueueTable({
  items,
  selectedIds,
  focusId,
  outputNames,
  activePreset,
  blurCovers,
  selectedCount,
  selectedSize,
  onToggle,
  onFocus,
  onRename,
  onSelectReady,
  onRemoveSelected,
  onClear,
}: ExportQueueTableProps) {
  const preset = presetSummaryLines(activePreset);
  const rows = items.map((item) => (
    <Row
      key={item.work.id}
      item={item}
      selected={selectedIds.has(item.work.id)}
      focused={focusId === item.work.id}
      outputName={outputNames[item.work.id] ?? item.output_name}
      presetName={preset.name}
      presetRule={preset.rule}
      blurCovers={blurCovers}
      onToggle={onToggle}
      onFocus={onFocus}
      onRename={onRename}
    />
  ));

  return (
    <section className="export-panel export-queue-panel">
      <div className="export-panel-head">
        <div>
          <h2>
            待导出列表 <small>已选择 {selectedCount} 项</small>
          </h2>
          <p>输出名称可在导出前重命名，导出会打包并下载到你的设备。</p>
        </div>
        <div className="export-panel-actions">
          <button type="button" onClick={onSelectReady}>
            <Plus size={15} />
            全选就绪
          </button>
          <button type="button" onClick={onRemoveSelected} disabled={selectedCount === 0}>
            <Trash2 size={15} />
            移除当前
          </button>
          <button type="button" onClick={onClear} disabled={selectedCount === 0}>
            <XCircle size={15} />
            清空
          </button>
        </div>
      </div>

      <div className="export-table">
        <div className="export-table-head">
          <span />
          <span>作品</span>
          <span>输出名称（预览）</span>
          <span>状态</span>
          <span>警告</span>
          <span>使用预设</span>
        </div>
        {items.length > STAGGER_CAP ? (
          <div className="export-table-body">{rows}</div>
        ) : (
          <Stagger key={items.map((i) => i.work.id).join("-")} className="export-table-body">
            {items.map((item) => (
              <StaggerItem key={item.work.id}>
                <Row
                  item={item}
                  selected={selectedIds.has(item.work.id)}
                  focused={focusId === item.work.id}
                  outputName={outputNames[item.work.id] ?? item.output_name}
                  presetName={preset.name}
                  presetRule={preset.rule}
                  blurCovers={blurCovers}
                  onToggle={onToggle}
                  onFocus={onFocus}
                  onRename={onRename}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
        <div className="export-table-foot">
          <span>
            已选择 {selectedCount} 项 · 预计大小 {formatBytes(selectedSize)}
          </span>
          <span>总计 {items.length} 项</span>
        </div>
      </div>
    </section>
  );
}

function Row({
  item,
  selected,
  focused,
  outputName,
  presetName,
  presetRule,
  blurCovers,
  onToggle,
  onFocus,
  onRename,
}: {
  item: ExportQueueItem;
  selected: boolean;
  focused: boolean;
  outputName: string;
  presetName: string;
  presetRule: string;
  blurCovers: boolean;
  onToggle: (id: number) => void;
  onFocus: (id: number) => void;
  onRename: (id: number, value: string) => void;
}) {
  const issues = [...item.blockers, ...item.warnings];
  const blocked = item.blockers.length > 0;
  return (
    <div
      className={`export-row ${focused ? "focused" : ""} ${selected ? "selected" : ""}`}
      onClick={() => onFocus(item.work.id)}
    >
      <button
        type="button"
        className="export-check"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(item.work.id);
        }}
        aria-label={selected ? "取消选择" : "选择作品"}
      >
        {selected ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>
      <span className="export-work-cell">
        <Cover workId={item.work.id} coverPath={item.work.cover_path} blurCovers={blurCovers} />
        <span>
          <strong>{workTitle(item.work)}</strong>
          <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
        </span>
      </span>
      <label className="export-name-field" onClick={(event) => event.stopPropagation()}>
        <span>输出名称</span>
        <input
          className="export-name-input"
          value={outputName}
          onChange={(event) => onRename(item.work.id, event.target.value)}
          aria-label="输出名称"
        />
      </label>
      <span className={blocked ? "export-state blocked" : "export-state ready"}>
        {blocked ? "阻塞" : "就绪"}
      </span>
      <span className="export-warning-cell">
        {issues.length === 0 ? (
          <em className="export-warning-empty">无</em>
        ) : (
          <>
            {issues.slice(0, 2).map((issue) => (
              <span key={`${issue.code}-${issue.message}`} className="export-warning-item">
                {issue.message}
              </span>
            ))}
            {issues.length > 2 ? <span className="export-warning-more">+{issues.length - 2}</span> : null}
          </>
        )}
      </span>
      <span className="export-preset-cell">
        <strong>{presetName}</strong>
        <small>{presetRule}</small>
      </span>
    </div>
  );
}
