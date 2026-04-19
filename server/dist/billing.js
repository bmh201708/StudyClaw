import { randomUUID } from "node:crypto";
import { mapSubscriptionSummary, pool } from "./db.js";
const DEFAULT_FREE_WEEKLY_CREDITS = 1000;
const DEFAULT_STARTER_WEEKLY_CREDITS = 5000;
const DEFAULT_PLUS_WEEKLY_CREDITS = 15000;
const DEFAULT_CHAT_CREDITS_PER_1K_TOKENS = 10;
const AI_SMASH_CREDIT_COST = 100;
const SHANGHAI_OFFSET_MINUTES = 8 * 60;
function envNumber(name) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function getChatCreditsPer1kTokens() {
    return envNumber("CHAT_CREDITS_PER_1K_TOKENS") ?? DEFAULT_CHAT_CREDITS_PER_1K_TOKENS;
}
export function getPlanCatalog() {
    const chatCreditsPer1kTokens = getChatCreditsPer1kTokens();
    return [
        {
            planCode: "free",
            label: "Free",
            monthlyPriceUsd: 0,
            weeklyCredits: DEFAULT_FREE_WEEKLY_CREDITS,
            includesDefaultAi: true,
            aiSmashCost: AI_SMASH_CREDIT_COST,
            chatCreditsPer1kTokens,
        },
        {
            planCode: "starter",
            label: "Starter",
            ...(envNumber("STARTER_MONTHLY_PRICE_USD") !== undefined
                ? { monthlyPriceUsd: envNumber("STARTER_MONTHLY_PRICE_USD") }
                : {}),
            weeklyCredits: DEFAULT_STARTER_WEEKLY_CREDITS,
            includesDefaultAi: true,
            aiSmashCost: AI_SMASH_CREDIT_COST,
            chatCreditsPer1kTokens,
        },
        {
            planCode: "plus",
            label: "Plus",
            ...(envNumber("PLUS_MONTHLY_PRICE_USD") !== undefined
                ? { monthlyPriceUsd: envNumber("PLUS_MONTHLY_PRICE_USD") }
                : {}),
            weeklyCredits: DEFAULT_PLUS_WEEKLY_CREDITS,
            includesDefaultAi: true,
            aiSmashCost: AI_SMASH_CREDIT_COST,
            chatCreditsPer1kTokens,
        },
    ];
}
function getWeeklyAllowance(planCode) {
    return (getPlanCatalog().find((plan) => plan.planCode === planCode)?.weeklyCredits ?? DEFAULT_FREE_WEEKLY_CREDITS);
}
function getNowInShanghaiParts(now = new Date()) {
    const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MINUTES * 60_000);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        date: shifted.getUTCDate(),
        day: shifted.getUTCDay(),
    };
}
function toUtcFromShanghai(year, month, date, hours = 0) {
    return new Date(Date.UTC(year, month, date, hours) - SHANGHAI_OFFSET_MINUTES * 60_000);
}
export function getNextWeeklyResetAt(now = new Date()) {
    const parts = getNowInShanghaiParts(now);
    const daysUntilNextMonday = ((8 - parts.day) % 7) || 7;
    return toUtcFromShanghai(parts.year, parts.month, parts.date + daysUntilNextMonday, 0);
}
function estimateTokensFromText(...segments) {
    const chars = segments.reduce((total, segment) => total + (segment?.length ?? 0), 0);
    return Math.max(1, Math.ceil(chars / 4));
}
function buildInsufficientCredits(currentCredits, requiredCredits, planCode) {
    return {
        error: "insufficient credits",
        currentCredits,
        requiredCredits,
        planCode,
        upgradePath: "/pricing",
    };
}
export function estimateWorkflowChatReserveCredits(input) {
    const inputTokens = estimateTokensFromText(input.goal, ...input.messages.map((item) => item.content), ...input.tasks.flatMap((task) => [task.text, task.duration, task.note, task.priority]), ...input.distractions) + 1200;
    return Math.max(1, Math.ceil((inputTokens / 1000) * getChatCreditsPer1kTokens()));
}
export function estimateWorkflowChatActualCredits(input) {
    const totalTokens = typeof input.totalTokens === "number" && Number.isFinite(input.totalTokens)
        ? input.totalTokens
        : estimateTokensFromText(input.userMessageContent, input.assistantMessageContent);
    return Math.max(1, Math.ceil((totalTokens / 1000) * getChatCreditsPer1kTokens()));
}
export class InsufficientCreditsError extends Error {
    payload;
    constructor(payload) {
        super(payload.error);
        this.name = "InsufficientCreditsError";
        this.payload = payload;
    }
}
export function isInsufficientCreditsError(error) {
    return error instanceof InsufficientCreditsError;
}
export async function ensureUserSubscription(userId, planCode = "free") {
    const weeklyAllowance = getWeeklyAllowance(planCode);
    const nextResetAt = getNextWeeklyResetAt();
    await pool.query(`
      INSERT INTO user_subscriptions (
        user_id,
        plan_code,
        status,
        current_credits,
        weekly_credit_allowance,
        next_credit_reset_at
      )
      VALUES ($1, $2, 'active', $3, $3, $4)
      ON CONFLICT (user_id) DO NOTHING
    `, [userId, planCode, weeklyAllowance, nextResetAt.toISOString()]);
    const ledgerCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1
        FROM credit_ledger
        WHERE user_id = $1
          AND reason = 'signup_initial_grant'
      ) AS exists
    `, [userId]);
    if (!ledgerCheck.rows[0]?.exists) {
        await pool.query(`
        INSERT INTO credit_ledger (
          id,
          user_id,
          plan_code,
          delta_credits,
          balance_after,
          reason,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5, 'signup_initial_grant', $6::jsonb)
      `, [
            randomUUID(),
            userId,
            planCode,
            weeklyAllowance,
            weeklyAllowance,
            JSON.stringify({ source: "register" }),
        ]);
    }
}
async function refreshWeeklyCreditsIfDue(userId) {
    const result = await pool.query(`
      SELECT *
      FROM user_subscriptions
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);
    const current = result.rows[0];
    if (!current) {
        await ensureUserSubscription(userId);
        return;
    }
    const now = new Date();
    if (new Date(current.next_credit_reset_at) > now)
        return;
    const nextResetAt = getNextWeeklyResetAt(now);
    const balanceAfter = current.weekly_credit_allowance;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`
        UPDATE user_subscriptions
        SET
          current_credits = weekly_credit_allowance,
          next_credit_reset_at = $2,
          updated_at = NOW()
        WHERE user_id = $1
      `, [userId, nextResetAt.toISOString()]);
        await client.query(`
        INSERT INTO credit_ledger (
          id,
          user_id,
          plan_code,
          delta_credits,
          balance_after,
          reason,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5, 'weekly_refresh', $6::jsonb)
      `, [
            randomUUID(),
            userId,
            current.plan_code,
            balanceAfter - current.current_credits,
            balanceAfter,
            JSON.stringify({
                previousCredits: current.current_credits,
                weeklyCreditAllowance: current.weekly_credit_allowance,
            }),
        ]);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
