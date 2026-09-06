import {
  ArrowRight,
  Eye,
  EyeOff,
  BookOpen,
  Check,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { api, AUTH_REQUIRED_EVENT, type AuthStatus } from "../../lib/api";
import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import { FolioChrome } from "../folio/shell/FolioChrome";
import "../folio/Folio.css";
import "./AuthWakeDemo.css";

type AuthPhase = "loading" | "offline" | "ready" | "error" | "submitting" | "success" | "awake";

type Props = {
  children?: (logout: () => Promise<void>) => ReactNode;
  preview?: boolean;
};

const PREVIEW_PASSWORD = "archive";

export function AuthWakeDemo({ children, preview = false }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const appRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<AuthStatus | null>(preview ? { configured: true, authenticated: false, session_days: 90 } : null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupStep, setSetupStep] = useState<"password" | "confirmation">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<AuthPhase>(preview ? "ready" : "loading");
  const [capsLock, setCapsLock] = useState(false);

  const loadStatus = useCallback(async () => {
    if (preview) return;
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
  }, [preview]);

  useEffect(() => {
    const previous = document.title;
    if (preview) document.title = "NH Archive · 登录预览";
    return () => {
      document.title = previous;
    };
  }, [preview]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (preview) return;
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
  }, [preview]);

  useEffect(() => {
    if (phase !== "success") return;
    const timer = window.setTimeout(() => setPhase("awake"), reduceMotion ? 0 : 260);
    return () => window.clearTimeout(timer);
  }, [phase, reduceMotion]);

  const locked = phase === "submitting" || phase === "success";
  const awake = phase === "awake";
  const setup = status ? !status.configured : false;
  const confirming = setup && setupStep === "confirmation";
  const activeValue = confirming ? confirmation : password;
  const fieldLabel = setup ? (confirming ? "再次输入" : "设置密码") : "访问密码";
  const actionLabel = setup ? (confirming ? "确认并进入" : "继续") : "登录";
  const realApp = Boolean(status?.authenticated && children && !preview);

  useEffect(() => {
    if (!awake) return;
    const target = appRef.current?.querySelector<HTMLElement>(".app-route-reader") ?? appRef.current?.querySelector<HTMLElement>("main");
    target?.focus({ preventScroll: true });
  }, [awake]);

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
    if (preview) {
      resetForm();
      return;
    }
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
      let next: AuthStatus;
      if (preview) {
        if (password !== PREVIEW_PASSWORD) throw new Error("演示密码不匹配，请重新输入。");
        next = { configured: true, authenticated: true, session_days: 90 };
      } else {
        next = setup ? await api.authSetup(password) : await api.authLogin(password);
      }
      setStatus(next);
      setFormError(null);
      inputRef.current?.blur();
      setShowPassword(false);
      setPhase("success");
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
          ? "正在进入"
      : phase === "error"
        ? "验证失败"
        : confirming
          ? "再次确认"
          : setup
            ? "首次设置"
            : "未登录";

  const errorMessage = formError ?? "访问验证失败，请重试";

  return (
    <div
      className={`folio folio-no-command auth-wake-demo auth-wake-${phase}${realApp ? " has-real-app" : ""}`}
      aria-busy={phase === "loading" || locked}
    >
      {realApp ? (
        <div className="auth-wake-real-app" aria-hidden={!awake} ref={(node) => { appRef.current = node; if (node) node.inert = !awake; }}>
          {children?.(logout)}
        </div>
      ) : awake && preview ? (
        <FolioChrome page="workbench" onNavigate={(page) => window.location.assign(`/demo#${page}`)} onLogout={logout}>
          <section className="folio-page-body auth-wake-preview">
            <BookOpen size={28} aria-hidden="true" />
            <h2>已登录</h2>
            <p>选择导航查看页面。</p>
          </section>
        </FolioChrome>
      ) : null}

      {!awake ? (
        <div className="auth-wake-portal">
          <main className="auth-wake-stage">
            <header className="auth-wake-brand">
              <span className="auth-wake-logo" aria-label="NH Archive">nh<span>archive</span><i /></span>
              <span className="auth-wake-category">成人漫画库</span>
            </header>

            {phase === "loading" ? (
              <div className="auth-wake-connecting" role="status"><LoaderCircle size={22} className="spin" /><span>正在连接…</span></div>
            ) : (
              <section className="auth-wake-access" aria-label="访问控制">
                <header className="auth-wake-access-head">
                  <h1>{phase === "offline" ? "连接失败" : setup ? (confirming ? "确认密码" : "设置密码") : "登录"}</h1>
                  <span role="status">{stateLabel}</span>
                </header>
                {setup ? <p className="auth-wake-instruction">{confirming ? "再次输入密码。" : "首次使用，请设置访问密码。"}</p> : null}

                {phase === "offline" ? (
                  <div className="auth-wake-status" role="alert">
                    <p>{statusError}</p>
                    <button type="button" onClick={() => void loadStatus()}>重新连接 <ArrowRight size={17} /></button>
                  </div>
                ) : (
                  <form onSubmit={submit} aria-busy={locked}>
                    <label className="auth-wake-label" htmlFor="auth-wake-password">{fieldLabel}</label>
                    <div className="auth-wake-field">
                      <LockKeyhole size={18} aria-hidden="true" />
                      <input
                        id="auth-wake-password"
                        name="password"
                        ref={inputRef}
                        autoFocus
                        type={showPassword ? "text" : "password"}
                        value={activeValue}
                        disabled={locked}
                        maxLength={256}
                        autoComplete={setup ? "new-password" : "current-password"}
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={confirming ? "再次输入密码" : "输入密码"}
                        aria-describedby={preview ? "auth-wake-hint auth-wake-feedback" : "auth-wake-feedback"}
                        aria-invalid={phase === "error"}
                        onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                        onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                        onBlur={() => setCapsLock(false)}
                        onChange={(event) => {
                          if (confirming) setConfirmation(event.target.value);
                          else setPassword(event.target.value);
                          setFormError(null);
                          if (phase === "error") setPhase("ready");
                        }}
                      />
                      <button
                        className="auth-wake-reveal"
                        type="button"
                        disabled={locked}
                        aria-label={showPassword ? "隐藏密码" : "显示密码"}
                        aria-pressed={showPassword}
                        onClick={() => {
                          setShowPassword((value) => !value);
                          window.requestAnimationFrame(() => inputRef.current?.focus());
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div id="auth-wake-feedback" className="auth-wake-feedback" aria-live="polite">
                      <AnimatePresence initial={false} mode="wait">
                        {phase === "error" ? (
                          <m.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast, ease: ease.standard }}>{errorMessage}</m.p>
                        ) : capsLock ? <p key="caps">大写锁定已开启</p> : null}
                      </AnimatePresence>
                    </div>
                    <button className="auth-wake-submit" type="submit" disabled={locked} aria-label={actionLabel}>
                      <span>{phase === "submitting" ? "正在验证…" : phase === "success" ? "已验证，正在进入" : actionLabel}</span>
                      {phase === "submitting" ? <LoaderCircle size={19} className="spin" /> : phase === "success" ? <Check size={19} /> : <ArrowRight size={19} />}
                    </button>
                    <div className="auth-wake-form-foot">
                      {preview ? <p id="auth-wake-hint">演示密码：archive</p> : null}
                      {confirming ? <button type="button" disabled={locked} onClick={() => {
                        setSetupStep("password");
                        setConfirmation("");
                        setShowPassword(false);
                        setFormError(null);
                        setPhase("ready");
                        window.requestAnimationFrame(() => inputRef.current?.focus());
                      }}>返回修改</button> : null}
                    </div>
                  </form>
                )}
              </section>
            )}
          </main>
        </div>
      ) : null}
    </div>
  );
}
