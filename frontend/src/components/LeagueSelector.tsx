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
      setLeagues(data);
      setLoading(false);
      
      // Auto-select logic: if only one league, always make it default
      if (data.length === 1 && !selectedId) {
        onSelect(data[0].id);
      }
    }).catch(() => setLoading(false));
  }, [onSelect, autoSelectIfOnlyOne, selectedId]);

  if (loading) return null;
  if (leagues.length === 0) return <div className="card" style={{ textAlign: "center", padding: "20px" }}>Vous n'êtes membre d'aucune ligue active.</div>;

  // If only one league exists, we auto-select in useEffect and show nothing here
  if (leagues.length === 1) {
    return null;
  }

  // If already selected and only one league, show nothing (auto-selected)
  if (selectedId) {
    const current = leagues.find(l => l.id === selectedId);
    // Only show the active bar + switcher if user has 2+ leagues
    if (leagues.length < 2) return null;
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
        width: "fit-content"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <TrophyIcon />
          <span style={{ fontWeight: 700, color: "var(--accent-light)" }}>{current?.name || "Ligue"}</span>
        </div>
        <select 
          value={selectedId} 
          onChange={(e) => onSelect(e.target.value)}
          className="premium-select"
        >
          {leagues.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
    );
  }

  // If nothing selected yet and user has multiple leagues — show cards
  return (
    <div className="league-selection-grid" style={{ 
      display: "grid", 
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
      gap: "20px", 
      marginBottom: "32px" 
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{league.member_count} membres</span>
          </div>
          <h3 style={{ fontSize: "20px", marginBottom: "8px" }}>{league.name}</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>{league.description}</p>
          <button className="btn btn-primary btn-sm" style={{ width: "100%" }}>Sélectionner cette ligue</button>
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