async function getSubscriptionRow(userId) {
    await ensureUserSubscription(userId);
    await refreshWeeklyCreditsIfDue(userId);
    const result = await pool.query(`
      SELECT *
      FROM user_subscriptions
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);
    return result.rows[0];
}
export async function getSubscriptionResponse(userId) {
    const row = await getSubscriptionRow(userId);
    return {
        ...mapSubscriptionSummary(row),
        plans: getPlanCatalog(),
    };
}
export async function assertHasCredits(userId, requiredCredits) {
    const row = await getSubscriptionRow(userId);
    if (row.current_credits < requiredCredits) {
        throw new InsufficientCreditsError(buildInsufficientCredits(row.current_credits, requiredCredits, row.plan_code));
    }
    return mapSubscriptionSummary(row);
}
export async function consumeCredits(input) {
    const row = await getSubscriptionRow(input.userId);
    if (row.current_credits < input.requiredCredits) {
        throw new InsufficientCreditsError(buildInsufficientCredits(row.current_credits, input.requiredCredits, row.plan_code));
    }
    const balanceAfter = row.current_credits - input.requiredCredits;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const updated = await client.query(`
        UPDATE user_subscriptions
        SET
          current_credits = current_credits - $2,
          updated_at = NOW()
        WHERE user_id = $1
          AND current_credits >= $2
        RETURNING *
      `, [input.userId, input.requiredCredits]);
        const next = updated.rows[0];
        if (!next) {
            throw new InsufficientCreditsError(buildInsufficientCredits(row.current_credits, input.requiredCredits, row.plan_code));
        }
        await client.query(`
        INSERT INTO credit_ledger (
          id,
          user_id,
          plan_code,
          delta_credits,
          balance_after,
          reason,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `, [
            randomUUID(),
            input.userId,
            row.plan_code,
            -input.requiredCredits,
            balanceAfter,
            input.reason,
            JSON.stringify(input.metadata ?? {}),
        ]);
        await client.query("COMMIT");
        return mapSubscriptionSummary(next);
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
export const billingConstants = {
    aiSmashCreditCost: AI_SMASH_CREDIT_COST,
    chatCreditsPer1kTokens: getChatCreditsPer1kTokens,
};
