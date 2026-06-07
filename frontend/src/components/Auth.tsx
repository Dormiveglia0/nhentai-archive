import { Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import archiveRoom from '../assets/archive-room.svg';
import { ApiClient, type AuthPayload } from '../lib/api';
import { Logo } from './ui';

export function LoginPage({ needsSetup, onAuth }: { needsSetup: boolean; onAuth: (payload: AuthPayload) => void }) {
  const [username, setUsername] = useState('NH_Collector');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const api = useMemo(() => new ApiClient(null), []);

  useEffect(() => {
    setError('');
  }, [needsSetup]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      if (needsSetup) {
        onAuth(await api.setupAdmin(username, password));
        return;
      }
      onAuth(await api.login(username, password));
    } catch {
      setError(needsSetup ? '管理员创建失败，请检查用户名和密码。' : '用户名或密码不正确。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-brand">
        <Logo large />
        <h1>私人同人志档案馆</h1>
        <p>本地优先，阅读优先，隐私优先。把发现、馆藏、元数据、词典与导出收束进一个安静可靠的私人平台。</p>
        <img src={archiveRoom} alt="" />
      </section>
      <form
        className="login-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="seal">私藏</div>
        <h2>{needsSetup ? '创建管理员' : '管理员登录'}</h2>
        <p>{needsSetup ? '首次启动会创建本地管理员账户。' : '公网入口必须登录后使用。浏览器标题与封面可在进入后开启隐私模式。'}</p>
        <label><span>用户名</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label><span>密码</span><input autoComplete={needsSetup ? 'new-password' : 'current-password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={needsSetup ? '设置管理员密码' : '输入管理员密码'} /></label>
        {error ? <div className="login-error">{error}</div> : null}
        <button className="primary wide" disabled={submitting}><Lock size={16} />{submitting ? '处理中...' : needsSetup ? '创建并进入' : '进入档案馆'}</button>
      </form>
    </div>
  );
}
