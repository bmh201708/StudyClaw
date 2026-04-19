/**
 * 后端会话 API（不含 AI）。开发环境通过 Vite 代理访问 /api → 127.0.0.1:3001
 * 生产环境可设置 VITE_API_URL=https://your-api.example.com
 */
import { loadAuthSession } from "./authStorage";
import { readApiError } from "./apiError";

export function apiUrl(path: string): string {
  const root = import.meta.env.VITE_API_URL as string | undefined;
  if (root) return `${root.replace(/\/$/, "")}${path}`;
  return path;
}

export function authHeaders(init?: HeadersInit): HeadersInit {
  const token = loadAuthSession()?.token;
  if (!token) return init ?? {};
  return {
    ...(init ?? {}),
    Authorization: `Bearer ${token}`,
  };
}

export type WorkflowMode = "digital" | "physical";

export interface ServerSession {
  id: string;
  userId: string;
  goal: string;
  mode: WorkflowMode;
  status: "active" | "completed";
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  tasks: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  distractionEscrow?: string[];
  contextSummary?: string;
}

export type TaskRecommendation = {
  title: string;
  description: string;
  url: string;
  kind: "site" | "doc";
  source: "search" | "fallback";
};

export async function createServerSession(
  goal: string,
  mode: WorkflowMode,
  opts?: { contextSummary?: string },
): Promise<ServerSession | null> {
  try {
    const res = await fetch(apiUrl("/api/sessions"), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        goal,
        mode,
        ...(opts?.contextSummary ? { contextSummary: opts.contextSummary } : {}),
      }),
    });
    if (!res.ok) throw await readApiError(res);
    return (await res.json()) as ServerSession;
  } catch (error) {
    throw error;
  }
}

export interface CompleteSessionPayload {
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  tasks: string[];
  goal?: string;
  /** Distraction Escrow Inbox 条目文案 */
  distractionEscrow?: string[];
}

export async function completeServerSession(
  sessionId: string,
  payload: CompleteSessionPayload,
): Promise<ServerSession | null> {
  try {
    const res = await fetch(apiUrl(`/api/sessions/${sessionId}/complete`), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerSession;
  } catch {
    return null;
  }
}

export async function patchServerSession(
  sessionId: string,
  partial: Partial<CompleteSessionPayload>,
): Promise<ServerSession | null> {
  try {
    const res = await fetch(apiUrl(`/api/sessions/${sessionId}`), {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(partial),
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerSession;
  } catch {
    return null;
  }
}

export async function fetchCompletedSessions(limit = 20): Promise<ServerSession[]> {
  try {
    const res = await fetch(apiUrl(`/api/sessions?status=completed&limit=${limit}`), {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { sessions: ServerSession[] };
    return data.sessions ?? [];
  } catch {
    return [];
  }
}

export async function fetchTaskRecommendations(
  taskTitle: string,
  goal?: string,
  language: "zh" | "en" = "zh",
): Promise<{ query: string; items: TaskRecommendation[] } | null> {
  try {
    const res = await fetch(apiUrl("/api/sessions/recommendations"), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        taskTitle,
        goal,
        language,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { query: string; items: TaskRecommendation[] };
  } catch {
    return null;
  }
}
