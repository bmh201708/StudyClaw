import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ensureUserSubscription } from "./billing.js";
import { mapUser, pool } from "./db.js";
import type { User } from "./types.js";

const SALT_ROUNDS = 10;
const TOKEN_TTL_DAYS = Math.max(1, Number(process.env.AUTH_TOKEN_TTL_DAYS || "30") || 30);

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function extractBearerToken(req: Request): string | null {
  const value = req.headers.authorization?.trim() || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function findUserRowByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, name, password_hash, created_at, updated_at
      FROM app_users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function findUserByToken(token: string): Promise<User | null> {
  const tokenHash = hashToken(token);
  const result = await pool.query<UserRow>(
    `
      SELECT u.id, u.email, u.name, u.password_hash, u.created_at, u.updated_at
      FROM auth_tokens t
      JOIN app_users u ON u.id = t.user_id
      WHERE t.token_hash = $1
        AND t.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) return null;

  await pool.query(
    `
      UPDATE auth_tokens
      SET last_used_at = NOW()
      WHERE token_hash = $1
    `,
    [tokenHash],
  );

  return mapUser(row);
}

async function issueToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await pool.query(
    `
      INSERT INTO auth_tokens (token_hash, user_id, expires_at)
      VALUES ($1, $2, $3)
    `,
    [hashToken(token), userId, expiresAt],
  );

  return token;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const result = await pool.query<UserRow>(
    `
      INSERT INTO app_users (id, email, name, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, password_hash, created_at, updated_at
    `,
    [id, normalizeEmail(input.email), input.name.trim(), passwordHash],
  );

  const row = result.rows[0];
  await ensureUserSubscription(row.id);
  const token = await issueToken(row.id);

  return {
    token,
    user: mapUser(row),
  };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: User } | null> {
  const row = await findUserRowByEmail(input.email);
  if (!row) return null;

  const ok = await bcrypt.compare(input.password, row.password_hash);
  if (!ok) return null;

  const token = await issueToken(row.id);
  return {
    token,
    user: mapUser(row),
  };
}

export async function revokeToken(token: string): Promise<void> {
  await pool.query("DELETE FROM auth_tokens WHERE token_hash = $1", [hashToken(token)]);
}

export async function requireUser(req: Request, res: Response): Promise<User | null> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "authentication required" });
    return null;
  }

  const user = await findUserByToken(token);
  if (!user) {
    res.status(401).json({ error: "invalid or expired token" });
    return null;
  }

  return user;
}

export function readBearerToken(req: Request): string | null {
  return extractBearerToken(req);
}
