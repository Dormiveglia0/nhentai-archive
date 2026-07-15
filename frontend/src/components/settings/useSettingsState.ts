import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type SettingsSummary } from "../../lib/api";
import type { SettingsSection } from "../folio/config";

export function useSettingsState(
  onPrivacyModeChange: (value: boolean) => void,
  onBlurCoversChange: (value: boolean) => void,
) {
  const [settings, setSettings] = useState<SettingsSummary | null>(null);
  const [section, setSection] = useState<SettingsSection>("connection");

  const [apiKey, setApiKey] = useState("");
  const [privacyDefault, setPrivacyDefault] = useState(true);
  const [blurDefault, setBlurDefault] = useState(true);
  const [readerMode, setReaderMode] = useState<"single" | "scroll">("single");

  const [mtProvider, setMtProvider] = useState<"google_free" | "deepl">("google_free");
  const [deeplPlan, setDeeplPlan] = useState<"free" | "pro">("free");
  const [deeplKey, setDeeplKey] = useState("");
  const [mtTargetLang, setMtTargetLang] = useState<"zh-CN" | "zh-TW">("zh-CN");
  const [mtBatchLimit, setMtBatchLimit] = useState(20);
  const [exportDefaults, setExportDefaults] = useState({ write_comicinfo: true, keep_json: true, compress: true });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);

  const hydrate = useCallback((payload: SettingsSummary) => {
    const mt = payload.machine_translation;
    setSettings(payload);
    setPrivacyDefault(payload.privacy.privacy_mode_default);
    setBlurDefault(payload.privacy.blur_covers_default);
    onPrivacyModeChange(payload.privacy.privacy_mode_default);
    onBlurCoversChange(payload.privacy.blur_covers_default);
    setReaderMode(payload.reader.default_mode);
    setMtProvider(mt?.provider ?? "google_free");
    setDeeplPlan(mt?.deepl_plan ?? "free");
    setMtTargetLang(mt?.target_lang === "zh-TW" ? "zh-TW" : "zh-CN");
    setMtBatchLimit(mt?.batch_limit ?? 20);
    setExportDefaults(payload.export.default_options);
  }, [onBlurCoversChange, onPrivacyModeChange]);

  const execute = useCallback(async <T,>(action: () => Promise<T>, onSuccess: (result: T) => void) => {
    const requestId = ++requestRef.current;
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
      setMessage(null);
    }
    try {
      const result = await action();
      if (!mountedRef.current || requestId !== requestRef.current) return;
      onSuccess(result);
    } catch (exc) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    await execute(
      () => api.settings(),
      (payload) => {
        hydrate(payload);
        setApiKey("");
        setDeeplKey("");
      },
    );
  }, [execute, hydrate]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [load]);

  const save = useCallback(async () => {
    await execute(
      () => api.updateSettings({
        nhentai_api_key: apiKey.trim() || undefined,
        privacy: { privacy_mode_default: privacyDefault, blur_covers_default: blurDefault },
        reader: { default_mode: readerMode },
        machine_translation: {
          provider: mtProvider,
          deepl_plan: deeplPlan,
          target_lang: mtTargetLang,
          batch_limit: mtBatchLimit,
          deepl_api_key: deeplKey.trim() || undefined,
        },
        export: { default_options: exportDefaults },
      }),
      (payload) => {
        hydrate(payload);
        setApiKey("");
        setDeeplKey("");
        setMessage("设置已保存，运行态配置已更新。");
      },
    );
  }, [apiKey, blurDefault, deeplKey, deeplPlan, execute, exportDefaults, hydrate, mtBatchLimit, mtProvider, mtTargetLang, privacyDefault, readerMode]);

  const clearKey = useCallback(async () => {
    await execute(
      () => api.updateSettings({ clear_nhentai_api_key: true }),
      (payload) => {
        hydrate(payload);
        setApiKey("");
        setMessage(payload.nhentai.api_key_source === "env" ? "本地 key 已清除；环境变量 key 仍然生效。" : "NH API Key 已清除。");
      },
    );
  }, [execute, hydrate]);

  const clearDeeplKey = useCallback(async () => {
    await execute(
      () => api.updateSettings({ machine_translation: { clear_deepl_api_key: true } }),
      (payload) => {
        hydrate(payload);
        setDeeplKey("");
        setMessage("DeepL Key 已清除。");
      },
    );
  }, [execute, hydrate]);

  const verify = useCallback(async () => {
    await execute(
      async () => {
        const result = await api.verifyNhentaiSettings();
        const payload = await api.settings();
        return { result, payload };
      },
      ({ result, payload }) => {
        hydrate(payload);
        setMessage(result.message);
      },
    );
  }, [execute, hydrate]);

  const clearCache = useCallback(async () => {
    await execute(
      () => api.clearNhentaiCache(),
      (result) => setMessage(result.message),
    );
  }, [execute]);

  const verifyTranslation = useCallback(async () => {
    await execute(
      async () => {
        const result = await api.verifyTranslationSettings();
        const payload = await api.settings();
        return { result, payload };
      },
      ({ result, payload }) => {
        hydrate(payload);
        setMessage(result.ok ? `机翻连接正常（${result.provider}）：${result.sample ?? ""}` : `机翻验证失败：${result.message}`);
      },
    );
  }, [execute, hydrate]);

  const dirty = useMemo(() => {
    if (!settings) return Boolean(apiKey.trim() || deeplKey.trim());
    const mt = settings.machine_translation;
    const defaults = settings.export.default_options;
    return Boolean(
      apiKey.trim()
      || deeplKey.trim()
      || privacyDefault !== settings.privacy.privacy_mode_default
      || blurDefault !== settings.privacy.blur_covers_default
      || readerMode !== settings.reader.default_mode
      || mtProvider !== (mt?.provider ?? "google_free")
      || deeplPlan !== (mt?.deepl_plan ?? "free")
      || mtTargetLang !== (mt?.target_lang === "zh-TW" ? "zh-TW" : "zh-CN")
      || mtBatchLimit !== (mt?.batch_limit ?? 20)
      || exportDefaults.write_comicinfo !== defaults.write_comicinfo
      || exportDefaults.keep_json !== defaults.keep_json
      || exportDefaults.compress !== defaults.compress
    );
  }, [apiKey, blurDefault, deeplKey, deeplPlan, exportDefaults, mtBatchLimit, mtProvider, mtTargetLang, privacyDefault, readerMode, settings]);

  return {
    settings,
    section,
    setSection,
    apiKey,
    setApiKey,
    privacyDefault,
    setPrivacyDefault,
    blurDefault,
    setBlurDefault,
    readerMode,
    setReaderMode,
    mtProvider,
    setMtProvider,
    deeplPlan,
    setDeeplPlan,
    deeplKey,
    setDeeplKey,
    mtTargetLang,
    setMtTargetLang,
    mtBatchLimit,
    setMtBatchLimit,
    exportDefaults,
    setExportDefaults,
    loading,
    message,
    error,
    dirty,
    load,
    save,
    clearKey,
    clearDeeplKey,
    verify,
    verifyTranslation,
    clearCache,
  };
}

export type SettingsVM = ReturnType<typeof useSettingsState>;
