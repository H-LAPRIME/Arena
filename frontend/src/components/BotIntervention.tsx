"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BotIcon } from "./Icons";

interface BotInterventionProps {
  message: string;
  duration?: number;
  onClose?: () => void;
}

export function BotIntervention({ message, duration = 8000, onClose }: BotInterventionProps) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div className="bot-intervention-overlay" onClick={() => router.push("/chat")}>
      <div className="bot-intervention-card">
        <div className="bot-avatar">
          <BotIcon />
        </div>
        <div className="bot-content">
          <div className="bot-header">AI Coach (Intervention)</div>
          <div className="bot-message">{message}</div>
          <div className="bot-hint">Click to discuss with the Chatbot</div>
        </div>
        <button className="bot-close" onClick={(e) => { e.stopPropagation(); setVisible(false); if (onClose) onClose(); }}>×</button>
      </div>
      <style jsx>{`
        .bot-intervention-overlay {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 9999;
          cursor: pointer;
          animation: slideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes slideIn {
          from { transform: translateX(120%) scale(0.8); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
        .bot-intervention-card {
          background: var(--bg-card);
          border: 1px solid var(--accent-border);
          border-left: 4px solid var(--accent);
          box-shadow: 0 15px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 16px 20px;
          max-width: 380px;
          display: flex;
          gap: 16px;
          position: relative;
        }
        .bot-avatar {
          width: 48px;
          height: 48px;
          background: var(--gradient-accent);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: var(--accent-glow);
        }
        .bot-header {
          font-size: 11px;
          font-weight: 800;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }
        .bot-message {
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .bot-hint {
          font-size: 10px;
          color: var(--text-muted);
          font-style: italic;
        }
        .bot-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 18px;
        }
        .bot-close:hover { color: var(--red); }
      `}</style>
    </div>
  );
}
