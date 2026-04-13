import { Pool } from "pg";
import type {
  AccountRecentSession,
  AccountStatsPoint,
  SavedProgress,
  Session,
  User,
  UserAiPreferences,
  UserPreferences,
} from "./types.js";

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

      await pool.query(`
        CREATE TABLE IF NOT EXISTS saved_progress (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          source_session_id TEXT REFERENCES workflow_sessions(id) ON DELETE SET NULL,
          goal TEXT NOT NULL,
          focus_time INTEGER NOT NULL DEFAULT 0,
          completed_tasks INTEGER NOT NULL DEFAULT 0,
          total_tasks INTEGER NOT NULL DEFAULT 0,
          distraction_count INTEGER NOT NULL DEFAULT 0,
          completed_task_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
          distraction_escrow JSONB NOT NULL DEFAULT '[]'::jsonb,
          context_summary TEXT,
          saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS saved_progress_user_saved_idx
        ON saved_progress (user_id, saved_at DESC, created_at DESC);
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
          default_workflow_mode TEXT NOT NULL DEFAULT 'digital',
          focus_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          break_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          theme_variant TEXT NOT NULL DEFAULT 'radiant',
          ui_density TEXT NOT NULL DEFAULT 'comfortable',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_ai_preferences (
          user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
          mode TEXT NOT NULL DEFAULT 'default',
          provider TEXT NOT NULL DEFAULT 'openai',
          model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
          base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
          custom_api_key_encrypted TEXT,
          custom_api_key_masked TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
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

export function mapUserPreferences(row: {
  user_id: string;
  default_workflow_mode: UserPreferences["defaultWorkflowMode"];
  focus_reminder_enabled: boolean;
  break_reminder_enabled: boolean;
  theme_variant: UserPreferences["themeVariant"];
  ui_density: UserPreferences["uiDensity"];
  updated_at: Date | string;
}): UserPreferences {
  return {
    userId: row.user_id,
    defaultWorkflowMode: row.default_workflow_mode,
    focusReminderEnabled: row.focus_reminder_enabled,
    breakReminderEnabled: row.break_reminder_enabled,
    themeVariant: row.theme_variant,
    uiDensity: row.ui_density,
    updatedAt: toIso(row.updated_at),
  };
}

export function mapUserAiPreferences(row: {
  user_id: string;
  mode: UserAiPreferences["mode"];
  provider: UserAiPreferences["provider"];
  model: string;
  base_url: string;
  custom_api_key_masked: string | null;
  updated_at: Date | string;
}): UserAiPreferences {
  return {
    userId: row.user_id,
    mode: row.mode,
    provider: row.provider,
    model: row.model,
    baseUrl: row.base_url,
    hasCustomApiKey: Boolean(row.custom_api_key_masked),
    ...(row.custom_api_key_masked ? { customApiKeyMasked: row.custom_api_key_masked } : {}),
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

export function mapSavedProgress(row: {
  id: string;
  user_id: string;
  source_session_id: string | null;
  goal: string;
  focus_time: number;
  completed_tasks: number;
  total_tasks: number;
  distraction_count: number;
  completed_task_titles: unknown;
  distraction_escrow: unknown;
  context_summary: string | null;
  saved_at: Date | string;
  created_at: Date | string;
}): SavedProgress {
  return {
    id: row.id,
    userId: row.user_id,
    ...(row.source_session_id ? { sourceSessionId: row.source_session_id } : {}),
    goal: row.goal,
    focusTime: row.focus_time,
    completedTasks: row.completed_tasks,
    totalTasks: row.total_tasks,
    distractionCount: row.distraction_count,
    completedTaskTitles: Array.isArray(row.completed_task_titles)
      ? row.completed_task_titles.map((item) => String(item))
      : [],
    distractionEscrow: Array.isArray(row.distraction_escrow)
      ? row.distraction_escrow.map((item) => String(item))
      : [],
    ...(row.context_summary ? { contextSummary: row.context_summary } : {}),
    savedAt: toIso(row.saved_at),
    createdAt: toIso(row.created_at),
  };
}

export function mapAccountRecentSession(row: {
  id: string;
  goal: string;
  focus_time: number;
  completed_tasks: number;
  total_tasks: number;
  completed_at: Date | string | null;
}): AccountRecentSession {
  return {
    id: row.id,
    goal: row.goal,
    focusTime: row.focus_time,
    completedTasks: row.completed_tasks,
    totalTasks: row.total_tasks,
    ...(row.completed_at ? { completedAt: toIso(row.completed_at) } : {}),
  };
}

export function mapAccountStatsPoint(row: {
  day: Date | string;
  focus_time: number | string | null;
  completed_sessions: number | string | null;
}): AccountStatsPoint {
  const date = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
  return {
    date,
    focusTime: Number(row.focus_time || 0),
    completedSessions: Number(row.completed_sessions || 0),
  };
}
