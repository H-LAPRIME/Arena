"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  role: "user" | "admin";
  total_titles: number;
  lord_count: number;
  is_lord: boolean;
  is_active: boolean;
  whatsapp_phone?: string | null;
  created_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAdmin: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});

const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedToken = localStorage.getItem("efootball_token");
    const savedUser = localStorage.getItem("efootball_user");
    const loginTime = localStorage.getItem("efootball_login_time");

    if (savedToken && savedUser && loginTime) {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - parseInt(loginTime) > twentyFourHours) {
        // Session expired
        logout();
      } else {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } catch {
          logout();
        }
      }
    } else if (savedToken || savedUser || loginTime) {
      // Inconsistent state, logout to be safe
      logout();
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [user, isLoading, pathname, router]);

  const login = (newToken: string, newUser: AuthUser) => {
    const now = Date.now().toString();
    localStorage.setItem("efootball_token", newToken);
    localStorage.setItem("efootball_user", JSON.stringify(newUser));
    localStorage.setItem("efootball_login_time", now);
    setToken(newToken);
    setUser(newUser);
    router.replace("/");
  };

  const logout = () => {
    localStorage.removeItem("efootball_token");
    localStorage.removeItem("efootball_user");
    localStorage.removeItem("efootball_login_time");
    setToken(null);
    setUser(null);
    router.replace("/login");
  };

  const updateUser = (newUser: AuthUser) => {
    localStorage.setItem("efootball_user", JSON.stringify(newUser));
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAdmin: user?.role === "admin", isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
