"use client";
import { useEffect, useState } from "react";
import { leaguesApi, getAvatarUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { CalendarIcon, HomeIcon, PlaneIcon, GamepadIcon, CheckIcon, ArrowRightIcon } from "@/components/Icons";
import LeagueSelector from "@/components/LeagueSelector";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MatchesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (selectedLeagueId) {
      loadMatches(selectedLeagueId);
    } else {
      setLoading(false);
    }
  }, [selectedLeagueId]);

  async function loadMatches(id: string) {
    setLoadingMatches(true);
    try {
      const [l, m] = await Promise.all([
        leaguesApi.getOne(id),
        leaguesApi.getMatches(id)
      ]);
      setLeague(l);
      setMatches(m);
    } catch (e) {
      setMsg("Erreur lors du chargement des matchs");
    } finally {
      setLoadingMatches(false);
      setLoading(false);
    }
  }


  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><CalendarIcon /> Match Calendar</h1>
        <p className="page-subtitle">
          {league ? `${league.name}` : "No active league"}
        </p>
      </div>

      {msg && <div className="toast">{msg}</div>}

      <LeagueSelector 
        onSelect={setSelectedLeagueId} 
        selectedId={selectedLeagueId || undefined} 
      />

      {selectedLeagueId && !loadingMatches ? (
        <div className="match-list">
          {matches.map((m: any) => {
            const isHome = m.home_player_id === user?.id;
            const isAway = m.away_player_id === user?.id;
            const isMyMatch = isHome || isAway;
            return (
              <div 
                key={m.id} 
                className={`match-card ${m.status} ${isHome ? "home-match" : ""} ${isAway ? "away-match" : ""}`}
                onClick={() => isMyMatch && m.status === "pending" && router.push(`/claims?matchId=${m.id}`)}
                style={{ cursor: isMyMatch && m.status === "pending" ? "pointer" : "default" }}
              >
                {isHome && (
                  <div className="match-card-bg-icon home-bg">
                    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                )}
                {isAway && (
                  <div className="match-card-bg-icon away-bg">
                    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.7 5.2c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z"/></svg>
                  </div>
                )}
                <span className="match-day-badge" style={{ position: "absolute", top: "12px", left: "16px" }}>MATCH DAY {m.match_day}</span>
                
                <div className="match-players">
                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <div className="player-avatar" style={{ margin: "0 auto 8px", width: "44px", height: "44px", fontSize: "18px", border: m.home_player_id === user?.id ? "2px solid var(--accent)" : "", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                      {m.home_player_avatar ? (
                        <img src={getAvatarUrl(m.home_player_avatar) || ""} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        (m.home_player_name || "?")[0].toUpperCase()
                      )}
                    </div>
                    <div style={{ fontWeight: m.home_player_id === user?.id ? 800 : 700, fontSize: "15px", color: m.home_player_id === user?.id ? "var(--accent)" : "var(--text-primary)" }}>
                      {m.home_player_name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><HomeIcon /> HOME</div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    {m.status === "played" ? (
                      <span className="match-score">{m.home_score} - {m.away_score}</span>
                    ) : (
                      <span className="match-vs">VS</span>
                    )}
                    {m.status === "played" && (
                      <span className="badge badge-green" style={{ fontSize: "9px", padding: "2px 6px" }}><CheckIcon /> Played</span>
                    )}
                    {m.status === "pending" && isMyMatch && (
                      <button className="btn btn-green btn-sm" style={{ padding: "4px 10px", fontSize: "11px" }}><GamepadIcon /> Play</button>
                    )}
                  </div>

                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <div className="player-avatar" style={{ margin: "0 auto 8px", width: "44px", height: "44px", fontSize: "18px", background: "var(--gradient-green)", border: m.away_player_id === user?.id ? "2px solid var(--accent)" : "", overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                      {m.away_player_avatar ? (
                        <img src={getAvatarUrl(m.away_player_avatar) || ""} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        (m.away_player_name || "?")[0].toUpperCase()
                      )}
                    </div>
                    <div style={{ fontWeight: m.away_player_id === user?.id ? 800 : 700, fontSize: "15px", color: m.away_player_id === user?.id ? "var(--accent)" : "var(--text-primary)" }}>
                      {m.away_player_name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><PlaneIcon /> AWAY</div>
                  </div>
                </div>
              </div>
            );
          })}
          {matches.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "48px" }}>
              <p style={{ color: "var(--text-muted)" }}>No matches for this league yet.</p>
            </div>
          )}
        </div>
      ) : selectedLeagueId && loadingMatches ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px", background: "rgba(255,255,255,0.02)", borderRadius: "20px", border: "1px dashed var(--border)" }}>
          <p style={{ color: "var(--text-muted)" }}>Sélectionnez une ligue pour voir le calendrier des matchs.</p>
        </div>
      )}

    </div>
  );
}
