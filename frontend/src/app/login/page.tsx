"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/icon.png" alt="EFootball Arena Icon" width="84" height="84" style={{ objectFit: 'contain' }} />
        </div>
        <h1 className="auth-title">LOGIN</h1>
        <p className="auth-subtitle">Welcome to the arena</p>

        <form onSubmit={handleSubmit}>
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
            />
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
                placeholder="••••••••"
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px"
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "var(--red)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <button id="login-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={loading}>
            {loading ? (
              <><span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} /> Connecting...</>
            ) : "Login"}
          </button>
        </form>

        <div style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "12px" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
          <span>OR</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google login failed")}
            theme="filled_black"
            shape="pill"
            width="100%"
          />
        </div>

        <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
          Not registered yet?{" "}
          <Link href="/register" style={{ color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
