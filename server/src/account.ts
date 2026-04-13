import bcrypt from "bcryptjs";
import { mapAccountRecentSession, mapAccountStatsPoint, mapUser, mapUserAiPreferences, mapUserPreferences, pool } from "./db.js";
import { encryptSecret, maskSecret } from "./crypto.js";
import type {
  AccountPreferencesBundle,
  AccountProfileUpdateBody,
  AccountStatsResponse,
  ChangePasswordBody,
  UpdateUserAiPreferencesBody,
  UpdateUserPreferencesBody,
  User,
  UserAiPreferences,
  UserPreferences,
} from "./types.js";

const SALT_ROUNDS = 10;

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserPreferencesRow = {
  user_id: string;
  default_workflow_mode: UserPreferences["defaultWorkflowMode"];
  focus_reminder_enabled: boolean;
  break_reminder_enabled: boolean;
  theme_variant: UserPreferences["themeVariant"];
  ui_density: UserPreferences["uiDensity"];
  updated_at: Date | string;
};

type UserAiPreferencesRow = {
  user_id: string;
  mode: UserAiPreferences["mode"];
  provider: UserAiPreferences["provider"];
  model: string;
  base_url: string;
  custom_api_key_encrypted: string | null;
  custom_api_key_masked: string | null;
  updated_at: Date | string;
};

function defaultUserPreferences(userId: string): UserPreferences {
  return {
    userId,
    defaultWorkflowMode: "digital",
    focusReminderEnabled: true,
    breakReminderEnabled: true,
    themeVariant: "radiant",
    uiDensity: "comfortable",
    updatedAt: new Date(0).toISOString(),
  };
}

function defaultUserAiPreferences(userId: string): UserAiPreferences {
  return {
    userId,
    mode: "default",
    provider: "openai",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    hasCustomApiKey: false,
    updatedAt: new Date(0).toISOString(),
  };
}

async function ensurePreferenceRows(userId: string): Promise<void> {
  await pool.query(
    `
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );

  await pool.query(
    `
      INSERT INTO user_ai_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );
}

