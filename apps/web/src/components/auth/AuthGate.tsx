import {
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  Menu,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { api, AUTH_REQUIRED_EVENT, type AuthStatus } from "../../lib/api";
import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import { FOLIO_PAGES } from "../folio/config";
import { WorkbenchScene } from "../folio/scenes/WorkbenchScene";
import "../folio/Folio.css";
import "./AuthGate.css";

type AuthPhase = "loading" | "offline" | "ready" | "error" | "submitting" | "success" | "awake";

type Props = {
  children: (logout: () => Promise<void>) => ReactNode;
};

export function AuthGate({ children }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupStep, setSetupStep] = useState<"password" | "confirmation">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<AuthPhase>("loading");
  const [focused, setFocused] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusError(null);
    setPhase("loading");
    try {
      const next = await api.authStatus();
      setStatus(next);
      setPhase(next.authenticated ? "awake" : "ready");
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : String(error));
      setPhase("offline");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const requireLogin = () => {
      setStatus((current) => ({ configured: true, authenticated: false, session_days: current?.session_days ?? 90 }));
      setPassword("");
      setConfirmation("");
      setSetupStep("password");
      setShowPassword(false);
      setFormError(null);
      setPhase("ready");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, requireLogin);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, requireLogin);
  }, []);

  const locked = phase === "submitting" || phase === "success";
  const awake = phase === "awake";
  const setup = status ? !status.configured : false;
  const confirming = setup && setupStep === "confirmation";
  const activeValue = confirming ? confirmation : password;
  const fieldLabel = setup ? (confirming ? "再次输入" : "设置密码") : "访问密码";
  const actionLabel = setup ? (confirming ? "确认并进入" : "继续") : "验证并进入";
  const realApp = Boolean(status?.authenticated);

  function resetForm() {
    setPassword("");
    setConfirmation("");
    setSetupStep("password");
    setShowPassword(false);
    setFormError(null);
    setStatusError(null);
    setPhase("ready");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function logout() {
    try {
      await api.authLogout();
    } finally {
      setStatus({ configured: true, authenticated: false, session_days: status?.session_days ?? 90 });
      resetForm();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status || locked || awake) return;
    if (!activeValue) {
      setFormError(confirming ? "请再次输入密码" : setup ? "请设置访问密码" : "请输入访问密码");
      setPhase("error");
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (setup && !confirming) {
      setSetupStep("confirmation");
      setFormError(null);
      setPhase("ready");
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (setup && password !== confirmation) {
      setFormError("两次输入的密码不一致");
      setPhase("error");
      window.requestAnimationFrame(() => inputRef.current?.select());
      return;
    }

    setPhase("submitting");
    try {
      const next = setup ? await api.authSetup(password) : await api.authLogin(password);
      setStatus(next);
      setFormError(null);
      if (!reduceMotion) await new Promise<void>((resolve) => window.setTimeout(resolve, 360));
      setPhase("success");
      if (!reduceMotion) await new Promise<void>((resolve) => window.setTimeout(resolve, 760));
      setPhase("awake");
      setPassword("");
      setConfirmation("");
      setSetupStep("password");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
      setPhase("error");
      window.requestAnimationFrame(() => inputRef.current?.select());
    }
  }

  const stateLabel = phase === "offline"
    ? "服务未连接"
    : phase === "loading"
      ? "正在连接"
      : phase === "submitting"
        ? "正在验证"
        : phase === "success"
          ? "正在唤醒"
      : phase === "error"
        ? "凭证未通过"
        : confirming
          ? "再次确认"
          : setup
            ? "首次设置"
            : "待验证";

  const errorMessage = formError ?? "访问验证失败，请重试";

  return (
    <main
      className={`folio folio-no-command auth-gate auth-wake-${phase}${focused ? " is-focused" : ""}${realApp ? " has-real-app" : ""}`}
      aria-label="NH Archive 访问控制"
      aria-busy={phase === "loading" || locked}
    >
      <div className="folio-binding auth-wake-binding" aria-hidden="true"><span className="folio-binding-progress" /></div>

      {realApp ? (
        <div className="auth-wake-real-app" aria-hidden={!awake}>
          {children(logout)}
        </div>
      ) : null}

      {!realApp ? <header className="auth-wake-topbar" aria-hidden={!awake}>
        <div className="auth-wake-brand">
          <span className="auth-wake-brand-mark"><span>NH</span><i /></span>
          <span className="auth-wake-brand-copy"><strong>Archive</strong><small>local collection</small></span>
        </div>
        <nav className="auth-wake-nav" aria-label="休眠导航">
          {FOLIO_PAGES.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={index === 0 ? "is-active" : ""} type="button" tabIndex={awake ? 0 : -1}>
                <Icon size={17} />
                <strong>{item.label}</strong>
              </button>
            );
          })}
        </nav>
        <div className="auth-wake-actions">
          <button type="button" aria-label="锁定" title="锁定" onClick={() => void logout()} tabIndex={awake ? 0 : -1}>
            <LogOut size={17} /><span>锁定</span>
          </button>
          <button className="auth-wake-menu" type="button" aria-label="打开导航" tabIndex={awake ? 0 : -1}><Menu size={20} /></button>
        </div>
      </header> : null}

      {!realApp ? <section className="auth-wake-shell" aria-hidden={!awake}>
        <header className="auth-wake-page-head">
          <div>
            <h1>工作台</h1>
            <p>馆藏、治理、任务与文件状态的每日入口。</p>
          </div>
          <div className="auth-wake-scene" aria-hidden="true">
            <svg viewBox="0 0 540 230" preserveAspectRatio="xMaxYMid meet"><WorkbenchScene /></svg>
          </div>
        </header>
        <div className="auth-wake-page-body">
          <div className="auth-wake-shell-loading" aria-hidden="true"><span /><span /><span /><span /></div>
        </div>
      </section> : null}

      <div className="auth-wake-registration" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      {phase === "loading" || awake ? null : <section className="auth-wake-access" aria-label="访问控制">
        <header>
          <span>访问控制</span>
          <strong>{stateLabel}</strong>
        </header>

        {phase === "offline" ? (
          <div className="auth-wake-status" role="alert">
            <span>{statusError}</span>
            <button type="button" onClick={() => void loadStatus()}>重新连接</button>
          </div>
        ) : (
        <form onSubmit={submit}>
          <label className="auth-wake-field">
            <span>{fieldLabel}</span>
            <span className="auth-wake-input-wrap">
              <input
                ref={inputRef}
                autoFocus
                type={showPassword ? "text" : "password"}
                value={activeValue}
                disabled={locked || awake}
                autoComplete={setup ? "new-password" : "current-password"}
                aria-label={fieldLabel}
                aria-describedby={phase === "error" ? "auth-wake-feedback" : undefined}
                aria-invalid={phase === "error"}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(event) => {
                  if (confirming) setConfirmation(event.target.value);
                  else setPassword(event.target.value);
                  setFormError(null);
                  if (phase === "error") setPhase("ready");
                }}
              />
              <i aria-hidden="true" />
            </span>
            <button
              className="auth-wake-reveal"
              type="button"
              disabled={locked || awake}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              aria-pressed={showPassword}
              onClick={() => {
                setShowPassword((value) => !value);
                window.requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button className="auth-wake-submit" type="submit" disabled={locked || awake} aria-label={actionLabel}>
              <ArrowRight size={20} />
            </button>
          </label>

          <AnimatePresence initial={false}>
            {phase === "error" ? (
              <m.p
                id="auth-wake-feedback"
                role="alert"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }}
                transition={{ duration: duration.fast, ease: ease.standard }}
              >
                {errorMessage}
              </m.p>
            ) : null}
          </AnimatePresence>
        </form>
        )}
      </section>}

      <div className="auth-wake-scan" aria-hidden="true"><i /></div>

    </main>
  );
}
