"use client";
import { useEffect, useState } from "react";
import { leaguesApi, matchesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { CalendarIcon, HomeIcon, PlaneIcon, GamepadIcon, CheckIcon, ArrowRightIcon } from "@/components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MatchesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [league, setLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const leagues = await leaguesApi.getAll();
      const active = leagues.find((l: any) => l.status === "active") || leagues[0];
      if (active) {
        setLeague(active);
        const mt = await leaguesApi.getMatches(active.id);
        setMatches(mt);
      }
    } catch (e) {}
    setLoading(false);
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
              <span className="match-day-badge">MATCH DAY {m.match_day}</span>
              <div className="match-players">
                <div style={{ textAlign: "center", minWidth: "100px" }}>
                  <div className="player-avatar" style={{ margin: "0 auto 4px", width: "32px", height: "32px", fontSize: "14px", border: m.home_player_id === user?.id ? "2px solid var(--accent)" : "", overflow: "hidden" }}>
                    {m.home_player_avatar ? (
                      <img src={`${API_URL}${m.home_player_avatar}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (m.home_player_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: m.home_player_id === user?.id ? 700 : 600, color: m.home_player_id === user?.id ? "var(--accent)" : "inherit" }}>
                    {m.home_player_name}
                  </span>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}><HomeIcon /></div>
                </div>

                {m.status === "played" ? (
                  <span className="match-score">{m.home_score} - {m.away_score}</span>
                ) : (
                  <span className="match-vs">VS</span>
                )}

                <div style={{ textAlign: "center", minWidth: "100px" }}>
                  <div className="player-avatar" style={{ margin: "0 auto 4px", width: "32px", height: "32px", fontSize: "14px", background: "var(--gradient-green)", border: m.away_player_id === user?.id ? "2px solid var(--accent)" : "", overflow: "hidden" }}>
                    {m.away_player_avatar ? (
                      <img src={`${API_URL}${m.away_player_avatar}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (m.away_player_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: m.away_player_id === user?.id ? 700 : 600, color: m.away_player_id === user?.id ? "var(--accent)" : "inherit" }}>
                    {m.away_player_name}
                  </span>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}><PlaneIcon /></div>
                </div>
              </div>

              {m.status === "pending" && isMyMatch && (
                <button className="btn btn-green btn-sm"><GamepadIcon /> Enter</button>
              )}

              {m.status === "played" && (
                <span className="badge badge-green"><CheckIcon /> Played</span>
              )}
            </div>
          );
        })}
      </div>

      {matches.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ color: "var(--text-muted)" }}>No matches. Create and start a season!</p>
          <a href="/dashboard" className="btn btn-primary" style={{ marginTop: "16px" }}><ArrowRightIcon /> Dashboard</a>
        </div>
      )}
    </div>
  );
}
