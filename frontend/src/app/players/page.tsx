"use client";
import { useEffect, useState } from "react";
import { usersApi, getAvatarUrl } from "@/lib/api";

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.getAll().then(p => { setPlayers(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">👥 Joueurs</h1>
        <p className="page-subtitle">{players.length} joueurs inscrits</p>
      </div>

      <div className="grid-3">
        {players.map((p: any) => (
          <a href={`/players/${p.id}`} key={p.id} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card" style={{ textAlign: "center", cursor: "pointer" }}>
              <div className="player-avatar" style={{ width: "80px", height: "80px", fontSize: "32px", margin: "0 auto 16px",
                background: p.is_lord ? "var(--gradient-gold)" : "var(--gradient-green)", overflow: "hidden" }}>
                {p.avatar_url ? (
                  <img src={getAvatarUrl(p.avatar_url) || ""} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  p.username[0].toUpperCase()
                )}
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", marginBottom: "8px" }}>
                {p.username}
              </h3>
              {p.is_lord && <div className="lord-badge" style={{ marginBottom: "12px" }}>🏆 LORD OF THE GAME</div>}
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="badge badge-gold">👑 {p.total_titles} titres</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>
                Inscrit le {new Date(p.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </a>
        ))}
      </div>

      {players.length < 3 && (
        <div className="card" style={{ textAlign: "center", marginTop: "24px", padding: "32px" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
            Il faut 3 joueurs pour démarrer une saison ({players.length}/3)
          </p>
          <a href="/register" className="btn btn-primary">➕ Inscrire un joueur</a>
        </div>
      )}
    </div>
  );
}
