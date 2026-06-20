import { RefreshCw } from "lucide-react";

import type { SettingsVM } from "./useSettingsState";
import { StatusDot } from "./settingsHelpers";

export function ConnectionSection({ vm }: { vm: SettingsVM }) {
  const { settings } = vm;
  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>数据源与连接</h2>
        <p>配置 NH API Key 与请求策略；敏感值不会在前端回显明文。</p>
      </div>
      <div className="settings-grid">
        <label>
          <span>NH API Key</span>
          <input
            type="password"
            value={vm.apiKey}
            onChange={(event) => vm.setApiKey(event.target.value)}
            placeholder={settings?.nhentai.api_key_configured ? "已配置，输入新 key 可覆盖" : "输入 NH API Key"}
            autoComplete="off"
          />
        </label>
        <label>
          <span>Base URL</span>
          <input value={settings?.nhentai.base_url ?? ""} readOnly />
        </label>
        <div className="connection-actions">
          <button type="button" onClick={() => void vm.verify()} disabled={vm.loading}>
            <RefreshCw size={16} />
            验证连接
          </button>
          <button type="button" onClick={() => void vm.clearKey()} disabled={vm.loading || !settings?.nhentai.api_key_configured}>
            清除 Key
          </button>
        </div>
      </div>
      <div className="status-row">
        <StatusDot ok={Boolean(settings?.nhentai.api_key_configured)} />
        <span>
          连接状态：
          {settings?.nhentai.api_key_configured ? `已配置（${settings.nhentai.api_key_source}）` : "未配置"}
        </span>
        {settings?.nhentai.last_verify ? <span>最后验证：{settings.nhentai.last_verify.message}</span> : null}
      </div>
    </section>
  );
}
