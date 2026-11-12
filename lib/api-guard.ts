// Shared guard for the dashboard API routes: 503 when accounts are
// not configured, 401 when signed out, otherwise the session user.
// A configured-but-unreachable database also fails soft to 503 so
// the dashboard never hard-crashes.

import { NextRequest, NextResponse } from "next/server";
import { ACCOUNTS_MESSAGE, authConfigured, getSessionUser, type AccountUser } from "./auth";

export async function requireUser(
  req: NextRequest,
): Promise<{ user: AccountUser } | { error: NextResponse }> {
  if (!authConfigured()) {
    return {
      error: NextResponse.json(
        { error: "accounts_not_configured", message: ACCOUNTS_MESSAGE },
        { status: 503 },
      ),
    };
  }
  const user = await getSessionUser(req);
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  return { user };
}

export function dbUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "accounts_unavailable", message: ACCOUNTS_MESSAGE },
    { status: 503 },
  );
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

/** Trim + cap an untrusted string field. */
export function cleanStr(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** A YYYY-MM-DD date string, or null. */
export function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
