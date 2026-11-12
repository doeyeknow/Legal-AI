import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import {
  APP_SENT_STATUS_PREFIX,
  addComm,
  countAppSentComms,
  getOwnedCaseLite,
} from '@/lib/cases';
import { formatFromHeader, sendViaResend } from '@/lib/comm-send';
import { getOrMintInboxAddress } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/comms/send — send a drafted court communication by
// email, from the SIGNED-IN USER'S OWN court-mail address
// (<slug>-<token>@inbox domain), through Resend.
//
// Body: { caseId, to, subject, body } — one recipient, plain
// text. The From is minted server-side from the user's own inbox
// address and is NEVER taken from the request; reply_to is the
// same address, so replies land back in the user's inbox and get
// scanned like all inbound mail.
//
// Only a successful send is written to the case's comm log
// (direction 'to_court', method 'Email', the Resend message id in
// the status). A failed send records nothing — the log must never
// show a communication as sent that wasn't.
//
// Guardrails: the case must belong to the user; subject/body caps
// match the comm log's (300 / 8000); per-user rate limit of
// SENDS_PER_HOUR per rolling hour and SENDS_PER_DAY per rolling
// day, counted from the log's own sent markers.
const SENDS_PER_HOUR = 20;
const SENDS_PER_DAY = 50;
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'sending_not_configured',
        message:
          'Email sending is not set up yet — copy the draft and send it through the court’s own channels for now.',
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const caseId = typeof body?.caseId === 'string' ? body.caseId : '';
  if (!caseId) {
    return NextResponse.json({ error: 'A case is required.' }, { status: 400 });
  }
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  if (to.length > 254 || !EMAIL_RE.test(to)) {
    return NextResponse.json(
      { error: 'Enter one valid recipient email address.' },
      { status: 400 },
    );
  }
  const subject = cleanStr(body?.subject, 300);
  if (!subject) {
    return NextResponse.json({ error: 'A subject is required.' }, { status: 400 });
  }
  const text = cleanStr(body?.body, 8000);
  if (!text) {
    return NextResponse.json({ error: 'The email body is empty.' }, { status: 400 });
  }

  try {
    const lite = await getOwnedCaseLite(g.user.id, caseId);
    if (!lite) return notFound();

    const [perHour, perDay] = await Promise.all([
      countAppSentComms(g.user.id, 60),
      countAppSentComms(g.user.id, 24 * 60),
    ]);
    if (perHour >= SENDS_PER_HOUR || perDay >= SENDS_PER_DAY) {
      return NextResponse.json(
        {
          error: 'send_limit_reached',
          message:
            'You have reached the email sending limit for now — copy the draft and send it through the court’s own channels, or try again later.',
        },
        { status: 429 },
      );
    }

    const { address } = await getOrMintInboxAddress(g.user.id);
    const from = formatFromHeader(g.user.fullName, address);
    const sent = await sendViaResend({
      apiKey,
      from,
      to,
      subject,
      text,
      replyTo: address,
    });
    if (!sent.ok) {
      return NextResponse.json(
        {
          error: sent.kind === 'domain_not_verified' ? 'domain_not_verified' : 'send_failed',
          message: sent.message,
        },
        { status: 502 },
      );
    }

    const comm = await addComm(g.user.id, caseId, {
      direction: 'to_court',
      method: 'Email',
      subject,
      body: text,
      sentAt: new Date().toISOString().slice(0, 10),
      responseDeadline: null,
      status: `${APP_SENT_STATUS_PREFIX}${to} from ${address} (Resend ${sent.id})`,
    });
    return NextResponse.json({ ok: true, from: address, to, id: sent.id, comm });
  } catch {
    return dbUnavailable();
  }
}
