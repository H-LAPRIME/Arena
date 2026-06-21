"use client";
import { useEffect, useState } from "react";
import { usersApi, leaguesApi, getAvatarUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { UsersIcon, TrophyIcon, SwordIcon, GridIcon } from "@/components/Icons";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [activeLeague, setActiveLeague] = useState<any>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    try {
      const [u, leagues] = await Promise.all([usersApi.getAll(), leaguesApi.getAll()]);
      setPlayers(u);
      const active = leagues.find((l: any) => l.status === "active");
      if (active) {
        setActiveLeague(active);
        const st = await leaguesApi.getStandings(active.id);
        setStandings(st);
      }
    } catch { /* API not ready */ }
  }

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!user) return null; // AuthProvider handles redirect

  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <img src="https://lengolmmiwmrmlmzswek.supabase.co/storage/v1/object/public/avatars/icon.png" alt="" className="hero-bg-icon" />
        <div className="hero-content">
          <h1>eFootball <span>Arena</span></h1>
          
          <p>Compete with friends, submit match results, climb the leaderboard, and prove you are the best.</p>
          <div className="hero-actions">
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              <PlayIcon /> Go to Dashboard
            </Link>
            <Link href="/claims" className="btn btn-secondary btn-lg">
              <ShieldIcon /> Submit Result
            </Link>
          </div>
        </div>
      </section>

      <div className="page-container">
        {/* Quick Stats */}
        <div className="stat-grid" style={{ marginBottom: "32px" }}>
          <div className="stat-card">
            <div className="card-bg-watermark"><UsersIcon /></div>
            <div className="stat-value gold">{players.length}</div>
            <div className="stat-label">Players</div>
          </div>
          <div className="stat-card">
            <div className="card-bg-watermark"><TrophyIcon /></div>
            <div className="stat-value blue">{activeLeague?.name || "—"}</div>
            <div className="stat-label">Active League</div>
          </div>
          <div className="stat-card">
            <div className="card-bg-watermark"><SwordIcon /></div>
            <div className="stat-value accent">12</div>
            <div className="stat-label">Matches / League</div>
          </div>
          <div className="stat-card">
            <div className="card-bg-watermark"><GridIcon /></div>
            <div className="stat-value green">3</div>
            <div className="stat-label">Titles = Lord</div>
          </div>
        </div>

        {/* Standings */}
        {standings.length > 0 && (
          <div className="card" style={{ marginBottom: "32px" }}>
            <div className="card-header">
              <span className="card-title">Standings — {activeLeague?.name}</span>
              <Link href="/scoreboard" className="btn btn-sm btn-secondary">View Details</Link>
            </div>
            <div className="table-container admin-table-container" style={{ margin: 0, border: "none", borderRadius: 0 }}>
              <table className="scoreboard">
                <thead>
                  <tr>
                    <th>#</th><th>Player</th><th>MP</th><th>STAY</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th><th>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s: any, i: number) => {
                    const totalMatches = ((activeLeague?.max_members || standings.length) - 1) * 4;
                    const restant = Math.max(0, totalMatches - s.played);
                    return (
                      <tr key={s.id}>
                        <td className={`rank rank-${i + 1}`}>{i + 1}</td>
                        <td>
                          <div className="player-cell">
                            <div className="player-avatar" style={{ overflow: "hidden" }}>
                              {s.avatar_url ? (
                                <img 
                                  src={getAvatarUrl(s.avatar_url) || ""} 
                                  alt="Avatar" 
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                                />
                              ) : (
                                (s.username || "?")[0].toUpperCase()
                              )}
                            </div>
                            <span className="player-name">{s.username}</span>
                          </div>
                        </td>
                        <td>{s.played}</td>
                        <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{restant}</td>
                        <td>{s.wins}</td>
                        <td>{s.draws}</td>
                        <td>{s.losses}</td>
                        <td>{s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}</td>
                        <td className="points-cell">{s.points}</td>
                        <td>
                          <div className="form-dots">
                            {(s.form || []).map((f: string, j: number) => (
                              <span key={j} className={`form-dot ${f}`}>{f}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Getting Started */}
        {players.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "56px 32px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--accent-glow)", border: "1px solid var(--border-accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--accent-light)" }}>
              <RocketIcon />
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", marginBottom: "12px" }}>Ready to start?</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "28px", fontSize: "14px" }}>
              Register 3 players, create a season, and submit results with proof.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link href="/register" className="btn btn-primary">Register a Player</Link>
              <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
            </div>
          </div>
        )}
      </div>
      <footer style={{ marginTop: "64px", padding: "40px 0", borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          &copy; {new Date().getFullYear()} eFootball Arena — Developed by <strong style={{ color: "var(--text-primary)" }}>Hida Mouad</strong>
        </p>
      </footer>
    </main>
  );
}

function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function ShieldIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
}
function RocketIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;
}
