"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <defs>
              <linearGradient id="logoG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7c3aed"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
            <circle cx="26" cy="26" r="24" stroke="url(#logoG)" strokeWidth="2" fill="rgba(124,58,237,0.08)"/>
            <polygon points="20,17 36,26 20,35" fill="url(#logoG)"/>
            <circle cx="26" cy="26" r="4" fill="url(#logoG)" opacity="0.5"/>
          </svg>
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
            <input
              id="login-password"
              className="form-input"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
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
