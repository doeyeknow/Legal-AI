import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { APP_MEMBERSHIP, syncLifetimeRefund, syncMembershipCheckout, syncRecurringMembership } from '@/lib/membership';
import { stripeKeyStatus } from '@/lib/stripe-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET?.trim();
  const key = stripeKeyStatus();
  if (!secret || !key.ok) return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 });
  const stripe = new Stripe(key.key);
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature, secret); }
  catch { return NextResponse.json({ error: 'invalid_signature' }, { status: 400 }); }
  if (event.livemode !== (key.mode === 'live')) return NextResponse.json({ error: 'wrong_mode' }, { status: 400 });
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (event.data.object.metadata?.product === APP_MEMBERSHIP) {
          await syncMembershipCheckout(stripe, event.data.object.id);
        }
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        if (event.data.object.metadata?.product === APP_MEMBERSHIP) {
          await syncRecurringMembership(stripe, event.data.object.id);
        }
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const subscription = event.data.object.parent?.subscription_details?.subscription;
        if (subscription) await syncRecurringMembership(stripe, typeof subscription === 'string' ? subscription : subscription.id);
        break;
      }
      case 'charge.refunded': {
        const intent = event.data.object.payment_intent;
        if (intent && event.data.object.refunded) await syncLifetimeRefund(stripe, typeof intent === 'string' ? intent : intent.id);
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch {
    // Stripe retries delivery on server errors.
    return NextResponse.json({ error: 'fulfillment_failed' }, { status: 500 });
  }
}
