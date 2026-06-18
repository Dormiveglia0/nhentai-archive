import { CheckCircle2, Database, EyeOff, Folder, KeyRound, RefreshCw, Save, Shield, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api, SettingsSummary } from "../../lib/api";
import { FadeIn, Stagger, StaggerItem } from "../../lib/motion";

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsSummary | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [privacyDefault, setPrivacyDefault] = useState(true);
  const [blurDefault, setBlurDefault] = useState(true);
  const [readerMode, setReaderMode] = useState<"single" | "scroll">("single");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    await run(async () => {
      const payload = await api.settings();
      setSettings(payload);
      setPrivacyDefault(payload.privacy.privacy_mode_default);
      setBlurDefault(payload.privacy.blur_covers_default);
      setReaderMode(payload.reader.default_mode);
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const payload = await api.updateSettings({
        nhentai_api_key: apiKey.trim() || undefined,
        privacy: {
          privacy_mode_default: privacyDefault,
          blur_covers_default: blurDefault,
        },
        reader: {
          default_mode: readerMode,
        },
      });
      setSettings(payload);
      setApiKey("");
      setMessage("设置已保存，运行态连接配置已更新。");
    });
  }

  async function clearKey() {
    await run(async () => {
      const payload = await api.updateSettings({ clear_nhentai_api_key: true });
      setSettings(payload);
      setApiKey("");
      setMessage(payload.nhentai.api_key_source === "env" ? "本地 key 已清除；环境变量 key 仍然生效。" : "NH API Key 已清除。");
    });
  }

  async function verify() {
    await run(async () => {
      const result = await api.verifyNhentaiSettings();
      const payload = await api.settings();
      setSettings(payload);
      setMessage(result.message);
    });
  }

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page settings-page">
      <div className="hero">
        <div>
          <h1>设置</h1>
          <p>管理系统行为、隐私安全、存储路径与阅读偏好。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <form className="settings-layout" onSubmit={save}>
        <FadeIn className="settings-rail-motion" x={-12}>
          <aside className="settings-rail">
            <button className="active" type="button">
              <Database size={17} />
              数据源与连接
            </button>
            <button type="button">
              <Folder size={17} />
              存储与路径
            </button>
            <button type="button">
              <Shield size={17} />
              隐私与安全
            </button>
            <button type="button">
              <EyeOff size={17} />
              阅读器
            </button>
          </aside>
        </FadeIn>

        <FadeIn className="settings-main-motion" y={8} delay={0.05}>
          <main>
            <Stagger className="settings-main">
              <StaggerItem className="settings-card-motion">
                <section className="settings-card">
                  <div className="settings-title">
                    <h2>A. 连接与同步</h2>
                    <p>配置数据源连接与请求策略；敏感值不会在前端回显明文。</p>
                  </div>
                  <div className="settings-grid">
                    <label>
                      <span>NH API Key</span>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={settings?.nhentai.api_key_configured ? "已配置，输入新 key 可覆盖" : "输入 NH API Key"}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      <span>Base URL</span>
                      <input value={settings?.nhentai.base_url ?? ""} readOnly />
                    </label>
                    <div className="connection-actions">
                      <button type="button" onClick={verify} disabled={loading}>
                        <RefreshCw size={16} />
                        验证连接
                      </button>
                      <button type="button" onClick={clearKey} disabled={loading || !settings?.nhentai.api_key_configured}>
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
              </StaggerItem>

              <StaggerItem className="settings-card-motion">
                <section className="settings-card">
                  <div className="settings-title">
                    <h2>B. 本地存储</h2>
                    <p>当前阶段只展示真实路径；目录迁移和容量策略后续接入。</p>
                  </div>
                  <div className="path-grid">
                    {settings
                      ? Object.entries(settings.storage).map(([key, value]) => (
                          <label key={key}>
                            <span>{key}</span>
                            <input value={value} readOnly />
                          </label>
                        ))
                      : null}
                  </div>
                </section>
              </StaggerItem>

              <StaggerItem className="settings-card-motion">
                <section className="settings-card">
                  <div className="settings-title">
                    <h2>C. 隐私与阅读偏好</h2>
                    <p>这些选项会保存为本地 UI 默认值。</p>
                  </div>
                  <div className="preference-row">
                    <label className="switch-field">
                      <span>隐私模式默认开启</span>
                      <input type="checkbox" checked={privacyDefault} onChange={(event) => setPrivacyDefault(event.target.checked)} />
                      <i />
                    </label>
                    <label className="switch-field">
                      <span>封面模糊默认开启</span>
                      <input type="checkbox" checked={blurDefault} onChange={(event) => setBlurDefault(event.target.checked)} />
                      <i />
                    </label>
                    <label>
                      <span>默认阅读模式</span>
                      <select value={readerMode} onChange={(event) => setReaderMode(event.target.value as "single" | "scroll")}>
                        <option value="single">单页</option>
                        <option value="scroll">连续滚动</option>
                      </select>
                    </label>
                  </div>
                </section>
              </StaggerItem>
            </Stagger>

            {error ? (
              <FadeIn key={`error-${error}`} y={6}>
                <div className="notice error">{error}</div>
              </FadeIn>
            ) : null}
            {message ? (
              <FadeIn key={`message-${message}`} y={6}>
                <div className="notice slim">{message}</div>
              </FadeIn>
            ) : null}

            <div className="settings-bottom">
              <button type="button" onClick={load} disabled={loading}>
                <RefreshCw size={16} />
                重新读取
              </button>
              <button className="primary-action" type="submit" disabled={loading}>
                <Save size={16} />
                保存设置
              </button>
            </div>
          </main>
        </FadeIn>

        <FadeIn className="settings-summary-motion" x={12} delay={0.1}>
          <aside className="settings-summary">
            <h2>配置摘要</h2>
            <SummaryRow label="NH API Key" value={settings?.nhentai.api_key_configured ? "已配置" : "未配置"} />
            <SummaryRow label="Key 来源" value={settings?.nhentai.api_key_source ?? "none"} />
            <SummaryRow label="隐私默认" value={privacyDefault ? "开启" : "关闭"} />
            <SummaryRow label="封面模糊" value={blurDefault ? "开启" : "关闭"} />
            <SummaryRow label="阅读模式" value={readerMode === "single" ? "单页" : "连续滚动"} />
            <div className="settings-help">
              <KeyRound size={18} />
              <p>保存后后端会立即更新运行态客户端，发现与导入不需要重启服务。</p>
            </div>
          </aside>
        </FadeIn>
      </form>
    </section>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="ok" size={17} /> : <XCircle className="bad" size={17} />;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
