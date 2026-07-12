"use client";
import { useState, useEffect } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function EnablePushButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "enabled" | "error">("idle");

  useEffect(() => {
    navigator.serviceWorker?.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (sub) setStatus("enabled");
    });
  }, []);

  const enablePush = async () => {
    setStatus("loading");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        alert("Notifications push non supportees sur ce navigateur.");
        setStatus("error");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("error");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const keyResp = await fetch(`${BACKEND_URL}/api/push/vapid-public-key`);
      const { publicKey } = await keyResp.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const token = localStorage.getItem("efootball_token");
      await fetch(`${BACKEND_URL}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      setStatus("enabled");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (status === "enabled") {
    return <span style={{ fontSize: "13px", fontWeight: 600, color: "#22c55e", display: "inline-flex", alignItems: "center", gap: "6px" }}>Notifications activees</span>;
  }

  return (
    <button
      onClick={enablePush}
      disabled={status === "loading"}
      className="btn btn-sm btn-secondary"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
    >
      {status === "loading" ? "Activation..." : "Activer les notifications"}
    </button>
  );
}
