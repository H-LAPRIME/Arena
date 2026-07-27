"use client";
import { useState } from "react";

function DiamondIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12l4 6-10 12L2 9z" fill="url(#lordGrad)" stroke="#7dd3fc" strokeWidth="0.5" />
      <defs>
        <linearGradient id="lordGrad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LordBadge({ lordCount }: { lordCount: number }) {
  const [hover, setHover] = useState(false);
  if (!lordCount || lordCount < 1) return null;

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: "4px", cursor: "default" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <DiamondIcon />
      {hover && (
        <span
          style={{
            position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)",
            background: "var(--surface-2, #111)", color: "#fff", fontSize: "11px",
            padding: "4px 8px", borderRadius: "6px", whiteSpace: "nowrap", zIndex: 20,
            border: "1px solid rgba(56,189,248,0.4)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          Lord of the game x{lordCount}
        </span>
      )}
    </span>
  );
}
