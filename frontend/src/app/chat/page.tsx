"use client";
import { useEffect, useState, useRef } from "react";
import { chatApi, usersApi } from "@/lib/api";
import { BotIcon, ShieldIcon, GamepadIcon, TrashIcon } from "@/components/Icons";

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
    usersApi.getAll().then(setPlayers).catch(() => {});
  }, []);

  useEffect(() => {
    if (messagesEnd.current) {
      messagesEnd.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, loading]);

  async function loadHistory() {
    try {
      const history = await chatApi.history(50);
      setMessages(history);
    } catch (e) {}
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg, id: `temp-${Date.now()}` }]);
    setLoading(true);

    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      const userId = stored ? JSON.parse(stored).id : undefined;
      const res = await chatApi.send(userMsg, userId);
      setMessages(prev => [...prev, { role: "assistant", content: res.reply, id: `ai-${Date.now()}` }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}`, id: `err-${Date.now()}` }]);
    }
    setLoading(false);
  }

  async function clearHistory() {
    if (!confirm("Are you sure you want to clear the entire history?")) return;
    try {
      await chatApi.clearHistory();
      setMessages([]);
    } catch (e) {}
  }

  const suggestions = [
    "Who is leading?",
    "Analyze each player's form",
    "Make a prediction for the next match",
    "Season recap",
    "Who will become Lord of the Game?",
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="page-title"><BotIcon /> AI Commentator</h1>
            <p className="page-subtitle">Chat with the eFootball Arena expert powered by AI</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setMessages([])} className="btn btn-sm btn-secondary">New Chat</button>
            <button onClick={clearHistory} className="btn btn-sm btn-danger"><TrashIcon /> Clear History</button>
          </div>
        </div>
      </div>

      <div className="chat-container">
        <div className="card-bg-watermark chat-watermark" style={{ opacity: 0.08 }}><BotIcon /></div>
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", display: "flex", justifyContent: "center", gap: "10px" }}>
                <BotIcon /> <GamepadIcon />
              </div>
              <p style={{ fontWeight: 600, marginBottom: "12px" }}>The commentator is ready!</p>
              <p style={{ fontSize: "13px" }}>Ask me anything about the challenge</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "20px" }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setInput(s)} className="btn btn-sm btn-secondary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m: any) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble assistant" style={{ display: "flex", gap: "4px" }}>
              <span style={{ animation: "pulse 1s infinite" }}>●</span>
              <span style={{ animation: "pulse 1s infinite 0.2s" }}>●</span>
              <span style={{ animation: "pulse 1s infinite 0.4s" }}>●</span>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        <form onSubmit={sendMessage} className="chat-input-area">
          <input className="chat-input" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask the commentator something..." disabled={loading} />
          <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
