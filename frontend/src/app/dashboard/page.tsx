"use client";
import { useEffect, useState } from "react";
import { usersApi, leaguesApi, matchesApi, getAvatarUrl } from "@/lib/api";
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
  const [viewingLeague, setViewingLeague] = useState<any>(null);
  const [leagueMembers, setLeagueMembers] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [p, l, ml] = await Promise.all([usersApi.getAll(), leaguesApi.getAll(), leaguesApi.getMy()]);
      setPlayers(p);
      setLeagues(l);
      setMyLeagues(ml);
      
      // Active league should be one of MY leagues
      const active = ml.find((x: any) => x.status === "active");
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

  async function handleViewLeague(lg: any) {
    setViewingLeague(lg);
    try {
      const members = await leaguesApi.getMembers(lg.id);
      setLeagueMembers(members);
    } catch (e) {
      setLeagueMembers([]);
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
          <div className="card-bg-watermark"><UsersIcon /></div>
          <div className="stat-value gold">{players.length}</div>
          <div className="stat-label">Registered Players</div>
        </div>
        <div className="stat-card">
          <div className="card-bg-watermark"><GridIcon /></div>
          <div className="stat-value green">{myLeagues.length}</div>
          <div className="stat-label">My Leagues</div>
        </div>
        <div className="stat-card">
          <div className="card-bg-watermark"><GamepadIcon /></div>
          <div className="stat-value blue">{matches.filter((m: any) => m.status === "played").length}/{matches.length || 12}</div>
          <div className="stat-label">Matches Played</div>
        </div>
        <div className="stat-card">
          <div className="card-bg-watermark"><TrophyIcon /></div>
          <div className="stat-value">{activeLeague ? activeLeague.name : "—"}</div>
          <div className="stat-label">Active League</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Next Match */}
        <div className="card">
          <div className="card-bg-watermark next-match-watermark"><ZapIcon /></div>
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
                      <img 
                        src={getAvatarUrl(matches[0].home_player_avatar) || ""} 
                        alt="Avatar" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
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
                      <img 
                        src={getAvatarUrl(matches[0].away_player_avatar) || ""} 
                        alt="Avatar" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
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
          <div className="card-bg-watermark"><PlusIcon /></div>
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
        <div className="card-bg-watermark"><TrophyIcon /></div>
        <div className="card-header">
          <span className="card-title"><TrophyIcon /> My Leagues</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {myLeagues.length > 0 ? myLeagues.map((lg: any) => (
            <div key={lg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--border)", borderRadius: "8px", background: "rgba(255,255,255,0.01)" }}>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => handleViewLeague(lg)}>
                <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--text-primary)" }}>{lg.name}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "12px" }}>
                  <span>Status: <span style={{ color: lg.status === "pending" ? "var(--gold)" : "var(--green)", fontWeight: 600 }}>{lg.status.toUpperCase()}</span></span>
                  <span>•</span>
                  <span>{lg.member_count} Players</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button className="btn btn-sm" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => handleViewLeague(lg)}>Details</button>
                {lg.status === "pending" && lg.created_by !== user?.id && (
                  <button 
                    className="btn btn-sm btn-secondary"
                    style={{ color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)", padding: "6px 12px", fontSize: "12px" }}
                    onClick={async (e) => {
                      e.stopPropagation();
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
                    Quit
                  </button>
                )}
              </div>
            </div>
          )) : (
            <p style={{ fontSize: "14px", color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>You are not in any leagues yet.</p>
          )}
        </div>
      </div>

      {/* League Details Modal */}
      {viewingLeague && (
        <div className="modal-overlay" onClick={() => setViewingLeague(null)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()} style={{ width: "500px", maxWidth: "95vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px" }}>{viewingLeague.name}</h2>
              <button onClick={() => setViewingLeague(null)} className="btn btn-sm" style={{ minWidth: "auto", padding: "4px 8px" }}>✕</button>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>JOIN CODE</div>
              <div style={{ fontFamily: "monospace", fontSize: "24px", fontWeight: 700, color: "var(--accent-light)", letterSpacing: "2px" }}>{viewingLeague.join_code}</div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>{viewingLeague.description || "No description provided."}</p>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>Participants ({viewingLeague.member_count}/{viewingLeague.max_members})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", paddingRight: "8px" }}>
                {leagueMembers.map((m: any) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <div className="player-avatar" style={{ width: "36px", height: "36px", fontSize: "14px" }}>
                      {m.avatar_url ? (
                        <img 
                          src={getAvatarUrl(m.avatar_url) || ""} 
                          alt={m.username} 
                          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} 
                        />
                      ) : (
                        m.username[0].toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{m.username}</span>
                        {m.is_lord && <span title="Lord of the Game" style={{ color: "gold", fontSize: "12px" }}>👑</span>}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Joined {new Date(m.joined_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255, 215, 0, 0.1)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255, 215, 0, 0.2)" }}>
                      <span style={{ color: "gold", fontSize: "12px" }}>🏆</span>
                      <span style={{ fontWeight: 700, color: "gold", fontSize: "12px" }}>{m.total_trophies || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Status: <span style={{ color: "var(--text-primary)" }}>{viewingLeague.status.toUpperCase()}</span>
              </div>
              <button onClick={() => setViewingLeague(null)} className="btn btn-primary btn-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Players List */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-bg-watermark"><UsersIcon /></div>
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
                    <img 
                      src={getAvatarUrl(p.avatar_url) || ""} 
                      alt="Avatar" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
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
