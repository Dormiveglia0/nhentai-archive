import { Database, Download, KeyRound, Languages, RefreshCcw, Save, Shield, TestTube2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHero, StatStrip } from '../components/Shell';
import type { ApiClient, AppSettings, AppStatus, TranslationProvider } from '../lib/api';

export function SettingsPage({ api, refreshStatus }: { api: ApiClient; refreshStatus: () => Promise<void> }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
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
    setNotice('');
    setError('');
    try {
      await action();
      setNotice(label);
      await refreshStatus();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  if (!settings) {
    return <section className="page"><PageHero title="设置" subtitle="正在加载偏好..." />{error ? <p className="notice error">{error}</p> : null}</section>;
  }

  return (
    <section className="page settings-page">
      <PageHero title="设置" seal="偏好" subtitle="管理数据源、翻译服务、资料库路径、导出规则和安全维护。" />
      <StatStrip items={[
        { label: 'API Key', value: settings.secrets?.nhentai_api_key?.configured ? '已配置' : '未配置', hint: settings.secrets?.nhentai_api_key?.masked || '数据源', icon: <KeyRound size={21} />, tone: settings.secrets?.nhentai_api_key?.configured ? 'green' : 'amber' },
        { label: '翻译', value: providerLabel(settings.translation_provider), hint: '仅建议', icon: <Languages size={21} /> },
        { label: 'CDN', value: status?.cdn.servers?.length || 0, hint: '节点', icon: <Database size={21} /> },
        { label: '可用空间', value: formatBytes(status?.storage.free_bytes || 0), hint: '存储', icon: <Shield size={21} /> }
      ]} />
      {notice ? <p className="notice success">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="settings-grid">
        <section className="paper-panel settings-card">
          <header className="panel-head"><div><h2>数据源</h2><p>远端能力全部由后端封装，前端不保存明文 key。</p></div></header>
          <label><span>User-Agent</span><input value={settings.nhentai_user_agent} onChange={(event) => setSettings({ ...settings, nhentai_user_agent: event.target.value })} /></label>
          <label><span>nhentai API Key</span><input type="password" value={secrets.nhentai_api_key || ''} onChange={(event) => setSecrets({ ...secrets, nhentai_api_key: event.target.value })} placeholder={settings.secrets?.nhentai_api_key?.masked || '输入新值'} /></label>
          <div className="row-actions">
            <button className="primary-button" type="button" onClick={() => run('数据源已保存', async () => {
              await api.saveSettings({ nhentai_user_agent: settings.nhentai_user_agent });
              if (secrets.nhentai_api_key?.trim()) await api.saveSecrets({ nhentai_api_key: secrets.nhentai_api_key });
              setSecrets({});
            })}><Save size={16} />保存</button>
            <button className="ghost-button" type="button" onClick={() => run('连接测试完成', async () => { await api.testConnection({ nhentai_user_agent: settings.nhentai_user_agent, nhentai_api_key: secrets.nhentai_api_key || '' }); })}><TestTube2 size={16} />测试连接</button>
          </div>
        </section>

        <section className="paper-panel settings-card">
          <header className="panel-head"><div><h2>翻译</h2><p>机器翻译只生成建议，用户确认后才写入最终数据。</p></div></header>
          <div className="tabs block">
            {(['none', 'google_free_gtx', 'deepl', 'google_paid'] as TranslationProvider[]).map((provider) => (
              <button key={provider} type="button" className={settings.translation_provider === provider ? 'active' : ''} onClick={() => setSettings({ ...settings, translation_provider: provider })}>{providerLabel(provider)}</button>
            ))}
          </div>
          <label><span>DeepL API Key</span><input type="password" value={secrets.deepl_api_key || ''} onChange={(event) => setSecrets({ ...secrets, deepl_api_key: event.target.value })} placeholder={settings.secrets?.deepl_api_key?.masked || '输入新值'} /></label>
          <label><span>Google API Key</span><input type="password" value={secrets.google_translate_api_key || ''} onChange={(event) => setSecrets({ ...secrets, google_translate_api_key: event.target.value })} placeholder={settings.secrets?.google_translate_api_key?.masked || '输入新值'} /></label>
          <button className="primary-button" type="button" onClick={() => run('翻译设置已保存', async () => {
            await api.saveSettings({ translation_provider: settings.translation_provider });
            const payload = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value.trim()));
            if (Object.keys(payload).length) await api.saveSecrets(payload);
            setSecrets({});
          })}><Save size={16} />保存翻译设置</button>
        </section>

        <section className="paper-panel settings-card">
          <header className="panel-head"><div><h2>资料库</h2><p>导入、封面缓存、导出目录可以独立配置。</p></div></header>
          <label><span>导入目录</span><input value={settings.library_import_dir || ''} onChange={(event) => setSettings({ ...settings, library_import_dir: event.target.value })} /></label>
          <label><span>导出目录</span><input value={settings.library_export_dir || ''} onChange={(event) => setSettings({ ...settings, library_export_dir: event.target.value })} /></label>
          <label><span>封面缓存</span><input value={settings.cover_cache_dir || ''} onChange={(event) => setSettings({ ...settings, cover_cache_dir: event.target.value })} /></label>
          <button className="primary-button" type="button" onClick={() => run('资料库路径已保存', async () => { await api.saveSettings({ library_import_dir: settings.library_import_dir, library_export_dir: settings.library_export_dir, cover_cache_dir: settings.cover_cache_dir }); })}><Save size={16} />保存路径</button>
        </section>

        <section className="paper-panel settings-card">
          <header className="panel-head"><div><h2>导出规则</h2><p>生成新的 CBZ，不覆盖原始文件。</p></div></header>
          <label><span>命名规则</span><input value={settings.export_pattern || ''} onChange={(event) => setSettings({ ...settings, export_pattern: event.target.value })} /></label>
          <label><span>标签分隔符</span><input value={settings.tag_separator || ''} onChange={(event) => setSettings({ ...settings, tag_separator: event.target.value })} /></label>
          <label className="check-line"><input type="checkbox" checked={settings.keep_meta_json} onChange={(event) => setSettings({ ...settings, keep_meta_json: event.target.checked })} />保留原 meta.json</label>
          <button className="primary-button" type="button" onClick={() => run('导出规则已保存', async () => { await api.saveSettings({ export_pattern: settings.export_pattern, tag_separator: settings.tag_separator, keep_meta_json: settings.keep_meta_json }); })}><Save size={16} />保存导出规则</button>
        </section>

        <section className="paper-panel settings-card">
          <header className="panel-head"><div><h2>维护</h2><p>轻量维护动作，不删除原始 CBZ。</p></div></header>
          <button className="ghost-button full" type="button" onClick={() => run('失败任务已重试', async () => { await api.retryFailed(); })}><RefreshCcw size={16} />重试失败任务</button>
          <button className="ghost-button full" type="button" onClick={() => run('成功任务已清空', async () => { await api.clearCompleted(); })}><RefreshCcw size={16} />清空成功记录</button>
          <button className="ghost-button full" type="button" onClick={() => run('配置已导出', async () => { await api.exportConfig(); })}><Download size={16} />导出配置</button>
        </section>
      </div>
      {busy ? <p className="notice success">正在处理：{busy}</p> : null}
    </section>
  );
}

function providerLabel(value?: string) {
  const map: Record<string, string> = { none: '关闭', google_free_gtx: 'Google 免费', deepl: 'DeepL', google_paid: 'Google API' };
  return map[value || 'none'] || value || '关闭';
}

function formatBytes(value: number) {
  if (!value) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size > 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(size > 10 ? 0 : 1)} ${units[unit]}`;
}
