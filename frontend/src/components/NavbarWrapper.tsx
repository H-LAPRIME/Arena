"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { usersApi, leaguesApi, certificatesApi, getAvatarUrl } from "@/lib/api";
import { GridIcon, TrophyIcon, SwordIcon, ShieldIcon, ChartIcon, BotIcon, AdminIcon, BellIcon, LogoutIcon, MenuIcon, XIcon, TrashIcon } from "@/components/Icons";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: <GridIcon /> },
  { href: "/scoreboard", label: "Standings", icon: <TrophyIcon /> },
  { href: "/matches", label: "Matches", icon: <SwordIcon /> },
  { href: "/claims", label: "Results", icon: <ShieldIcon /> },
  { href: "/stats", label: "Stats", icon: <ChartIcon /> },
  { href: "/chat", label: "AI Chat", icon: <BotIcon /> },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function NavbarWrapper() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();

  const [notifs, setNotifs] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [awardNotif, setAwardNotif] = useState<any | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileNotifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadNotifs();
      const interval = setInterval(loadNotifs, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inDesktop = notifRef.current && notifRef.current.contains(target);
      const inMobile = mobileNotifRef.current && mobileNotifRef.current.contains(target);
      if (!inDesktop && !inMobile) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadNotifs() {
    try {
      const data = await usersApi.getNotifications();
      setNotifs(data);
      const freshAward = data.find((n: any) => !n.is_read && ["champion", "lord"].includes(n.notif_type) && !hasSeenAward(n.id));
      if (freshAward) {
        markAwardSeen(freshAward.id);
        setAwardNotif(freshAward);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 5200);
      }
    } catch { /* Silent fail */ }
  }

  async function markAsRead(id: string) {
    try {
      await usersApi.markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* Silent fail */ }
  }

  async function deleteNotif(notifId: string) {
    // Optimistic removal — remove from state first, then call API
    const previousNotifs = [...notifs];
    setNotifs(prev => prev.filter(n => n.id !== notifId));
    try {
      await usersApi.deleteNotification(notifId);
    } catch {
      // Restore on failure
      setNotifs(previousNotifs);
    }
  }

  function parseNotifData(n: any) {
    if (!n?.notif_data) return {};
    try {
      return JSON.parse(n.notif_data);
    } catch {
      return {};
    }
  }

  function hasSeenAward(id: string) {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(`award_notif_seen_${id}`) === "1";
  }

  function markAwardSeen(id: string) {
    if (typeof window !== "undefined") localStorage.setItem(`award_notif_seen_${id}`, "1");
  }

  function notificationTarget(n: any) {
    const data = parseNotifData(n);
    if (n.notif_type === "points_awarded") return `/scoreboard${data.league_id ? `?league=${data.league_id}` : ""}`;
    if (n.notif_type === "claim_rejected") return "/claims";
    if (n.notif_type === "champion" || n.notif_type === "lord") return "/profile";
    if (n.notif_type === "league_completed") return `/scoreboard${data.league_id ? `?league=${data.league_id}` : ""}`;
    if (n.notif_type === "new_season") return `/matches${data.league_id ? `?league=${data.league_id}` : ""}`;
    if (n.notif_type === "invitation") return "/dashboard";
    return "/dashboard";
  }

  async function handleNotificationClick(n: any) {
    await markAsRead(n.id);
    setIsNotifOpen(false);
    if (n.notif_type === "champion" || n.notif_type === "lord") {
      markAwardSeen(n.id);
      setAwardNotif(n);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5200);
      return;
    }
    router.push(notificationTarget(n));
  }

  async function handleAcceptInvitation(n: any) {
    try {
      await leaguesApi.acceptInvitation(n.id);
      setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
      router.push("/dashboard");
      setIsNotifOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRejectInvitation(n: any) {
    try {
      await leaguesApi.rejectInvitation(n.id);
      setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
    } catch (err: any) {
      alert(err.message);
    }
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const publicPaths = ["/login", "/register"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return null;
  if (!user) return null;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);
  const awardData: any = awardNotif ? parseNotifData(awardNotif) : {};

  return (
    <>
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <img src="https://lengolmmiwmrmlmzswek.supabase.co/storage/v1/object/public/avatars/logo_complet.png" alt="EFootball Arena Logo" className="navbar-brand-img" style={{ height: '52px', objectFit: 'contain' }} />
        </Link>

        <div className="mobile-header-actions mobile-only-flex">
          <div className="notif-wrapper" ref={mobileNotifRef} style={{ position: "relative" }}>
            <button
              className={`notif-bell ${unreadCount > 0 ? "has-unread" : ""}`}
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              title="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
            {isNotifOpen && (
              <div className="notif-dropdown card mobile-dropdown">
                <div className="notif-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && <span className="unread-count">{unreadCount} new</span>}
                </div>
                <div className="notif-list">
                  {notifs.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifs.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.is_read ? "read" : "unread"}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div className="notif-item-title">{n.title}</div>
                          <button
                            className="notif-delete-btn"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteNotif(n.id); }}
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="notif-item-msg">{n.message}</div>
                        {n.notif_type === "invitation" && !n.is_read && (
                          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                            <button 
                              className="btn btn-green" 
                              style={{ padding: "4px 12px", fontSize: "11px" }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                handleAcceptInvitation(n);
                              }}
                            >
                              Accepter
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: "4px 12px", fontSize: "11px" }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                handleRejectInvitation(n);
                              }}
                            >
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="mobile-menu-btn" onClick={toggleMenu}>
            {isMenuOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>

        <ul className={`navbar-links ${isMenuOpen ? "mobile-open" : ""}`}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={pathname.startsWith(link.href) ? "active" : ""} onClick={closeMenu}>
                {link.icon}
                {link.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link href="/admin" className={pathname.startsWith("/admin") ? "active" : ""} onClick={closeMenu}>
                <AdminIcon />
                Admin
              </Link>
            </li>
          )}

          <li className="mobile-only-link separator" style={{ width: "100%", height: "1px", background: "var(--border)", margin: "10px 0" }}></li>

          <li className="mobile-only-link">
            <Link href="/profile" className={pathname === "/profile" ? "active" : ""} onClick={closeMenu}>
              {user.avatar_url ? (
                <img
                  src={getAvatarUrl(user.avatar_url) || ""}
                  alt="Avatar"
                  style={{ width: "18px", height: "18px", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <span className={isAdmin ? "admin-dot" : "user-dot"} style={{ width: "8px", height: "8px" }} />
              )}
              Profile
            </Link>
          </li>


          <li className="mobile-only-link">
            <button className="nav-item-btn" onClick={() => { logout(); closeMenu(); }}>
              <LogoutIcon />
              Logout
            </button>
          </li>
        </ul>

        <div className="navbar-right desktop-only">
          {/* Notifications */}
          <div className="notif-wrapper" ref={notifRef} style={{ position: "relative" }}>
            <button
              className={`notif-bell ${unreadCount > 0 ? "has-unread" : ""}`}
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              title="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            {/* Notification dropdown for Desktop */}
            {isNotifOpen && (
              <div className="notif-dropdown card">
                <div className="notif-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && <span className="unread-count">{unreadCount} new</span>}
                </div>
                <div className="notif-list">
                  {notifs.length === 0 ? (
                    <div className="notif-empty">No notifications</div>
                  ) : (
                    notifs.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.is_read ? "read" : "unread"}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div className="notif-item-title">{n.title}</div>
                          <button
                            className="notif-delete-btn"
                            onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="notif-item-msg">{n.message}</div>
                        {n.notif_type === "invitation" && !n.is_read && (
                          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                            <button 
                              className="btn btn-green" 
                              style={{ padding: "4px 12px", fontSize: "11px" }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                handleAcceptInvitation(n);
                              }}
                            >
                              Accepter
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: "4px 12px", fontSize: "11px" }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                handleRejectInvitation(n);
                              }}
                            >
                              Refuser
                            </button>
                          </div>
                        )}
                        <div className="notif-item-time">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Link href="/profile" className="user-badge" title="My Profile" style={{ gap: "8px" }}>
            {user.avatar_url ? (
              <img
                src={getAvatarUrl(user.avatar_url) || ""}
                alt="Avatar"
                style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span className={isAdmin ? "admin-dot" : "user-dot"} />
            )}
            <span style={{ fontWeight: 600 }}>{user.username}</span>
            {isAdmin && <span style={{ fontSize: "10px", color: "var(--accent)", fontFamily: "var(--font-display)" }}>ADMIN</span>}
          </Link>

          <button onClick={logout} className="notif-bell" style={{ marginLeft: "8px" }} title="Logout">
            <LogoutIcon />
          </button>
        </div>
      </div>
    </nav>

    {showCelebration && (
      <div className="award-confetti" aria-hidden="true">
        {Array.from({ length: 42 }).map((_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * 0.12}s` }} />
        ))}
      </div>
    )}

    {awardNotif && (
      <div className="modal-overlay" onClick={() => setAwardNotif(null)}>
        <div className="modal-content card award-modal" onClick={e => e.stopPropagation()}>
          <button onClick={() => setAwardNotif(null)} className="btn-close" style={{ position: "absolute", top: "14px", right: "14px" }}>
            <XIcon />
          </button>
          <div className="award-modal-medal">
            <TrophyIcon />
          </div>
          <h2>{awardNotif.notif_type === "lord" ? "Lord of the Game" : "League Champion"}</h2>
          <p>{awardNotif.message}</p>
          <div style={{ display: "grid", gap: "10px", marginTop: "20px" }}>
            {awardNotif.notif_type === "champion" && awardData.league_id && (
              <button
                className="btn btn-gold"
                onClick={() => certificatesApi.downloadTitle(awardData.league_id, awardData.league_name || "League")}
              >
                <TrophyIcon /> Download Champion Certificate
              </button>
            )}
            {awardNotif.notif_type === "lord" && (
              <button className="btn btn-gold" onClick={() => certificatesApi.downloadLord()}>
                <TrophyIcon /> Download Lord Certificate
              </button>
            )}
            {awardData.league_id && (
              <button
                className="btn btn-secondary"
                onClick={() => certificatesApi.downloadReport(awardData.league_id, awardData.league_name || "League", user.username)}
              >
                <ChartIcon /> Download Season Report
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={async () => {
                await markAsRead(awardNotif.id);
                setAwardNotif(null);
                router.push(awardNotif.notif_type === "lord" ? "/profile" : `/scoreboard${awardData.league_id ? `?league=${awardData.league_id}` : ""}`);
              }}
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

