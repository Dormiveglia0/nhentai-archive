import { Eraser, RefreshCw } from "lucide-react";

import type { SettingsVM } from "./useSettingsState";
import { StatusDot } from "./settingsHelpers";

export function ConnectionSection({ vm }: { vm: SettingsVM }) {
  const { settings } = vm;
  const nh = settings?.nhentai;
  const lastVerify = nh?.last_verify ?? null;

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>数据源与连接</h2>
        <p>配置 NH API Key 与请求参数；敏感值不会在前端回显明文。保存后运行态客户端立即生效。</p>
      </div>

      <div className="settings-grid">
        <label className="wide">
          <span>NH API Key</span>
          <input
            type="password"
            value={vm.apiKey}
            onChange={(event) => vm.setApiKey(event.target.value)}
            placeholder={nh?.api_key_configured ? "已配置，输入新 key 可覆盖" : "输入 NH API Key"}
            autoComplete="off"
          />
        </label>
        <label>
          <span>Base URL</span>
          <input value={nh?.base_url ?? ""} readOnly />
        </label>
        <label>
          <span>请求超时（秒）</span>
          <input value={nh?.request_timeout ?? ""} readOnly />
        </label>
        <label className="wide">
          <span>User-Agent</span>
          <input value={nh?.user_agent ?? ""} readOnly />
        </label>
      </div>

      <div className="connection-actions">
        <button type="button" onClick={() => void vm.verify()} disabled={vm.loading}>
          <RefreshCw size={16} />
          验证连接
        </button>
        <button type="button" onClick={() => void vm.clearCache()} disabled={vm.loading}>
          <Eraser size={16} />
          清除远端缓存
        </button>
        <button type="button" onClick={() => void vm.clearKey()} disabled={vm.loading || !nh?.api_key_configured}>
          清除 Key
        </button>
      </div>

      <dl className="settings-kv">
        <div>
          <dt>连接状态</dt>
          <dd>{nh?.api_key_configured ? `已配置（${nh.api_key_source}）` : "未配置"}</dd>
        </div>
        <div>
          <dt>最近验证</dt>
          <dd>{lastVerify ? (lastVerify.ok ? "通过" : "失败") : "未验证"}</dd>
        </div>
        <div>
          <dt>返回状态码</dt>
          <dd>{lastVerify?.status_code ?? "—"}</dd>
        </div>
        <div>
          <dt>验证信息</dt>
          <dd>{lastVerify?.message ?? "—"}</dd>
        </div>
      </dl>

      <div className="status-row">
        <StatusDot ok={Boolean(nh?.api_key_configured)} />
        <span>{nh?.api_key_configured ? "已就绪，可进行发现与导入。" : "未配置 API Key，发现与导入将不可用。"}</span>
      </div>
    </section>
  );
}
