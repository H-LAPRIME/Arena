"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usersApi, leaguesApi, matchesApi, getAvatarUrl } from "@/lib/api";
import { GridIcon, ZapIcon, GamepadIcon, TrophyIcon, UsersIcon, PlusIcon, HomeIcon, PlaneIcon, CrownIcon, CheckIcon } from "@/components/Icons";
import { BotIntervention } from "@/components/BotIntervention";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DashboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [groupedPlayers, setGroupedPlayers] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [activeLeague, setActiveLeague] = useState<any>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [botMessage, setBotMessage] = useState("");
  const [viewingLeague, setViewingLeague] = useState<any>(null);
  const [leagueMembers, setLeagueMembers] = useState<any[]>([]);
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [p, l, ml, gp] = await Promise.all([
        usersApi.getAll(), 
        leaguesApi.getAll(), 
        leaguesApi.getMy(),
        usersApi.getGroupedByLeague()
      ]);
      setPlayers(p);
      setLeagues(l);
      setMyLeagues(ml);
      setGroupedPlayers(gp);
      
      // Active league: prefer user-selected, else first active, else first in list
      const storedId = typeof window !== "undefined" ? localStorage.getItem("selected_league_id") : null;
      const active = (storedId && ml.find((x: any) => x.id === storedId)) ||
                     ml.find((x: any) => x.status === "active") ||
                     (ml.length > 0 ? ml[0] : null);
      if (active) {
        setActiveLeague(active);
        setSelectedLeagueId(active.id);
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

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await usersApi.search(q);
      setSearchResults(results);
    } catch (e) {}
    setSearching(false);
  }

  async function handleInvite(userId: string, username: string) {
    // Find a pending league owned by the user
    const pendingLeague = myLeagues.find(l => l.status === "pending" && l.created_by === user?.id);
    if (!pendingLeague) {
      setMsg("error:You must have a pending league that you created to invite players.");
      return;
    }

    try {
      await leaguesApi.inviteMember(pendingLeague.id, userId);
      setMsg(`success:Invitation envoyée à ${username} pour rejoindre ${pendingLeague.name} !`);
      setSearchQuery("");
      setSearchResults([]);
      loadAll();
    } catch (err: any) {
      setMsg("error:" + err.message);
    }
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
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="page-title"><GridIcon /> Dashboard</h1>
          <p className="page-subtitle">Manage your matches and leagues</p>
        </div>
        {/* Premium Player Search */}
        <div style={{ position: "relative", minWidth: "260px", maxWidth: "340px", flex: "0 0 auto" }}>
          {/* Wrapper with glowing border on focus */}
          <div style={{
            position: "relative",
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            backdropFilter: "blur(12px)",
            transition: "box-shadow 0.3s, border-color 0.3s",
          }}
            onFocusCapture={e => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12), 0 4px 14px rgba(0,0,0,0.15)";
              el.style.borderColor = "rgba(37,99,235,0.6)";
            }}
            onBlurCapture={e => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.12)";
              el.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            {/* Search icon */}
            <span style={{
              position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)",
              color: "var(--accent-light)", display: "flex", pointerEvents: "none", opacity: 0.8
            }}>
              <UsersIcon />
            </span>
            <input
              type="text"
              placeholder="Search player..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 38px 10px 40px",
                background: "transparent",
                border: "none",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
                letterSpacing: "0.02em",
              }}
            />
            {searching && (
              <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>
                <div className="spinner" style={{ width: "13px", height: "13px" }}></div>
              </div>
            )}
          </div>

          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              left: 0,
              background: "linear-gradient(160deg, rgba(20,24,40,0.98), rgba(12,16,32,0.98))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
              backdropFilter: "blur(16px)",
              zIndex: 999
            }}>
              <div style={{ padding: "8px 14px 6px", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                Results
              </div>
              {searchResults.map((p: any) => (
                <div key={p.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  transition: "background 0.15s, padding-left 0.15s",
                  cursor: "pointer"
                }}
                  onClick={() => router.push(`/players/${p.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.08)"; e.currentTarget.style.paddingLeft = "18px"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.paddingLeft = "14px"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="player-avatar" style={{ width: "30px", height: "30px", fontSize: "12px", flexShrink: 0, overflow: "hidden", borderRadius: "50%" }}>
                      {p.avatar_url ? (
                        <img src={getAvatarUrl(p.avatar_url) || ""} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
                      ) : p.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "#ffffff" }}>{p.username}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px", marginTop: "1px" }}>
                        <TrophyIcon /> {p.total_trophies || 0} trophies
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleInvite(p.id, p.username); }}
                    className="btn btn-sm btn-green"
                    style={{ fontSize: "10px", padding: "4px 10px", flexShrink: 0 }}
                  >
                    <PlusIcon /> Invite
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
          {myLeagues.length > 0 ? myLeagues.map((lg: any) => {
            const isSelected = selectedLeagueId === lg.id;
            return (
              <div key={lg.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px",
                border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                borderRadius: "10px",
                background: isSelected ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.01)",
                transition: "all 0.2s"
              }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => handleViewLeague(lg)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>{lg.name}</div>
                    {isSelected && (
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent-light)", background: "rgba(37,99,235,0.15)", padding: "2px 7px", borderRadius: "20px", letterSpacing: "0.05em" }}>SELECTED</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "12px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><UsersIcon />{lg.member_count} players</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {!isSelected && myLeagues.length > 1 && (
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: "11px", padding: "5px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={async () => {
                        setSelectedLeagueId(lg.id);
                        if (typeof window !== "undefined") localStorage.setItem("selected_league_id", lg.id);
                        setActiveLeague(lg);
                        try {
                          const [st, lm] = await Promise.all([
                            leaguesApi.getStandings(lg.id),
                            leaguesApi.getMatches(lg.id)
                          ]);
                          setStandings(st);
                          setMatches(lm);
                        } catch {}
                      }}
                    >
                      <CheckIcon /> Sélectionner
                    </button>
                  )}
                  <button className="btn btn-sm" style={{ padding: "5px 10px", fontSize: "11px" }} onClick={() => handleViewLeague(lg)}>Détails</button>
                  {lg.status === "pending" && lg.created_by !== user?.id && (
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.2)", padding: "5px 10px", fontSize: "11px" }}
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
            );
          }) : (
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
                        {m.is_lord && <span title="Lord of the Game" style={{ color: "var(--gold)", display: "flex" }}><CrownIcon /></span>}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Joined {new Date(m.joined_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255, 215, 0, 0.1)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255, 215, 0, 0.2)" }}>
                      <span style={{ color: "var(--gold)", display: "flex" }}><TrophyIcon /></span>
                      <span style={{ fontWeight: 700, color: "var(--gold)", fontSize: "12px" }}>{m.total_trophies || 0}</span>
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

      {/* Players List Grouped by League */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-bg-watermark"><UsersIcon /></div>
        <div className="card-header">
          <span className="card-title"><UsersIcon /> Players Organization</span>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "12px" }}>
          {groupedPlayers.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", fontSize: "14px" }}>You are not in any leagues yet.</p>
          ) : groupedPlayers.map((league: any) => (
            <div key={league.league_id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-light)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {league.league_name}
                </h3>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "20px" }}>
                  {league.members.length} players
                </span>
              </div>
              <div className="grid-3">
                {league.members.map((p: any) => (
                  <a href={`/players/${p.id}`} key={p.id} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="stat-card" style={{
                      cursor: "pointer",
                      textAlign: "center",
                      padding: "20px 16px",
                      border: "1px solid var(--border)",
                      boxShadow: "var(--shadow-xs)",
                      transition: "box-shadow var(--ease-md), transform var(--ease-md), border-color var(--ease-md)"
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-xs)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
                    >
                      <div className="card-bg-watermark" style={{ fontSize: "40px", opacity: 0.04 }}><UsersIcon /></div>
                      <div className="player-avatar" style={{ width: "44px", height: "44px", fontSize: "18px", margin: "0 auto 10px", overflow: "hidden" }}>
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
                      <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>{p.username}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                        <TrophyIcon /> {p.total_trophies || 0}
                        {p.is_lord && <span title="Lord" style={{ color: "var(--gold)", display: "flex", marginLeft: "4px" }}><CrownIcon /></span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {botMessage && <BotIntervention message={botMessage} onClose={() => setBotMessage("")} />}
    </div>
  );
}
