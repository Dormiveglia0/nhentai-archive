import { CheckCircle2, Database, FileOutput, FolderOpen, KeyRound, Languages, RefreshCcw, Save, Search, Shield, TestTube2, Wrench, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { PageHeader } from '../components/Shell';
import type { ApiClient, AppLogs, AppSettings, AppStatus, ConnectionTest, TranslationProvider } from '../lib/api';

const sections = [
  { id: 'source', label: '数据源', icon: KeyRound },
  { id: 'translation', label: '翻译', icon: Languages },
  { id: 'library', label: '资料库', icon: FolderOpen },
  { id: 'export', label: '导出', icon: FileOutput },
  { id: 'security', label: '安全', icon: Shield },
  { id: 'maintenance', label: '维护与日志', icon: Wrench }
] as const;

type SectionId = typeof sections[number]['id'];

export function SettingsPage({ api, refreshStatus }: { api: ApiClient; refreshStatus: () => Promise<void> }) {
  const [active, setActive] = useState<SectionId>('source');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [connection, setConnection] = useState<ConnectionTest | null>(null);
  const [logs, setLogs] = useState<AppLogs | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [nextSettings, nextStatus] = await Promise.all([api.settings(), api.status()]);
    setSettings(nextSettings);
    setStatus(nextStatus);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : '设置加载失败'));
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  async function save(next: Partial<AppSettings>) {
    await run('设置已保存', async () => {
      setSettings(await api.saveSettings(next));
      await refreshStatus();
      await load();
    });
  }

  async function saveSecrets(nextSecrets: Record<string, string>) {
    const payload = Object.fromEntries(Object.entries(nextSecrets).filter(([, value]) => value.trim()));
    if (!Object.keys(payload).length) return;
    await run('密钥已保存', async () => {
      const result = await api.saveSecrets(payload);
      setSettings((previous) => previous ? { ...previous, secrets: result.secrets } : previous);
      setSecrets({});
      await refreshStatus();
      await load();
    });
  }

  async function saveSource() {
    if (!settings) return;
    await run('数据源配置已保存', async () => {
      const [nextSettings, secretResult] = await Promise.all([
        api.saveSettings({ nhentai_user_agent: settings.nhentai_user_agent }),
        secrets.nhentai_api_key?.trim() ? api.saveSecrets({ nhentai_api_key: secrets.nhentai_api_key }) : Promise.resolve(null)
      ]);
      setSettings({ ...nextSettings, secrets: secretResult?.secrets || nextSettings.secrets });
      setSecrets((previous) => ({ ...previous, nhentai_api_key: '' }));
      await refreshStatus();
      await load();
    });
  }

  async function testConnection() {
    if (!settings) return;
    await run('连接测试已完成', async () => {
      setConnection(await api.testConnection({
        nhentai_user_agent: settings.nhentai_user_agent,
        nhentai_api_key: secrets.nhentai_api_key || ''
      }));
      await load();
    });
  }

  async function openLogs() {
    await run('日志已刷新', async () => {
      setLogs(await api.logs());
    });
  }

  if (!settings) {
    return <section className="page"><PageHeader title="设置" subtitle="正在加载配置..." />{error ? <p className="notice error">{error}</p> : null}</section>;
  }

  return (
    <section className="page preferences-page">
      <PageHeader
        title="设置"
        subtitle="偏好设置、密钥、存储、导出规则和维护操作。"
        action={<button type="button" className="ghost-button" onClick={load}><RefreshCcw size={16} />刷新</button>}
      />
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="preferences-layout">
        <aside className="preferences-nav">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => setActive(id)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        <main className="preferences-main">
          {active === 'source' ? (
            <PreferenceSection icon={<KeyRound size={20} />} title="数据源" desc="所有远程搜索、预览和下载都由后端调用 API v2，前端不保存明文 key。">
              <label><span>User-Agent</span><input value={settings.nhentai_user_agent} onChange={(event) => setSettings({ ...settings, nhentai_user_agent: event.target.value })} /></label>
              <SecretInput label="nhentai API Key" name="nhentai_api_key" settings={settings} values={secrets} setValues={setSecrets} />
              <div className="settings-hint-grid">
                <span>认证头</span><strong>Authorization: Key &lt;api_key&gt;</strong>
                <span>密钥状态</span><strong>{settings.secrets?.nhentai_api_key?.configured ? settings.secrets.nhentai_api_key.masked : '未配置'}</strong>
              </div>
              <div className="split-actions">
                <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={saveSource}><Save size={16} />保存</button>
                <button type="button" className="ghost-button" disabled={Boolean(busy)} onClick={testConnection}><TestTube2 size={16} />测试连接</button>
              </div>
            </PreferenceSection>
          ) : null}

          {active === 'translation' ? (
            <PreferenceSection icon={<Languages size={20} />} title="翻译" desc="机器翻译只生成建议，作品 metadata 和词典都需要用户确认后才写入。">
              <div className="segmented">
                {(['none', 'google_free_gtx', 'deepl', 'google_paid'] as TranslationProvider[]).map((provider) => (
                  <button type="button" key={provider} className={settings.translation_provider === provider ? 'active' : ''} onClick={() => setSettings({ ...settings, translation_provider: provider })}>{providerLabel(provider)}</button>
                ))}
              </div>
              <SecretInput label="DeepL API Key" name="deepl_api_key" settings={settings} values={secrets} setValues={setSecrets} />
              <SecretInput label="Google Translate API Key" name="google_translate_api_key" settings={settings} values={secrets} setValues={setSecrets} />
              <div className="split-actions">
                <button type="button" className="primary-button" onClick={() => save({ translation_provider: settings.translation_provider })}><Save size={16} />保存翻译设置</button>
                <button type="button" className="ghost-button" onClick={() => saveSecrets(secrets)}><KeyRound size={16} />保存密钥</button>
              </div>
            </PreferenceSection>
          ) : null}

          {active === 'library' ? (
            <PreferenceSection icon={<Database size={20} />} title="资料库" desc="原始 CBZ 不做破坏性修改，扫描目录和导出目录可以独立设置。">
              <label><span>资料库根目录</span><input value={settings.library_dir} readOnly /></label>
              <label><span>导入扫描目录</span><input value={settings.library_import_dir || ''} onChange={(event) => setSettings({ ...settings, library_import_dir: event.target.value })} /></label>
              <label><span>导出目录</span><input value={settings.library_export_dir || ''} onChange={(event) => setSettings({ ...settings, library_export_dir: event.target.value })} /></label>
              <label><span>封面缓存目录</span><input value={settings.cover_cache_dir || ''} onChange={(event) => setSettings({ ...settings, cover_cache_dir: event.target.value })} /></label>
              <StorageMeter free={status?.storage.free_bytes || 0} total={status?.storage.total_bytes || 0} />
              <button type="button" className="primary-button" onClick={() => save({
                library_import_dir: settings.library_import_dir,
                library_export_dir: settings.library_export_dir,
                cover_cache_dir: settings.cover_cache_dir
              })}><Save size={16} />保存资料库设置</button>
            </PreferenceSection>
          ) : null}

          {active === 'export' ? (
            <PreferenceSection icon={<FileOutput size={20} />} title="导出" desc="导出会生成新的 CBZ，并写入确认后的 ComicInfo.xml。">
              <label><span>输出命名模式</span><input value={settings.export_pattern || ''} onChange={(event) => setSettings({ ...settings, export_pattern: event.target.value })} /></label>
              <label><span>标签分隔符</span><input value={settings.tag_separator || ''} onChange={(event) => setSettings({ ...settings, tag_separator: event.target.value })} /></label>
              <label className="checkbox-line"><input type="checkbox" checked={settings.keep_meta_json} onChange={(event) => setSettings({ ...settings, keep_meta_json: event.target.checked })} />保留原 meta.json</label>
              <label className="checkbox-line"><input type="checkbox" checked={settings.update_meta_json} onChange={(event) => setSettings({ ...settings, update_meta_json: event.target.checked })} />导出时更新 meta.json</label>
              <button type="button" className="primary-button" onClick={() => save({
                export_pattern: settings.export_pattern,
                tag_separator: settings.tag_separator,
                keep_meta_json: settings.keep_meta_json,
                update_meta_json: settings.update_meta_json
              })}><Save size={16} />保存导出规则</button>
            </PreferenceSection>
          ) : null}

          {active === 'security' ? <AccountPanel api={api} /> : null}

          {active === 'maintenance' ? (
            <PreferenceSection icon={<Wrench size={20} />} title="维护与日志" desc="维护操作写入结构化日志，日志以浮层打开，不拉长页面。">
              <StatusStrip status={status} />
              <div className="maintenance-grid">
                <MaintenanceButton title="重试失败任务" desc="将 failed 状态任务重新排队。" busy={busy} onClick={() => run('失败任务已重试', async () => { await api.retryFailed(); await load(); })} />
                <MaintenanceButton title="清空成功队列" desc="只删除队列记录，不删除已生成 CBZ。" busy={busy} onClick={() => run('已清空成功任务记录', async () => { await api.clearCompleted(); await load(); })} />
                <MaintenanceButton title="导出配置" desc="导出 masked/configured 配置，不包含明文密钥。" busy={busy} onClick={() => run('配置已导出', async () => { await api.exportConfig(); })} />
                <MaintenanceButton title="查看日志" desc="打开最近导入、搜索、词典、导出和 worker 事件。" busy={busy} onClick={openLogs} />
              </div>
            </PreferenceSection>
          ) : null}
        </main>

        <aside className="preferences-context">
          <h2>运行状态</h2>
          <StatusStrip status={status} />
          <div className="settings-hint-grid">
            <span>CDN 节点</span><strong>{status?.cdn.servers?.length || 0}</strong>
            <span>翻译服务</span><strong>{providerLabel(status?.translation.provider || 'none')}</strong>
            <span>等待任务</span><strong>{status?.worker.queued || 0}</strong>
            <span>失败任务</span><strong>{status?.worker.failed || 0}</strong>
          </div>
        </aside>
      </div>

      {connection ? <ConnectionDrawer connection={connection} onClose={() => setConnection(null)} /> : null}
      {logs ? <LogsDrawer logs={logs} busy={busy === '日志已刷新'} onRefresh={openLogs} onClose={() => setLogs(null)} /> : null}
    </section>
  );
}

