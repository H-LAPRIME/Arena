"use client";
import { useEffect, useState } from "react";
import { leaguesApi, certificatesApi, getAvatarUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ChartIcon, TrophyIcon, ArrowRightIcon } from "@/components/Icons";
import { BotIntervention } from "@/components/BotIntervention";
import LeagueSelector from "@/components/LeagueSelector";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ScoreboardPage() {
  const [standings, setStandings] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const { user } = useAuth();
  const [botMessage, setBotMessage] = useState("");

  useEffect(() => {
    if (selectedLeagueId) {
      loadData(selectedLeagueId);
    } else {
      setLoading(false);
    }
  }, [selectedLeagueId]);

  async function loadData(id: string) {
    setLoadingData(true);
    setBotMessage("");
    try {
      const [l, st] = await Promise.all([
        leaguesApi.getOne(id),
        leaguesApi.getStandings(id)
      ]);
      setLeague(l);
      setStandings(st);
      
      // Bot intervention
      leaguesApi.getStandingAdvice(id)
        .then(res => setBotMessage(res.comment))
        .catch(() => {});
    } catch (e) {
    } finally {
      setLoadingData(false);
      setLoading(false);
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 className="page-title"><ChartIcon /> Standings</h1>
          <p className="page-subtitle">
            {league ? `${league.name} — ${league.status === "active" ? "Ongoing" : "Completed"}` : "No league"}
          </p>
        </div>
        {league && (
          <button 
            onClick={() => certificatesApi.downloadReport(league.id, league.name, user?.username || "Player")}
            className="btn btn-sm btn-secondary"
            style={{ borderRadius: "var(--radius-full)", padding: "8px 16px" }}
          >
            <TrophyIcon /> Download My Season Report
          </button>
        )}
      </div>

      <LeagueSelector 
        onSelect={setSelectedLeagueId} 
        selectedId={selectedLeagueId || undefined} 
      />

      {selectedLeagueId && !loadingData ? (
        <>
          {standings.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-container">
                <table className="scoreboard">
                  <thead>
                    <tr>
                      <th>#</th><th>Player</th><th>MP</th><th>STAY</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s: any, i: number) => {
                      const totalMatches = ((league?.max_members || standings.length) - 1) * 4;
                      const restant = Math.max(0, totalMatches - s.played);
                      return (
                        <tr key={s.id}>
                          <td className={`rank rank-${i + 1}`}>
                            {i === 0 ? <TrophyIcon /> : i + 1}
                          </td>
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
                              <a href={`/players/${s.user_id}`} style={{ textDecoration: "none", color: "inherit" }}>
                                <span className="player-name">{s.username}</span>
                              </a>
                            </div>
                          </td>
                          <td>{s.played}</td>
                          <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{restant}</td>
                          <td style={{ color: "var(--green)", fontWeight: 600 }}>{s.wins}</td>
                          <td>{s.draws}</td>
                          <td style={{ color: "var(--red)" }}>{s.losses}</td>
                          <td>{s.goals_for}</td>
                          <td>{s.goals_against}</td>
                          <td style={{ fontWeight: 600 }}>{s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}</td>
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
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "48px" }}>
              <p style={{ color: "var(--text-muted)" }}>No standings data for this league yet.</p>
            </div>
          )}
          {botMessage && <BotIntervention message={botMessage} />}
        </>
      ) : selectedLeagueId && loadingData ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px", background: "rgba(255,255,255,0.02)", borderRadius: "20px", border: "1px dashed var(--border)" }}>
          <p style={{ color: "var(--text-muted)" }}>Sélectionnez une ligue pour voir le classement.</p>
        </div>
      )}
    </div>
  );
}
