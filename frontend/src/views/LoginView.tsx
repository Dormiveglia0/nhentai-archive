import { LockKeyhole } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ApiClient } from '../lib/api';

type Props = {
  onLogin: (token: string) => void;
};

export function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const client = new ApiClient(null);
      const response = await client.request<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      onLogin(response.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <div className="login-icon">
          <LockKeyhole size={28} />
        </div>
        <h1>Archive Platform</h1>
        <label>
          管理员
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={busy}>
          {busy ? '登录中' : '登录'}
        </button>
      </form>
    </div>
  );
}
