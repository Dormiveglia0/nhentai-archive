import { Archive, LockKeyhole, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { api, AUTH_REQUIRED_EVENT, type AuthStatus } from "../../lib/api";
import "./AuthGate.css";

type Props = {
  children: (logout: () => Promise<void>) => ReactNode;
};

export function AuthGate({ children }: Props) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusError(null);
    try {
      setStatus(await api.authStatus());
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const requireLogin = () => {
      setStatus((current) => ({
        configured: true,
        authenticated: false,
        session_days: current?.session_days ?? 90,
      }));
      setPassword("");
      setConfirmation("");
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, requireLogin);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, requireLogin);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status) return;
    if (!password) {
      setFormError("密码不能为空");
      return;
    }
    if (!status.configured && password !== confirmation) {
      setFormError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const next = status.configured ? await api.authLogin(password) : await api.authSetup(password);
      setStatus(next);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    try {
      await api.authLogout();
    } finally {
      setStatus({ configured: true, authenticated: false, session_days: status?.session_days ?? 90 });
      setPassword("");
      setConfirmation("");
    }
  }

  if (status?.authenticated) return children(logout);

  const setup = status ? !status.configured : false;
  return (
    <main className="auth-gate">
      <section className="auth-card" aria-labelledby="auth-title" aria-busy={submitting || !status}>
        <header className="auth-brand">
          <span aria-hidden="true"><Archive size={23} /></span>
          <div><strong>NH Archive</strong><small>LOCAL COLLECTION</small></div>
        </header>

        {statusError ? (
          <div className="auth-status-error" role="alert">
            <LockKeyhole size={22} />
            <h1 id="auth-title">无法连接本地服务</h1>
            <p>{statusError}</p>
            <button type="button" onClick={() => void loadStatus()}>重新连接</button>
          </div>
        ) : !status ? (
          <div className="auth-loading" role="status">
            <LockKeyhole size={24} />
            <span>正在确认访问状态…</span>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="auth-intro">
              <span aria-hidden="true"><ShieldCheck size={20} /></span>
              <div>
                <h1 id="auth-title">{setup ? "创建访问密码" : "解锁本地馆藏"}</h1>
                <p>{setup ? "首次访问可设置任意非空密码，不限制字符种类或组合，也不会创建用户名或远端账户。" : "输入访问密码继续使用本地馆藏。"}</p>
              </div>
            </div>

            <label>
              <span>{setup ? "访问密码" : "密码"}</span>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={setup ? "new-password" : "current-password"}
                maxLength={256}
                required
              />
            </label>
            {setup ? (
              <label>
                <span>再次输入</span>
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  maxLength={256}
                  required
                />
              </label>
            ) : null}

            {formError ? <p className="auth-form-error" role="alert">{formError}</p> : null}
            <button className="auth-submit" type="submit" disabled={submitting}>
              <LockKeyhole size={17} />
              {submitting ? "正在验证…" : setup ? "创建并进入" : "进入馆藏"}
            </button>
            <small className="auth-session-note">本设备将保持登录 {status.session_days} 天；密码不明文保存，会话凭据由 HttpOnly Cookie 保管。</small>
          </form>
        )}
      </section>
    </main>
  );
}
