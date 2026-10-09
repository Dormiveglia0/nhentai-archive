import "./NotificationSection.css";
import { createPortal } from "react-dom";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { Mail, RefreshCw, Save, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, type MailOutbox, type SmtpSettings } from "../../lib/api";
import { parseUtcTimestamp } from "../../lib/format";
import { FolioSelect, FolioToggleRow } from "../folio/ui/FolioPrimitives";

export function SmtpSection() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [config, setConfig] = useState<SmtpSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [security, setSecurity] = useState<SmtpSettings["security"]>("starttls");
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [outbox, setOutbox] = useState<MailOutbox | null>(null);
  const [outboxError, setOutboxError] = useState("");
  const [revision, setRevision] = useState(0);
  const fieldsRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    if (config) return;
    let alive = true;
    api.smtpSettings().then(payload => {
      if (alive) { setConfig(payload); setEnabled(payload.enabled); setSecurity(payload.security); }
    }).catch(exc => { if (alive) setError(exc.message); });
    return () => { alive = false; };
  }, [revision, Boolean(config)]);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    async function load() {
      if (!alive) return;
      if (!document.hidden) {
        try { const data = await api.mailOutbox(); if (alive) { setOutbox(data); setOutboxError(""); } }
        catch (exc) { if (alive) setOutboxError(exc instanceof Error ? exc.message : String(exc)); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [revision]);

  async function save() {
    const inputs = Array.from(fieldsRef.current?.querySelectorAll<HTMLInputElement>("input[name]") ?? []);
    if (!config || inputs.some(input => !input.reportValidity())) return;
    const values = Object.fromEntries(inputs.map(input => [input.name, input.value]));
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = await api.configureSmtp({
        enabled, security, host: values.host, port: Number(values.port), username: values.username,
        sender: values.sender, recipient: values.recipient, site_url: values.site_url,
        timeout_seconds: Number(values.timeout_seconds), password: password || undefined, clear_password: clearPassword,
      });
      setConfig(payload); setDirty(false); setPassword(""); setClearPassword(false); setMessage("邮件通知设置已保存");
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api.testSmtp();
      if (result.ok) setMessage(result.message); else setError(result.message);
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  async function retry(id: number) {
    setBusy(true); setError("");
    try { await api.retryMail(id); setRevision(value => value + 1); setMessage("通知已重新加入发送队列"); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  if (!config) return <section className="folio-smtp" aria-label="邮件通知" aria-busy={!error}>
    <div className="folio-settings-subhead"><h3><Mail size={16} />邮件通知</h3></div>
    {error ? <p className="folio-media-error" role="alert">{error}<button className="folio-settings-mini-action" type="button" onClick={() => setRevision(value => value + 1)}>重试</button></p>
      : <p className="folio-media-hint" role="status">正在读取邮件配置…</p>}
  </section>;

  return <section className="folio-smtp" aria-label="邮件通知">
    <div className="folio-settings-subhead"><h3><Mail size={16} />邮件通知</h3></div>
    {config ? <fieldset ref={fieldsRef} key={JSON.stringify(config)} disabled={busy} onChange={() => setDirty(true)} onKeyDown={event => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); if (!busy) void save(); }
    }}>
      <FolioToggleRow label="开启邮件通知" copy="只通知开启后的新更新，历史作品不补发。" checked={enabled} onChange={value => { setEnabled(value); setDirty(true); }} />
      <div className="folio-field-matrix">
        <label className="folio-field"><span>SMTP服务器</span><input name="host" defaultValue={config.host} required={enabled} maxLength={253} placeholder="smtp.example.com" /><i /></label>
        <label className="folio-field"><span>端口</span><input name="port" type="number" defaultValue={config.port} min={1} max={65535} step={1} required /><i /></label>
        <FolioSelect label="连接方式" value={security} options={[{ value: "starttls", label: "STARTTLS" }, { value: "ssl", label: "SSL / TLS" }, { value: "none", label: "不加密" }]} onChange={value => { setSecurity(value); setDirty(true); }} />
        <label className="folio-field"><span>用户名</span><input name="username" defaultValue={config.username} maxLength={320} autoComplete="off" /><i /></label>
        <label className="folio-field folio-field-wide"><span>SMTP密码</span><input type="password" value={password} onChange={event => { setPassword(event.target.value); setClearPassword(false); setDirty(true); }} maxLength={4096} autoComplete="new-password" placeholder={config.password_configured && !clearPassword ? "已保存，留空保留" : "输入SMTP密码"} /><i /></label>
        {config.password_configured ? <label className="folio-smtp-clear"><input type="checkbox" checked={clearPassword} onChange={event => { setClearPassword(event.target.checked); setPassword(""); setDirty(true); }} />清除已保存的密码</label> : null}
        <label className="folio-field"><span>发件邮箱</span><input name="sender" type="email" defaultValue={config.sender} required={enabled} maxLength={320} /><i /></label>
        <label className="folio-field"><span>收件邮箱</span><input name="recipient" type="email" defaultValue={config.recipient} required={enabled} maxLength={320} /><i /></label>
        <label className="folio-field"><span>网站地址（可选，用于邮件内链接）</span><input name="site_url" type="url" defaultValue={config.site_url} maxLength={2048} placeholder="https://archive.example.com" /><i /></label>
        <label className="folio-field"><span>连接超时（秒）</span><input name="timeout_seconds" type="number" defaultValue={config.timeout_seconds} min={3} max={60} step={1} required /><i /></label>
      </div>
    </fieldset> : <p className="folio-media-hint">正在读取邮件配置…</p>}
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {message ? <p className="folio-media-feedback" role="status">{message}</p> : null}
    <div className="folio-media-actions folio-smtp-actions">
      <button className="folio-line-button" type="button" onClick={() => setPreviewOpen(true)}><Mail size={15} />预览邮件</button>
      <button className="folio-line-button is-primary" type="button" disabled={!config || busy || !dirty} onClick={() => void save()}><Save size={15} />保存邮件设置</button>
      <button className="folio-line-button" type="button" disabled={!config?.host || !config.sender || !config.recipient || busy || dirty} onClick={() => void test()}><Send size={15} />发送测试邮件</button>
    </div>
    <details className="folio-smtp-outbox">
      <summary>发送记录{outbox?.counts.failed ? " · " + outbox.counts.failed + " 失败" : ""}</summary>
      {outboxError ? <p className="folio-media-error" role="alert">{outboxError}</p> : null}
      {!outbox?.result.length ? <p className="folio-media-hint">暂无发送记录</p> : outbox.result.map(mail => <div key={mail.id}>
        <span><strong>{mail.name ? (mail.tag_type === "artist" ? "作者 " : "社团 ") + mail.name : "邮件通知"}</strong><time>{parseUtcTimestamp(mail.created_at)?.toLocaleString() ?? "—"}</time></span>
        <span>{({ pending: "等待发送", sending: "正在发送", sent: "已发送", failed: "发送失败", cancelled: "已取消" })[mail.status]}</span>
        {mail.status === "failed" || mail.status === "pending" ? <button className="folio-settings-mini-action" type="button" disabled={busy || !config?.enabled} onClick={() => void retry(mail.id)}><RefreshCw size={14} />重试</button> : null}
        {mail.last_error ? <p className="folio-media-error">{mail.last_error}</p> : null}
      </div>)}
    </details>
    {previewOpen ? <MailPreviewDialog onClose={() => setPreviewOpen(false)} /> : null}
  </section>;
}

function MailPreviewDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useNativeDialog(dialog, onClose);
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api.previewMail().then(value => { if (alive) setHtml(value.html); }).catch(reason => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, []);
  return createPortal(<dialog ref={dialog} className="folio-mail-preview" aria-label="通知邮件预览">
    <header><h2>通知邮件预览</h2><button type="button" data-dialog-focus autoFocus onClick={dismiss}>关闭</button></header>
    {error ? <p className="folio-media-error" role="alert">{error}</p> : html ? <iframe title="通知邮件正文" sandbox="" srcDoc={html} /> : <p role="status">正在读取作品…</p>}
  </dialog>, document.querySelector(".folio") ?? document.body);
}
