import { createHmac } from 'node:crypto';
import type Stripe from 'stripe';
import { ensureSchema, query } from './db';
import { MOTION_PRICE } from './plans';

export const MOTION_PRODUCT = 'quikform-motion-packet-v1';
const LEGACY_PRODUCT = 'legal-eyeknow-document';

export function packetHash(key: string, motionId: string, body: Record<string, unknown>): string {
  const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
    ? Object.entries(body.answers).filter(([, value]) => typeof value === 'string').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    : [];
  return createHmac('sha256', process.env.SESSION_SECRET || key).update(JSON.stringify([
    motionId, answers, typeof body.signature === 'string' ? body.signature : null, body.feeWaiverAdded === true,
  ])).digest('hex');
}

export function localFreeDownload(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.LEGAL_DEV_FREE === '1';
}

export function sessionAllowsPacket(session: Stripe.Checkout.Session, motionId: string, hash: string): 'current' | 'legacy' | null {
  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const charge = typeof intent?.latest_charge === 'object' ? intent.latest_charge : null;
  if (session.status !== 'complete' || session.mode !== 'payment' || session.currency !== 'usd' ||
      session.payment_status !== 'paid' || intent?.status !== 'succeeded' || !charge || charge.refunded ||
      session.metadata?.motionId !== motionId) return null;
  if (session.metadata.product === MOTION_PRODUCT && session.amount_total === MOTION_PRICE &&
      session.metadata.packetHash === hash) return 'current';
  if (session.metadata.product === LEGACY_PRODUCT && session.amount_total === 300) return 'legacy';
  return null;
}

/** Honor an already-paid $3 session, but bind it to the first packet redeemed. */
export async function claimLegacyPacket(sessionId: string, hash: string): Promise<boolean> {
  await ensureSchema();
  const rows = await query(
    `INSERT INTO legacy_motion_downloads (stripe_session, packet_hash) VALUES ($1,$2)
     ON CONFLICT (stripe_session) DO UPDATE SET packet_hash = EXCLUDED.packet_hash
     WHERE legacy_motion_downloads.packet_hash = EXCLUDED.packet_hash RETURNING stripe_session`,
    [sessionId, hash]);
  return rows.length > 0;
}
