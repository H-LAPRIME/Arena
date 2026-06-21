"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GoogleLogin } from "@react-oauth/google";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, UserIcon } from "@/components/Icons";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [step, setStep] = useState<"username" | "email" | "password">("username");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { login } = useAuth();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const stepIndex = step === "username" ? 0 : step === "email" ? 1 : 2;

  async function continueToEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.username.trim().length < 3) {
      setError("Player name must contain at least 3 characters.");
      return;
    }
    setChecking(true);
    try {
      const result = await authApi.checkUsername(form.username.trim());
      setForm(prev => ({ ...prev, username: result.username }));
      setStep("email");
    } catch (err: any) {
      setError(err.message || "Username is not available");
    }
    setChecking(false);
  }

  async function continueToPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }
    setChecking(true);
    try {
      const result = await authApi.checkSignupEmail(form.email.trim());
      setForm(prev => ({ ...prev, email: result.email }));
      setStep("password");
    } catch (err: any) {
      setError(err.message || "Email is not available");
    }
    setChecking(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({ username: form.username.trim(), email: form.email.trim(), password: form.password });
      login(res.access_token, res.user);
    } catch (err: any) {
      if (err.detail && Array.isArray(err.detail)) {
        const messages = err.detail.map((d: any) => `${d.loc[d.loc.length - 1]}: ${d.msg}`);
        setError(messages.join(", "));
      } else {
        setError(err.message || "Registration failed. Check your information.");
      }
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
      setError(err.message || "Google registration failed");
    }
    setLoading(false);
  }

  function goBack() {
    setError("");
    if (step === "password") setStep("email");
    else if (step === "email") setStep("username");
  }

  function handleSwipeEnd(x: number) {
    if (touchStartX === null) return;
    const delta = x - touchStartX;
    setTouchStartX(null);
    if (delta > 55) goBack();
  }

  const panelBase: React.CSSProperties = {
    width: "100%",
    transition: "transform 0.35s ease, opacity 0.35s ease",
  };

  function getPanelStyle(panelStep: "username" | "email" | "password"): React.CSSProperties {
    const panelIndex = panelStep === "username" ? 0 : panelStep === "email" ? 1 : 2;
    const diff = panelIndex - stepIndex;
    if (diff === 0) {
      return { ...panelBase, position: "relative", transform: "translateX(0%)", opacity: 1 };
    }
    return {
      ...panelBase,
      position: "absolute",
      top: 0,
      left: 0,
      transform: diff < 0 ? "translateX(-110%)" : "translateX(110%)",
      opacity: 0,
      pointerEvents: "none",
    };
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthHeader title="REGISTER" subtitle="Join the arena and start competing today" />
        <StepDots total={3} current={stepIndex} />

        <div className="auth-stepper three" aria-label="Signup progress">
          <button type="button" className="active" onClick={() => { setStep("username"); setError(""); }}>
            <UserIcon /> Name
          </button>
          <button type="button" className={stepIndex >= 1 ? "active" : ""} onClick={() => { if (stepIndex >= 1) { setStep("email"); setError(""); } }}>
            Email
          </button>
          <span className={step === "password" ? "active" : ""}>Password</span>
        </div>

        <div
          style={{ position: "relative", overflow: "hidden", width: "100%" }}
          onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
        >
          {/* Username panel */}
          <div style={getPanelStyle("username")}>
            <form onSubmit={continueToEmail}>
              <div className="form-group">
                <label className="form-label">Player Name</label>
                <input
                  id="reg-username"
                  className="form-input"
                  type="text"
                  required
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="Ex: CR7_King"
                  autoFocus
                />
              </div>
              {error && step === "username" && <AuthError message={error} />}
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={checking}>
                {checking
                  ? <><span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} /> Checking name...</>
                  : <>Suivant <ArrowRightIcon /></>}
              </button>
            </form>
          </div>

          {/* Email panel */}
          <div style={getPanelStyle("email")}>
            <form onSubmit={continueToPassword}>
              <button type="button" className="auth-back-btn" onClick={goBack}>
                <ArrowLeftIcon /> Change name
              </button>
              <div className="auth-confirmed-email"><CheckIcon /> {form.username.trim()}</div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  id="reg-email"
                  className="form-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="joueur@email.com"
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

          {/* Password panel */}
          <div style={getPanelStyle("password")}>
            <form onSubmit={handleSubmit}>
              <button type="button" className="auth-back-btn" onClick={goBack}>
                <ArrowLeftIcon /> Change email
              </button>
              <div className="auth-welcome">
                <span>WELCOME <strong><i>{form.username.trim()}</i></strong> ...</span>
                
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reg-password"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Password"
                    style={{ paddingRight: "44px" }}
                  />
                  <PasswordToggle show={showPassword} onClick={() => setShowPassword(!showPassword)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reg-confirm"
                    className="form-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Confirm password"
                    style={{ paddingRight: "44px" }}
                  />
                  <PasswordToggle show={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
                </div>
              </div>
              {error && step === "password" && <AuthError message={error} />}
              <button id="reg-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Registering..." : "Create my account"}
              </button>
            </form>
          </div>
        </div>

        <AuthDivider />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google login failed")} theme="filled_black" shape="pill" width="100%" />
        </div>
        <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
          Already registered? <Link href="/login" style={{ color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>Login</Link>
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