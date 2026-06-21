import { Download, RefreshCw, Save, Tags } from "lucide-react";

import { navigate } from "../../lib/navigation";

export function GovernanceActionBar({
  workId,
  changedCount,
  saving,
  onSave,
  onReload,
}: {
  workId: number;
  changedCount: number;
  saving: boolean;
  onSave: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="governance-actionbar">
      <button className="governance-action primary" type="button" onClick={() => void onSave()} disabled={saving || changedCount === 0}>
        <Save size={17} />
        {saving ? "保存中..." : `保存修改${changedCount ? ` (${changedCount})` : ""}`}
      </button>
      <button className="governance-action" type="button" onClick={() => navigate({ name: "dictionary" })}>
        <Tags size={16} />
        管理词典
      </button>
      <button className="governance-action" type="button" onClick={() => navigate({ name: "export", workId })}>
        <Download size={16} />
        进入导出
      </button>
      <button className="governance-action" type="button" onClick={() => void onReload()}>
        <RefreshCw size={16} />
        重新读取
      </button>
    </div>
  );
}
