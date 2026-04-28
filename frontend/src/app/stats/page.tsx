"use client";
import { useEffect, useState } from "react";
import { statsApi, usersApi, leaguesApi } from "@/lib/api";
import { ChartIcon, ZapIcon, TrophyIcon, SwordIcon } from "@/components/Icons";
import { BotIntervention } from "@/components/BotIntervention";
import LeagueSelector from "@/components/LeagueSelector";

export default function StatsPage() {
  const [records, setRecords] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [h2h, setH2h] = useState<any>(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [botMessage, setBotMessage] = useState("");

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadLeagueStats(selectedLeagueId || undefined);
  }, [selectedLeagueId]);

  async function loadBaseData() {
    try {
      const p = await usersApi.getAll();
      setPlayers(p);
    } catch (e) {}
    setLoading(false);
  }

  async function loadLeagueStats(lid?: string) {
    setLoadingData(true);
    try {
      const r = await statsApi.records(lid);
      setRecords(r);
    } catch (e) {}
    setLoadingData(false);
  }

  async function loadH2H() {
    if (!p1 || !p2 || p1 === p2) return;
    try {
      const data = await statsApi.headToHead(p1, p2, selectedLeagueId || undefined);
      setH2h(data);
      
      // Bot intervention
      leaguesApi.getH2HAdvice(selectedLeagueId || "global", p2)
        .then(res => setBotMessage(res.comment))
        .catch(() => {});
    } catch (e) {}
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><ChartIcon /> Statistics</h1>
        <p className="page-subtitle">Records, matches and analysis</p>
      </div>

      <LeagueSelector 
        onSelect={setSelectedLeagueId} 
        selectedId={selectedLeagueId || undefined} 
        autoSelectIfOnlyOne={false} // Allow global view by default
      />

      {loadingData ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <>
          {/* Records */}
          {records && (
        <div className="grid-2" style={{ marginBottom: "32px" }}>
          <div className="card">
            <div className="card-bg-watermark"><ZapIcon /></div>
            <div className="card-header"><span className="card-title"><ZapIcon /> Biggest Win</span></div>
            {records.biggest_win ? (
              <div style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 900 }}>
                  {records.biggest_win.score}
                </div>
                <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
                  {records.biggest_win.home} vs {records.biggest_win.away}
                </p>
              </div>
            ) : <p style={{ color: "var(--text-muted)", textAlign: "center" }}>No matches yet</p>}
          </div>
          <div className="card">
            <div className="card-bg-watermark"><ChartIcon /></div>
            <div className="card-header"><span className="card-title"><ZapIcon /> Highest Scoring Match</span></div>
            {records.highest_scoring_match ? (
              <div style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 900 }}>
                  {records.highest_scoring_match.score}
                </div>
                <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
                  {records.highest_scoring_match.total_goals} total goals
                </p>
              </div>
            ) : <p style={{ color: "var(--text-muted)", textAlign: "center" }}>No matches yet</p>}
          </div>
        </div>
      )}

      {/* Player Rankings */}
      {records?.player_stats && (
        <div className="card" style={{ marginBottom: "32px", padding: 0, overflow: "hidden" }}>
          <div className="card-bg-watermark"><TrophyIcon /></div>
          <div className="card-header" style={{ padding: "24px 24px 0 24px" }}><span className="card-title"><TrophyIcon /> Global Ranking (All Seasons)</span></div>
          <div className="table-container">
            <table className="scoreboard">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Wins</th>
                  <th>Goals</th>
                  <th>Titles</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.player_stats.map((p: any, i: number) => (
                  <tr key={i}>
                    <td className={`rank rank-${i + 1}`}>{i + 1}</td>
                    <td><span className="player-name">{p.username}</span></td>
                    <td style={{ color: "var(--green)", fontWeight: 700 }}>{p.total_wins}</td>
                    <td>{p.total_goals}</td>
                    <td><span className="badge badge-gold"><TrophyIcon /> {p.titles}</span></td>
                    <td>{p.is_lord ? <span className="lord-badge" style={{ fontSize: "10px", padding: "4px 12px" }}><TrophyIcon /> LORD</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Head-to-Head */}
      <div className="card">
        <div className="card-bg-watermark"><SwordIcon /></div>
        <div className="card-header"><span className="card-title"><SwordIcon /> Head-to-Head</span></div>
        <div style={{ display: "flex", gap: "12px", alignItems: "end", marginBottom: "20px", flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: "150px" }}>
            <label className="form-label">Player 1</label>
            <select className="form-input" value={p1} onChange={e => setP1(e.target.value)}>
              <option value="">Choose...</option>
              {players.map((p: any) => <option key={p.id} value={p.id}>{p.username}</option>)}
            </select>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-muted)", padding: "12px 0" }}>VS</div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: "150px" }}>
            <label className="form-label">Player 2</label>
            <select className="form-input" value={p2} onChange={e => setP2(e.target.value)}>
              <option value="">Choose...</option>
              {players.map((p: any) => <option key={p.id} value={p.id}>{p.username}</option>)}
            </select>
          </div>
          <button onClick={loadH2H} className="btn btn-primary" disabled={!p1 || !p2 || p1 === p2}>
            Compare
          </button>
        </div>

        {h2h && (
          <div style={{ padding: "20px" }}>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value green">{h2h.user1_wins}</div>
                <div className="stat-label">{h2h.user1.username} wins</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{h2h.draws}</div>
                <div className="stat-label">Draws</div>
              </div>
              <div className="stat-card">
                <div className="stat-value blue">{h2h.user2_wins}</div>
                <div className="stat-label">{h2h.user2.username} wins</div>
              </div>
            </div>
            <div className="stat-grid" style={{ marginTop: "16px" }}>
              <div className="stat-card">
                <div className="stat-value">{h2h.user1_goals}</div>
                <div className="stat-label">{h2h.user1.username} goals</div>
              </div>
              <div className="stat-card">
                <div className="stat-value gold">{h2h.total_matches}</div>
                <div className="stat-label">Matches played</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{h2h.user2_goals}</div>
                <div className="stat-label">{h2h.user2.username} goals</div>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {botMessage && <BotIntervention message={botMessage} onClose={() => setBotMessage("")} />}
    </div>
  );
}
