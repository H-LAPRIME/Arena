"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { statsApi, usersApi, leaguesApi } from "@/lib/api";
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
    <div className="page-container">
      {/* Profile Header */}
      <div className="card" style={{ padding: "40px", textAlign: "center", marginBottom: "32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100px", background: user.is_lord ? "var(--gradient-gold)" : "var(--gradient-blue)", opacity: 0.1, zIndex: 0 }}></div>
        
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="player-avatar" style={{ 
            width: "120px", 
            height: "120px", 
            fontSize: "48px", 
            margin: "0 auto 20px",
            background: user.is_lord ? "var(--gradient-gold)" : "var(--gradient-blue)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            border: "4px solid var(--card-bg)",
            position: "relative",
            cursor: "pointer",
            overflow: "hidden"
          }} onClick={() => document.getElementById("avatar-input")?.click()}>
            {user.avatar_url ? (
              <img src={`${API_URL}${user.avatar_url}`} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              user.username[0].toUpperCase()
            )}
            <div style={{ 
              position: "absolute", bottom: 0, left: 0, width: "100%", 
              background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", 
              padding: "4px 0", fontWeight: 700, opacity: uploading ? 1 : 0.8 
            }}>
              {uploading ? "..." : "EDIT"}
            </div>
            <input id="avatar-input" type="file" accept="image/*" hidden onChange={handleFileSelect} />
          </div>
          <h1 className="page-title" style={{ marginBottom: "8px" }}>{user.username}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px" }}>{user.email}</p>
          
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-sm btn-secondary" style={{ borderRadius: "var(--radius-full)" }}>
              <SettingsIcon /> Edit Profile
            </button>
            {user.is_lord && <span className="lord-badge"><TrophyIcon /> LORD OF THE GAME</span>}
            <span className={user.role === "admin" ? "badge badge-gold" : "badge"}>
              {user.role === "admin" ? <><ShieldIcon /> Administrator</> : <><GamepadIcon /> Competitor</>}
            </span>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`toast ${msg.startsWith("success:") ? "success" : "error"}`} onClick={() => setMsg("")} style={{ cursor: "pointer", marginBottom: "24px", position: "relative", bottom: 0, right: 0, width: "100%" }}>
          {msg.split(":")[1]}
        </div>
      )}

      <div className="grid-2">
        {/* Statistics Column */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <ChartIcon /> My Statistics
          </h2>
          
          {stats && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-value gold">{stats.total_titles}</div>
                  <div className="stat-label">Titles</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value green">{stats.win_rate}%</div>
                  <div className="stat-label">Win Rate</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Match Summary</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--green)" }}>{stats.total_wins}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Wins</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-muted)" }}>{stats.total_draws}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Draws</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--red)" }}>{stats.total_losses}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Losses</div>
                  </div>
                </div>
                <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                   <div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Goals scored</div>
                      <div style={{ fontSize: "20px", fontWeight: 700 }}>{stats.goals_for}</div>
                   </div>
                   <div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Average / match</div>
                      <div style={{ fontSize: "20px", fontWeight: 700 }}>{stats.avg_goals_per_match}</div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Settings & Leagues Column */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <GamepadIcon /> My Leagues
          </h2>
          
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="notif-list">
              {myLeagues.length === 0 ? (
                <p style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No leagues joined</p>
              ) : (
                myLeagues.map(l => (
                  <div key={l.id} style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{l.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Status: {l.status}</div>
                    </div>
                    <Link href={`/scoreboard`} className="btn btn-sm btn-secondary">View</Link>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ border: "1px solid var(--red-glow)", background: "rgba(239, 68, 68, 0.05)" }}>
            <div className="card-header"><span className="card-title" style={{ color: "var(--red)" }}>Actions</span></div>
            <div style={{ padding: "16px" }}>
              <button onClick={logout} className="btn btn-danger" style={{ width: "100%" }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: "450px", width: "90%" }}>
            <div className="card-header">
              <span className="card-title">Edit my profile</span>
              <button onClick={() => setIsModalOpen(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleUpdateProfile} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              </div>
              
              <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "12px", color: "var(--accent)" }}>CHANGE PASSWORD</p>
                
                <div className="form-group">
                  <label className="form-label">Old password</label>
                  <input className="form-input" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Required to change" />
                </div>
                
                <div className="form-group">
                  <label className="form-label">New password</label>
                  <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={updating}>
                  {updating ? "Updating..." : "Save"}
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
              <span className="card-title">Crop your photo</span>
              <button onClick={() => setIsPhotoModalOpen(false)} className="btn-close">×</button>
            </div>
            <div style={{ padding: "24px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
                Drag to move and use the slider to zoom.
              </p>
              
              <div style={{ position: "relative", width: "100%", height: "300px", background: "#333", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
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

              <div style={{ marginTop: "20px", padding: "0 10px" }}>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e: any) => setZoom(e.target.value)}
                  style={{ width: "100%", cursor: "pointer", accentColor: "var(--accent)" }}
                />
              </div>
              
              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button onClick={() => setIsPhotoModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleAvatarUpload} className="btn btn-primary" style={{ flex: 2 }} disabled={uploading}>
                  {uploading ? "Uploading..." : "Apply and Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

