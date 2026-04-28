"use client";
import { useEffect, useState } from "react";
import { usersApi, leaguesApi, getAvatarUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TrashIcon, TrophyIcon, UsersIcon } from "@/components/Icons";

export default function PlayersPage() {
  const [leaguesWithMembers, setLeaguesWithMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await usersApi.getGroupedByLeague();
      setLeaguesWithMembers(data);
    } catch (e) {
      setMsg("Erreur lors du chargement des joueurs");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(leagueId: string, userId: string, username: string) {
    if (!confirm(`Retirer ${username} de cette ligue ?`)) return;
    try {
      await leaguesApi.removeMember(leagueId, userId);
      setMsg(`Success: ${username} retiré de la ligue`);
      loadData();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">👥 Mes Ligues & Joueurs</h1>
        <p className="page-subtitle">Liste des participants par ligue</p>
      </div>

      {msg && (
        <div className={`toast ${msg.startsWith("Error") ? "error" : "success"}`} onClick={() => setMsg("")}>
          {msg.replace(/^(Success: |Error: )/, "")}
        </div>
      )}

      {leaguesWithMembers.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
            Vous n'êtes membre d'aucune ligue.
          </p>
          <a href="/dashboard" className="btn btn-primary">Rejoindre une ligue</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {leaguesWithMembers.map((league: any) => (
            <div key={league.league_id} className="league-frame" style={{
              background: "rgba(255,255,255,0.02)",
              borderRadius: "24px",
              padding: "32px",
              border: "1px solid var(--border)",
              position: "relative",
              overflow: "hidden"
            }}>
              <div className="card-bg-watermark" style={{ opacity: 0.03, fontSize: "150px" }}><UsersIcon /></div>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", position: "relative" }}>
                <div>
                  <h2 style={{ fontSize: "24px", fontFamily: "var(--font-display)", color: "var(--accent-light)" }}>{league.league_name}</h2>
                  <span className={`badge ${league.status === "active" ? "badge-green" : "badge-gold"}`} style={{ marginTop: "4px" }}>
                    {league.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>
                    {league.members.length} joueurs
                  </span>
                </div>
              </div>

              <div className="grid-3" style={{ position: "relative" }}>
                {league.members.map((p: any) => (
                  <div key={p.id} className="card player-card-league" style={{ 
                    textAlign: "center", 
                    padding: "24px", 
                    background: "var(--bg-card)",
                    position: "relative"
                  }}>
                    {(isAdmin || user?.id === league.created_by) && (
                      <button 
                        onClick={() => handleRemoveMember(league.league_id, p.id, p.username)}
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "var(--red)",
                          border: "none",
                          borderRadius: "8px",
                          padding: "6px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: p.id === league.created_by ? "none" : "block" // Cannot remove self/creator
                        }}
                        title="Retirer de la ligue"
                        className="delete-btn-hover"
                      >
                        <TrashIcon />
                      </button>
                    )}

                    <a href={`/players/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div className="player-avatar" style={{ 
                        width: "70px", 
                        height: "70px", 
                        fontSize: "28px", 
                        margin: "0 auto 16px",
                        background: p.is_lord ? "var(--gradient-gold)" : "var(--gradient-green)", 
                        overflow: "hidden",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.2)"
                      }}>
                        {p.avatar_url ? (
                          <img src={getAvatarUrl(p.avatar_url) || ""} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          p.username[0].toUpperCase()
                        )}
                      </div>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", marginBottom: "8px" }}>
                        {p.username}
                      </h3>
                      {p.is_lord && <div className="lord-badge" style={{ marginBottom: "12px", fontSize: "10px" }}>🏆 LORD</div>}
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                        <span className="badge badge-gold" style={{ fontSize: "11px" }}>👑 {p.total_trophies} titres</span>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .player-card-league:hover {
          transform: translateY(-5px);
          border-color: var(--accent);
        }
        .delete-btn-hover:hover {
          background: var(--red) !important;
          color: white !important;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
