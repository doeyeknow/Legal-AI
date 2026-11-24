import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { dbUnavailable, requireAccount } from '@/lib/api-guard';
import { checkoutOrigin } from '@/lib/checkout-origin';
import { ensureSchema, getPool } from '@/lib/db';
import { activeMembership, APP_MEMBERSHIP, recurringCustomer, syncMembershipCheckout } from '@/lib/membership';
import { isMembershipPlan, MEMBERSHIP_PLANS, type MembershipPlan } from '@/lib/plans';
import { stripeKeyStatus } from '@/lib/stripe-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const account = await requireAccount(req);
  if ('error' in account) return account.error;
  try {
    const membership = await activeMembership(account.user.id);
    return NextResponse.json({ plan: membership?.plan || null, canManage: Boolean(await recurringCustomer(account.user.id)) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return dbUnavailable(); }
}

export async function POST(req: NextRequest) {
  const account = await requireAccount(req);
  if ('error' in account) return account.error;
  const origin = checkoutOrigin(req);
  if (!origin) return NextResponse.json({ message: 'Open this page on the official quikForm site.' }, { status: 403 });
  const userId = account.user.id;
  const body = await req.json().catch(() => null);
  const key = stripeKeyStatus();
  if (!key.ok) return NextResponse.json({ message: 'Membership billing is not available right now.' }, { status: 503 });
  const stripe = new Stripe(key.key, { timeout: 8000, maxNetworkRetries: 1 });
  const back = `${origin}/membership${body?.returnTo === 'interview' ? '?return=interview' : ''}`;
  try {
    if (body?.action === 'confirm') {
      if (typeof body.sessionId !== 'string' || !/^cs_[a-zA-Z0-9_]{8,200}$/.test(body.sessionId)) {
        return NextResponse.json({ message: 'Invalid checkout session.' }, { status: 400 });
      }
      const linked = await syncMembershipCheckout(stripe, body.sessionId, userId);
      const membership = linked ? await activeMembership(userId) : null;
      return membership
        ? NextResponse.json({ plan: membership.plan })
        : NextResponse.json({ message: 'Membership is not active for this account yet. If you just paid, wait a moment and check again.' }, { status: 409 });
    }
    if (body?.action === 'portal') {
      const customer = await recurringCustomer(userId);
      if (!customer) return NextResponse.json({ message: 'No recurring billing account was found.' }, { status: 404 });
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: back });
      return NextResponse.json({ url: portal.url });
    }
    if (body?.action !== 'checkout' || !isMembershipPlan(body?.plan)) {
      return NextResponse.json({ message: 'Choose a membership plan.' }, { status: 400 });
    }
    const plan: MembershipPlan = body.plan;
    const details = MEMBERSHIP_PLANS[plan];
    const priceId = process.env[`STRIPE_MEMBERSHIP_${plan.toUpperCase()}_PRICE_ID`]?.trim();
    if (!priceId?.startsWith('price_') || !process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET?.trim()) {
      return NextResponse.json({ message: 'This plan is not available right now. You can still buy an individual motion.' }, { status: 503 });
    }
    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // Serialize plan checkout on this account; a second tab cannot create a second chargeable session.
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (await activeMembership(userId, client)) {
        await client.query('COMMIT');
        return NextResponse.json({ message: 'You already have an active membership. Manage billing instead.' }, { status: 409 });
      }
      const { rows } = await client.query<{ stripe_session: string }>(
        'SELECT stripe_session FROM membership_checkouts WHERE user_id = $1', [userId]);
      const previous = rows[0]?.stripe_session;
      const cancel = `${back}${back.includes('?') ? '&' : '?'}cancelled=1`;
      const success = `${back}${back.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
      if (previous) {
        const old = await stripe.checkout.sessions.retrieve(previous);
        if (old.status === 'open') {
          if (old.metadata?.plan === plan && old.success_url === success && old.url) {
            await client.query('COMMIT');
            return NextResponse.json({ url: old.url });
          }
          await stripe.checkout.sessions.expire(previous);
        } else if (old.status === 'complete') {
          await syncMembershipCheckout(stripe, previous, userId, client);
          if (await activeMembership(userId, client)) {
            await client.query('COMMIT');
            return NextResponse.json({ message: 'Your membership is already active. Refresh this page to continue.' }, { status: 409 });
          }
        }
      }
      // A failed payment can suspend tool access while Stripe is still retrying.
      // Don't sell a second plan that could charge alongside the first.
      const recurring = (await client.query<{ stripe_source: string }>(
        `SELECT stripe_source FROM membership_grants WHERE user_id = $1 AND plan <> 'lifetime'
         ORDER BY checked_at DESC LIMIT 1`, [userId])).rows[0]?.stripe_source;
      if (recurring) {
        const subscription = await stripe.subscriptions.retrieve(recurring);
        if (subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired') {
          await client.query('COMMIT');
          return NextResponse.json({ message: 'You already have a subscription with Stripe. Use Manage billing to fix payment or cancel it before choosing another plan.' }, { status: 409 });
        }
      }
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active || price.currency !== 'usd' || price.unit_amount !== details.amount ||
          price.livemode !== (key.mode === 'live') ||
          (details.interval ? price.recurring?.interval !== details.interval || price.recurring.interval_count !== 1 : price.type !== 'one_time')) {
        await client.query('ROLLBACK');
        return NextResponse.json({ message: 'This plan is temporarily unavailable.' }, { status: 503 });
      }
      const customer = (await client.query<{ stripe_customer: string }>(
        `SELECT stripe_customer FROM membership_grants WHERE user_id = $1 AND stripe_customer IS NOT NULL
         ORDER BY (plan <> 'lifetime') DESC, checked_at DESC LIMIT 1`, [userId])).rows[0]?.stripe_customer;
      const metadata = { product: APP_MEMBERSHIP, plan, userId };
      const session = await stripe.checkout.sessions.create({
        mode: details.interval ? 'subscription' : 'payment',
        allowed_payment_method_types: ['card'],
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: userId,
        ...(customer ? { customer } : { customer_email: account.user.email }),
        metadata,
        ...(details.interval ? { subscription_data: { metadata } } : { customer_creation: customer ? undefined : 'always' }),
        success_url: success,
        cancel_url: cancel,
      }, { idempotencyKey: `membership:${createHash('sha256').update(JSON.stringify([userId, previous, plan, price.id, back])).digest('hex')}` });
      await client.query(`INSERT INTO membership_checkouts (user_id, stripe_session) VALUES ($1,$2)
        ON CONFLICT (user_id) DO UPDATE SET stripe_session = EXCLUDED.stripe_session`, [userId, session.id]);
      await client.query('COMMIT');
      return NextResponse.json({ url: session.url });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  } catch {
    return NextResponse.json({ message: 'Stripe billing could not be reached. Please try again shortly.' }, { status: 502 });
  }
}
