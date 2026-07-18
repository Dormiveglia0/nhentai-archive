import { Download, RefreshCw, Save, Tags } from "lucide-react";

import { pageHref } from "../../lib/navigation";

export function GovernanceActionBar({
  workId,
  changedCount,
  saving,
  writeBack,
  onWriteBackChange,
  onSave,
  onReload,
}: {
  workId: number;
  changedCount: number;
  saving: boolean;
  writeBack: boolean;
  onWriteBackChange: (value: boolean) => void;
  onSave: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="folio-governance-actions">
      <button className="folio-governance-action is-primary" type="button" onClick={() => void onSave()} disabled={saving || (!writeBack && changedCount === 0)}>
        <Save size={17} />
        {saving ? "保存中..." : writeBack && !changedCount ? "回写源文件" : `保存修改${changedCount ? ` (${changedCount})` : ""}`}
      </button>
      <label className="folio-governance-writeback">
        <input
          type="checkbox"
          checked={writeBack}
          onChange={(event) => onWriteBackChange(event.target.checked)}
        />
        <i aria-hidden="true"><span /></i>
        <span><strong>同时回写 ComicInfo</strong><small>就地改写源 CBZ，不可撤销</small></span>
      </label>
      <a className="folio-governance-action" href={pageHref({ name: "dictionary" })}>
        <Tags size={16} />
        管理词典
      </a>
      <a className="folio-governance-action" href={pageHref({ name: "export", workId })}>
        <Download size={16} />
        进入导出
      </a>
      <button className="folio-governance-action" type="button" onClick={() => void onReload()}>
        <RefreshCw size={16} />
        重新读取
      </button>
    </div>
  );
}
