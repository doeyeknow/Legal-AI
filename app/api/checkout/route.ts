import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getMotion } from '@/lib/motions/match';
import { isValidCoupon, isValidFreeWeekCoupon } from '@/lib/promo';
import { stripeKeyStatus, stripeProblemMessage } from '@/lib/stripe-config';
import { getSessionUser } from '@/lib/auth';
import { activeMembership, grantFreeWeek } from '@/lib/membership';
import { MOTION_PRICE } from '@/lib/plans';
import { localFreeDownload, MOTION_PRODUCT, packetHash } from '@/lib/motion-payment';
import { checkoutOrigin } from '@/lib/checkout-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Payment status for the site owner: whether the server can see a
// usable Stripe key, its mode, and which setting it came from. The
// key itself is never returned.
export async function GET() {
  const s = stripeKeyStatus();
  return NextResponse.json(
    s.ok
      ? { configured: true, mode: s.mode, setting: s.source }
      : { configured: false, problem: s.problem, setting: s.source, message: stripeProblemMessage(s) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// $5 for a single motion PDF with filing instructions.
// If STRIPE_SECRET_KEY is absent we fail soft with a clear message —
// the PDF is never given away silently. LEGAL_DEV_FREE=1 is a local
// development bypass only.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) || {};
  const motion = getMotion(String(body.motionId || ''));
  if (!motion) {
    return NextResponse.json({ error: 'unknown_motion', message: 'That motion is not in the library.' }, { status: 400 });
  }
  if (typeof body.answers?.fullName !== 'string' || !body.answers.fullName.trim() ||
      typeof body.answers?.zip !== 'string' || !body.answers.zip.trim()) {
    return NextResponse.json({ message: 'The interview answers are incomplete.' }, { status: 400 });
  }
  const user = await getSessionUser(req);
  if (user && await activeMembership(user.id).catch(() => null)) {
    return NextResponse.json({ ok: true, member: true });
  }
  if (body.memberOnly === true) {
    return NextResponse.json({ error: 'membership_required', message: 'Your membership is not active. Renew or choose the $5 one-time purchase.' }, { status: 403 });
  }

  // A coupon code makes the document free — checked before the
  // payment configuration, so coupons work whether or not Stripe
  // is set up. A code that was typed but does not match is a clear
  // error, never a silent charge.
  if (typeof body.coupon === 'string' && body.coupon.trim()) {
    if (isValidCoupon(body.coupon)) {
      return NextResponse.json({ ok: true, couponFree: true });
    }
    if (isValidFreeWeekCoupon(body.coupon)) {
      if (!user) {
        return NextResponse.json(
          { error: 'free_week_sign_in_required', message: 'Sign in or create a free account to redeem that free-week promo code.' },
          { status: 401 }
        );
      }
      try {
        const result = await grantFreeWeek(user.id);
        if (!('error' in result) || result.error === 'already_active') {
          return NextResponse.json({ ok: true, member: true });
        }
        return NextResponse.json(
          { error: 'free_week_already_redeemed', message: 'That free week was already used on this account.' },
          { status: 409 }
        );
      } catch (e) {
        console.error('[free-week checkout] failed', e instanceof Error ? e.message : e);
        return NextResponse.json(
          { error: 'free_week_failed', message: 'The free week could not be redeemed right now. Try again shortly.' },
          { status: 502 }
        );
      }
    }
    return NextResponse.json(
      { error: 'coupon_invalid', message: "That coupon code doesn't look right. Check it or continue without it for $5." },
      { status: 400 }
    );
  }

  if (localFreeDownload()) {
    return NextResponse.json({ ok: true, devFree: true });
  }

  const ks = stripeKeyStatus();
  if (!ks.ok) {
    return NextResponse.json(
      { error: 'payments_not_configured', message: stripeProblemMessage(ks) },
      { status: 503 }
    );
  }
  const key = ks.key;

  const origin = checkoutOrigin(req);
  if (!origin) return NextResponse.json({ message: 'Open this page on the official quikForm site.' }, { status: 403 });
  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded_page',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: MOTION_PRICE,
            product_data: {
              name: `${motion.name} — prepared document (PDF)`,
              description: 'One motion PDF with filing instructions, prepared from your answers. No subscription.',
            },
          },
          quantity: 1,
        },
      ],
      allowed_payment_method_types: ['card'],
      metadata: { motionId: motion.id, product: MOTION_PRODUCT, packetHash: packetHash(key, motion.id, body) },
      return_url: `${origin}/interview?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      branding_settings: { display_name: 'quikForm', button_color: '#D9A62E', border_style: 'rounded' },
    });
    return NextResponse.json({ ok: true, clientSecret: session.client_secret, sessionId: session.id });
  } catch (e) {
    console.error('Stripe checkout failed:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'checkout_failed', message: 'Checkout could not be started. No charge was made. Please try again in a moment.' },
      { status: 502 }
    );
  }
}
