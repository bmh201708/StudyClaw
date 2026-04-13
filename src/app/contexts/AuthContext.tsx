import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, loginUser, logoutUser, registerUser } from "../lib/authApi";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
  type AuthUser,
} from "../lib/authStorage";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthSession>;
  register: (input: { name: string; email: string; password: string }) => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "studyclaw_auth_session") setSession(loadAuthSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const current = loadAuthSession();
    if (!current?.token) return;

    fetchCurrentUser(current.token)
      .then((user) => {
        if (cancelled) return;
        const next = { token: current.token, user };
        saveAuthSession(next);
        setSession(next);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthSession();
        setSession(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const next = await loginUser(input);
    saveAuthSession(next);
    setSession(next);
    return next;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const next = await registerUser(input);
    saveAuthSession(next);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    const current = loadAuthSession();
    clearAuthSession();
    setSession(null);
    if (current?.token) {
      await logoutUser(current.token);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token && session?.user),
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
