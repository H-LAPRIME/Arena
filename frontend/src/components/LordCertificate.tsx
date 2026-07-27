"use client";
import { useRef, useState } from "react";

export function LordCertificate({ username, titleCount, achievedAt, leagueName }: { username: string; titleCount: number; achievedAt: string; leagueName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(ref.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `lord-certificate-${leagueName ? leagueName.replace(/\s+/g, "-") : "all"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      alert("Failed to download certificate");
    }
    setDownloading(false);
  }

  return (
    <div>
      <div
        ref={ref}
        style={{
          width: "600px", maxWidth: "100%", aspectRatio: "1.4",
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          border: "3px solid #38bdf8", borderRadius: "16px", padding: "40px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", color: "#fff", fontFamily: "var(--font-display, serif)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>&#x1F48E;</div>
        <div style={{ fontSize: "13px", letterSpacing: "3px", color: "#7dd3fc", marginBottom: "16px" }}>CERTIFICATE OF HONOR</div>
        <div style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>LORD OF THE GAME</div>
        {leagueName && (
          <div style={{ fontSize: "14px", color: "#bae6fd", fontWeight: 600, marginBottom: "4px" }}>{leagueName}</div>
        )}
        <div style={{ width: "60px", height: "2px", background: "#38bdf8", margin: "12px 0" }} />
        <div style={{ fontSize: "22px", fontWeight: 600, color: "#fbbf24" }}>{username}</div>
        <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "12px" }}>
          {titleCount} league title{titleCount > 1 ? "s" : ""} won · Awarded {new Date(achievedAt).toLocaleDateString()}
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={download} disabled={downloading}>
        {downloading ? "Generating..." : "Download certificate"}
      </button>
    </div>
  );
}