function PreferenceSection({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <section className="preference-section">
      <header>{icon}<div><h2>{title}</h2><p>{desc}</p></div></header>
      <div className="preference-form">{children}</div>
    </section>
  );
}

function AccountPanel({ api }: { api: ApiClient }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!newPassword) {
      setError('请输入新密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    try {
      await api.request('/api/account/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码更新失败');
    }
  }

  return (
    <PreferenceSection icon={<Shield size={20} />} title="账户与安全" desc="修改当前管理员密码。新密码只要求非空。">
      <form className="account-form" onSubmit={submit}>
        <label><span>当前密码</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label><span>新密码</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label><span>确认新密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <button type="submit" className="primary-button"><Save size={16} />保存密码</button>
      </form>
    </PreferenceSection>
  );
}

function SecretInput({
  label,
  name,
  settings,
  values,
  setValues
}: {
  label: string;
  name: string;
  settings: AppSettings;
  values: Record<string, string>;
  setValues: (values: Record<string, string>) => void;
}) {
  const state = settings.secrets?.[name];
  return (
    <label>
      <span>{label} {state?.configured ? `已配置 ${state.masked}` : '未配置'}</span>
      <input value={values[name] || ''} onChange={(event) => setValues({ ...values, [name]: event.target.value })} type="password" placeholder="输入新值后保存" />
    </label>
  );
}

