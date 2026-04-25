"use client";
import { useEffect, useState } from "react";
import { usersApi, leaguesApi, matchesApi } from "@/lib/api";
import { GridIcon, ZapIcon, GamepadIcon, TrophyIcon, UsersIcon, PlusIcon, HomeIcon, PlaneIcon } from "@/components/Icons";
import { BotIntervention } from "@/components/BotIntervention";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DashboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [activeLeague, setActiveLeague] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [botMessage, setBotMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [p, l, ml] = await Promise.all([usersApi.getAll(), leaguesApi.getAll(), leaguesApi.getMy()]);
      setPlayers(p);
      setLeagues(l);
      setMyLeagues(ml);
      const active = l.find((x: any) => x.status === "active");
      if (active) {
        setActiveLeague(active);
        const [st, lm] = await Promise.all([
          leaguesApi.getStandings(active.id),
          leaguesApi.getMatches(active.id)
        ]);
        setStandings(st);
        setMatches(lm);

        // Bot intervention for recent approval
        const lastPlayed = lm.find((m: any) => m.status === "played");
        if (lastPlayed) {
          leaguesApi.getMatchAdvice(lastPlayed.id)
            .then(res => setBotMessage(res.comment))
            .catch(() => {});
        }
      }
    } catch (e) { /* API not ready */ }
    setLoading(false);
  }

  async function handleJoinLeague(e: React.FormEvent) {
    e.preventDefault();
    try {
      await leaguesApi.join(joinCode);
      setMsg("success:You have joined the league!");
      setJoinCode("");
      loadAll();
    } catch (err: any) {
      setMsg("error:" + err.message);
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><GridIcon /> Dashboard</h1>
        <p className="page-subtitle">Manage your matches and leagues</p>
      </div>

      {msg && (
        <div 
          className={`toast ${msg.startsWith("success:") ? "success" : "error"}`}
          onClick={() => setMsg("")}
          style={{ cursor: "pointer", marginBottom: "20px" }}
        >
          {msg.replace(/^(success:|error:)/, "")}
        </div>
      )}

      {/* Quick Stats */}
      <div className="stat-grid" style={{ marginBottom: "32px" }}>
        <div className="stat-card">
          <div className="stat-value gold">{players.length}</div>
          <div className="stat-label">Registered Players</div>
        </div>
        <div className="stat-card">
          <div className="stat-value green">{leagues.length}</div>
          <div className="stat-label">Total Leagues</div>
        </div>
        <div className="stat-card">
          <div className="stat-value blue">{matches.filter((m: any) => m.status === "played").length}/{matches.length || 12}</div>
          <div className="stat-label">Matches Played</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeLeague ? activeLeague.name : "—"}</div>
          <div className="stat-label">Active League</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Next Match */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><ZapIcon /> Next Match</span>
          </div>
          {matches.length > 0 ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <span className="match-day-badge">MATCH DAY {matches[0].match_day}</span>
              <div className="score-input-group" style={{ marginTop: "16px" }}>
                <div style={{ textAlign: "center" }}>
                  <div className="player-avatar" style={{ width: "48px", height: "48px", fontSize: "20px", margin: "0 auto 8px", overflow: "hidden" }}>
                    {matches[0].home_player_avatar ? (
                      <img src={`${API_URL}${matches[0].home_player_avatar}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (matches[0].home_player_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>{matches[0].home_player_name}</span>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><HomeIcon /> Home</div>
                </div>
                <span className="match-vs">VS</span>
                <div style={{ textAlign: "center" }}>
                  <div className="player-avatar" style={{ width: "48px", height: "48px", fontSize: "20px", margin: "0 auto 8px", background: "var(--gradient-green)", overflow: "hidden" }}>
                    {matches[0].away_player_avatar ? (
                      <img src={`${API_URL}${matches[0].away_player_avatar}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      (matches[0].away_player_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>{matches[0].away_player_name}</span>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><PlaneIcon /> Away</div>
                </div>
              </div>
              <a href="/matches" className="btn btn-green btn-sm" style={{ marginTop: "8px" }}>
                <GamepadIcon /> Enter Score
              </a>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
              No matches available at the moment
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrophyIcon /> Join a League</span>
          </div>
          <form onSubmit={handleJoinLeague} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Enter the invitation code to join an existing league.
            </p>
            <input 
              placeholder="Code (ex: J8K2L9)" 
              value={joinCode} 
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              style={{
                width: "100%",
                padding: "12px",
                background: "rgba(0,0,0,0.03)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none"
              }}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ width: "100%" }}>
              Join
            </button>
          </form>
        </div>
      </div>

      {/* My Leagues (Moved outside grid-2 for full width) */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-header">
          <span className="card-title"><TrophyIcon /> My Leagues</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {myLeagues.length > 0 ? myLeagues.map((lg: any) => (
            <div key={lg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "16px" }}>{lg.name}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Status: <span style={{ color: lg.status === "pending" ? "var(--gold)" : "var(--green)" }}>{lg.status.toUpperCase()}</span>
                </div>
              </div>
              {lg.status === "pending" && (
                lg.created_by !== user?.id ? (
                  <button 
                    className="btn btn-sm btn-secondary"
                    style={{ color: "var(--red)", borderColor: "rgba(255,59,48,0.2)" }}
                    onClick={async () => {
                      if (confirm("Are you sure you want to quit this league?")) {
                        try {
                          await leaguesApi.quit(lg.id);
                          setMsg("success:You have quit the league.");
                          loadAll();
                        } catch (err: any) {
                          setMsg("error:" + err.message);
                        }
                      }
                    }}
                  >
                    Quit League
                  </button>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", padding: "4px 8px", background: "var(--bg)", borderRadius: "4px" }}>
                    Creator (Cannot quit)
                  </span>
                )
              )}
            </div>
          )) : (
            <p style={{ fontSize: "14px", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>You are not in any leagues yet.</p>
          )}
        </div>
      </div>

      {/* Players List */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-header">
          <span className="card-title"><UsersIcon /> Players</span>
          <a href="/register" className="btn btn-sm btn-secondary"><PlusIcon /> Add</a>
        </div>
        <div className="grid-3">
          {players.map((p: any) => (
            <a href={`/players/${p.id}`} key={p.id} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="stat-card" style={{ cursor: "pointer" }}>
                <div className="player-avatar" style={{ width: "56px", height: "56px", fontSize: "24px", margin: "0 auto 12px", overflow: "hidden" }}>
                  {p.avatar_url ? (
                    <img src={`${API_URL}${p.avatar_url}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    p.username[0].toUpperCase()
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: "16px" }}>{p.username}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {p.total_titles} titles {p.is_lord && <TrophyIcon />}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
      
      {botMessage && <BotIntervention message={botMessage} onClose={() => setBotMessage("")} />}
    </div>
  );
}
