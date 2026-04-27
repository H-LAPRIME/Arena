"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { usersApi, getAvatarUrl } from "@/lib/api";
import { GridIcon, TrophyIcon, SwordIcon, ShieldIcon, ChartIcon, BotIcon, AdminIcon, BellIcon, LogoutIcon, MenuIcon, XIcon } from "@/components/Icons";

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
  const { user, isAdmin, logout } = useAuth();

  const [notifs, setNotifs] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadNotifs();
      const interval = setInterval(loadNotifs, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
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
    } catch { /* Silent fail */ }
  }

  async function markAsRead(id: string) {
    try {
      await usersApi.markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* Silent fail */ }
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const publicPaths = ["/login", "/register"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return null;
  if (!user) return null;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <svg className="navbar-brand-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2563eb"/>
                <stop offset="100%" stopColor="#3b82f6"/>
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14" stroke="url(#logoGrad)" strokeWidth="2" fill="none"/>
            <polygon points="12,10 22,16 12,22" fill="url(#logoGrad)"/>
            <circle cx="16" cy="16" r="3" fill="url(#logoGrad)" opacity="0.6"/>
          </svg>
          <span className="navbar-brand-text">EFOOTBALL ARENA</span>
        </Link>

        <div className="mobile-header-actions mobile-only-flex">
          <div className="notif-wrapper" ref={notifRef} style={{ position: "relative" }}>
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
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-msg">{n.message}</div>
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
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-msg">{n.message}</div>
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
  );
}