function MaintenanceButton({ title, desc, busy, onClick }: { title: string; desc: string; busy: string; onClick: () => void }) {
  return (
    <button className="maintenance-card" type="button" disabled={Boolean(busy)} onClick={onClick}>
      <strong>{title}</strong>
      <span>{desc}</span>
    </button>
  );
}

function StatusStrip({ status }: { status: AppStatus | null }) {
  return (
    <div className="status-strip compact">
      <span><CheckCircle2 size={16} />API {status?.api.key_configured ? '已配置' : '未配置'}</span>
      <span><CheckCircle2 size={16} />CDN {status?.cdn.servers?.length ? '可用' : '待检查'}</span>
      <span><CheckCircle2 size={16} />翻译 {providerLabel(status?.translation.provider || 'none')}</span>
    </div>
  );
}

function ConnectionDrawer({ connection, onClose }: { connection: ConnectionTest; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="side-drawer result-drawer" onClick={(event) => event.stopPropagation()}>
        <header><div><h2>连接测试结果</h2><p>测试使用当前输入框草稿值，不要求先保存。</p></div><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></header>
        <ConnectionLine title="API Root" check={connection.api_root} />
        <ConnectionLine title="API Key" check={connection.auth_key} />
        <ConnectionLine title="CDN" check={{ ok: connection.cdn.ok, detail: connection.cdn.detail }} />
        <div className="settings-hint-grid">
          <span>图片节点</span><strong>{connection.cdn.image_servers?.length || connection.cdn.servers?.length || 0}</strong>
          <span>缩略图节点</span><strong>{connection.cdn.thumb_servers?.length || 0}</strong>
        </div>
      </aside>
    </div>
  );
}

