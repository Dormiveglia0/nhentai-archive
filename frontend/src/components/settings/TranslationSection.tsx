import { Languages, RefreshCw, Wand2 } from "lucide-react";
import { useState } from "react";

import { api } from "../../lib/api";
import type { SettingsVM } from "./useSettingsState";
import { StatusDot } from "./settingsHelpers";

export function TranslationSection({ vm }: { vm: SettingsVM }) {
  const mt = vm.settings?.machine_translation ?? null;
  const isDeepl = vm.mtProvider === "deepl";
  const lastVerify = mt?.last_verify ?? null;

  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    const text = testText.trim();
    if (!text) return;
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await api.dictionaryTranslate(text);
      setTestResult(result.translation || "（返回为空）");
    } catch (exc) {
      setTestError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>机器翻译</h2>
        <p>词典里的「机翻填充中文名」与「批量机翻」会用这里配置的服务。Google 免费翻译无需 key；DeepL 需要 API Key。</p>
      </div>

      <div className="settings-mt-providers">
        <button
          type="button"
          className={`settings-mt-provider${vm.mtProvider === "google_free" ? " is-active" : ""}`}
          onClick={() => vm.setMtProvider("google_free")}
        >
          <Languages size={16} />
          <span>
            <strong>Google 免费翻译</strong>
            <small>无需 API Key，开箱即用</small>
          </span>
        </button>
        <button
          type="button"
          className={`settings-mt-provider${vm.mtProvider === "deepl" ? " is-active" : ""}`}
          onClick={() => vm.setMtProvider("deepl")}
        >
          <Languages size={16} />
          <span>
            <strong>DeepL API</strong>
            <small>需 API Key，质量更稳定</small>
          </span>
        </button>
      </div>

      <div className="settings-grid">
        <label>
          <span>目标语言</span>
          <select value={vm.mtTargetLang} onChange={(event) => vm.setMtTargetLang(event.target.value as "zh-CN" | "zh-TW")}>
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁体中文</option>
          </select>
        </label>
        <label>
          <span>批量建议数量（每次）</span>
          <input
            type="number"
            min={1}
            max={50}
            value={vm.mtBatchLimit}
            onChange={(event) => vm.setMtBatchLimit(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
          />
        </label>
      </div>

      {isDeepl ? (
        <div className="settings-grid">
          <label>
            <span>DeepL API Key</span>
            <input
              type="password"
              value={vm.deeplKey}
              onChange={(event) => vm.setDeeplKey(event.target.value)}
              placeholder={mt?.deepl_api_key_configured ? "已配置，输入新 key 可覆盖" : "输入 DeepL API Key"}
              autoComplete="off"
            />
          </label>
          <label>
            <span>DeepL 套餐</span>
            <select value={vm.deeplPlan} onChange={(event) => vm.setDeeplPlan(event.target.value as "free" | "pro")}>
              <option value="free">Free（api-free.deepl.com）</option>
              <option value="pro">Pro（api.deepl.com）</option>
            </select>
          </label>
          <div className="connection-actions">
            <button type="button" onClick={() => void vm.verifyTranslation()} disabled={vm.loading}>
              <RefreshCw size={16} />
              测试机翻
            </button>
            <button type="button" onClick={() => void vm.clearDeeplKey()} disabled={vm.loading || !mt?.deepl_api_key_configured}>
              清除 Key
            </button>
          </div>
        </div>
      ) : (
        <div className="connection-actions">
          <button type="button" onClick={() => void vm.verifyTranslation()} disabled={vm.loading}>
            <RefreshCw size={16} />
            测试机翻
          </button>
        </div>
      )}

      <div className="settings-subhead">
        <h3>
          <Wand2 size={15} /> 即时翻译测试
        </h3>
      </div>
      <div className="settings-translate-test">
        <input
          type="text"
          value={testText}
          onChange={(event) => setTestText(event.target.value)}
          placeholder="输入要翻译的英文（如 full color）"
          onKeyDown={(event) => {
            if (event.key === "Enter") void runTest();
          }}
        />
        <button type="button" onClick={() => void runTest()} disabled={testing || !testText.trim()}>
          {testing ? "翻译中…" : "翻译"}
        </button>
        <div className="settings-translate-out">
          {testError ? <span className="bad">{testError}</span> : <span>{testResult ?? "结果会显示在这里"}</span>}
        </div>
      </div>

      <div className="status-row">
        <StatusDot ok={isDeepl ? Boolean(mt?.deepl_api_key_configured) : true} />
        <span>
          当前服务：{vm.mtProvider === "deepl" ? "DeepL API" : "Google 免费翻译"}
          {isDeepl ? (mt?.deepl_api_key_configured ? `（key 已配置·${mt.deepl_key_source}）` : "（key 未配置）") : ""}
        </span>
        {lastVerify ? <span>最后测试：{lastVerify.ok ? `成功「${lastVerify.sample ?? ""}」` : lastVerify.message}</span> : null}
      </div>
    </section>
  );
}
