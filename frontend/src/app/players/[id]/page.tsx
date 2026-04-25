"use client";
import { useEffect, useState } from "react";
import { usersApi, statsApi } from "@/lib/api";
import { useParams } from "next/navigation";

export default function PlayerDetailPage() {
  const params = useParams();
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    Promise.all([usersApi.getOne(id), statsApi.player(id)])
      .then(([p, s]) => { setPlayer(p); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!player) return <div className="page-container"><p>Joueur non trouvé</p></div>;

  return (
    <div className="page-container">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div className="player-avatar" style={{ width: "100px", height: "100px", fontSize: "40px", margin: "0 auto 16px",
          background: player.is_lord ? "var(--gradient-gold)" : "var(--gradient-green)" }}>
          {player.username[0].toUpperCase()}
        </div>
        <h1 className="page-title">{player.username}</h1>
        {player.is_lord && <div className="lord-badge">🏆 LORD OF THE GAME</div>}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {(player.badges || []).map((b: any) => (
            <span key={b.id} className="badge">{b.icon} {b.badge_name}</span>
          ))}
        </div>
      </div>

      {stats && (
        <>
          <div className="stat-grid" style={{ marginBottom: "24px" }}>
            <div className="stat-card">
              <div className="stat-value gold">{stats.total_titles}</div>
              <div className="stat-label">Titres</div>
            </div>
            <div className="stat-card">
              <div className="stat-value green">{stats.win_rate}%</div>
              <div className="stat-label">Taux de victoire</div>
            </div>
            <div className="stat-card">
              <div className="stat-value blue">{stats.total_played}</div>
              <div className="stat-label">Matchs joués</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.avg_goals_per_match}</div>
              <div className="stat-label">Moy. buts/match</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><span className="card-title">📈 Résultats</span></div>
              <div className="stat-grid">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--green)" }}>{stats.total_wins}</div>
                  <div className="stat-label">Victoires</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-muted)" }}>{stats.total_draws}</div>
                  <div className="stat-label">Nuls</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)" }}>{stats.total_losses}</div>
                  <div className="stat-label">Défaites</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">⚽ Buts</span></div>
              <div className="stat-grid">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--green)" }}>{stats.goals_for}</div>
                  <div className="stat-label">Buts marqués</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)" }}>{stats.goals_against}</div>
                  <div className="stat-label">Buts encaissés</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: stats.goal_difference >= 0 ? "var(--green)" : "var(--red)" }}>
                    {stats.goal_difference > 0 ? `+${stats.goal_difference}` : stats.goal_difference}
                  </div>
                  <div className="stat-label">Différence</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: "24px" }}>
            <div className="card">
              <div className="card-header"><span className="card-title">🏠 Domicile</span></div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--green)" }}>{stats.home_wins}</div>
                <div className="stat-label">victoires sur {stats.home_played} matchs</div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">✈️ Extérieur</span></div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--blue)" }}>{stats.away_wins}</div>
                <div className="stat-label">victoires sur {stats.away_played} matchs</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
