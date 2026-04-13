import { apiUrl } from "./sessionApi";
import type { AuthSession, AuthUser } from "./authStorage";

type AuthResponse = {
  token: string;
  user: AuthUser;
};

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || `request failed (${res.status})`;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  const res = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return (await res.json()) as AuthResponse;
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return (await res.json()) as AuthResponse;
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const res = await fetch(apiUrl("/api/auth/me"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function logoutUser(token: string): Promise<void> {
  await fetch(apiUrl("/api/auth/logout"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}
