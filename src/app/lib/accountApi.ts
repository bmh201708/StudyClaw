import type { AiProviderId, AiSettingsMode } from "./aiSettingsStorage";
import { apiUrl, authHeaders, type WorkflowMode } from "./sessionApi";
import type { AuthUser } from "./authStorage";

export interface AccountPreferences {
  userId: string;
  defaultWorkflowMode: WorkflowMode;
  focusReminderEnabled: boolean;
  breakReminderEnabled: boolean;
  themeVariant: "radiant";
  uiDensity: "comfortable" | "compact";
  updatedAt: string;
}

export interface AccountAiPreferences {
  userId: string;
  mode: AiSettingsMode;
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  hasCustomApiKey: boolean;
  customApiKeyMasked?: string;
  updatedAt: string;
}

export interface AccountStatsPoint {
  date: string;
  focusTime: number;
  completedSessions: number;
}

export interface AccountRecentSession {
  id: string;
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  completedAt?: string;
}

export interface AccountStats {
  totalFocusTime: number;
  completedSessions: number;
  savedProgressCount: number;
  last7Days: AccountStatsPoint[];
  recentSessions: AccountRecentSession[];
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || `request failed (${res.status})`;
}

export async function updateAccountProfile(name: string): Promise<AuthUser> {
  const res = await fetch(apiUrl("/api/account/profile"), {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function changeAccountPassword(input: {
  currentPassword: string;
  nextPassword: string;
}): Promise<void> {
  const res = await fetch(apiUrl("/api/account/change-password"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function fetchAccountPreferences(): Promise<{
  preferences: AccountPreferences;
  aiPreferences: AccountAiPreferences;
}> {
  const res = await fetch(apiUrl("/api/account/preferences"), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    preferences: AccountPreferences;
    aiPreferences: AccountAiPreferences;
  };
}

export async function updateAccountPreferences(
  input: Partial<Omit<AccountPreferences, "userId" | "updatedAt">>,
): Promise<AccountPreferences> {
  const res = await fetch(apiUrl("/api/account/preferences"), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { preferences: AccountPreferences };
  return data.preferences;
}

export async function fetchAccountAiPreferences(): Promise<AccountAiPreferences> {
  const res = await fetch(apiUrl("/api/account/ai-preferences"), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { aiPreferences: AccountAiPreferences };
  return data.aiPreferences;
}

export async function updateAccountAiPreferences(input: {
  mode: AiSettingsMode;
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  customApiKey?: string;
}): Promise<AccountAiPreferences> {
  const res = await fetch(apiUrl("/api/account/ai-preferences"), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { aiPreferences: AccountAiPreferences };
  return data.aiPreferences;
}

export async function fetchAccountStats(): Promise<AccountStats> {
  const res = await fetch(apiUrl("/api/account/stats"), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as AccountStats;
}
