"use client";
import { useEffect, useState } from "react";
import { usersApi, leaguesApi, getAvatarUrl } from "@/lib/api";

export default function HallOfFamePage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [completedLeagues, setCompletedLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([usersApi.getAll(), leaguesApi.getAll()])
      .then(([p, l]) => { 
        setPlayers(p); 
        setCompletedLeagues(l.filter((league: any) => league.status === "completed"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lord = players.find((p: any) => p.is_lord);
  const sortedPlayers = [...players].sort((a, b) => b.total_titles - a.total_titles);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ textAlign: "center" }}>
        <h1 className="page-title">🏆 Hall of Fame</h1>
        <p className="page-subtitle">Les légendes de eFootball Arena</p>
      </div>

      {/* Lord of the Game */}
      {lord ? (
        <div className="card" style={{ textAlign: "center", padding: "48px", marginBottom: "32px",
          background: "linear-gradient(145deg, #fffdf0, #fff8e0)", border: "2px solid var(--gold)" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>👑</div>
          <div className="lord-badge" style={{ fontSize: "14px", marginBottom: "16px" }}>🏆 LORD OF THE GAME</div>
          <div className="player-avatar" style={{ width: "100px", height: "100px", fontSize: "40px", margin: "0 auto 16px",
            background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            {lord.username[0].toUpperCase()}
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "32px", marginBottom: "8px" }}>{lord.username}</h2>
          <p style={{ color: "var(--gold-dark)", fontWeight: 600 }}>{lord.total_titles} titres de champion</p>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "48px", marginBottom: "32px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>👑</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", marginBottom: "8px", color: "var(--text-muted)" }}>
            LORD OF THE GAME
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            Aucun joueur n&apos;a encore accumulé 3 titres de champion. Qui sera le premier ?
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: "40px", height: "40px", borderRadius: "50%",
                border: "2px dashed var(--text-muted)", display: "flex", alignItems: "center",
                justifyContent: "center", color: "var(--text-muted)" }}>?</div>
            ))}
          </div>
        </div>
      )}

      {/* Champions by Titles */}
      <div className="card" style={{ marginBottom: "32px" }}>
        <div className="card-header"><span className="card-title">👑 Palmarès des joueurs</span></div>
        <div className="grid-3">
          {sortedPlayers.map((p: any, i: number) => (
            <div key={p.id} className="stat-card" style={{
              border: i === 0 ? "2px solid var(--gold)" : "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </div>
              <div className="player-avatar" style={{ width: "56px", height: "56px", fontSize: "22px", margin: "0 auto 8px", overflow: "hidden" }}>
                {p.avatar_url ? (
                  <img 
                    src={getAvatarUrl(p.avatar_url) || ""} 
                    alt="Avatar" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                ) : (
                  p.username[0].toUpperCase()
                )}
              </div>
              <h3 style={{ fontWeight: 700, marginBottom: "4px" }}>{p.username}</h3>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 900, color: "var(--gold-dark)" }}>
                {p.total_titles}
              </div>
              <div className="stat-label">titres de champion</div>
            </div>
          ))}
        </div>
      </div>

      {/* Season History */}
      {completedLeagues.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">📜 Historique des Ligues</span></div>
          <div className="match-list">
            {completedLeagues.map((s: any) => {
              const champ = players.find((p: any) => p.id === s.champion_id);
              return (
                <div key={s.id} className="match-card played">
                  <span className="match-day-badge">{s.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "24px" }}>👑</span>
                    <span style={{ fontWeight: 700 }}>{champ?.username || "?"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