async function findUserRowById(userId: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, name, password_hash, created_at, updated_at
      FROM app_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

export class AccountStore {
  async updateProfile(userId: string, body: AccountProfileUpdateBody): Promise<User> {
    const result = await pool.query<UserRow>(
      `
        UPDATE app_users
        SET name = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name, password_hash, created_at, updated_at
      `,
      [userId, body.name.trim()],
    );

    return mapUser(result.rows[0]);
  }

  async changePassword(userId: string, body: ChangePasswordBody): Promise<void> {
    const row = await findUserRowById(userId);
    if (!row) throw new Error("user not found");

    const ok = await bcrypt.compare(body.currentPassword, row.password_hash);
    if (!ok) {
      throw new Error("current password is incorrect");
    }

    const nextHash = await bcrypt.hash(body.nextPassword, SALT_ROUNDS);
    await pool.query(
      `
        UPDATE app_users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [userId, nextHash],
    );
  }

  async getPreferences(userId: string): Promise<AccountPreferencesBundle> {
    await ensurePreferenceRows(userId);

    const [prefsRes, aiRes] = await Promise.all([
      pool.query<UserPreferencesRow>(
        `
          SELECT *
          FROM user_preferences
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId],
      ),
      pool.query<UserAiPreferencesRow>(
        `
          SELECT *
          FROM user_ai_preferences
          WHERE user_id = $1
          LIMIT 1
        `,
        [userId],
      ),
    ]);

    return {
      preferences: prefsRes.rows[0] ? mapUserPreferences(prefsRes.rows[0]) : defaultUserPreferences(userId),
      aiPreferences: aiRes.rows[0] ? mapUserAiPreferences(aiRes.rows[0]) : defaultUserAiPreferences(userId),
    };
  }

  async updatePreferences(userId: string, body: UpdateUserPreferencesBody): Promise<UserPreferences> {
    await ensurePreferenceRows(userId);

    const result = await pool.query<UserPreferencesRow>(
      `
        UPDATE user_preferences
        SET
          default_workflow_mode = COALESCE($2, default_workflow_mode),
          focus_reminder_enabled = COALESCE($3, focus_reminder_enabled),
          break_reminder_enabled = COALESCE($4, break_reminder_enabled),
          theme_variant = COALESCE($5, theme_variant),
          ui_density = COALESCE($6, ui_density),
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `,
      [
        userId,
        body.defaultWorkflowMode ?? null,
        body.focusReminderEnabled ?? null,
        body.breakReminderEnabled ?? null,
        body.themeVariant ?? null,
        body.uiDensity ?? null,
      ],
    );

    return mapUserPreferences(result.rows[0]);
  }

  async getAiPreferences(userId: string): Promise<UserAiPreferences> {
    await ensurePreferenceRows(userId);
    const result = await pool.query<UserAiPreferencesRow>(
      `
        SELECT *
        FROM user_ai_preferences
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ? mapUserAiPreferences(result.rows[0]) : defaultUserAiPreferences(userId);
  }

  async updateAiPreferences(userId: string, body: UpdateUserAiPreferencesBody): Promise<UserAiPreferences> {
    await ensurePreferenceRows(userId);

    const existingResult = await pool.query<UserAiPreferencesRow>(
      `
        SELECT *
        FROM user_ai_preferences
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    );
    const existing = existingResult.rows[0];

    const encryptedKey =
      body.mode === "custom" && body.customApiKey?.trim()
        ? encryptSecret(body.customApiKey.trim())
        : null;
    const maskedKey =
      body.mode === "custom" && body.customApiKey?.trim()
        ? maskSecret(body.customApiKey.trim())
        : null;

    if (body.mode === "custom" && !encryptedKey && !existing?.custom_api_key_encrypted) {
      throw new Error("custom API key is required for custom mode");
    }

    const result = await pool.query<UserAiPreferencesRow>(
      `
        UPDATE user_ai_preferences
        SET
          mode = $2,
          provider = $3,
          model = $4,
          base_url = $5,
          custom_api_key_encrypted = CASE
            WHEN $2 = 'default' THEN NULL
            WHEN $6::text IS NOT NULL THEN $6
            ELSE custom_api_key_encrypted
          END,
          custom_api_key_masked = CASE
            WHEN $2 = 'default' THEN NULL
            WHEN $7::text IS NOT NULL THEN $7
            ELSE custom_api_key_masked
          END,
          updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `,
      [
        userId,
        body.mode,
        body.provider,
        body.model.trim(),
        (body.baseUrl || "https://api.openai.com/v1").trim(),
        encryptedKey,
        maskedKey,
      ],
    );

    return mapUserAiPreferences(result.rows[0]);
  }

  async getStats(userId: string): Promise<AccountStatsResponse> {
    const [summaryRes, progressRes, recentRes, trendRes] = await Promise.all([
      pool.query<{ total_focus_time: string | null; completed_sessions: string | null }>(
        `
          SELECT
            COALESCE(SUM(focus_time), 0) AS total_focus_time,
            COUNT(*)::int AS completed_sessions
          FROM workflow_sessions
          WHERE user_id = $1
            AND status = 'completed'
        `,
        [userId],
      ),
      pool.query<{ saved_progress_count: string | null }>(
        `
          SELECT COUNT(*)::int AS saved_progress_count
          FROM saved_progress
          WHERE user_id = $1
        `,
        [userId],
      ),
      pool.query<{
        id: string;
        goal: string;
        focus_time: number;
        completed_tasks: number;
        total_tasks: number;
        completed_at: Date | string | null;
      }>(
        `
          SELECT id, goal, focus_time, completed_tasks, total_tasks, completed_at
          FROM workflow_sessions
          WHERE user_id = $1
            AND status = 'completed'
          ORDER BY completed_at DESC NULLS LAST, updated_at DESC
          LIMIT 5
        `,
        [userId],
      ),
      pool.query<{ day: Date | string; focus_time: string | null; completed_sessions: string | null }>(
        `
          WITH days AS (
            SELECT generate_series(
              date_trunc('day', NOW()) - INTERVAL '6 day',
              date_trunc('day', NOW()),
              INTERVAL '1 day'
            ) AS day
          )
          SELECT
            days.day,
            COALESCE(SUM(ws.focus_time), 0) AS focus_time,
            COUNT(ws.id)::int AS completed_sessions
          FROM days
          LEFT JOIN workflow_sessions ws
            ON ws.user_id = $1
           AND ws.status = 'completed'
           AND date_trunc('day', ws.completed_at) = days.day
          GROUP BY days.day
          ORDER BY days.day ASC
        `,
        [userId],
      ),
    ]);

    const summary = summaryRes.rows[0];
    const progress = progressRes.rows[0];

    return {
      totalFocusTime: Number(summary?.total_focus_time || 0),
      completedSessions: Number(summary?.completed_sessions || 0),
      savedProgressCount: Number(progress?.saved_progress_count || 0),
      last7Days: trendRes.rows.map(mapAccountStatsPoint),
      recentSessions: recentRes.rows.map(mapAccountRecentSession),
    };
  }
}

export const accountStore = new AccountStore();
