import { randomUUID } from "node:crypto";
import { mapSession, pool } from "./db.js";
const MAX_COMPLETED = 100;
export class SessionStore {
    async create(userId, body) {
        const id = randomUUID();
        const ctx = body.contextSummary?.trim().slice(0, 200_000) || null;
        const result = await pool.query(`
        INSERT INTO workflow_sessions (
          id,
          user_id,
          goal,
          mode,
          status,
          context_summary
        )
        VALUES ($1, $2, $3, $4, 'active', $5)
        RETURNING *
      `, [id, userId, body.goal.trim(), body.mode, ctx]);
        return mapSession(result.rows[0]);
    }
    async get(userId, id) {
        const result = await pool.query(`
        SELECT *
        FROM workflow_sessions
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `, [id, userId]);
        const row = result.rows[0];
        return row ? mapSession(row) : undefined;
    }
    async patch(userId, id, patch) {
        const values = [id, userId];
        const sets = ["updated_at = NOW()"];
        if (patch.focusTime !== undefined) {
            values.push(patch.focusTime);
            sets.push(`focus_time = $${values.length}`);
        }
        if (patch.completedTasks !== undefined) {
            values.push(patch.completedTasks);
            sets.push(`completed_tasks = $${values.length}`);
        }
        if (patch.totalTasks !== undefined) {
            values.push(patch.totalTasks);
            sets.push(`total_tasks = $${values.length}`);
        }
        if (patch.distractionCount !== undefined) {
            values.push(patch.distractionCount);
            sets.push(`distraction_count = $${values.length}`);
        }
        if (patch.tasks !== undefined) {
            values.push(JSON.stringify(patch.tasks));
            sets.push(`tasks = $${values.length}::jsonb`);
        }
        if (patch.distractionEscrow !== undefined) {
            values.push(JSON.stringify(patch.distractionEscrow));
            sets.push(`distraction_escrow = $${values.length}::jsonb`);
        }
        const result = await pool.query(`
        UPDATE workflow_sessions
        SET ${sets.join(", ")}
        WHERE id = $1
          AND user_id = $2
          AND status = 'active'
        RETURNING *
      `, values);
        const row = result.rows[0];
        return row ? mapSession(row) : undefined;
    }
    async complete(userId, id, body) {
        const result = await pool.query(`
        UPDATE workflow_sessions
        SET
          status = 'completed',
          focus_time = $3,
          completed_tasks = $4,
          total_tasks = $5,
          distraction_count = $6,
          tasks = $7::jsonb,
          goal = COALESCE(NULLIF($8, ''), goal),
          distraction_escrow = $9::jsonb,
          updated_at = NOW(),
          completed_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND status = 'active'
        RETURNING *
      `, [
            id,
            userId,
            body.focusTime,
            body.completedTasks,
            body.totalTasks,
            body.distractionCount,
            JSON.stringify(body.tasks),
            body.goal?.trim() || "",
            JSON.stringify(Array.isArray(body.distractionEscrow) ? body.distractionEscrow : []),
        ]);
        const row = result.rows[0];
        return row ? mapSession(row) : undefined;
    }
    async listCompleted(userId, limit) {
        const result = await pool.query(`
        SELECT *
        FROM workflow_sessions
        WHERE user_id = $1
          AND status = 'completed'
        ORDER BY completed_at DESC NULLS LAST, updated_at DESC
        LIMIT $2
      `, [userId, Math.min(limit, MAX_COMPLETED)]);
        return result.rows.map(mapSession);
    }
}
export const store = new SessionStore();
