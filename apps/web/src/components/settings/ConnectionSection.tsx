import { Activity, BadgeCheck, Cable, Database, Eraser, Eye, EyeOff, Gauge, Globe2, Hash, MessageSquareText, RefreshCw, TimerReset } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, type NhentaiRuntimeStats } from "../../lib/api";
import { FolioField } from "../folio/ui/FolioPrimitives";
import { FolioMetricGrid, type FolioMetricItem } from "../folio/ui/FolioMetricGrid";
import { StatusDot } from "./settingsHelpers";
import type { SettingsVM } from "./useSettingsState";

export function ConnectionSection({ vm }: { vm: SettingsVM }) {
  const nh = vm.settings?.nhentai;
  const lastVerify = nh?.last_verify ?? null;
  const [keyVisible, setKeyVisible] = useState(false);
  const [runtime, setRuntime] = useState<NhentaiRuntimeStats | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);

  const loadRuntime = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (mountedRef.current) {
      setRuntimeLoading(true);
      setRuntimeError(null);
    }
    try {
      const payload = await api.nhentaiRuntime();
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setRuntime(payload);
    } catch (exc) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setRuntime(null);
      setRuntimeError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setRuntimeLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadRuntime();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, [loadRuntime]);

  function clearKey() {
    if (!window.confirm("确定清除已保存的 NH API Key 吗？环境变量中的 Key 不会被删除。")) return;
    void vm.clearKey();
  }

  const connectionMetrics: FolioMetricItem[] = [
    {
      label: "连接状态",
      value: nh?.api_key_configured ? "已配置" : "未配置",
      detail: nh?.api_key_configured ? `来源：${nh.api_key_source}` : "发现与导入暂不可用",
      icon: Cable,
      tone: nh?.api_key_configured ? "good" : "danger",
      valueKind: "text",
    },
    {
      label: "最近验证",
      value: lastVerify ? (lastVerify.ok ? "验证通过" : "验证失败") : "尚未验证",
      icon: BadgeCheck,
      tone: lastVerify ? (lastVerify.ok ? "good" : "danger") : "muted",
      valueKind: "text",
    },
    {
      label: "返回状态码",
      value: lastVerify?.status_code ?? "—",
      icon: Hash,
      tone: lastVerify?.ok ? "good" : lastVerify ? "danger" : "muted",
    },
    {
      label: "验证信息",
      value: lastVerify?.message ?? "暂无验证信息",
      icon: MessageSquareText,
      tone: lastVerify?.ok ? "good" : lastVerify ? "warning" : "muted",
      valueKind: "text",
    },
  ];
  const runtimeMetrics: FolioMetricItem[] = [
    {
      label: "缓存条目",
      value: runtime ? `${runtime.cache_active_entries} / ${runtime.cache_entries}` : "—",
      detail: "有效 / 总数",
      icon: Database,
      tone: "neutral",
      valueKind: "text",
    },
    {
      label: "限流冷却",
      value: runtime ? (runtime.cooldown_active ? `约 ${runtime.cooldown_remaining_seconds} 秒` : "正常") : "—",
      detail: runtime?.cooldown_active ? "请求暂缓" : "当前没有限流",
      icon: TimerReset,
      tone: runtime?.cooldown_active ? "warning" : "good",
      valueKind: "text",
    },
    {
      label: "CDN 配置",
      value: runtime ? (runtime.cdn_configured ? "已解析" : "未解析") : "—",
      icon: Globe2,
      tone: runtime?.cdn_configured ? "good" : "muted",
      valueKind: "text",
    },
    {
      label: "运行就绪",
      value: <StatusDot ok={Boolean(nh?.api_key_configured) && !(runtime?.cooldown_active ?? false)} />,
      icon: Activity,
      tone: Boolean(nh?.api_key_configured) && !(runtime?.cooldown_active ?? false) ? "good" : "danger",
      valueKind: "text",
    },
  ];

  return (
    <section className="folio-settings-section" aria-label="数据源与连接配置">
      <div className="folio-field-matrix">
        <label className="folio-field folio-field-wide">
          <span>NH API Key</span>
          <div className="folio-secret">
            <input
              type={keyVisible ? "text" : "password"}
              value={vm.apiKey}
              onChange={(event) => vm.setApiKey(event.target.value)}
              placeholder={nh?.api_key_configured ? "已配置；输入新 Key 可覆盖" : "输入 NH API Key"}
              autoComplete="off"
            />
            <button type="button" aria-label={keyVisible ? "隐藏密钥" : "显示密钥"} onClick={() => setKeyVisible((value) => !value)}>
              {keyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <i />
        </label>
        <FolioField label="Base URL" value={nh?.base_url ?? ""} readOnly />
        <FolioField label="请求超时（秒）" value={nh ? String(nh.request_timeout) : ""} readOnly />
        <FolioField label="User-Agent" value={nh?.user_agent ?? ""} readOnly wide />
      </div>

      <div className="folio-settings-inline-actions">
        <button className="folio-line-button" type="button" onClick={() => void vm.verify()} disabled={vm.loading || vm.dirty || !nh?.api_key_configured}>
          <RefreshCw size={15} />
          验证连接
        </button>
        <button className="folio-line-button" type="button" onClick={() => void vm.clearCache()} disabled={vm.loading}>
          <Eraser size={15} />
          清除远端缓存
        </button>
        <button className="folio-line-button" type="button" onClick={clearKey} disabled={vm.loading || vm.dirty || !nh?.api_key_configured}>
          清除 Key
        </button>
        {vm.dirty ? <span className="folio-settings-action-hint">请先保存或重新读取当前配置</span> : null}
      </div>

      <FolioMetricGrid ariaLabel="连接状态" className="folio-settings-metric-group" items={connectionMetrics} />

      <div className="folio-settings-subhead">
        <h3><Gauge size={16} />运行态与配额</h3>
        <button className="folio-settings-mini-action" type="button" onClick={() => void loadRuntime()} disabled={runtimeLoading}>
          <RefreshCw size={14} className={runtimeLoading ? "spin" : undefined} />
          刷新运行态
        </button>
      </div>
      {runtimeError ? <p className="folio-settings-inline-error" role="alert">{runtimeError}</p> : null}
      <FolioMetricGrid ariaLabel="运行态与配额" className="folio-settings-metric-group is-runtime" items={runtimeMetrics} />

      <div className={`folio-settings-status-band${nh?.api_key_configured ? " is-ready" : " is-attention"}`}>
        <StatusDot ok={Boolean(nh?.api_key_configured)} />
        <span>{nh?.api_key_configured ? "连接配置已就绪，可进行发现与导入。" : "尚未配置 API Key，发现与导入将不可用。"}</span>
      </div>
    </section>
  );
}
