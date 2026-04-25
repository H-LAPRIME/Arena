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
  is_lord: boolean;
  is_active: boolean;
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
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("efootball_token");
        localStorage.removeItem("efootball_user");
      }
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
    localStorage.setItem("efootball_token", newToken);
    localStorage.setItem("efootball_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    router.replace("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("efootball_token");
    localStorage.removeItem("efootball_user");
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
