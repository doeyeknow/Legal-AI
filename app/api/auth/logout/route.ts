import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authConfigured,
  clearedSessionCookie,
  destroySession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sign out: drop the server-side session (when accounts are live)
// and always clear the cookie, so sign-out can never fail visibly.
export async function POST(req: NextRequest) {
  if (authConfigured()) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      try {
        await destroySession(token);
      } catch {
        /* the cookie is cleared either way */
      }
    }
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearedSessionCookie() } },
  );
}
