"use client";
import { useEffect, useState } from "react";
import { leaguesApi } from "@/lib/api";
import { TrophyIcon, CalendarIcon } from "./Icons";

interface LeagueSelectorProps {
  onSelect: (leagueId: string) => void;
  selectedId?: string;
  autoSelectIfOnlyOne?: boolean;
}

export default function LeagueSelector({ onSelect, selectedId, autoSelectIfOnlyOne = true }: LeagueSelectorProps) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaguesApi.getMy().then(data => {
      const sorted = [...data].sort((a: any, b: any) => {
        const order: Record<string, number> = { active: 0, pending: 1, completed: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.name.localeCompare(b.name);
      });
      setLeagues(sorted);
      setLoading(false);

      if (autoSelectIfOnlyOne && !selectedId) {
        const defaultLeague = sorted.find((league: any) => league.status === "active") || sorted.find((league: any) => league.status === "pending");
        if (defaultLeague) {
          onSelect(defaultLeague.id);
        } else if (sorted.length === 1) {
          onSelect(sorted[0].id);
        }
      }
    }).catch(() => setLoading(false));
  }, [onSelect, autoSelectIfOnlyOne, selectedId]);

  if (loading) return null;
  if (leagues.length === 0) {
    return <div className="card" style={{ textAlign: "center", padding: "20px" }}>Vous n&apos;etes membre d&apos;aucune ligue.</div>;
  }

  const activeLeagues = leagues.filter(l => l.status !== "completed");
  const completedLeagues = leagues.filter(l => l.status === "completed");
  const statusLabel = (status: string) => status === "completed" ? "Terminated" : status === "active" ? "Ongoing" : "Pending";

  if (autoSelectIfOnlyOne && leagues.length === 1) return null;
  if (autoSelectIfOnlyOne && !selectedId && activeLeagues.length > 0) return null;

  if (selectedId) {
    const current = leagues.find(l => l.id === selectedId);
    return (
      <div className="league-selector-active" style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "24px",
        padding: "12px 20px",
        background: "var(--bg-card)",
        borderRadius: "16px",
        border: "1px solid var(--border)",
        width: "fit-content",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {current?.status === "completed" ? <CalendarIcon /> : <TrophyIcon />}
          <span style={{ fontWeight: 700, color: "var(--accent-light)" }}>{current?.name || "Ligue"}</span>
          {current && <span className={current.status === "completed" ? "badge badge-gold" : current.status === "active" ? "badge badge-green" : "badge"}>{statusLabel(current.status)}</span>}
        </div>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="premium-select"
        >
          {activeLeagues.length > 0 && (
            <optgroup label="Current seasons">
              {activeLeagues.map(l => (
                <option key={l.id} value={l.id}>{l.name} - {statusLabel(l.status)}</option>
              ))}
            </optgroup>
          )}
          {completedLeagues.length > 0 && (
            <optgroup label="Season history">
              {completedLeagues.map(l => (
                <option key={l.id} value={l.id}>{l.name} - Terminated</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "32px" }}>
      {activeLeagues.length > 0 && (
        <>
          <h2 className="section-title" style={{ fontSize: "16px", marginBottom: "14px" }}><TrophyIcon /> Current Seasons</h2>
          <LeagueGrid leagues={activeLeagues} onSelect={onSelect} statusLabel={statusLabel} />
        </>
      )}
      {completedLeagues.length > 0 && (
        <>
          <h2 className="section-title" style={{ fontSize: "16px", margin: activeLeagues.length > 0 ? "24px 0 14px" : "0 0 14px" }}><CalendarIcon /> Season History</h2>
          <LeagueGrid leagues={completedLeagues} onSelect={onSelect} statusLabel={statusLabel} />
        </>
      )}
    </div>
  );
}

function LeagueGrid({ leagues, onSelect, statusLabel }: { leagues: any[]; onSelect: (leagueId: string) => void; statusLabel: (status: string) => string }) {
  return (
    <div className="league-selection-grid" style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: "20px",
    }}>
      {leagues.map(league => (
        <div
          key={league.id}
          className="card league-card-select"
          onClick={() => onSelect(league.id)}
          style={{
            cursor: "pointer",
            transition: "transform 0.2s, border-color 0.2s",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{league.member_count} membres</span>
            <span className={league.status === "completed" ? "badge badge-gold" : league.status === "active" ? "badge badge-green" : "badge"}>
              {statusLabel(league.status)}
            </span>
          </div>
          <h3 style={{ fontSize: "20px", marginBottom: "8px" }}>{league.name}</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>{league.description}</p>
          <button className="btn btn-primary btn-sm" style={{ width: "100%" }}>Consulter cette saison</button>
        </div>
      ))}
      <style jsx>{`
        .league-card-select:hover {
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: var(--shadow-accent);
        }
      `}</style>
    </div>
  );
}
