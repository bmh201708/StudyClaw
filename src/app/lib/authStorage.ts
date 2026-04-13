export type AuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const STORAGE_KEY = "studyclaw_auth_session";

export function loadAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
    if (!parsed?.token || !parsed.user?.id || !parsed.user?.email || !parsed.user?.name) return null;
    return {
      token: parsed.token,
      user: {
        id: parsed.user.id,
        email: parsed.user.email,
        name: parsed.user.name,
        createdAt: parsed.user.createdAt || "",
        updatedAt: parsed.user.updatedAt || "",
      },
    };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
