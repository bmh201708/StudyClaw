import { apiUrl, authHeaders } from "./sessionApi";

export interface SavedProgress {
  id: string;
  userId: string;
  sourceSessionId?: string;
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  completedTaskTitles: string[];
  distractionEscrow: string[];
  contextSummary?: string;
  savedAt: string;
  createdAt: string;
}

export interface CreateProgressPayload {
  sourceSessionId?: string;
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  completedTaskTitles: string[];
  distractionEscrow?: string[];
  contextSummary?: string;
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || `request failed (${res.status})`;
}

export async function createSavedProgress(payload: CreateProgressPayload): Promise<SavedProgress> {
  const res = await fetch(apiUrl("/api/progress"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as SavedProgress;
}

export async function fetchRecentProgress(limit = 3): Promise<SavedProgress[]> {
  const res = await fetch(apiUrl(`/api/progress?limit=${limit}`), {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { progress?: SavedProgress[] };
  return data.progress ?? [];
}
