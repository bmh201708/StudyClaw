import { Pool } from "pg";
import type { Session, User } from "./types.js";

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString,
});

pool.on("error", (error) => {
  console.error("[studyclaw-api] postgres pool error", error);
});

let initPromise: Promise<void> | null = null;

export async function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS workflow_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          goal TEXT NOT NULL,
          mode TEXT NOT NULL,
          status TEXT NOT NULL,
          focus_time INTEGER NOT NULL DEFAULT 0,
          completed_tasks INTEGER NOT NULL DEFAULT 0,
          total_tasks INTEGER NOT NULL DEFAULT 0,
          distraction_count INTEGER NOT NULL DEFAULT 0,
          tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
          distraction_escrow JSONB NOT NULL DEFAULT '[]'::jsonb,
          context_summary TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS workflow_sessions_user_status_idx
        ON workflow_sessions (user_id, status, updated_at DESC);
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_tokens_user_id_idx
        ON auth_tokens (user_id, expires_at DESC);
      `);
    })();
  }

  return initPromise;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapUser(row: {
  id: string;
  email: string;
  name: string;
  created_at: Date | string;
  updated_at: Date | string;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapSession(row: {
  id: string;
  user_id: string;
  goal: string;
  mode: Session["mode"];
  status: Session["status"];
  focus_time: number;
  completed_tasks: number;
  total_tasks: number;
  distraction_count: number;
  tasks: unknown;
  distraction_escrow: unknown;
  context_summary: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
}): Session {
  return {
    id: row.id,
    userId: row.user_id,
    goal: row.goal,
    mode: row.mode,
    status: row.status,
    focusTime: row.focus_time,
    completedTasks: row.completed_tasks,
    totalTasks: row.total_tasks,
    distractionCount: row.distraction_count,
    tasks: Array.isArray(row.tasks) ? row.tasks.map((item) => String(item)) : [],
    distractionEscrow: Array.isArray(row.distraction_escrow)
      ? row.distraction_escrow.map((item) => String(item))
      : [],
    ...(row.context_summary ? { contextSummary: row.context_summary } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...(row.completed_at ? { completedAt: toIso(row.completed_at) } : {}),
  };
}
