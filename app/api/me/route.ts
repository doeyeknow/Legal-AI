import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNTS_MESSAGE,
  authConfigured,
  cleanProfile,
  getSessionUser,
  profileOrEmpty,
  updateUserProfile,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: who is signed in, with their basic-info profile.
// 503 when accounts are not configured (no database / no session
// secret) — the client treats that as "accounts are being set up"
// and the interview runs its guest flow. 200 { user: null } when
// accounts are live but the visitor is signed out.
export async function GET(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "accounts_not_configured", message: ACCOUNTS_MESSAGE },
      { status: 503 },
    );
  }
  const user = await getSessionUser(req);
  return NextResponse.json({ user });
}

// PATCH: update the signed-in user's basic-info profile. This is
// also how interview corrections get saved back to the profile.
export async function PATCH(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "accounts_not_configured", message: ACCOUNTS_MESSAGE },
      { status: 503 },
    );
  }
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // Partial updates merge over the stored profile: a caller that
  // sends only the fields it changed must not wipe the rest.
  const cleaned = cleanProfile(body);
  const profile = profileOrEmpty(user);
  if (body) {
    for (const k of Object.keys(cleaned) as (keyof typeof cleaned)[]) {
      if (typeof body[k] === "string") profile[k] = cleaned[k];
    }
  }
  try {
    const updated = await updateUserProfile(user.id, profile);
    if (!updated) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json(
      { error: "accounts_unavailable", message: ACCOUNTS_MESSAGE },
      { status: 503 },
    );
  }
}
