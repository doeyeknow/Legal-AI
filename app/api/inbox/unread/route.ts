// GET /api/inbox/unread — a lightweight poll target for the
// in-app new-mail toast: the signed-in user's newest inbound
// message (id + arrival + sender only) and the unreviewed count.
// No subjects, no bodies, no facts — the toast names the sender
// and nothing else, and the full queue lives behind /dashboard/inbox.

import { NextRequest, NextResponse } from "next/server";
import { requireUser, dbUnavailable } from "@/lib/api-guard";
import { ensureSchema, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const [latest, cnt] = await Promise.all([
      query<{
        id: string;
        received_at: string;
        from_name: string;
        from_email: string;
      }>(
        `SELECT id, received_at, from_name, from_email
         FROM inbound_messages
         WHERE user_id = $1
         ORDER BY received_at DESC, created_at DESC, id DESC
         LIMIT 1`,
        [auth.user.id],
      ),
      query<{ n: string }>(
        `SELECT count(*) AS n FROM inbound_messages m
         WHERE m.user_id = $1 AND m.status NOT IN ('filed','dismissed') AND EXISTS (
           SELECT 1 FROM extracted_facts f WHERE f.message_id = m.id AND f.status = 'proposed'
         )`,
        [auth.user.id],
      ),
    ]);
    const row = latest[0];
    return NextResponse.json({
      latest: row
        ? {
            id: row.id,
            receivedAt: new Date(row.received_at).toISOString(),
            fromName: row.from_name || "",
            fromEmail: row.from_email || "",
          }
        : null,
      unreviewed: Number(cnt[0]?.n) || 0,
    });
  } catch {
    return dbUnavailable();
  }
}
