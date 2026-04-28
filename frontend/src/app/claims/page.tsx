"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { claimsApi, leaguesApi, matchesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ShieldIcon, TrophyIcon, HandshakeIcon, CheckIcon, TrashIcon } from "@/components/Icons";
import LeagueSelector from "@/components/LeagueSelector";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ClaimsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const matchIdFromUrl = searchParams.get("matchId");
  const [matches, setMatches] = useState<any[]>([]);
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [form, setForm] = useState({ matchId: "", homeScore: 0, awayScore: 0 });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);
  const touchTimer = useRef<NodeJS.Timeout | null>(null);

  // Select Mode State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      loadMatches(selectedLeagueId);
    } else {
      setMatches([]);
    }
  }, [selectedLeagueId, user?.id, matchIdFromUrl]);

  async function loadMatches(leagueId: string) {
    try {
      const allMatches = await leaguesApi.getMatches(leagueId);
      const mine = allMatches.filter((m: any) =>
        (m.home_player_id === user?.id || m.away_player_id === user?.id) && m.status === "pending"
      );
      setMatches(mine);
      
      if (matchIdFromUrl && mine.some((m: any) => m.id === matchIdFromUrl)) {
        setForm(f => ({ ...f, matchId: matchIdFromUrl }));
      }
    } catch {}
  }

  async function loadData() {
    try {
      const claims = await claimsApi.getMy();
      setMyClaims(claims);
      if (selectedLeagueId) {
        loadMatches(selectedLeagueId);
      }
    } catch { /* API not ready */ }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setScreenshot(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
    else setPreviewUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.matchId) { setMsg("error:Select a match"); return; }
    if (!screenshot) { setMsg("error:A screenshot (proof) is mandatory to submit a result."); return; }
    setLoading(true);
    setMsg("");
    try {
      await claimsApi.submit(form.matchId, form.homeScore, form.awayScore, screenshot || undefined);
      setMsg("success:Claim submitted! Awaiting admin validation.");
      setForm({ matchId: "", homeScore: 0, awayScore: 0 });
      setScreenshot(null);
      setPreviewUrl("");
      if (fileRef.current) fileRef.current.value = "";
      await loadData();
    } catch (err: any) {
      setMsg("error:" + err.message);
    }
    setLoading(false);
  }

  async function handleDeleteSelected() {
    if (selectedClaims.length === 0) return;
    if (!confirm(`Delete ${selectedClaims.length} selected claim(s)?`)) return;
    
    let errCount = 0;
    for (const id of selectedClaims) {
      try {
        await claimsApi.delete(id);
      } catch {
        errCount++;
      }
    }
    setIsSelectMode(false);
    setSelectedClaims([]);
    await loadData();
    if (errCount > 0) alert(`Completed with ${errCount} errors.`);
    else setMsg(`success:Deleted ${selectedClaims.length} claim(s).`);
  }

  function handleTouchStart(id: string) {
    if (isSelectMode) return;
    touchTimer.current = setTimeout(() => {
      setIsSelectMode(true);
      setSelectedClaims([id]);
      if (typeof window !== "undefined" && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 600); // 600ms hold
  }

  function handleTouchEnd() {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  }

  function toggleSelection(id: string) {
    if (selectedClaims.includes(id)) {
      setSelectedClaims(selectedClaims.filter(x => x !== id));
    } else {
      setSelectedClaims([...selectedClaims, id]);
    }
  }

  async function handleImageUpdate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (selectedClaims.length !== 1) {
      alert("Please select exactly ONE claim to update its image.");
      return;
    }
    const claimId = selectedClaims[0];
    try {
      setMsg("");
      await claimsApi.updateImage(claimId, file);
      setMsg("success:Image updated successfully!");
      setIsSelectMode(false);
      setSelectedClaims([]);
      await loadData();
    } catch (err: any) {
      setMsg("error:" + err.message);
    }
    // reset input
    if (updateFileRef.current) updateFileRef.current.value = "";
  }

  const msgType = msg.startsWith("success:") ? "success" : msg.startsWith("error:") ? "error" : "";
  const msgText = msg.replace(/^(success:|error:)/, "");

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <ShieldIcon /> Submit Result
        </h1>
        <p className="page-subtitle">Submit proof to claim your points after a win or draw</p>
      </div>

      {msg && <div className={`toast ${msgType}`} style={{ position: "relative", bottom: "auto", right: "auto", marginBottom: "20px" }}>{msgText}</div>}

      <div className="grid-2" style={{ marginBottom: "32px" }}>
        {/* Claim Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">New Claim</span>
          </div>

          <LeagueSelector 
            onSelect={setSelectedLeagueId} 
            selectedId={selectedLeagueId || undefined} 
          />

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Match</label>
              <select id="claim-match" className="form-select" value={form.matchId}
                onChange={e => setForm({ ...form, matchId: e.target.value })}>
                <option value="">-- Choose a match --</option>
                {matches.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    J{m.match_day}: {m.home_player_name} vs {m.away_player_name} {m.status === "played" ? <CheckIcon /> : ""}
                  </option>
                ))}
              </select>
            </div>


            <div className="form-group">
              <label className="form-label">Final Score</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <input type="number" min="0" value={form.homeScore} onChange={e => setForm({...form, homeScore: parseInt(e.target.value) || 0})}
                    className="form-input" style={{ textAlign: "center", fontSize: "20px", fontWeight: 800 }} />
                  <div style={{ fontSize: "10px", textAlign: "center", marginTop: "4px", color: "var(--text-muted)" }}>Home</div>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800 }}>-</div>
                <div style={{ flex: 1 }}>
                  <input type="number" min="0" value={form.awayScore} onChange={e => setForm({...form, awayScore: parseInt(e.target.value) || 0})}
                    className="form-input" style={{ textAlign: "center", fontSize: "20px", fontWeight: 800 }} />
                  <div style={{ fontSize: "10px", textAlign: "center", marginTop: "4px", color: "var(--text-muted)" }}>Away</div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Screenshot (proof)</label>
              <input id="claim-screenshot" ref={fileRef} type="file" accept="image/*"
                onChange={handleFileChange}
                style={{ display: "block", width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px" }} />
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="screenshot-preview" style={{ marginTop: "12px" }} />
              )}
            </div>

            <button id="claim-submit" type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Sending..." : "Submit Claim"}
            </button>
          </form>
        </div>

        {/* Rules */}
        <div className="card">
          <div className="card-header"><span className="card-title">System Rules</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { icon: <TrophyIcon />, color: "var(--gold)", title: "Automatic Calculation", desc: "Enter the final score. The system automatically calculates your points (3 for a win, 1 for a draw)." },
              { icon: <HandshakeIcon />, color: "var(--cyan)", title: "Proof Mandatory", desc: "A screenshot of the final result is required for each submission to enable validation." },
              { icon: <ShieldIcon />, color: "var(--accent-light)", title: "Admin Validation", desc: "The admin verifies your screenshot against the entered score and approves or rejects the claim." },
            ].map((rule, i) => (
              <div key={i} style={{ display: "flex", gap: "14px", padding: "14px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <div style={{ color: rule.color, flexShrink: 0, marginTop: "2px" }}>{rule.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: rule.color, marginBottom: "4px" }}>{rule.title}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>{rule.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Claims History */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {isSelectMode ? (
              <span className="card-title" style={{ color: "var(--accent)" }}>{selectedClaims.length} Selected</span>
            ) : (
              <>
                <span className="card-title">My Claims</span>
                <span className="badge" style={{ marginLeft: "8px" }}>{myClaims.length} total</span>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isSelectMode && selectedClaims.length > 0 && (
              <>
                <button 
                  className="btn btn-sm" 
                  style={{ padding: "6px 10px", color: "var(--text-primary)", background: "var(--bg)", border: "1px solid var(--border)", opacity: selectedClaims.length !== 1 ? 0.5 : 1 }} 
                  title={selectedClaims.length === 1 ? "Change Image" : "Select exactly 1 claim to change its image"} 
                  onClick={() => {
                    if (selectedClaims.length === 1) {
                      updateFileRef.current?.click();
                    } else {
                      alert("Veuillez sélectionner exactement UNE requête pour modifier son image.");
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <input 
                  type="file" 
                  ref={updateFileRef} 
                  style={{ display: "none" }} 
                  accept="image/*" 
                  onChange={handleImageUpdate} 
                />
                <button 
                  className="btn btn-sm btn-danger" 
                  style={{ padding: "6px 10px" }} 
                  title="Delete Selected" 
                  onClick={handleDeleteSelected}
                >
                  <TrashIcon />
                </button>
              </>
            )}
            {myClaims.length > 0 && (
              <button 
                className={isSelectMode ? "btn btn-sm" : "btn btn-sm btn-secondary"}
                onClick={() => { setIsSelectMode(!isSelectMode); setSelectedClaims([]); }}
              >
                {isSelectMode ? "Cancel" : "Modify"}
              </button>
            )}
          </div>
        </div>
        {myClaims.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px", fontSize: "14px" }}>No claims submitted</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myClaims.map((c: any) => (
              <div 
                key={c.id} 
                className="claim-list-item"
                style={{ 
                  display: "flex", 
                  gap: "12px", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  padding: "12px", 
                  border: "1px solid var(--border)", 
                  borderRadius: "8px",
                  cursor: isSelectMode ? "pointer" : "default",
                  background: selectedClaims.includes(c.id) ? "var(--accent-pale)" : "transparent",
                  transition: "background 0.2s"
                }}
                onClick={() => { if (isSelectMode) toggleSelection(c.id); }}
                onTouchStart={() => handleTouchStart(c.id)}
                onTouchEnd={handleTouchEnd}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  {isSelectMode && (
                    <input 
                      type="checkbox" 
                      checked={selectedClaims.includes(c.id)} 
                      readOnly
                      style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
                    />
                  )}
                  <span className={c.status === "pending" ? "claim-pending" : c.status === "approved" ? "claim-approved" : "claim-rejected"}>
                    {c.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 }}>
                    {c.home_score} - {c.away_score}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {c.points_awarded} pts
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {c.screenshot_url && (
                    <a href={`${API_URL}${c.screenshot_url}`} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isSelectMode) e.preventDefault(); }}>
                      <img src={`${API_URL}${c.screenshot_url}`} alt="proof" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--border)" }} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={<div className="loading-spinner"><div className="spinner"></div></div>}>
      <ClaimsContent />
    </Suspense>
  );
}
