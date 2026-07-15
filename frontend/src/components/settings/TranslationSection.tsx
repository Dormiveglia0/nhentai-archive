import { Check, Eye, EyeOff, Languages, LoaderCircle, RefreshCw, Wand2 } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { api } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { FolioField, FolioSelect } from "../folio/ui/FolioPrimitives";
import { StatusDot } from "./settingsHelpers";
import type { SettingsVM } from "./useSettingsState";

const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁体中文" },
] as const;

const PLAN_OPTIONS = [
  { value: "free", label: "Free · api-free.deepl.com" },
  { value: "pro", label: "Pro · api.deepl.com" },
] as const;

export function TranslationSection({ vm }: { vm: SettingsVM }) {
  const reduceMotion = usePrefersReducedMotion();
  const mt = vm.settings?.machine_translation ?? null;
  const isDeepl = vm.mtProvider === "deepl";
  const lastVerify = mt?.last_verify ?? null;
  const [keyVisible, setKeyVisible] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  async function runTest() {
    const text = testText.trim();
    if (!text || testing) return;
    const requestId = ++requestRef.current;
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await api.dictionaryTranslate(text);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setTestResult(result.translation || "（返回为空）");
    } catch (exc) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setTestError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setTesting(false);
    }
  }

  function clearKey() {
    if (!window.confirm("确定清除已保存的 DeepL API Key 吗？环境变量中的 Key 不会被删除。")) return;
    void vm.clearDeeplKey();
  }

  return (
    <section className="folio-settings-section" aria-label="机器翻译配置">
      <div className="folio-choice-row" aria-label="翻译服务">
        <button className={vm.mtProvider === "google_free" ? "is-active" : ""} type="button" onClick={() => vm.setMtProvider("google_free")}>
          {vm.mtProvider === "google_free" ? <m.i className="folio-choice-active" layoutId={reduceMotion ? undefined : "formal-translation-provider"} /> : null}
          <span>Google 免费翻译</span>
          <small>无需 API Key，适合直接开始</small>
          <Check size={16} />
        </button>
        <button className={isDeepl ? "is-active" : ""} type="button" onClick={() => vm.setMtProvider("deepl")}>
          {isDeepl ? <m.i className="folio-choice-active" layoutId={reduceMotion ? undefined : "formal-translation-provider"} /> : null}
          <span>DeepL API</span>
          <small>需要独立 Key 与套餐配置</small>
          <Check size={16} />
        </button>
      </div>

      <div className="folio-field-matrix">
        <FolioSelect label="目标语言" value={vm.mtTargetLang} options={LANGUAGE_OPTIONS} onChange={vm.setMtTargetLang} />
        <FolioField
          label="批量建议数量（每次）"
          type="number"
          value={String(vm.mtBatchLimit)}
          onChange={(value) => vm.setMtBatchLimit(Math.max(1, Math.min(50, Number(value) || 1)))}
        />
        {isDeepl ? (
          <>
            <label className="folio-field">
              <span>DeepL API Key</span>
              <div className="folio-secret">
                <input
                  type={keyVisible ? "text" : "password"}
                  value={vm.deeplKey}
                  onChange={(event) => vm.setDeeplKey(event.target.value)}
                  placeholder={mt?.deepl_api_key_configured ? "已配置；输入新 Key 可覆盖" : "输入 DeepL API Key"}
                  autoComplete="off"
                />
                <button type="button" aria-label={keyVisible ? "隐藏密钥" : "显示密钥"} onClick={() => setKeyVisible((value) => !value)}>
                  {keyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <i />
            </label>
            <FolioSelect label="DeepL 套餐" value={vm.deeplPlan} options={PLAN_OPTIONS} onChange={vm.setDeeplPlan} />
          </>
        ) : null}
      </div>

      <div className="folio-settings-inline-actions">
        <button className="folio-line-button" type="button" onClick={() => void vm.verifyTranslation()} disabled={vm.loading || vm.dirty}>
          <RefreshCw size={15} />
          验证已保存服务
        </button>
        {isDeepl ? (
          <button className="folio-line-button" type="button" onClick={clearKey} disabled={vm.loading || !mt?.deepl_api_key_configured}>
            清除 Key
          </button>
        ) : null}
        {vm.dirty ? <span className="folio-settings-action-hint">请先保存当前服务配置再验证</span> : null}
      </div>

      <div className="folio-settings-subhead">
        <h3><Wand2 size={16} />即时翻译测试</h3>
        <span>使用当前已保存的服务</span>
      </div>
      <div className="folio-settings-translate-test">
        <label className="folio-search-field">
          <Languages size={16} />
          <input
            type="text"
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            placeholder="输入要翻译的英文，例如 full color"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void runTest();
            }}
          />
          <i />
        </label>
        <button className="folio-ink-button" type="button" onClick={() => void runTest()} disabled={testing || !testText.trim()} aria-busy={testing}>
          {testing ? <LoaderCircle className="spin" size={15} /> : <Wand2 size={15} />}
          翻译
        </button>
        <div className={`folio-settings-translate-result${testError ? " is-error" : ""}`} aria-live="polite">
          {testError ?? testResult ?? "结果会显示在这里"}
        </div>
      </div>

      <div className={`folio-settings-status-band${isDeepl && !mt?.deepl_api_key_configured ? " is-attention" : " is-ready"}`}>
        <StatusDot ok={!isDeepl || Boolean(mt?.deepl_api_key_configured)} />
        <span>
          当前选择：{isDeepl ? "DeepL API" : "Google 免费翻译"}
          {isDeepl ? (mt?.deepl_api_key_configured ? `（Key 已配置 · ${mt.deepl_key_source}）` : "（Key 未配置）") : ""}
        </span>
        {lastVerify ? <small>最近验证：{lastVerify.ok ? `成功 · ${lastVerify.sample ?? ""}` : lastVerify.message}</small> : null}
      </div>
    </section>
  );
}
