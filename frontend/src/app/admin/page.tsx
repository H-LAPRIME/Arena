"use client";
import { useEffect, useState } from "react";
import { claimsApi, usersApi, matchesApi, leaguesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { AdminIcon, ShieldIcon, UsersIcon, GamepadIcon, CalendarIcon, TrophyIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/Icons";

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
  const [msg, setMsg] = useState("");

  // Modal States
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<any>(null);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace("/dashboard");
  }, [isAdmin, isLoading, router]);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, statusFilter]);

  async function loadAll() {
    try {
      const [c, u, m, s] = await Promise.all([
        claimsApi.getAll(statusFilter || undefined),
        usersApi.getAll(),
        matchesApi.getAll(),
        leaguesApi.getAll(),
      ]);
      setClaims(c);
      setUsers(u);
      setMatches(m);
      setSeasons(s);
    } catch (err: any) { setMsg("error:" + err.message); }
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
    } catch (err: any) { setMsg("error:" + err.message); }
  }
  async function handleDeleteUser(id: string) {
    if(!confirm("Deactivate this player?")) return;
    try { await usersApi.delete(id); setMsg("success:Player deactivated."); loadAll(); } 
    catch (err: any) { setMsg("error:" + err.message); }
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
          </button>
        ))}
      </div>

      {/* Claims Tab */}
      {tab === "claims" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Claims</span>
            <div style={{ display: "flex", gap: "8px" }}>
              {["pending", "approved", "rejected", ""].map(s => (
                <button key={s || "all"} onClick={() => setStatusFilter(s)} className="btn btn-sm" style={{
                  background: statusFilter === s ? "var(--accent-glow)" : "transparent",
                  color: statusFilter === s ? "var(--accent-light)" : "var(--text-muted)",
                  border: `1px solid ${statusFilter === s ? "var(--border-accent)" : "var(--border)"}`,
                }}>
                  {s || "All"}
                </button>
              ))}
            </div>
          </div>
          {claims.length === 0 ? <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px", fontSize: "14px" }}>No claims</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {claims.map((c: any) => (
                <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0 }}>
                    {c.screenshot_url ? <a href={`${API_URL}${c.screenshot_url}`} target="_blank" rel="noopener noreferrer"><img src={`${API_URL}${c.screenshot_url}`} alt="proof" style={{ width: "80px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border)" }} /></a> : <div style={{ width: "80px", height: "60px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "12px" }}>No proof</div>}
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
                    {c.admin_note && <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Note: {c.admin_note}</p>}
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "20px", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
            <span className="card-title">Players</span>
            <button onClick={() => { setEditingUser({}); setIsUserModalOpen(true); }} className="btn btn-sm btn-secondary"><PlusIcon /> Add Player</button>
          </div>
          <div className="table-container admin-table-container">
            <table className="admin-table">
              <thead>
                <tr><th>Player</th><th>Email</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td><span className="player-name">{u.username}</span> {!u.is_active && <span className="badge badge-danger">Inactive</span>}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{u.email}</td>
                    <td><span className={u.role === "admin" ? "badge badge-gold" : "badge"}>{u.role}</span></td>
                    <td>
                      <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="btn btn-sm" style={{ marginRight: "4px" }}>Edit</button>
                      {u.is_active && <button onClick={() => handleDeleteUser(u.id)} className="btn btn-danger btn-sm"><TrashIcon /></button>}
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "20px", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
            <span className="card-title">Matches</span>
            <button onClick={() => { setEditingMatch({}); setIsMatchModalOpen(true); }} className="btn btn-sm btn-secondary"><PlusIcon /> Add Match</button>
          </div>
          <div className="table-container admin-table-container">
            <table className="admin-table">
              <thead>
                <tr><th>League</th><th>Match Day</th><th>Home</th><th>Away</th><th>Score</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {matches.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.league_id}</td>
                    <td>J{m.match_day}</td>
                    <td>{m.home_player_name}</td>
                    <td>{m.away_player_name}</td>
                    <td style={{ fontWeight: 700 }}>{m.home_score !== null ? `${m.home_score} - ${m.away_score}` : "-"}</td>
                    <td><span className={m.status === "played" ? "badge badge-green" : "badge"}>{m.status}</span></td>
                    <td>
                      <button onClick={() => { setEditingMatch(m); setIsMatchModalOpen(true); }} className="btn btn-sm" style={{ marginRight: "4px" }}>Edit</button>
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header" style={{ padding: "20px", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
            <span className="card-title">Seasons / Leagues</span>
            <button onClick={() => { setEditingSeason({}); setIsSeasonModalOpen(true); }} className="btn btn-sm btn-secondary"><PlusIcon /> Create League</button>
          </div>
          <div className="table-container admin-table-container">
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Code</th><th>Members</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {seasons.map((s: any) => (
                  <tr key={s.id}>
                    <td><span className="player-name">{s.name}</span></td>
                    <td><code>{s.join_code}</code></td>
                    <td>{s.member_count} / {s.max_members}</td>
                    <td><span className={s.status === "active" ? "badge badge-green" : s.status === "completed" ? "badge badge-gold" : "badge"}>{s.status}</span></td>
                    <td>
                      <button onClick={() => { setEditingSeason(s); setIsSeasonModalOpen(true); }} className="btn btn-sm" style={{ marginRight: "4px" }}>Edit</button>
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
            <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              {editingUser?.id && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", padding: "10px", background: "rgba(0,0,0,0.02)", borderRadius: "8px" }}>
                  <div className="player-avatar" style={{ width: "48px", height: "48px" }}>
                    {editingUser.avatar_url ? <img src={`${API_URL}${editingUser.avatar_url}`} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : editingUser.username[0].toUpperCase()}
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

      <style jsx>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .modal-content { width: 400px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
        .input-field { width: 100%; padding: 12px; background: rgba(0,0,0,0.03); border: 1px solid var(--border); borderRadius: 8px; color: var(--text-primary); fontSize: 14px; outline: none; }
        .input-field:focus { border-color: var(--accent); }
      `}</style>
    </div>
  );
}

