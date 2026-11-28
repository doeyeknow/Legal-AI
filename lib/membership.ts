import type Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { ensureSchema, query } from './db';
import { isMembershipPlan, MEMBERSHIP_PLANS, type MembershipPlan } from './plans';

export const APP_MEMBERSHIP = 'quikform-membership-v1';
type Grant = { plan: MembershipPlan; stripe_customer: string | null; valid_until: Date | null };

export async function activeMembership(userId: string, client?: PoolClient): Promise<Grant | null> {
  if (!client) await ensureSchema();
  const sql = `SELECT plan, stripe_customer, valid_until FROM membership_grants
     WHERE user_id = $1 AND active AND (plan = 'lifetime' OR valid_until > now())
     ORDER BY (plan = 'lifetime') DESC, valid_until DESC LIMIT 1`;
  const rows = client ? (await client.query<Grant>(sql, [userId])).rows : await query<Grant>(sql, [userId]);
  return rows[0] || null;
}

export async function recurringCustomer(userId: string): Promise<string | null> {
  await ensureSchema();
  const rows = await query<{ stripe_customer: string }>(
    `SELECT stripe_customer FROM membership_grants WHERE user_id = $1
     AND plan <> 'lifetime' AND stripe_customer IS NOT NULL ORDER BY active DESC, checked_at DESC LIMIT 1`, [userId]);
  return rows[0]?.stripe_customer || null;
}

function id(object: string | { id: string } | null | undefined): string | null {
  return typeof object === 'string' ? object : object?.id || null;
}

async function recordGrant(g: {
  source: string; userId: string; customer: string | null; plan: MembershipPlan;
  active: boolean; until: Date | null; checkedAt: Date;
}, client?: PoolClient) {
  if (!client) await ensureSchema();
  const sql = `INSERT INTO membership_grants (stripe_source, user_id, stripe_customer, plan, active, valid_until, checked_at)
    SELECT $1, id, $3, $4, $5, $6, $7 FROM users WHERE id = $2
    ON CONFLICT (stripe_source) DO UPDATE SET stripe_customer = EXCLUDED.stripe_customer,
      plan = EXCLUDED.plan, active = EXCLUDED.active, valid_until = EXCLUDED.valid_until, checked_at = EXCLUDED.checked_at
    WHERE membership_grants.user_id = EXCLUDED.user_id AND membership_grants.checked_at <= EXCLUDED.checked_at`;
  const values = [g.source, g.userId, g.customer, g.plan, g.active, g.until, g.checkedAt];
  if (client) await client.query(sql, values);
  else await query(sql, values);
}

export async function syncRecurringMembership(stripe: Stripe, subscriptionId: string, account?: string, client?: PoolClient) {
  const checkedAt = new Date();
  // Retrieve current Stripe state instead of applying potentially out-of-order event snapshots.
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
  const { product, plan, userId } = sub.metadata;
  if (product !== APP_MEMBERSHIP || !isMembershipPlan(plan) || plan === 'lifetime' || !userId ||
      (account && userId !== account)) return;
  const item = sub.items.data[0];
  const price = item?.price;
  const allowed = sub.items.data.length === 1 && item.quantity === 1 &&
    price.currency === 'usd' && price.unit_amount === MEMBERSHIP_PLANS[plan].amount &&
    price.recurring?.interval === MEMBERSHIP_PLANS[plan].interval && price.recurring.interval_count === 1;
  const invoicePaid = typeof sub.latest_invoice === 'object' && sub.latest_invoice?.status === 'paid';
  const end = item?.current_period_end;
  await recordGrant({
    source: sub.id, userId, customer: id(sub.customer), plan, checkedAt,
    active: Boolean(allowed && end && sub.status === 'active' && invoicePaid),
    until: end ? new Date(Math.min(end, sub.cancel_at || end) * 1000) : null,
  }, client);
}

export async function syncMembershipCheckout(stripe: Stripe, sessionId: string, account?: string, client?: PoolClient) {
  const checkedAt = new Date();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge'] });
  const { product, plan, userId } = session.metadata || {};
  if (product !== APP_MEMBERSHIP || !isMembershipPlan(plan) || !userId ||
      session.client_reference_id !== userId || (account && account !== userId) ||
      session.status !== 'complete') return false;
  if (plan !== 'lifetime') {
    const subscription = id(session.subscription);
    if (session.mode !== 'subscription' || !subscription) return false;
    await syncRecurringMembership(stripe, subscription, userId, client);
    return true;
  }
  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const charge = typeof intent?.latest_charge === 'object' ? intent.latest_charge : null;
  if (session.mode !== 'payment' || session.currency !== 'usd' ||
      session.amount_total !== MEMBERSHIP_PLANS.lifetime.amount || !intent || !charge) return false;
  await recordGrant({
    source: intent.id, userId, customer: id(session.customer), plan, checkedAt, until: null,
    active: session.payment_status === 'paid' && intent.status === 'succeeded' && !charge.refunded,
  }, client);
  return true;
}

/** Grant one free week of weekly membership from a coupon code —
 *  no Stripe involved. One free week per account, ever: the grant's
 *  source names the account, so a second redemption finds the
 *  first row and is refused. The grant behaves like a paid weekly
 *  membership (activeMembership, dashboard access) until its
 *  valid_until passes; it carries no Stripe customer, so there is
 *  nothing to manage or cancel. */
export async function grantFreeWeek(userId: string): Promise<{ ok: true } | { error: 'already_active' | 'already_redeemed' }> {
  await ensureSchema();
  if (await activeMembership(userId)) return { error: 'already_active' };
  const source = `coupon-free-week:${userId}`;
  const prior = await query<{ stripe_source: string }>(
    `SELECT stripe_source FROM membership_grants WHERE user_id = $1 AND stripe_source = $2 LIMIT 1`, [userId, source]);
  if (prior.length) return { error: 'already_redeemed' };
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await recordGrant({
    source, userId, customer: null, plan: 'weekly', active: true, until, checkedAt: new Date(),
  });
  const active = await activeMembership(userId);
  if (!active) throw new Error('free-week grant was not recorded');
  return { ok: true };
}

export async function syncLifetimeRefund(stripe: Stripe, paymentIntent: string) {
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 5 });
  for (const session of sessions.data) {
    if (session.metadata?.product === APP_MEMBERSHIP && session.metadata.plan === 'lifetime') {
      await syncMembershipCheckout(stripe, session.id);
    }
  }
}
