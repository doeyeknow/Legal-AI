import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getMotion } from '@/lib/motions/match';
import { generateMotionPdf } from '@/lib/pdf';
import { getSessionUser } from '@/lib/auth';
import { getOwnedCaseLite, saveDocumentForUser } from '@/lib/cases';
import { getCaseFacts } from '@/lib/inbox';
import { isValidCoupon } from '@/lib/promo';
import type { Answers } from '@/lib/motions/types';

export const runtime = 'nodejs';

// Generates the PDF only after payment is verified (Stripe session paid,
// $3.00), or under the local-only LEGAL_DEV_FREE=1 bypass.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const motion = getMotion(String(body.motionId || ''));
  if (!motion) {
    return NextResponse.json({ error: 'unknown_motion' }, { status: 400 });
  }
  const answers = (body.answers || {}) as Answers;
  if (!answers.fullName || !answers.zip) {
    return NextResponse.json({ error: 'incomplete', message: 'The interview answers are incomplete.' }, { status: 400 });
  }

  const devFree = process.env.LEGAL_DEV_FREE === '1';
  // A valid coupon makes the document free, with or without Stripe
  // configured. The code is re-validated here — the client saying
  // "coupon" is never enough on its own.
  const couponFree = isValidCoupon(body.coupon);
  if (!devFree && !couponFree) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return NextResponse.json(
        { error: 'payments_not_configured', message: 'Payments are not configured yet.' },
        { status: 503 }
      );
    }
    const sessionId = String(body.sessionId || '');
    if (!sessionId) {
      return NextResponse.json({ error: 'payment_required', message: 'Payment is required before the document is generated.' }, { status: 402 });
    }
    try {
      const stripe = new Stripe(key);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid' || session.amount_total !== 300) {
        return NextResponse.json({ error: 'payment_not_completed', message: 'That payment has not completed.' }, { status: 402 });
      }
    } catch {
      return NextResponse.json({ error: 'payment_check_failed', message: 'We could not verify that payment.' }, { status: 402 });
    }
  }

  // Court-mail facts: when the interview ran against a case the
  // signed-in user owns, the CONFIRMED-facts bag underlays the
  // answers in the generator (answers always win) and is snapshotted
  // onto the saved document so a re-download reproduces it exactly.
  // Unconfirmed facts are never in the bag — see lib/inbox.ts.
  let caseFactsBag: Answers | undefined;
  let ownedCaseId: string | null = null;
  const user = await getSessionUser(req).catch(() => null);
  if (user && typeof body.caseId === 'string' && body.caseId) {
    try {
      const lite = await getOwnedCaseLite(user.id, body.caseId);
      if (lite) {
        ownedCaseId = lite.id;
        const { facts } = await getCaseFacts(user.id, lite.id);
        if (Object.keys(facts).length) caseFactsBag = facts;
      }
    } catch {
      caseFactsBag = undefined;
      ownedCaseId = null;
    }
  }

  const pdf = await generateMotionPdf({
    motion,
    answers,
    signaturePngDataUrl: typeof body.signature === 'string' ? body.signature : null,
    feeWaiverAdded: body.feeWaiverAdded === true,
    caseFacts: caseFactsBag,
  });

  // Dashboard save: a signed-in user's finished document is filed to
  // their case (created or attached by case number). Best-effort —
  // a failed save never blocks the download they paid for; guests
  // skip this entirely and their flow is unchanged.
  let savedCaseId: string | null = null;
  try {
    if (user) {
      savedCaseId = await saveDocumentForUser(user.id, {
        motion,
        answers,
        feeWaiver: body.feeWaiverAdded === true,
        relation: body.forWhom === 'other' ? 'other' : 'self',
        // An interview resumed from (or autosaved as) a draft
        // completes THAT case instead of creating a duplicate.
        draftId: typeof body.draftId === 'string' && body.draftId ? body.draftId : null,
        caseId: ownedCaseId,
        caseFacts: caseFactsBag || null,
      });
    }
  } catch {
    savedCaseId = null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${motion.id}.pdf"`,
  };
  if (savedCaseId) headers['x-legal-case-id'] = savedCaseId;

  return new NextResponse(Buffer.from(pdf), { status: 200, headers });
}
