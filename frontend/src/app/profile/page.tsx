"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { statsApi, usersApi, leaguesApi, certificatesApi } from "@/lib/api";
import Link from "next/link";
import { ChartIcon, TrophyIcon, ShieldIcon, GamepadIcon, SettingsIcon } from "@/components/Icons";
import Cropper from "react-easy-crop";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  
  // Crop states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (user) {
      if (!newUsername) setNewUsername(user.username);
      Promise.all([
        statsApi.player(user.id),
        leaguesApi.getMy()
      ])
        .then(([s, l]) => {
          setStats(s);
          setMyLeagues(l);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsPhotoModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile || !photoPreview || !croppedAreaPixels) return;
    setUploading(true);
    try {
      // Create cropped image using canvas and pixels from react-easy-crop
      const croppedFile = await new Promise<File>((resolve, reject) => {
        const image = new Image();
        image.src = photoPreview;
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject();

          canvas.width = croppedAreaPixels.width;
          canvas.height = croppedAreaPixels.height;

          ctx.drawImage(
            image,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            croppedAreaPixels.width,
            croppedAreaPixels.height
          );

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], selectedFile.name, { type: "image/jpeg" }));
            }
          }, "image/jpeg");
        };
        image.onerror = reject;
      });

      const updated = await usersApi.updateAvatar(croppedFile);
      if (user) updateUser({ ...user, avatar_url: updated.avatar_url });
      setMsg("success:Photo updated!");
      setIsPhotoModalOpen(false);
      setPhotoPreview(null);
      setSelectedFile(null);
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
    setUploading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const updated = await usersApi.updateProfile({ 
        username: newUsername !== user?.username ? newUsername : undefined,
        password: newPassword || undefined,
        old_password: newPassword ? oldPassword : undefined
      });
      updateUser(updated);
      setMsg("success:Profile updated!");
      setNewPassword("");
      setOldPassword("");
      setIsModalOpen(false);
    } catch (err: any) {
      setMsg("error:" + err.message);
    }
    setUpdating(false);
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;
  if (!user) return <div className="page-container"><p>Please log in</p></div>;

  return (
    <div className="page-container" style={{ maxWidth: "1200px" }}>
      {/* 1. HERO SECTION: Profile Header */}
      <div className="card" style={{ padding: "40px", textAlign: "center", marginBottom: "32px", position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)" }}>
        <div style={{ 
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%", 
          background: user.is_lord ? "var(--gradient-gold)" : "var(--gradient-blue)", 
          opacity: 0.05, zIndex: 0 
        }}></div>
        
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="player-avatar" style={{ 
            width: "140px", height: "140px", fontSize: "56px", margin: "0 auto 24px",
            background: user.is_lord ? "var(--gradient-gold)" : "var(--gradient-blue)",
            boxShadow: "0 15px 35px rgba(0,0,0,0.3)",
            border: "4px solid var(--card-bg)",
            position: "relative", cursor: "pointer", overflow: "hidden"
          }} onClick={() => document.getElementById("avatar-input")?.click()}>
            {user.avatar_url ? (
              <img src={`${API_URL}${user.avatar_url}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              user.username[0].toUpperCase()
            )}
            <div className="avatar-edit-overlay">
              <SettingsIcon />
            </div>
            <input id="avatar-input" type="file" accept="image/*" hidden onChange={handleFileSelect} />
          </div>

          <h1 style={{ fontSize: "32px", fontWeight: 900, marginBottom: "8px", letterSpacing: "-1px" }}>{user.username}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "24px" }}>{user.email}</p>
          
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-secondary" style={{ borderRadius: "var(--radius-full)", padding: "8px 20px" }}>
              <SettingsIcon /> Account Settings
            </button>
            {user.is_lord && <span className="lord-badge" style={{ padding: "8px 20px" }}><TrophyIcon /> LORD OF THE GAME</span>}
            <span className={user.role === "admin" ? "badge badge-gold" : "badge"} style={{ padding: "8px 16px" }}>
              {user.role === "admin" ? <><ShieldIcon /> Administrator</> : <><GamepadIcon /> Pro Player</>}
            </span>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`toast ${msg.startsWith("success:") ? "success" : "error"}`} onClick={() => setMsg("")} style={{ marginBottom: "32px" }}>
          {msg.split(":")[1]}
        </div>
      )}

      {/* 2. MAIN CONTENT GRID */}
      <div className="grid-3" style={{ gap: "32px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: Stats Overview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 className="section-title"><ChartIcon /> Performance</h2>
          
          {stats && (
            <>
              <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="stat-card" style={{ padding: "20px" }}>
                  <div className="stat-value gold" style={{ fontSize: "32px" }}>{stats.total_titles}</div>
                  <div className="stat-label">Titles Won</div>
                </div>
                <div className="stat-card" style={{ padding: "20px" }}>
                  <div className="stat-value green" style={{ fontSize: "32px" }}>{stats.win_rate}%</div>
                  <div className="stat-label">Win Rate</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Season Totals</span></div>
                <div style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "var(--green)", fontSize: "20px", fontWeight: 800 }}>{stats.total_wins}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>WINS</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "20px", fontWeight: 800 }}>{stats.total_draws}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>DRAWS</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "var(--red)", fontSize: "20px", fontWeight: 800 }}>{stats.total_losses}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>LOSSES</div>
                    </div>
                  </div>
                  
                  <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", display: "flex", overflow: "hidden", marginBottom: "24px" }}>
                    <div style={{ width: `${(stats.total_wins / stats.total_played) * 100}%`, background: "var(--green)" }}></div>
                    <div style={{ width: `${(stats.total_draws / stats.total_played) * 100}%`, background: "var(--text-muted)" }}></div>
                    <div style={{ width: `${(stats.total_losses / stats.total_played) * 100}%`, background: "var(--red)" }}></div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="stat-item-mini">
                      <span>Goals For</span>
                      <strong>{stats.goals_for}</strong>
                    </div>
                    <div className="stat-item-mini">
                      <span>Avg/Match</span>
                      <strong>{stats.avg_goals_per_match}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* MIDDLE COLUMN: Certificates & Achievements */}
        <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 className="section-title"><TrophyIcon /> Hall of Fame</h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Lord Certificate Card */}
            {user.is_lord ? (
              <div className="card certificate-card gold" style={{ background: "rgba(212, 175, 55, 0.05)", border: "1px solid var(--gold)" }}>
                <div style={{ padding: "24px" }}>
                  <div style={{ fontSize: "32px", color: "var(--gold)", marginBottom: "16px" }}><TrophyIcon /></div>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>Lord of the Arena</h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>Legendary status for winning 3+ titles.</p>
                  <button onClick={() => certificatesApi.downloadLord()} className="btn btn-gold" style={{ width: "100%" }}>Download Certificate</button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: "24px", textAlign: "center", border: "1px dashed var(--border)", opacity: 0.6 }}>
                <div style={{ fontSize: "32px", color: "var(--text-muted)", marginBottom: "12px" }}><TrophyIcon /></div>
                <p style={{ fontSize: "14px", fontWeight: 700 }}>Lord Status Locked</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Win 3 titles to unlock</p>
              </div>
            )}

            {/* Latest Achievement or Static Info */}
            <div className="card" style={{ padding: "24px" }}>
               <div style={{ fontSize: "32px", color: "var(--accent)", marginBottom: "16px" }}><ShieldIcon /></div>
               <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>Verified Athlete</h3>
               <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>You are a verified member of the eFootball Arena.</p>
               <Link href="/scoreboard" className="btn btn-secondary" style={{ width: "100%" }}>View Global Standings</Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="card-title">Season Reports & Badges</span>
              <span className="badge">{myLeagues.length} Leagues</span>
            </div>
            <div style={{ padding: "0" }}>
              {myLeagues.length === 0 ? (
                <p style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No trophies yet. Join a league!</p>
              ) : (
                <div className="achievement-list">
                  {myLeagues.map(l => {
                    const isChamp = l.champion_id === user.id;
                    return (
                      <div key={l.id} className="achievement-item">
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div className={`achievement-icon ${isChamp ? 'gold' : ''}`}>
                            <TrophyIcon />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800 }}>{l.name}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{isChamp ? "Champion 🏆" : "Participant"}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {isChamp && (
                            <button onClick={() => certificatesApi.downloadTitle(l.id, l.name)} className="btn btn-sm btn-gold">Badge</button>
                          )}
                          <button onClick={() => certificatesApi.downloadReport(l.id, l.name, user.username)} className="btn btn-sm btn-secondary">Report</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. FOOTER ACTIONS */}
      <div style={{ marginTop: "48px", paddingTop: "32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>eFootball Arena Athlete Profile — Established 2024</p>
        <button onClick={logout} className="btn btn-danger btn-sm">Logout Session</button>
      </div>

      {/* Edit Profile Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: "450px", width: "90%" }}>
            <div className="card-header">
              <span className="card-title">Account Settings</span>
              <button onClick={() => setIsModalOpen(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleUpdateProfile} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              </div>
              
              <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "12px", color: "var(--accent)" }}>SECURITY & PASSWORD</p>
                
                <div className="form-group">
                  <label className="form-label">Current password</label>
                  <input className="form-input" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Enter to authorize changes" />
                </div>
                
                <div className="form-group">
                  <label className="form-label">New password</label>
                  <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={updating}>
                  {updating ? "Saving Changes..." : "Update Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Adaptation Modal */}
      {isPhotoModalOpen && photoPreview && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: "400px", width: "90%", textAlign: "center" }}>
            <div className="card-header">
              <span className="card-title">Adjust Avatar</span>
              <button onClick={() => setIsPhotoModalOpen(false)} className="btn-close">×</button>
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ position: "relative", width: "100%", height: "300px", background: "#111", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <Cropper
                  image={photoPreview}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div style={{ marginTop: "20px" }}>
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e: any) => setZoom(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button onClick={() => setIsPhotoModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Discard</button>
                <button onClick={handleAvatarUpload} className="btn btn-primary" style={{ flex: 2 }} disabled={uploading}>Save Avatar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
