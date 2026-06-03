import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { authApi, clearToken, getToken, setToken, setOn401, type AuthUser } from "@/lib/api";

interface JwtPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  exp: number;
}

interface AuthContextValue {
  user: JwtPayload | null;
  profile: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readInitialUser(): JwtPayload | null {
  if (typeof window === "undefined") return null;
  const t = getToken();
  if (!t) return null;
  try {
    const decoded = jwtDecode<JwtPayload>(t);
    if (decoded.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return decoded;
  } catch {
    clearToken();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(() => readInitialUser());
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const logout = useCallback(() => {
    authApi.logout();
    clearToken();
    setUser(null);
    setProfile(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth") && window.location.pathname !== "/") {
      window.location.replace("/auth");
    }
  }, []);

  useEffect(() => {
    setOn401(() => {
      clearToken();
      setUser(null);
      setProfile(null);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth") && window.location.pathname !== "/") {
        window.location.replace("/auth");
      }
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getToken()) return;
    try {
      const p = await authApi.me();
      setProfile(p);
    } catch {
      // ignore — 401 interceptor handles logout
    }
  }, []);

  useEffect(() => {
    if (user) refreshProfile().finally(() => setIsReady(true));
    else setIsReady(true);
  }, [user, refreshProfile]);

  const loginWithToken = useCallback((token: string) => {
    setToken(token);
    try {
      setUser(jwtDecode<JwtPayload>(token));
    } catch {
      clearToken();
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await authApi.login(email, password);
    loginWithToken(token);
  }, [loginWithToken]);

  const register = useCallback(async (email: string, password: string) => {
    const { token } = await authApi.register(email, password);
    loginWithToken(token);
  }, [loginWithToken]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    isAuthenticated: !!user,
    isReady,
    login,
    register,
    loginWithToken,
    logout,
    refreshProfile,
  }), [user, profile, isReady, login, register, loginWithToken, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
