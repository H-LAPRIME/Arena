"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usersApi, leaguesApi, matchesApi, getAvatarUrl } from "@/lib/api";
import { GridIcon, ZapIcon, GamepadIcon, TrophyIcon, UsersIcon, PlusIcon, HomeIcon, PlaneIcon, CrownIcon, CheckIcon, CalendarIcon, XIcon } from "@/components/Icons";
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
  const [inviteUser, setInviteUser] = useState<any>(null);
  const [inviteLeagueId, setInviteLeagueId] = useState("");
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [dashboardLeagueFilter, setDashboardLeagueFilter] = useState("all");
  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [showUnassignedPlayers, setShowUnassignedPlayers] = useState(false);

  const getBaseLeagueName = (name: string) => name.replace(/ V\d+$/i, "").trim();
  const getSeasonNumber = (name: string) => {
    const match = name.match(/ V(\d+)$/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  const buildLeagueGroups = (leagues: any[]) => {
    const grouped: Record<string, any[]> = {};
    leagues.forEach((lg: any) => {
      const base = getBaseLeagueName(lg.name);
      if (!grouped[base]) grouped[base] = [];
      grouped[base].push(lg);
    });
    return Object.entries(grouped).map(([baseName, seasons]) => {
      const sorted = [...seasons].sort((a, b) => getSeasonNumber(b.name) - getSeasonNumber(a.name));
      const activeSeason = sorted.find((l: any) => l.status === "active") || sorted.find((l: any) => l.status === "pending") || sorted[0];
      return {
        baseName,
        seasons: sorted,
        activeSeason,
        completedSeasons: sorted.filter((l: any) => l.status === "completed" && l.id !== activeSeason?.id),
      };
    });
  };

  const buildPlayerOrganizationGroups = (leagueGroups: any[], includeUnassigned = false) => {
    const grouped: Record<string, any[]> = {};
    const unassignedGroups: any[] = [];
    leagueGroups.forEach((lg: any) => {
      if (lg.league_id === "unassigned") {
        if (includeUnassigned) unassignedGroups.push(lg);
        return;
      }
      const base = getBaseLeagueName(lg.league_name);
      if (!grouped[base]) grouped[base] = [];
      grouped[base].push(lg);
    });

    const currentGroups = Object.entries(grouped).map(([baseName, seasons]) => {
      const sorted = [...seasons].sort((a, b) => getSeasonNumber(b.league_name) - getSeasonNumber(a.league_name));
      const currentSeason = sorted.find((l: any) => l.status === "active") || sorted.find((l: any) => l.status === "pending") || sorted[0];
      return {
        baseName,
        league_id: currentSeason.league_id,
        league_name: currentSeason.league_name,
        status: currentSeason.status,
        members: currentSeason.members,
      };
    });

    if (!includeUnassigned || unassignedGroups.length === 0) return currentGroups;
    const members = unassignedGroups.flatMap((group: any) => group.members || []);
    if (members.length === 0) return currentGroups;
    return [
      ...currentGroups,
      {
        baseName: "Unassigned",
        league_id: "unassigned",
        league_name: "No league assigned",
        status: "unassigned",
        members,
      },
    ];
  };

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

  function handleInviteClick(userId: string, username: string) {
    const ownedLeagues = myLeagues.filter(l => l.created_by === user?.id);
    if (ownedLeagues.length === 0) {
      setMsg("error:You must have a league that you created to invite players.");
      return;
    }
    setInviteUser({ id: userId, username });
    setInviteLeagueId(ownedLeagues[0].id);
  }

  async function confirmInvite() {
    if (!inviteUser || !inviteLeagueId) return;
    const lg = myLeagues.find(l => l.id === inviteLeagueId);
    try {
      await leaguesApi.inviteMember(inviteLeagueId, inviteUser.id);
      setMsg(`success:Invitation envoyée à ${inviteUser.username} pour rejoindre ${lg.name} !`);
      setSearchQuery("");
      setSearchResults([]);
      setInviteUser(null);
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
  const playerOrganizationGroups = buildPlayerOrganizationGroups(groupedPlayers, showUnassignedPlayers);

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
                    onClick={(e) => { e.stopPropagation(); handleInviteClick(p.id, p.username); }}
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
          <div className="stat-value green">{buildLeagueGroups(myLeagues).length}</div>
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
          {(() => {
            const nextMatch = matches.find((m: any) => m.status !== "played");
            if (nextMatch) {
              return (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <span className="match-day-badge">MATCH DAY {nextMatch.match_day}</span>
                  <div className="score-input-group" style={{ marginTop: "16px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div className="player-avatar" style={{ width: "48px", height: "48px", fontSize: "20px", margin: "0 auto 8px", overflow: "hidden" }}>
                        {nextMatch.home_player_avatar ? (
                          <img 
                            src={getAvatarUrl(nextMatch.home_player_avatar) || ""} 
                            alt="Avatar" 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                          />
                        ) : (
                          (nextMatch.home_player_name || "?")[0].toUpperCase()
                        )}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{nextMatch.home_player_name}</span>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><HomeIcon /> Home</div>
                    </div>
                    <span className="match-vs">VS</span>
                    <div style={{ textAlign: "center" }}>
                      <div className="player-avatar" style={{ width: "48px", height: "48px", fontSize: "20px", margin: "0 auto 8px", background: "var(--gradient-green)", overflow: "hidden" }}>
                        {nextMatch.away_player_avatar ? (
                          <img 
                            src={getAvatarUrl(nextMatch.away_player_avatar) || ""} 
                            alt="Avatar" 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                          />
                        ) : (
                          (nextMatch.away_player_name || "?")[0].toUpperCase()
                        )}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{nextMatch.away_player_name}</span>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}><PlaneIcon /> Away</div>
                    </div>
                  </div>
                  <a href="/matches" className="btn btn-green btn-sm" style={{ marginTop: "8px" }}>
                    <GamepadIcon /> Enter Score
                  </a>
                </div>
              );
            } else {
              return (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                  {matches.length > 0 ? "All matches have been played! 🎉" : "No matches available at the moment"}
                </div>
              );
            }
          })()}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {myLeagues.length > 0 ? buildLeagueGroups(myLeagues).map((group: any) => {
            const isActiveSelected = selectedLeagueId === group.activeSeason?.id;
            const historyOpen = !!expandedHistory[group.baseName];
            return (
              <div key={group.baseName} style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "16px", background: "rgba(255,255,255,0.01)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--text-primary)" }}>{group.baseName}</span>
                      {group.completedSeasons.length > 0 && (
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: "11px", padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => setExpandedHistory(prev => ({ ...prev, [group.baseName]: !prev[group.baseName] }))}
                        >
                          <CalendarIcon /> History {group.completedSeasons.length}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Current season: <strong>{group.activeSeason?.name}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {group.activeSeason && !isActiveSelected && (
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: "11px", padding: "5px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                        onClick={async () => {
                          const lg = group.activeSeason;
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
                    {group.activeSeason && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: group.activeSeason.status === "active" ? "#22c55e" : "var(--accent)", background: group.activeSeason.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)", padding: "4px 9px", borderRadius: "999px" }}>
                        {group.activeSeason.status === "active" ? "Active" : group.activeSeason.status === "pending" ? "Pending" : "Latest"}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", borderRadius: "12px", background: isActiveSelected ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.02)", border: isActiveSelected ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-primary)" }}>Current season</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}><UsersIcon /> {group.activeSeason?.member_count} members</div>
                    </div>
                    <button className="btn btn-sm" style={{ padding: "5px 10px", fontSize: "11px" }} onClick={() => handleViewLeague(group.activeSeason)}>
                      Détails
                    </button>
                  </div>

                  {group.completedSeasons.length > 0 && historyOpen && (
                    <div style={{ display: "grid", gap: "10px", padding: "12px 0 0" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)" }}>Season History</div>
                      {group.completedSeasons.map((lg: any) => (
                        <div key={lg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{lg.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{lg.member_count} players</div>
                          </div>
                          <button className="btn btn-sm btn-secondary" style={{ padding: "5px 10px", fontSize: "11px" }} onClick={() => handleViewLeague(lg)}>
                            History
                          </button>
                        </div>
                      ))}
                    </div>
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
              <button onClick={() => setViewingLeague(null)} className="btn btn-sm" style={{ minWidth: "auto", padding: "4px 8px" }}><XIcon /></button>
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

      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-bg-watermark"><UsersIcon /></div>
        <div className="card-header" style={{ flexWrap: "wrap", gap: "12px" }}>
          <span className="card-title"><UsersIcon /> Players Organization</span>
          <label className="btn btn-sm btn-secondary" style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showUnassignedPlayers}
              onChange={(e) => {
                setShowUnassignedPlayers(e.target.checked);
                if (!e.target.checked && dashboardLeagueFilter === "Unassigned") setDashboardLeagueFilter("all");
              }}
              style={{ margin: 0 }}
            />
            Show unassigned
          </label>
          <select 
            className="btn btn-sm" 
            style={{ background: "var(--bg-dark)", color: "var(--text-primary)", border: "1px solid var(--border)", fontSize: "12px" }}
            value={dashboardLeagueFilter}
            onChange={(e) => setDashboardLeagueFilter(e.target.value)}
          >
            <option value="all">All Current Leagues</option>
            {playerOrganizationGroups.map((l: any) => (
              <option key={l.baseName} value={l.baseName}>{l.baseName}</option>
            ))}
          </select>
        </div>
        
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "24px", 
          padding: "12px", 
          maxHeight: "600px", 
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent"
        }}>
          {playerOrganizationGroups.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", fontSize: "14px" }}>
              {showUnassignedPlayers ? "No players to display yet." : "No current league groups. Enable unassigned players to inspect players without a league."}
            </p>
          ) : playerOrganizationGroups
            .filter((l: any) => dashboardLeagueFilter === "all" || l.baseName === dashboardLeagueFilter)
            .map((league: any) => {
              const isExpanded = expandedLeagues[league.baseName];
              const displayedMembers = isExpanded ? league.members : league.members.slice(0, 6);
              
              return (
                <div key={league.baseName}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-light)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {league.baseName}
                      </h3>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
                        {league.status === "unassigned" ? "Not assigned to any league" : `Current season: ${league.league_name}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "20px" }}>
                        {league.members.length} players
                      </span>
                    </div>
                  </div>
                  <div className="grid-3">
                    {displayedMembers.map((p: any) => (
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
                  {!isExpanded && league.members.length > 6 && (
                    <div style={{ textAlign: "center", marginTop: "16px" }}>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => setExpandedLeagues(prev => ({ ...prev, [league.baseName]: true }))}
                      >
                        See more ({league.members.length - 6} more)
                      </button>
                    </div>
                  )}
                  {isExpanded && (
                    <div style={{ textAlign: "center", marginTop: "16px" }}>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => setExpandedLeagues(prev => ({ ...prev, [league.baseName]: false }))}
                      >
                        Show less
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
      
      {botMessage && <BotIntervention message={botMessage} onClose={() => setBotMessage("")} />}

      {inviteUser && (
        <div className="modal-overlay" onClick={() => setInviteUser(null)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()} style={{ width: "400px" }}>
            <h2>Invite {inviteUser.username}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px" }}>Which league would you like to invite this player to?</p>
            <select 
              value={inviteLeagueId} 
              onChange={e => setInviteLeagueId(e.target.value)} 
              style={{ 
                width: "100%", padding: "12px", background: "rgba(0,0,0,0.03)", 
                border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", 
                marginBottom: "20px", outline: "none"
              }}
            >
              {myLeagues.filter(l => l.created_by === user?.id).map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.status})</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn btn-primary" onClick={confirmInvite} disabled={!inviteLeagueId} style={{ flex: 1 }}>Send Invite</button>
              <button className="btn btn-secondary" onClick={() => setInviteUser(null)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
