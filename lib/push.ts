// Web Push for new court mail. Mirrors the proven taosHouse
// implementation (taos-homelink-app/lib/push.ts), trimmed to this
// app's one use: a signed-in user's opted-in browsers learn that a
// new court email arrived in their inbox.
//
// Privacy-first by design: the payload names ONLY the sender. No
// subject line, case number, date, or body excerpt ever leaves the
// server inside a notification — a push is visible on a lock screen.
//
// Nothing in this module throws into ingestion: a missing VAPID
// configuration skips sending silently, a dead endpoint (404/410
// from the push service) is pruned, and every failure is swallowed.

import webpush from "web-push";
import { query } from "./db";

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  created_at: string;
  updated_at: string;
}

export interface CourtMailPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** The one notification this app sends. Exported pure so the
 *  privacy shape (sender only, never content) is unit-testable. */
export function courtMailPayload(senderLabel: string): CourtMailPayload {
  const sender = (senderLabel || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return {
    title: "New court mail",
    body: sender ? `${sender} sent you court mail` : "You have new court mail.",
    url: "/dashboard/inbox",
    tag: "quikform-court-mail",
  };
}

function vapidConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    return false;
  }
}

function dedupe(subscriptions: PushSubscriptionRow[]): PushSubscriptionRow[] {
  const byEndpoint = new Map<string, PushSubscriptionRow>();
  for (const sub of subscriptions) byEndpoint.set(sub.endpoint, sub);
  return [...byEndpoint.values()];
}

async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: CourtMailPayload,
): Promise<void> {
  const subs = dedupe(subscriptions);
  if (subs.length === 0) return;
  // Unconfigured VAPID keys: skip silently. Ingestion must never
  // break because push is not set up yet.
  if (!vapidConfigured()) return;
  const body = JSON.stringify(payload);
  for (const sub of subs) {
    let dead = false;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 24 * 60 * 60 },
      );
    } catch (err) {
      const code = (err as { statusCode?: unknown })?.statusCode;
      dead = code === 404 || code === 410;
    }
    if (dead) {
      try {
        await query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
      } catch {
        // Best effort only.
      }
    }
  }
}

/** Push a new-court-mail notification to one user's subscriptions.
 *  Never throws; never sends when unconfigured or unsubscribed. */
export async function notifyNewCourtMail(
  userId: string,
  senderLabel: string,
): Promise<void> {
  try {
    if (!userId) return;
    const subscriptions = await query<PushSubscriptionRow>(
      `SELECT * FROM push_subscriptions WHERE user_id = $1`,
      [userId],
    );
    await sendPushToSubscriptions(subscriptions, courtMailPayload(senderLabel));
  } catch {
    // Push must never break mail ingestion.
  }
}
