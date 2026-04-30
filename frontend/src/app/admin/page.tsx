"use client";
import { useEffect, useState } from "react";
import { claimsApi, usersApi, matchesApi, leaguesApi, getAvatarUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { AdminIcon, ShieldIcon, UsersIcon, GamepadIcon, CalendarIcon, TrophyIcon, CheckIcon, PlusIcon, TrashIcon, UserIcon } from "@/components/Icons";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<"claims" | "users" | "matches" | "seasons">("claims");
  const [claims, setClaims] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState("");
  const [msg, setMsg] = useState("");
  const [userFilterLeague, setUserFilterLeague] = useState<string>("all");
  const [userSortBy, setUserSortBy] = useState<"name" | "date">("name");
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [leagueMemberIds, setLeagueMemberIds] = useState<Set<string> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal States
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<any>(null);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedLeagueMembers, setSelectedLeagueMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace("/dashboard");
  }, [isAdmin, isLoading, router]);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  // Tab Switch Reset
  useEffect(() => { setSearchTerm(""); }, [tab]);

  async function loadAll() {
    try {
      const [c, u, m, s] = await Promise.all([
        claimsApi.getAll(),
        usersApi.adminList(),
        matchesApi.getAll(),
        leaguesApi.getAll(),
      ]);
      setClaims(c);
      setUsers(u);
      setMatches(m);
      setSeasons(s);
    } catch (err: any) { setMsg("error:" + err.message); }
  }

  useEffect(() => {
    let result = [...users];

    // Filter by League
    if (userFilterLeague !== "all" && leagueMemberIds) {
      result = result.filter(u => leagueMemberIds.has(u.id));
    }

    // Sort
    result.sort((a, b) => {
      if (userSortBy === "name") {
        return a.username.localeCompare(b.username);
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    // Search filter
    if (searchTerm) {
      result = result.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(result);
  }, [users, userSortBy, searchTerm, userFilterLeague, leagueMemberIds]);

  async function handleLeagueFilterChange(leagueId: string) {
    setUserFilterLeague(leagueId);
    if (leagueId === "all") {
      setLeagueMemberIds(null);
      return;
    }
    try {
      const members = await leaguesApi.getMembers(leagueId);
      setLeagueMemberIds(new Set(members.map((m: any) => m.user_id)));
    } catch (e) {
      setLeagueMemberIds(new Set());
    }
  }

  // Claim actions
  async function handleApprove(id: string) {
    try { await claimsApi.approve(id, noteMap[id]); setMsg("success:Claim approved!"); loadAll(); } 
    catch (err: any) { setMsg("error:" + err.message); }
  }
  async function handleReject(id: string) {
    try { await claimsApi.reject(id, noteMap[id]); setMsg("success:Claim rejected."); loadAll(); } 
    catch (err: any) { setMsg("error:" + err.message); }
  }

  // User Actions
  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    
    // Validation
    if (!editingUser.username || editingUser.username.length < 3) {
      setModalError("Username must be at least 3 characters");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editingUser.email || !emailRegex.test(editingUser.email)) {
      setModalError("Please enter a valid email address");
      return;
    }
    if (!editingUser.id && (!editingUser.password || editingUser.password.length < 6)) {
      setModalError("Password must be at least 6 characters for new accounts");
      return;
    }
    if (editingUser.id && editingUser.password && editingUser.password.length > 0 && editingUser.password.length < 6) {
      setModalError("New password must be at least 6 characters");
      return;
    }

    try {
      if (editingUser.id) {
        await usersApi.adminUpdate(editingUser.id, editingUser);
        setMsg("success:Joueur mis à jour !");
      } else {
        await usersApi.adminCreate(editingUser);
        setMsg("success:Joueur créé !");
      }
      setIsUserModalOpen(false);
      loadAll();
    } catch (err: any) { 
      setModalError(err.message || "Operation failed");
    }
  }
  async function handleDeleteUser(id: string) {
    if(!confirm("DELETE THIS PLAYER COMPLETELY FROM DATABASE? This action is IRREVERSIBLE and will delete all their data!")) return;
    try { await usersApi.delete(id); setMsg("success:Player deleted completely."); loadAll(); } 
    catch (err: any) { setMsg("error:" + err.message); }
  }

  async function handleRemoveMember(leagueId: string, userId: string) {
    if(!confirm("Remove this player from the league?")) return;
    try {
      await leaguesApi.removeMember(leagueId, userId);
      setMsg("success:Player removed from league.");
      // Refresh members list
      const members = await leaguesApi.getMembers(leagueId);
      setSelectedLeagueMembers(members);
      loadAll();
    } catch (err: any) { setMsg("error:" + err.message); }
  }

  async function handleAdminAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingUser?.id) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await usersApi.updateUserAvatar(editingUser.id, file);
      setEditingUser({ ...editingUser, avatar_url: res.avatar_url });
      setMsg("success:Photo du joueur mise à jour !");
      loadAll();
    } catch (err: any) { setMsg("error:" + err.message); }
  }

  // Match Actions
  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingMatch.id) {
        await matchesApi.adminUpdate(editingMatch.id, editingMatch);
        setMsg("success:Match mis à jour !");
      } else {
        await matchesApi.create(editingMatch);
        setMsg("success:Match créé !");
      }
      setIsMatchModalOpen(false);
      loadAll();
    } catch (err: any) { setMsg("error:" + err.message); }
  }
  async function handleDeleteMatch(id: string) {
    if(!confirm("Delete this match?")) return;
    try { await matchesApi.delete(id); setMsg("success:Match deleted."); loadAll(); } 
    catch (err: any) { setMsg("error:" + err.message); }
  }

  // Season Actions
  async function handleSaveSeason(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingSeason.id) {
        await leaguesApi.update(editingSeason.id, editingSeason);
        setMsg("success:Saison mise à jour !");
      } else {
        await leaguesApi.create({
          name: editingSeason.name || `Saison ${editingSeason.season_number}`,
          description: editingSeason.description || "",
        });
        setMsg("success:Saison créée !");
      }
      setIsSeasonModalOpen(false);
      loadAll();
    } catch (err: any) { setMsg("error:" + err.message); }
  }
  async function loadSeasonMembers(leagueId: string) {
    try {
      const members = await leaguesApi.getMembers(leagueId);
      setSelectedLeagueMembers(members);
      setIsMembersModalOpen(true);
    } catch (err: any) { setMsg("error:" + err.message); }
  }

  async function handleDeleteSeason(id: string) {
    if(!confirm("Supprimer cette saison ?")) return;
    try { await leaguesApi.delete(id); setMsg("success:Saison supprimée."); loadAll(); } 
    catch (err: any) { setMsg("error:" + err.message); }
  }

  const msgType = msg.startsWith("success:") ? "success" : "error";
  const msgText = msg.replace(/^(success:|error:)/, "");

  if (isLoading || !isAdmin) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><AdminIcon /> Admin Panel</h1>
        <p className="page-subtitle">Full platform management</p>
      </div>

      {msg && <div className={`toast ${msgType}`} style={{ position: "relative", bottom: "auto", right: "auto", marginBottom: "20px" }} onClick={() => setMsg("")}>{msgText}</div>}

      <div style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "var(--bg-card)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border)", width: "fit-content", flexWrap: "wrap" }}>
        {(["claims", "users", "matches", "seasons"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="btn" style={{
            background: tab === t ? "var(--gradient-accent)" : "transparent",
            color: tab === t ? "#fff" : "var(--text-muted)",
            borderRadius: "8px", gap: "6px",
          }}>
            {t === "claims" && <ShieldIcon />}
            {t === "users" && <UsersIcon />}
            {t === "matches" && <GamepadIcon />}
            {t === "seasons" && <CalendarIcon />}
            {t === "claims" ? "Claims" : t === "users" ? "Players" : t === "matches" ? "Matches" : "Seasons"}
            {t === "claims" && claims.filter(c => c.status === "pending").length > 0 && (
              <span style={{ background: "var(--red)", color: "white", fontSize: "10px", padding: "1px 6px", borderRadius: "10px", marginLeft: "4px" }}>
                {claims.filter(c => c.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Shared Search Bar / Filters handled per tab below */}

      {/* Claims Tab */}
      {tab === "claims" && (
        <div className="card" style={{ maxHeight: "750px", overflowY: "auto", scrollbarWidth: "thin" }}>
          <div className="card-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <span className="card-title">Claims</span>
            <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: "200px" }}>
              <input 
                type="text" 
                placeholder="Search claims..." 
                className="btn btn-sm"
                style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", flex: 1, textAlign: "left", cursor: "text" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {["pending", "approved", "rejected", ""].map(s => {
                const count = s === "" ? claims.length : claims.filter(c => c.status === s).length;
                return (
                  <button key={s || "all"} onClick={() => setStatusFilter(s)} className="btn btn-sm" style={{
                    background: statusFilter === s ? "var(--accent-glow)" : "transparent",
                    color: statusFilter === s ? "var(--accent-light)" : "var(--text-muted)",
                    border: `1px solid ${statusFilter === s ? "var(--border-accent)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    {s || "All"}
                    <span style={{ fontSize: "10px", opacity: 0.7, background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: "4px" }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {claims.length === 0 ? <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px", fontSize: "14px" }}>No claims</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {claims
                .filter((c: any) => {
                  const matchesSearch = c.home_player_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                      c.away_player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      c.claimant_username.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesStatus = statusFilter === "" || c.status === statusFilter;
                  return matchesSearch && matchesStatus;
                })
                .map((c: any) => (
                <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0 }}>
                    {c.screenshot_url ? <a href={getAvatarUrl(c.screenshot_url) || "#"} target="_blank" rel="noopener noreferrer"><img src={getAvatarUrl(c.screenshot_url) || ""} alt="proof" style={{ width: "80px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border)" }} /></a> : <div style={{ width: "80px", height: "60px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>No proof</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap", width: "100%" }}>
                      <span className={c.status === "pending" ? "claim-pending" : c.status === "approved" ? "claim-approved" : "claim-rejected"}>{c.status.toUpperCase()}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{c.home_player_name}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "18px", color: "var(--accent)", padding: "0 4px" }}>{c.home_score}-{c.away_score}</span>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{c.away_player_name}</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span className={c.claim_type === "win" ? "badge badge-gold" : c.claim_type === "draw" ? "badge badge-cyan" : "badge badge-danger"}>
                          {c.claim_type === "win" ? "Win +3" : c.claim_type === "draw" ? "Draw +1" : "Loss +0"}
                        </span>
                        {c.claim_type === "loss" && (
                          <span className="badge badge-gold" style={{ background: "rgba(255, 215, 0, 0.1)", border: "1px solid gold" }}>+3pt for opponent</span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "auto" }}>
                        Requested by <strong>{c.claimant_username}</strong>
                      </span>
                    </div>
                    {c.status !== "pending" && (
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "8px", marginBottom: "8px", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 600 }}>Review Details</span>
                          <span>{new Date(c.reviewed_at).toLocaleDateString()} at {new Date(c.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {c.admin_note ? (
                          <p style={{ margin: 0, fontStyle: "italic", color: "var(--text-secondary)" }}>"{c.admin_note}"</p>
                        ) : (
                          <p style={{ margin: 0, opacity: 0.5 }}>No note provided</p>
                        )}
                      </div>
                    )}
                    {c.status === "pending" && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <input placeholder="Note" value={noteMap[c.id] || ""} onChange={e => setNoteMap(p => ({ ...p, [c.id]: e.target.value }))} style={{ flex: 1, padding: "7px 12px", background: "rgba(0,0,0,0.04)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)" }} />
                        <button onClick={() => handleApprove(c.id)} className="btn btn-green btn-sm">Approve</button>
                        <button onClick={() => handleReject(c.id)} className="btn btn-danger btn-sm">Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: "750px", display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ padding: "20px", borderBottom: "1px solid var(--border)", marginBottom: 0, flexWrap: "wrap", gap: "12px" }}>
            <span className="card-title">Players</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", flex: 1 }}>
              <input 
                type="text" 
                placeholder="Search players..." 
                className="btn btn-sm"
                style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", flex: 1, minWidth: "150px", textAlign: "left", cursor: "text" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select 
                className="btn btn-sm" 
                style={{ background: "var(--bg-dark)", color: "var(--text-primary)", border: "1px solid var(--border)", fontSize: "12px" }}
                value={userFilterLeague}
                onChange={(e) => handleLeagueFilterChange(e.target.value)}
              >
                <option value="all">All Leagues</option>
                {seasons.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select 
                className="btn btn-sm" 
                style={{ background: "var(--bg-dark)", color: "var(--text-primary)", border: "1px solid var(--border)", fontSize: "12px" }}
                value={userSortBy}
                onChange={(e) => setUserSortBy(e.target.value as any)}
              >
                <option value="name">Sort: Name (A-Z)</option>
                <option value="date">Sort: Newest First</option>
              </select>
              <button onClick={() => { setEditingUser({}); setModalError(""); setIsUserModalOpen(true); }} className="btn btn-sm btn-secondary"><PlusIcon /> Add Player</button>
            </div>
          </div>
          <div className="table-container admin-table-container" style={{ flex: 1, overflowY: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>Player</th><th>Email</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Link href={`/players/${u.id}`} className="player-avatar" style={{ width: "28px", height: "28px", fontSize: "11px", flexShrink: 0, textDecoration: "none" }}>
                          {u.avatar_url ? (
                            <img src={getAvatarUrl(u.avatar_url) || ""} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          ) : u.username[0].toUpperCase()}
                        </Link>
                        <Link href={`/players/${u.id}`} className="player-name" style={{ color: "var(--text-primary)", fontWeight: 600, textDecoration: "none" }}>{u.username}</Link> 
                        {!u.is_active && <span className="badge badge-danger" style={{ fontSize: "9px", padding: "1px 5px" }}>Inactive</span>}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{u.email}</td>
                    <td><span className={u.role === "admin" ? "badge badge-gold" : "badge"}>{u.role}</span></td>
                    <td>
                      <button onClick={() => { setEditingUser(u); setModalError(""); setIsUserModalOpen(true); }} className="btn btn-sm" style={{ marginRight: "4px" }}>Edit</button>
                      {u.role !== "admin" && <button onClick={() => handleDeleteUser(u.id)} className="btn btn-danger btn-sm"><TrashIcon /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matches Tab */}
      {tab === "matches" && (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: "750px", display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ padding: "20px", borderBottom: "1px solid var(--border)", marginBottom: 0, flexWrap: "wrap", gap: "12px" }}>
            <span className="card-title">Matches</span>
            <input 
              type="text" 
              placeholder="Search matches..." 
              className="btn btn-sm"
              style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", flex: 1, minWidth: "150px", textAlign: "left", cursor: "text" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={() => { setEditingMatch({}); setModalError(""); setIsMatchModalOpen(true); }} className="btn btn-sm btn-secondary"><PlusIcon /> Add Match</button>
          </div>
          <div className="table-container admin-table-container" style={{ flex: 1, overflowY: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>League</th><th>Match Day</th><th>Home</th><th>Away</th><th>Score</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {matches
                  .filter((m: any) => {
                    const leagueName = seasons.find(s => s.id === m.league_id)?.name || "";
                    return m.home_player_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           m.away_player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           leagueName.toLowerCase().includes(searchTerm.toLowerCase());
                  })
                  .map((m: any) => (
                  <tr key={m.id}>
                    <td>{seasons.find(s => s.id === m.league_id)?.name || m.league_id}</td>
                    <td>J{m.match_day}</td>
                    <td>{m.home_player_name}</td>
                    <td>{m.away_player_name}</td>
                    <td style={{ fontWeight: 700 }}>{m.home_score !== null ? `${m.home_score} - ${m.away_score}` : "-"}</td>
                    <td><span className={m.status === "played" ? "badge badge-green" : "badge"}>{m.status}</span></td>
                    <td>
                      <button onClick={() => { setEditingMatch(m); setModalError(""); setIsMatchModalOpen(true); }} className="btn btn-sm" style={{ marginRight: "4px" }}>Edit</button>
                      <button onClick={() => handleDeleteMatch(m.id)} className="btn btn-danger btn-sm"><TrashIcon /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seasons Tab */}
      {tab === "seasons" && (
        <div className="card" style={{ padding: 0, overflow: "hidden", maxHeight: "750px", display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ padding: "20px", borderBottom: "1px solid var(--border)", marginBottom: 0, flexWrap: "wrap", gap: "12px" }}>
            <span className="card-title">Seasons / Leagues</span>
            <input 
              type="text" 
              placeholder="Search leagues..." 
              className="btn btn-sm"
              style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", flex: 1, minWidth: "150px", textAlign: "left", cursor: "text" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={() => { setEditingSeason({}); setIsSeasonModalOpen(true); }} className="btn btn-sm btn-secondary"><PlusIcon /> Create League</button>
          </div>
          <div className="table-container admin-table-container" style={{ flex: 1, overflowY: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Code</th><th>Members</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {seasons
                  .filter((s: any) => 
                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    s.join_code.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((s: any) => (
                  <tr key={s.id}>
                    <td><span className="player-name">{s.name}</span></td>
                    <td><code>{s.join_code}</code></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 600 }}>{s.member_count} / {s.max_members}</span>
                        <button 
                          onClick={() => loadSeasonMembers(s.id)} 
                          className="btn btn-sm" 
                          style={{ fontSize: "11px", padding: "4px 10px", background: "rgba(124, 58, 237, 0.1)", color: "var(--accent-light)", border: "1px solid var(--border-accent)" }}
                        >
                          View List
                        </button>
                      </div>
                    </td>
                    <td><span className={s.status === "active" ? "badge badge-green" : s.status === "completed" ? "badge badge-gold" : "badge"}>{s.status}</span></td>
                    <td>
                      <button onClick={() => { setEditingSeason(s); setModalError(""); setIsSeasonModalOpen(true); }} className="btn btn-sm" style={{ marginRight: "4px" }}>Edit</button>
                      <button onClick={() => handleDeleteSeason(s.id)} className="btn btn-danger btn-sm"><TrashIcon /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {isUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h2>{editingUser?.id ? "Edit" : "Create"} Player</h2>
            
            {modalError && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "var(--red)", fontSize: "13px" }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              {editingUser?.id && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", padding: "10px", background: "rgba(0,0,0,0.02)", borderRadius: "8px" }}>
                  <div className="player-avatar" style={{ width: "48px", height: "48px" }}>
                    {editingUser.avatar_url ? (
                      <img 
                        src={getAvatarUrl(editingUser.avatar_url) || ""} 
                        alt="Avatar" 
                        style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} 
                      />
                    ) : editingUser.username[0].toUpperCase()}
                  </div>
                  <div>
                    <button type="button" onClick={() => document.getElementById("admin-user-avatar")?.click()} className="btn btn-sm">Change Photo</button>
                    <input id="admin-user-avatar" type="file" hidden accept="image/*" onChange={handleAdminAvatarUpload} />
                  </div>
                </div>
              )}
              <input placeholder="Username" required value={editingUser?.username || ""} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} className="input-field" />
              <input type="email" placeholder="Email" required value={editingUser?.email || ""} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="input-field" />
              <input type="password" placeholder={editingUser?.id ? "Nouveau mot de passe (laisser vide si inchangé)" : "Mot de passe"} required={!editingUser?.id} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} className="input-field" />
              <select value={editingUser?.role || "user"} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="input-field" style={{ background: "var(--bg-dark)" }}>
                <option value="user">User</option>
                <option value="admin">Administrator</option>
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", marginTop: "10px" }}>
                <input 
                  type="checkbox" 
                  id="userActive" 
                  checked={editingUser?.is_active !== false} 
                  onChange={e => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                  style={{ width: "20px", height: "20px" }}
                />
                <label htmlFor="userActive" style={{ fontSize: "14px", fontWeight: 600 }}>Active Account</label>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSeasonModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h2>{editingSeason?.id ? "Edit" : "Create"} Season</h2>
            <form onSubmit={handleSaveSeason} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              <input placeholder="Season Name" required value={editingSeason?.name || ""} onChange={e => setEditingSeason({ ...editingSeason, name: e.target.value })} className="input-field" />
              <input placeholder="Description" value={editingSeason?.description || ""} onChange={e => setEditingSeason({ ...editingSeason, description: e.target.value })} className="input-field" />
              {!editingSeason?.id && <input type="number" placeholder="Season Number (optional)" value={editingSeason?.season_number || ""} onChange={e => setEditingSeason({ ...editingSeason, season_number: parseInt(e.target.value) })} className="input-field" />}
              {editingSeason?.id && (
                <select value={editingSeason?.status || "pending"} onChange={e => setEditingSeason({ ...editingSeason, status: e.target.value })} className="input-field" style={{ background: "var(--bg-dark)" }}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                <button type="button" onClick={() => setIsSeasonModalOpen(false)} className="btn" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMatchModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card">
            <h2>{editingMatch?.id ? "Edit" : "Create"} Match</h2>
            {modalError && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "var(--red)", fontSize: "13px" }}>
                {modalError}
              </div>
            )}
            <form onSubmit={handleSaveMatch} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              <select required value={editingMatch?.league_id || ""} onChange={e => setEditingMatch({ ...editingMatch, league_id: e.target.value })} className="input-field" style={{ background: "var(--bg-dark)" }}>
                <option value="">Select League</option>
                {seasons.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select required value={editingMatch?.home_player_id || ""} onChange={e => setEditingMatch({ ...editingMatch, home_player_id: e.target.value })} className="input-field" style={{ background: "var(--bg-dark)" }}>
                <option value="">Select Home</option>
                {users.map((u:any) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
              <select required value={editingMatch?.away_player_id || ""} onChange={e => setEditingMatch({ ...editingMatch, away_player_id: e.target.value })} className="input-field" style={{ background: "var(--bg-dark)" }}>
                <option value="">Select Away</option>
                {users.map((u:any) => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
              <input type="number" required placeholder="Match Day" value={editingMatch?.match_day || ""} onChange={e => setEditingMatch({ ...editingMatch, match_day: parseInt(e.target.value) })} className="input-field" />
              <select value={editingMatch?.status || "pending"} onChange={e => setEditingMatch({ ...editingMatch, status: e.target.value })} className="input-field" style={{ background: "var(--bg-dark)" }}>
                <option value="pending">Pending</option>
                <option value="played">Played</option>
              </select>
              {editingMatch?.status === "played" && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <input type="number" placeholder="Home Score" value={editingMatch?.home_score ?? ""} onChange={e => setEditingMatch({ ...editingMatch, home_score: parseInt(e.target.value) })} className="input-field" />
                  <input type="number" placeholder="Away Score" value={editingMatch?.away_score ?? ""} onChange={e => setEditingMatch({ ...editingMatch, away_score: parseInt(e.target.value) })} className="input-field" />
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                <button type="button" onClick={() => setIsMatchModalOpen(false)} className="btn" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {isMembersModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ width: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>League Participants</h2>
              <button onClick={() => setIsMembersModalOpen(false)} className="btn btn-sm" style={{ minWidth: "auto", padding: "4px 8px" }}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
              {selectedLeagueMembers.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>No participants yet.</p>
              ) : selectedLeagueMembers.map((m: any) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <div className="player-avatar" style={{ width: "40px", height: "40px", fontSize: "14px" }}>
                    {m.avatar_url ? (
                      <img 
                        src={getAvatarUrl(m.avatar_url) || ""} 
                        alt={m.username} 
                        style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} 
                      />
                    ) : m.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: 600 }}>{m.username}</span>
                      {m.is_lord && <span title="Lord of the Game" style={{ color: "gold", fontSize: "12px" }}>👑</span>}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}> Joined on {new Date(m.joined_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255, 215, 0, 0.1)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255, 215, 0, 0.2)" }}>
                      <span style={{ color: "gold", fontSize: "12px" }}>🏆</span>
                      <span style={{ fontWeight: 700, color: "gold", fontSize: "13px" }}>{m.total_trophies || 0}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveMember(m.league_id || (seasons.find((s:any)=>s.status==="active" || s.status==="pending")?.id), m.user_id)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: "4px 8px", minWidth: "auto" }}
                      title="Remove from league"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setIsMembersModalOpen(false)} className="btn btn-primary" style={{ width: "100%", marginTop: "20px" }}>Close</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .modal-content { width: 400px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
        .input-field { width: 100%; padding: 12px; background: rgba(0,0,0,0.03); border: 1px solid var(--border); borderRadius: 8px; color: var(--text-primary); fontSize: 14px; outline: none; }
        .input-field:focus { border-color: var(--accent); }
      `}</style>
    </div>
  );
}

