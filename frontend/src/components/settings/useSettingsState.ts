import { useEffect, useState } from "react";

import { api, SettingsSummary } from "../../lib/api";

export type SettingsSection = "connection" | "translation" | "preferences" | "export" | "data" | "storage";

export function useSettingsState() {
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
  const [exportActivePreset, setExportActivePreset] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hydrate(payload: SettingsSummary) {
    setSettings(payload);
    setPrivacyDefault(payload.privacy.privacy_mode_default);
    setBlurDefault(payload.privacy.blur_covers_default);
    setReaderMode(payload.reader.default_mode);
    if (payload.machine_translation) {
      setMtProvider(payload.machine_translation.provider);
      setDeeplPlan(payload.machine_translation.deepl_plan);
      setMtTargetLang(payload.machine_translation.target_lang === "zh-TW" ? "zh-TW" : "zh-CN");
    }
    setExportActivePreset(payload.export.active_preset_id);
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

  async function load() {
    await run(async () => {
      hydrate(await api.settings());
    });
  }

  async function save() {
    await run(async () => {
      const payload = await api.updateSettings({
        nhentai_api_key: apiKey.trim() || undefined,
        privacy: { privacy_mode_default: privacyDefault, blur_covers_default: blurDefault },
        reader: { default_mode: readerMode },
        machine_translation: {
          provider: mtProvider,
          deepl_plan: deeplPlan,
          target_lang: mtTargetLang,
          deepl_api_key: deeplKey.trim() || undefined,
        },
        export: { active_preset_id: exportActivePreset || undefined },
      });
      hydrate(payload);
      setApiKey("");
      setDeeplKey("");
      setMessage("设置已保存，运行态配置已更新。");
    });
  }

  async function clearKey() {
    await run(async () => {
      const payload = await api.updateSettings({ clear_nhentai_api_key: true });
      hydrate(payload);
      setApiKey("");
      setMessage(payload.nhentai.api_key_source === "env" ? "本地 key 已清除；环境变量 key 仍然生效。" : "NH API Key 已清除。");
    });
  }

  async function clearDeeplKey() {
    await run(async () => {
      const payload = await api.updateSettings({ machine_translation: { clear_deepl_api_key: true } });
      hydrate(payload);
      setDeeplKey("");
      setMessage("DeepL Key 已清除。");
    });
  }

  async function verify() {
    await run(async () => {
      const result = await api.verifyNhentaiSettings();
      hydrate(await api.settings());
      setMessage(result.message);
    });
  }

  async function verifyTranslation() {
    await run(async () => {
      const result = await api.verifyTranslationSettings();
      hydrate(await api.settings());
      setMessage(result.ok ? `机翻连接正常（${result.provider}）：${result.sample ?? ""}` : `机翻验证失败：${result.message}`);
    });
  }

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
    exportActivePreset,
    setExportActivePreset,
    loading,
    message,
    error,
    load,
    save,
    clearKey,
    clearDeeplKey,
    verify,
    verifyTranslation,
  };
}

export type SettingsVM = ReturnType<typeof useSettingsState>;
