import type { CompleteSessionBody, CreateSessionBody, Session } from "./types.js";

const MAX_COMPLETED = 100;

function nowIso() {
  return new Date().toISOString();
}

export class SessionStore {
  private active = new Map<string, Session>();
  private completed: Session[] = [];

  create(body: CreateSessionBody): Session {
    const id = crypto.randomUUID();
    const t = nowIso();
    const ctx = body.contextSummary?.trim().slice(0, 200_000);
    const session: Session = {
      id,
      goal: body.goal.trim(),
      mode: body.mode,
      status: "active",
      focusTime: 0,
      completedTasks: 0,
      totalTasks: 0,
      distractionCount: 0,
      tasks: [],
      distractionEscrow: [],
      ...(ctx ? { contextSummary: ctx } : {}),
      createdAt: t,
      updatedAt: t,
    };
    this.active.set(id, session);
    return { ...session };
  }

  get(id: string): Session | undefined {
    const s = this.active.get(id);
    if (s) return { ...s };
    const c = this.completed.find((x) => x.id === id);
    return c ? { ...c } : undefined;
  }

  patch(
    id: string,
    patch: Partial<
      Pick<Session, "focusTime" | "completedTasks" | "totalTasks" | "distractionCount" | "tasks" | "distractionEscrow">
    >,
  ): Session | undefined {
    const s = this.active.get(id);
    if (!s) return undefined;
    if (patch.focusTime !== undefined) s.focusTime = patch.focusTime;
    if (patch.completedTasks !== undefined) s.completedTasks = patch.completedTasks;
    if (patch.totalTasks !== undefined) s.totalTasks = patch.totalTasks;
    if (patch.distractionCount !== undefined) s.distractionCount = patch.distractionCount;
    if (patch.tasks !== undefined) s.tasks = [...patch.tasks];
    if (patch.distractionEscrow !== undefined) s.distractionEscrow = [...patch.distractionEscrow];
    s.updatedAt = nowIso();
    return { ...s };
  }

  complete(id: string, body: CompleteSessionBody): Session | undefined {
    const s = this.active.get(id);
    if (!s) return undefined;
    s.status = "completed";
    s.focusTime = body.focusTime;
    s.completedTasks = body.completedTasks;
    s.totalTasks = body.totalTasks;
    s.distractionCount = body.distractionCount;
    s.tasks = [...body.tasks];
    s.distractionEscrow = Array.isArray(body.distractionEscrow)
      ? body.distractionEscrow.map((x) => String(x))
      : [];
    if (body.goal?.trim()) s.goal = body.goal.trim();
    s.updatedAt = nowIso();
    s.completedAt = s.updatedAt;
    this.active.delete(id);
    this.completed.unshift({ ...s });
    if (this.completed.length > MAX_COMPLETED) this.completed.length = MAX_COMPLETED;
    return { ...s };
  }

  listCompleted(limit: number): Session[] {
    return this.completed.slice(0, Math.min(limit, MAX_COMPLETED)).map((x) => ({ ...x }));
  }
}

export const store = new SessionStore();
