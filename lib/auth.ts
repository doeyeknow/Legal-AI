// Accounts: email + password (bcryptjs), server-side sessions via an
// httpOnly cookie holding a random token (only its hash is stored).
// Mirrors palm-app/lib/auth.ts.
//
// Accounts count as configured only when BOTH a database connection
// string and SESSION_SECRET are present. When either is missing the
// auth APIs fail soft with a friendly 503 ("accounts are being set
// up") and the interview falls back to the guest flow — never a crash.

import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { dbConfigured, ensureSchema, query } from "./db";
import { EMPTY_PROFILE, type ProfileInfo } from "./profile";

export const SESSION_COOKIE = "legal_session";
const SESSION_DAYS = 30;

export const ACCOUNTS_MESSAGE =
  "Accounts are being set up — please check back soon. The interview still works as a guest.";

export function authConfigured(): boolean {
  return dbConfigured() && Boolean(process.env.SESSION_SECRET);
}

export interface AccountUser extends ProfileInfo {
  id: string;
  email: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

const USER_COLS = "id, email, full_name, street, city, state, zip, phone";

export function rowToUser(r: UserRow): AccountUser {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name || "",
    street: r.street || "",
    city: r.city || "",
    state: r.state || "",
    zip: r.zip || "",
    phone: r.phone || "",
  };
}

/** Trim and length-cap profile input from an untrusted request body. */
export function cleanProfile(input: unknown): ProfileInfo {
  const src = (input ?? {}) as Record<string, unknown>;
  const pick = (camel: keyof ProfileInfo): string => {
    const v = src[camel];
    return typeof v === "string" ? v.trim().slice(0, 200) : "";
  };
  return {
    fullName: pick("fullName"),
    street: pick("street"),
    city: pick("city"),
    state: pick("state"),
    zip: pick("zip"),
    phone: pick("phone"),
  };
}

export function profileOrEmpty(u: AccountUser | null): ProfileInfo {
  if (!u) return { ...EMPTY_PROFILE };
  const { fullName, street, city, state, zip, phone } = u;
  return { fullName, street, city, state, zip, phone };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session tokens are stored only as a hash. When SESSION_SECRET is
// set the token is HMAC-SHA256'd with it; when unset it falls back
// to plain SHA-256. (Note: rotating SESSION_SECRET invalidates all
// existing sessions, by design.)
function tokenHash(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return createHmac("sha256", secret).update(token).digest("hex");
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await query(
    `INSERT INTO legal_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [tokenHash(token), userId, String(maxAge)],
  );
  return { token, maxAge };
}

export async function destroySession(token: string): Promise<void> {
  await ensureSchema();
  await query(`DELETE FROM legal_sessions WHERE token_hash = $1`, [tokenHash(token)]);
}

export function sessionCookie(token: string, maxAge: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearedSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function getSessionUser(req: NextRequest): Promise<AccountUser | null> {
  if (!authConfigured()) return null;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    await ensureSchema();
    const rows = await query<UserRow>(
      `SELECT u.id, u.email, u.full_name, u.street, u.city, u.state, u.zip, u.phone
       FROM legal_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash(token)],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  } catch {
    // A configured-but-unreachable database must not crash callers;
    // the visitor is simply treated as signed out.
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  p: ProfileInfo,
): Promise<AccountUser | null> {
  await ensureSchema();
  const rows = await query<UserRow>(
    `UPDATE users
     SET full_name = $2, street = $3, city = $4, state = $5, zip = $6,
         phone = $7, updated_at = now()
     WHERE id = $1
     RETURNING ${USER_COLS}`,
    [userId, p.fullName, p.street, p.city, p.state, p.zip, p.phone],
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}
