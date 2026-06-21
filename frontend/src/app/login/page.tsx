"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GoogleLogin } from "@react-oauth/google";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/Icons";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [step, setStep] = useState<"email" | "password">("email");
  const [resolvedUser, setResolvedUser] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { login } = useAuth();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  async function continueToPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    setChecking(true);
    try {
      const result = await authApi.checkLoginEmail(form.email.trim());
      setResolvedUser(result.username);
      setForm(prev => ({ ...prev, email: result.email }));
      setStep("password");
    } catch (err: any) {
      setError(err.message || "Email not found");
    }
    setChecking(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(form);
      login(res.access_token, res.user);
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
    setLoading(false);
  }

  async function handleGoogleSuccess(credentialResponse: any) {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.googleLogin(credentialResponse.credential);
      login(res.access_token, res.user);
    } catch (err: any) {
      setError(err.message || "Google login failed");
    }
    setLoading(false);
  }

  function backToEmail() {
    setStep("email");
    setError("");
  }

  function handleSwipeEnd(x: number) {
    if (touchStartX === null) return;
    const delta = x - touchStartX;
    setTouchStartX(null);
    if (step === "password" && delta > 55) backToEmail();
  }

  const panelBase: React.CSSProperties = {
    width: "100%",
    transition: "transform 0.35s ease, opacity 0.35s ease",
  };

  const emailPanelStyle: React.CSSProperties = step === "email"
    ? { ...panelBase, position: "relative", transform: "translateX(0%)", opacity: 1 }
    : { ...panelBase, position: "absolute", top: 0, left: 0, transform: "translateX(-110%)", opacity: 0, pointerEvents: "none" };

  const passwordPanelStyle: React.CSSProperties = step === "password"
    ? { ...panelBase, position: "relative", transform: "translateX(0%)", opacity: 1 }
    : { ...panelBase, position: "absolute", top: 0, left: 0, transform: "translateX(110%)", opacity: 0, pointerEvents: "none" };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthHeader title="LOGIN" subtitle="Welcome to the arena" />
        <StepDots total={2} current={step === "email" ? 0 : 1} />

        <div className="auth-stepper" aria-label="Login progress">
          <button type="button" className="active" onClick={backToEmail}><CheckIcon /> Email</button>
          <span className={step === "password" ? "active" : ""}>Password</span>
        </div>

        <div
          style={{ position: "relative", overflow: "hidden", width: "100%" }}
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
        >
          {/* Email panel — relative when active, absolute when hidden (takes no height) */}
          <div style={emailPanelStyle}>
            <form onSubmit={continueToPassword}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  id="login-email"
                  className="form-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="joueur@email.com"
                  autoFocus
                />
              </div>
              {error && step === "email" && <AuthError message={error} />}
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={checking}>
                {checking
                  ? <><span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} /> Checking email...</>
                  : <>Suivant <ArrowRightIcon /></>}
              </button>
            </form>
          </div>

          {/* Password panel — relative when active, absolute when hidden (takes no height) */}
          <div style={passwordPanelStyle}>
            <form onSubmit={handleSubmit}>
              <button type="button" className="auth-back-btn" onClick={backToEmail}>
                <ArrowLeftIcon /> Change email
              </button>
              <div className="auth-welcome">
                    <span>WELCOME-BACK <strong><i>{resolvedUser || "player"}</i></strong> ...</span>
                    
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Password"
                    style={{ paddingRight: "44px" }}
                  />
                  <PasswordToggle show={showPassword} onClick={() => setShowPassword(!showPassword)} />
                </div>
              </div>
              {error && step === "password" && <AuthError message={error} />}
              <button id="login-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={loading}>
                {loading
                  ? <><span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} /> Connecting...</>
                  : "Login"}
              </button>
            </form>
          </div>
        </div>

        <AuthDivider />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google login failed")} theme="filled_black" shape="pill" width="100%" />
        </div>
        <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
          Not registered yet? <Link href="/register" style={{ color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}

function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <div className="auth-logo">
        <img src="https://lengolmmiwmrmlmzswek.supabase.co/storage/v1/object/public/avatars/icon.png" alt="EFootball Arena Icon" width="84" height="84" style={{ objectFit: "contain" }} />
      </div>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
    </>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="auth-step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={i <= current ? "active" : ""} />
      ))}
    </div>
  );
}

function PasswordToggle({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="password-toggle-btn" aria-label={show ? "Hide password" : "Show password"}>
      {show ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function AuthError({ message }: { message: string }) {
  return <div className="auth-error">{message}</div>;
}

function AuthDivider() {
  return <div className="auth-divider"><div /><span>OR</span><div /></div>;
}