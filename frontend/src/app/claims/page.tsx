"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { claimsApi, leaguesApi, matchesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ShieldIcon, TrophyIcon, HandshakeIcon, CheckIcon, TrashIcon } from "@/components/Icons";

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

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const leagues = await leaguesApi.getAll();
      const active = leagues.find((l: any) => l.status === "active");
      if (active) {
        const allMatches = await leaguesApi.getMatches(active.id);
        // Only show matches where the current user is a player AND status is pending
        const mine = allMatches.filter((m: any) =>
          (m.home_player_id === user?.id || m.away_player_id === user?.id) && m.status === "pending"
        );
        setMatches(mine);
        
        if (matchIdFromUrl && mine.some((m: any) => m.id === matchIdFromUrl)) {
          setForm(f => ({ ...f, matchId: matchIdFromUrl }));
        }
      }
      const claims = await claimsApi.getMy();
      setMyClaims(claims);
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

  async function handleDelete(claimId: string, status: string) {
    if (status === "approved" && !confirm("This claim has already been approved. Deleting it from your history won't change your points, but it will disappear from this list. Continue?")) {
      return;
    }
    if (status !== "approved" && !confirm("Delete this claim?")) {
      return;
    }
    try {
      await claimsApi.delete(claimId);
      await loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
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
        <div className="card-header">
          <span className="card-title">My Claims</span>
          <span className="badge">{myClaims.length} total</span>
        </div>
        {myClaims.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px", fontSize: "14px" }}>No claims submitted</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myClaims.map((c: any) => (
              <div key={c.id} className="claim-list-item">
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
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
                    <a href={`${API_URL}${c.screenshot_url}`} target="_blank" rel="noopener noreferrer">
                      <img src={`${API_URL}${c.screenshot_url}`} alt="proof" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--border)" }} />
                    </a>
                  )}
                  <button onClick={() => handleDelete(c.id, c.status)} className="btn btn-sm btn-danger" style={{ padding: "6px" }} title="Delete">
                    <TrashIcon />
                  </button>
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
