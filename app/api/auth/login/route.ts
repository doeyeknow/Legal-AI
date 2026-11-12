import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNTS_MESSAGE,
  authConfigured,
  createSession,
  rowToUser,
  sessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sign in. Failures are deliberately generic — the response never
// reveals whether the email exists or the password was wrong.
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
  const fail = () =>
    NextResponse.json({ error: "Email or password doesn't match." }, { status: 401 });
  if (!email || !password) return fail();
  try {
    await ensureSchema();
    const rows = await query<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      street: string;
      city: string;
      state: string;
      zip: string;
      phone: string;
    }>(
      `SELECT id, email, password_hash, full_name, street, city, state, zip, phone
       FROM users WHERE email = $1`,
      [email],
    );
    const row = rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) return fail();
    const user = rowToUser(row);
    const { token, maxAge } = await createSession(user.id);
    return NextResponse.json(
      { user },
      { status: 200, headers: { "Set-Cookie": sessionCookie(token, maxAge) } },
    );
  } catch {
    return NextResponse.json(
      { error: "accounts_unavailable", message: ACCOUNTS_MESSAGE },
      { status: 503 },
    );
  }
}
