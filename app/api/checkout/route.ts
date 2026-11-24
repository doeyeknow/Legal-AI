import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getMotion } from '@/lib/motions/match';
import { isValidCoupon } from '@/lib/promo';
import { stripeKeyStatus, stripeProblemMessage } from '@/lib/stripe-config';

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

// $3 per document, charged at PDF generation/download.
// If STRIPE_SECRET_KEY is absent we fail soft with a clear message —
// the PDF is never given away silently. LEGAL_DEV_FREE=1 is a local
// development bypass only.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const motion = getMotion(String(body.motionId || ''));
  if (!motion) {
    return NextResponse.json({ error: 'unknown_motion', message: 'That motion is not in the library.' }, { status: 400 });
  }

  // A coupon code makes the document free — checked before the
  // payment configuration, so coupons work whether or not Stripe
  // is set up. A code that was typed but does not match is a clear
  // error, never a silent charge.
  if (typeof body.coupon === 'string' && body.coupon.trim()) {
    if (isValidCoupon(body.coupon)) {
      return NextResponse.json({ ok: true, couponFree: true });
    }
    return NextResponse.json(
      { error: 'coupon_invalid', message: "That coupon code doesn't look right — check it and try again, or continue without one for $3." },
      { status: 400 }
    );
  }

  if (process.env.LEGAL_DEV_FREE === '1') {
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

  const origin = req.headers.get('origin') || 'http://localhost:3300';
  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 300,
            product_data: {
              name: `${motion.name} — prepared document (PDF)`,
              description: 'Filing-ready motion document prepared from your answers. Document preparation, not a law firm — this is not legal advice.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: { motionId: motion.id, product: 'legal-eyeknow-document' },
      success_url: `${origin}/interview?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/interview?payment=cancelled`,
    });
    return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Stripe checkout failed:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'checkout_failed', message: 'Checkout could not be started. No charge was made. Please try again in a moment.' },
      { status: 502 }
    );
  }
}
