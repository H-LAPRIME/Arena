"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({ username: form.username, email: form.email, password: form.password });
      login(res.access_token, res.user);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <defs>
              <linearGradient id="regLogoG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7c3aed"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
            <circle cx="26" cy="26" r="24" stroke="url(#regLogoG)" strokeWidth="2" fill="rgba(124,58,237,0.08)"/>
            <polygon points="20,17 36,26 20,35" fill="url(#regLogoG)"/>
            <circle cx="26" cy="26" r="4" fill="url(#regLogoG)" opacity="0.5"/>
          </svg>
        </div>
        <h1 className="auth-title">REGISTER</h1>
        <p className="auth-subtitle">
          Join the arena — The 1st account will be <span style={{ color: "var(--gold)", fontWeight: 700 }}>Administrator</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Player Name</label>
            <input id="reg-username" className="form-input" type="text" required value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ex: CR7_King" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="reg-email" className="form-input" type="email" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} placeholder="joueur@email.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="reg-password" className="form-input" type="password" required value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input id="reg-confirm" className="form-input" type="password" required value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••••" />
          </div>

          {error && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "var(--red)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <button id="reg-submit" type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Registering..." : "Create my account"}
          </button>
        </form>

        <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: "var(--accent-light)", fontWeight: 600, textDecoration: "none" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
