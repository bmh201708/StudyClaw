import bcrypt from "bcryptjs";
import { mapAccountRecentSession, mapAccountStatsPoint, mapUser, mapUserAiPreferences, mapUserPreferences, pool } from "./db.js";
import { encryptSecret, maskSecret } from "./crypto.js";
const SALT_ROUNDS = 10;
function defaultUserPreferences(userId) {
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
function defaultUserAiPreferences(userId) {
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
async function ensurePreferenceRows(userId) {
    await pool.query(`
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [userId]);
    await pool.query(`
      INSERT INTO user_ai_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `, [userId]);
}
async function findUserRowById(userId) {
    const result = await pool.query(`
      SELECT id, email, name, password_hash, created_at, updated_at
      FROM app_users
      WHERE id = $1
      LIMIT 1
    `, [userId]);
    return result.rows[0] ?? null;
}
export class AccountStore {
    async updateProfile(userId, body) {
        const result = await pool.query(`
        UPDATE app_users
        SET name = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name, password_hash, created_at, updated_at
      `, [userId, body.name.trim()]);
        return mapUser(result.rows[0]);
    }
    async changePassword(userId, body) {
        const row = await findUserRowById(userId);
        if (!row)
            throw new Error("user not found");
        const ok = await bcrypt.compare(body.currentPassword, row.password_hash);
        if (!ok) {
            throw new Error("current password is incorrect");
        }
        const nextHash = await bcrypt.hash(body.nextPassword, SALT_ROUNDS);
        await pool.query(`
        UPDATE app_users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
      `, [userId, nextHash]);
    }
    async getPreferences(userId) {
        await ensurePreferenceRows(userId);
        const [prefsRes, aiRes] = await Promise.all([
            pool.query(`
          SELECT *
          FROM user_preferences
          WHERE user_id = $1
          LIMIT 1
        `, [userId]),
            pool.query(`
          SELECT *
          FROM user_ai_preferences
          WHERE user_id = $1
          LIMIT 1
        `, [userId]),
        ]);
        return {
            preferences: prefsRes.rows[0] ? mapUserPreferences(prefsRes.rows[0]) : defaultUserPreferences(userId),
            aiPreferences: aiRes.rows[0] ? mapUserAiPreferences(aiRes.rows[0]) : defaultUserAiPreferences(userId),
        };
    }
    async updatePreferences(userId, body) {
        await ensurePreferenceRows(userId);
        const result = await pool.query(`
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
      `, [
            userId,
            body.defaultWorkflowMode ?? null,
            body.focusReminderEnabled ?? null,
            body.breakReminderEnabled ?? null,
            body.themeVariant ?? null,
            body.uiDensity ?? null,
        ]);
        return mapUserPreferences(result.rows[0]);
    }
    async getAiPreferences(userId) {
        await ensurePreferenceRows(userId);
        const result = await pool.query(`
        SELECT *
        FROM user_ai_preferences
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        return result.rows[0] ? mapUserAiPreferences(result.rows[0]) : defaultUserAiPreferences(userId);
    }
    async updateAiPreferences(userId, body) {
        await ensurePreferenceRows(userId);
        const existingResult = await pool.query(`
        SELECT *
        FROM user_ai_preferences
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        const existing = existingResult.rows[0];
        const encryptedKey = body.mode === "custom" && body.customApiKey?.trim()
            ? encryptSecret(body.customApiKey.trim())
            : null;
        const maskedKey = body.mode === "custom" && body.customApiKey?.trim()
            ? maskSecret(body.customApiKey.trim())
            : null;
        if (body.mode === "custom" && !encryptedKey && !existing?.custom_api_key_encrypted) {
            throw new Error("custom API key is required for custom mode");
        }
        const result = await pool.query(`
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
      `, [
            userId,
            body.mode,
            body.provider,
            body.model.trim(),
            (body.baseUrl || "https://api.openai.com/v1").trim(),
            encryptedKey,
            maskedKey,
        ]);
        return mapUserAiPreferences(result.rows[0]);
    }
    async getStats(userId) {
        const [summaryRes, progressRes, recentRes, trendRes] = await Promise.all([
            pool.query(`
          SELECT
            COALESCE(SUM(focus_time), 0) AS total_focus_time,
            COUNT(*)::int AS completed_sessions
          FROM workflow_sessions
          WHERE user_id = $1
            AND status = 'completed'
        `, [userId]),
            pool.query(`
          SELECT COUNT(*)::int AS saved_progress_count
          FROM saved_progress
          WHERE user_id = $1
        `, [userId]),
            pool.query(`
          SELECT id, goal, focus_time, completed_tasks, total_tasks, completed_at
          FROM workflow_sessions
          WHERE user_id = $1
            AND status = 'completed'
          ORDER BY completed_at DESC NULLS LAST, updated_at DESC
          LIMIT 5
        `, [userId]),
            pool.query(`
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
        `, [userId]),
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
