// POST /api/push/subscribe — store one browser Web Push
// subscription for the signed-in user (new court mail only).
// The endpoint URL is the upsert key, so re-subscribing the same
// browser updates its keys instead of creating duplicate rows.

import { NextRequest, NextResponse } from "next/server";
import { requireUser, dbUnavailable } from "@/lib/api-guard";
import { ensureSchema, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscriptionBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

function validSubscription(
  value: unknown,
): { endpoint: string; p256dh: string; auth: string } | null {
  if (!value || typeof value !== "object") return null;
  const sub = value as SubscriptionBody;
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint.trim() : "";
  const p256dh = typeof sub.keys?.p256dh === "string" ? sub.keys.p256dh.trim() : "";
  const auth = typeof sub.keys?.auth === "string" ? sub.keys.auth.trim() : "";
  if (!endpoint || endpoint.length > 2048) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  // Push keys are unpadded base64url; real values are ~87 / ~22 chars.
  if (!/^[A-Za-z0-9_-]+$/.test(p256dh) || p256dh.length < 30 || p256dh.length > 200) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(auth) || auth.length < 10 || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as
    | { subscription?: unknown; endpoint?: unknown; keys?: unknown }
    | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const subscription = validSubscription(body.subscription ?? body);
  if (!subscription) {
    return NextResponse.json(
      { error: "A valid push subscription (https endpoint + keys) is required." },
      { status: 422 },
    );
  }
  try {
    await ensureSchema();
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300);
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         updated_at = now()`,
      [auth.user.id, subscription.endpoint, subscription.p256dh, subscription.auth, userAgent],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
