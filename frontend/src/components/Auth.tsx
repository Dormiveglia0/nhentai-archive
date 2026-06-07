import { KeyRound } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { ApiClient } from '../lib/api';

export type AuthPayload = { token: string; username: string };

export function Splash() {
  return (
    <div className="auth-screen">
      <section className="auth-panel compact">正在加载</section>
    </div>
  );
}

export function SetupView({ onAuth }: { onAuth: (payload: AuthPayload) => void }) {
  return <AuthForm title="首次运行" subtitle="创建管理员账户后才能访问平台。" endpoint="/api/setup/admin" button="创建并登录" onAuth={onAuth} />;
}

export function LoginView({ onAuth }: { onAuth: (payload: AuthPayload) => void }) {
  return <AuthForm title="管理员登录" subtitle="公网入口必须登录后使用。" endpoint="/api/auth/login" button="登录" onAuth={onAuth} />;
}

function AuthForm({
  title,
  subtitle,
  endpoint,
  button,
  onAuth
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  button: string;
  onAuth: (payload: AuthPayload) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const api = new ApiClient(null);
      onAuth(await api.request<AuthPayload>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title={title} subtitle={subtitle}>
      <form className="stack" onSubmit={submit}>
        <label>
          <span>用户名</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="输入用户名" />
        </label>
        <label>
          <span>密码</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="输入密码" />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={busy}>{busy ? '处理中' : button}</button>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-screen">
      <section className="auth-panel">
        <div className="auth-icon"><KeyRound size={24} /></div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