function ConnectionLine({ title, check }: { title: string; check: { ok: boolean; detail: string } }) {
  return <div className={`connection-line ${check.ok ? 'ok' : 'bad'}`}><strong>{title}</strong><span>{check.detail}</span></div>;
}

function LogsDrawer({ logs, busy, onRefresh, onClose }: { logs: AppLogs; busy: boolean; onRefresh: () => void; onClose: () => void }) {
  const [filter, setFilter] = useState('all');
  const [level, setLevel] = useState('all');
  const [query, setQuery] = useState('');
  const allItems = [
    ...logs.events.map((event) => ({ key: `event-${event.id}`, kind: event.action, level: event.level, title: `${event.action} · ${event.level}`, detail: event.message, date: event.created_at })),
    ...logs.task_errors.map((event) => ({ key: `task-${event.task_id}`, kind: 'task_error', level: 'error', title: `任务 #${event.task_id} / 画廊 #${event.gallery_id}`, detail: event.message, date: event.updated_at }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  const kinds = Array.from(new Set(allItems.map((item) => item.kind)));
  const levels = Array.from(new Set(allItems.map((item) => item.level)));
  const q = query.trim().toLowerCase();
  const items = allItems.filter((item) => {
    const hitKind = filter === 'all' || item.kind === filter;
    const hitLevel = level === 'all' || item.level === level;
    const hitText = !q || `${item.title} ${item.detail}`.toLowerCase().includes(q);
    return hitKind && hitLevel && hitText;
  }).slice(0, 100);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="side-drawer logs-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><h2>日志</h2><p>最近维护、导入、搜索、词典、导出、CDN 和 worker 事件。</p></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="logs-toolbar">
          <div className="filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日志" /></div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="日志类型"><option value="all">全部类型</option>{kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select>
          <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="日志级别"><option value="all">全部级别</option>{levels.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" className="ghost-button" onClick={onRefresh} disabled={busy}>{busy ? '刷新中' : '刷新'}</button>
        </div>
        <div className="logs-list">
          {items.map((item) => (
            <div key={item.key} className={`log-item ${item.level}`}>
              <strong>{item.title}</strong>
              <span>{item.date}</span>
              <p>{item.detail}</p>
            </div>
          ))}
          {!items.length ? <p className="muted">暂无日志</p> : null}
        </div>
      </aside>
    </div>
  );
}

function StorageMeter({ free, total }: { free: number; total: number }) {
  const used = Math.max(0, total - free);
  const pct = total ? Math.round((used / total) * 100) : 0;
  return (
    <div className="storage-meter">
      <div><strong>{formatBytes(used)}</strong><span>/ {formatBytes(total)}</span><em>{pct}%</em></div>
      <div className="progress-bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function providerLabel(provider: TranslationProvider) {
  const labels: Record<TranslationProvider, string> = {
    none: '无',
    google_free_gtx: 'Google 免费',
    deepl: 'DeepL',
    google_paid: 'Google API'
  };
  return labels[provider] || provider;
}

function formatBytes(value: number) {
  if (!value) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let next = value;
  let unit = 0;
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024;
    unit++;
  }
  return `${next.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}
