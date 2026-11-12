import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNTS_MESSAGE,
  authConfigured,
  cleanProfile,
  createSession,
  hashPassword,
  rowToUser,
  sessionCookie,
} from "@/lib/auth";
import { ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Create an account: email + password, plus the basic-info profile
// (full legal name, street, city, state, ZIP, phone). The profile
// fields are optional at signup and editable later on /account.
export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "accounts_not_configured", message: ACCOUNTS_MESSAGE },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password || password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }
  const profile = cleanProfile(body);
  try {
    await ensureSchema();
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with that email already exists — try signing in." },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(password);
    const rows = await query<{
      id: string;
      email: string;
      full_name: string;
      street: string;
      city: string;
      state: string;
      zip: string;
      phone: string;
    }>(
      `INSERT INTO users (email, password_hash, full_name, street, city, state, zip, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, full_name, street, city, state, zip, phone`,
      [
        email,
        passwordHash,
        profile.fullName,
        profile.street,
        profile.city,
        profile.state,
        profile.zip,
        profile.phone,
      ],
    );
    const user = rowToUser(rows[0]);
    const { token, maxAge } = await createSession(user.id);
    return NextResponse.json(
      { user },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token, maxAge) } },
    );
  } catch {
    return NextResponse.json(
      { error: "accounts_unavailable", message: ACCOUNTS_MESSAGE },
      { status: 503 },
    );
  }
}
