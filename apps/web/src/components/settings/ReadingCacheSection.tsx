import { ArrowUpRight, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { pageHref } from "../../lib/navigation";
import { api, type ReadingCacheConfig, type ReadingCacheSummary } from "../../lib/api";
import { formatBytes } from "../../lib/format";

export function ReadingCacheSection() {
  const [summary, setSummary] = useState<ReadingCacheSummary | null>(null);
  const [config, setConfig] = useState<ReadingCacheConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const fieldsRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    async function load() {
      if (!alive) return;
      if (!document.hidden) {
        try {
          const payload = await api.readingCache();
          if (!alive) return;
          setSummary(payload);
          setConfig(value => value ?? payload.config);
          setLoadError("");
        } catch (exc) { if (alive) setLoadError(exc instanceof Error ? exc.message : String(exc)); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [revision]);

  async function save() {
    const inputs = Array.from(fieldsRef.current?.querySelectorAll<HTMLInputElement>("input") ?? []);
    if (!inputs.length || inputs.some(input => !input.reportValidity())) return;
    const values = Object.fromEntries(inputs.map(input => [input.name, input.valueAsNumber]));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = await api.configureReadingCache({
        max_bytes: Math.round(values.max_gib * 1024 ** 3), ttl_hours: values.ttl_hours,
        max_parallel: values.max_parallel, min_free_bytes: Math.round(values.free_mib * 1024 ** 2),
      });
      setSummary(payload);
      setConfig(payload.config);
      setDirty(false);
      setMessage("阅读缓存设置已保存");
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!window.confirm("清理未在用的阅读缓存？下次阅读时会重新下载。源文件、封面和元数据都会保留。")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.clearReadingCache();
      setMessage("已清理 " + result.deleted + " 部缓存，释放 " + formatBytes(result.freed_bytes));
      setRevision(value => value + 1);
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  return <section className="folio-reading-cache" aria-label="阅读缓存">
    <div className="folio-settings-subhead"><h3>阅读缓存</h3><div className="folio-storage-head-actions"><a className="folio-line-button" href={pageHref({ name: "files" })}>管理媒体库<ArrowUpRight size={15} /></a><button className="folio-settings-mini-action" type="button" aria-label="刷新缓存用量" onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} /></button></div></div>
    <div className="folio-cache-usage" aria-busy={!summary}>
      <div><strong>{summary ? `${formatBytes(summary.ready_bytes + summary.reserved_bytes)} / ${formatBytes(summary.config.max_bytes)}` : "正在读取缓存用量…"}</strong><span>{summary ? `${summary.ready_count} 部已缓存 · ${summary.active_count} 部在用` : "正在读取缓存状态…"}</span></div>
      <progress aria-label="阅读缓存用量" value={summary ? Math.min(summary.ready_bytes + summary.reserved_bytes, summary.config.max_bytes) : undefined} max={summary?.config.max_bytes ?? 1} />
      {summary?.reserved_bytes ? <p>下载预留 {formatBytes(summary.reserved_bytes)}</p> : null}
      {summary && summary.ready_bytes + summary.reserved_bytes > summary.config.max_bytes ? <p className="folio-media-error">在用缓存超过当前配额，退出阅读后自动回收。</p> : null}
    </div>
    <fieldset ref={fieldsRef} key={JSON.stringify(config)} className="folio-cache-fields" disabled={busy || !config} onChange={() => setDirty(true)} onKeyDown={event => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); if (!busy) void save(); }
    }}>
      <div className="folio-field-matrix">
        <label className="folio-field"><span>缓存配额（GiB）</span><input name="max_gib" type="number" defaultValue={config ? config.max_bytes / 1024 ** 3 : ""} min={.0625} max={1024} step="any" required /><i /></label>
        <label className="folio-field"><span>空闲保留期限（小时）</span><input name="ttl_hours" type="number" defaultValue={config?.ttl_hours ?? ""} min={1} max={8760} step={1} required /><i /></label>
        <label className="folio-field"><span>同时下载数量</span><input name="max_parallel" type="number" defaultValue={config?.max_parallel ?? ""} min={1} max={4} step={1} required /><i /></label>
        <label className="folio-field"><span>磁盘保留空间（MiB）</span><input name="free_mib" type="number" defaultValue={config ? config.min_free_bytes / 1024 ** 2 : ""} min={0} max={1048576} step="any" required /><i /></label>
      </div>
    </fieldset>
    {error || loadError ? <p className="folio-media-error" role="alert">{error || loadError}</p> : null}
    {message ? <p className="folio-media-feedback" role="status">{message}</p> : null}
    <div className="folio-media-actions folio-cache-actions">
      <button className="folio-line-button is-primary" type="button" disabled={busy || !dirty} onClick={() => void save()}><Save size={15} />{busy ? "正在处理" : "保存缓存设置"}</button>
      <button className="folio-line-button" type="button" disabled={busy || !summary?.ready_count} onClick={() => void clear()}><Trash2 size={15} />清理缓存</button>
    </div>
    <p className="folio-media-hint">在用与下载中的作品受保护；清理只回收阅读缓存，保留源文件、封面与标签。</p>
  </section>;
}
