"use client";
import { useEffect, useState } from "react";
import { usersApi, statsApi, getAvatarUrl, certificatesApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UsersIcon, TrophyIcon, GamepadIcon, ZapIcon, HomeIcon, PlaneIcon, CheckIcon, DownloadIcon } from "@/components/Icons";

export default function PlayerDetailPage() {
  const params = useParams();
  const { user, isAdmin } = useAuth();
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const id = params.id as string;
    Promise.all([usersApi.getOne(id), statsApi.player(id)])
      .then(([p, s]) => { setPlayer(p); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDownload = async () => {
    if (!player) return;
    setIsDownloading(true);
    try {
      await certificatesApi.downloadPlayerReport(player.id, player.username);
    } catch (error) {
      console.error("Failed to download report", error);
      alert("Erreur lors du téléchargement du rapport.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!player) return <div className="page-container"><p>Joueur non trouvé</p></div>;

  return (
    <div className="page-container">
      {/* Profile Header Card */}
      <div className="card" style={{ 
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap-reverse", gap: "20px",
        marginBottom: "32px", position: "relative", overflow: "hidden", padding: "40px 30px" 
      }}>
        <div className="card-bg-watermark" style={{ fontSize: "200px", opacity: 0.02, right: "-20px", top: "-20px" }}><UsersIcon /></div>
        
        {/* Left Side: Name and Badges */}
        <div style={{ flex: 1, textAlign: "left", position: "relative", zIndex: 1 }}>
          <h1 className="page-title" style={{ fontSize: "42px", marginBottom: "8px", lineHeight: "1.1", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{player.username}</h1>
          {player.is_lord && <div className="lord-badge" style={{ display: "inline-flex", marginBottom: "16px", fontSize: "14px" }}>🏆 LORD OF THE GAME</div>}
          <div style={{ display: "flex", justifyContent: "flex-start", gap: "8px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
            {(player.badges || []).map((b: any) => (
              <span key={b.id} className="badge" style={{ padding: "6px 12px", fontSize: "13px" }}>{b.icon} {b.badge_name}</span>
            ))}
            {(isAdmin || (user && user.id === player.id)) && (
              <button 
                onClick={handleDownload} 
                disabled={isDownloading}
                className="btn btn-sm btn-secondary" 
                style={{ marginLeft: "8px", padding: "6px 12px", height: "auto" }}
              >
                <DownloadIcon /> {isDownloading ? "Téléchargement..." : "Download Report"}
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Avatar */}
        <div className="player-avatar" style={{ 
          width: "160px", height: "160px", fontSize: "64px", flexShrink: 0,
          background: player.is_lord ? "var(--gradient-gold)" : "var(--gradient-green)", 
          overflow: "hidden", position: "relative", zIndex: 1,
          border: player.is_lord ? "4px solid var(--gold)" : "4px solid transparent",
          boxShadow: player.is_lord ? "0 0 30px rgba(255, 215, 0, 0.5)" : "0 8px 24px rgba(0,0,0,0.4)"
        }}>
          {player.avatar_url ? (
            <img src={getAvatarUrl(player.avatar_url) || ""} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            player.username[0].toUpperCase()
          )}
        </div>
      </div>

      {stats && (
        <>
          <div className="stat-grid" style={{ marginBottom: "24px" }}>
            <div className="stat-card">
              <div className="card-bg-watermark"><TrophyIcon /></div>
              <div className="stat-value gold">{stats.total_titles}</div>
              <div className="stat-label">Titres</div>
            </div>
            <div className="stat-card">
              <div className="card-bg-watermark"><ZapIcon /></div>
              <div className="stat-value green">{stats.win_rate}%</div>
              <div className="stat-label">Taux de victoire</div>
            </div>
            <div className="stat-card">
              <div className="card-bg-watermark"><GamepadIcon /></div>
              <div className="stat-value blue">{stats.total_played}</div>
              <div className="stat-label">Matchs joués</div>
            </div>
            <div className="stat-card">
              <div className="card-bg-watermark">⚽</div>
              <div className="stat-value">{stats.avg_goals_per_match}</div>
              <div className="stat-label">Moy. buts/match</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-bg-watermark"><ZapIcon /></div>
              <div className="card-header"><span className="card-title"><ZapIcon /> Résultats</span></div>
              <div className="stat-grid">
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--green)" }}>{stats.total_wins}</div>
                  <div className="stat-label">Victoires</div>
                </div>
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-muted)" }}>{stats.total_draws}</div>
                  <div className="stat-label">Nuls</div>
                </div>
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)" }}>{stats.total_losses}</div>
                  <div className="stat-label">Défaites</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-bg-watermark">⚽</div>
              <div className="card-header"><span className="card-title">⚽ Buts</span></div>
              <div className="stat-grid">
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--green)" }}>{stats.goals_for}</div>
                  <div className="stat-label">Buts marqués</div>
                </div>
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)" }}>{stats.goals_against}</div>
                  <div className="stat-label">Buts encaissés</div>
                </div>
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
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
              <div className="card-bg-watermark"><HomeIcon /></div>
              <div className="card-header"><span className="card-title"><HomeIcon /> Domicile</span></div>
              <div style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "var(--green)" }}>{stats.home_wins}</div>
                <div className="stat-label" style={{ fontSize: "13px" }}>victoires sur {stats.home_played} matchs</div>
              </div>
            </div>
            <div className="card">
              <div className="card-bg-watermark"><PlaneIcon /></div>
              <div className="card-header"><span className="card-title"><PlaneIcon /> Extérieur</span></div>
              <div style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "var(--blue)" }}>{stats.away_wins}</div>
                <div className="stat-label" style={{ fontSize: "13px" }}>victoires sur {stats.away_played} matchs</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
