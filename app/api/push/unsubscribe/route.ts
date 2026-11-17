// POST /api/push/unsubscribe — remove one browser Web Push
// subscription by endpoint, scoped to the signed-in user who owns
// it. Deleting a row that isn't there is still a success: the
// browser-side unsubscribe already happened, and the server row
// must not linger either way.

import { NextRequest, NextResponse } from "next/server";
import { requireUser, dbUnavailable } from "@/lib/api-guard";
import { ensureSchema, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint || endpoint.length > 2048) {
    return NextResponse.json(
      { error: "A push subscription endpoint is required." },
      { status: 422 },
    );
  }
  try {
    await ensureSchema();
    const rows = await query<{ id: string }>(
      `DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2 RETURNING id`,
      [endpoint, auth.user.id],
    );
    return NextResponse.json({ ok: true, deleted: rows.length });
  } catch {
    return dbUnavailable();
  }
}
