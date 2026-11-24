import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { APP_SENT_STATUS_PREFIX, addComm, countAppSentComms } from '@/lib/cases';
import { formatFromHeader, sendViaResend } from '@/lib/comm-send';
import {
  applyMailboxAction,
  countInboxSends,
  getOrMintInboxAddress,
  getReplyContext,
  recordInboxReply,
} from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/inbox/[id]/reply — reply to (or forward) one piece of
// court mail, from the user's OWN court-mail address via Resend.
//
// Body: { kind: 'reply' | 'forward', to, subject, body }
// A reply threads under the original (In-Reply-To / References).
// Sending is one deliberate tap in the compose sheet — nothing is
// ever sent automatically. Only a successful send is recorded:
// in inbox_replies (shown under the message) and, when the mail
// is assigned to a case, in that case's communication log.
//
// Shares the per-user send limits with /api/comms/send.
const SENDS_PER_HOUR = 20;
const SENDS_PER_DAY = 50;
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'sending_not_configured',
        message:
          'Email sending is not set up yet — copy your reply and send it from your own email for now.',
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = body?.kind === 'forward' ? 'forward' : 'reply';
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  if (to.length > 254 || !EMAIL_RE.test(to)) {
    return NextResponse.json({ error: 'Enter one valid recipient email address.' }, { status: 400 });
  }
  const subject = cleanStr(body?.subject, 300);
  if (!subject) return NextResponse.json({ error: 'A subject is required.' }, { status: 400 });
  const text = cleanStr(body?.body, 20000);
  if (!text) return NextResponse.json({ error: 'The message is empty.' }, { status: 400 });

  try {
    const ctx = await getReplyContext(g.user.id, params.id);
    if (!ctx) return notFound();

    const [caseHour, caseDay, inboxHour, inboxDay] = await Promise.all([
      countAppSentComms(g.user.id, 60),
      countAppSentComms(g.user.id, 24 * 60),
      countInboxSends(g.user.id, 60),
      countInboxSends(g.user.id, 24 * 60),
    ]);
    // Replies on an assigned case are logged in BOTH places, so take
    // the larger count rather than the sum to avoid double counting.
    if (Math.max(caseHour, inboxHour) >= SENDS_PER_HOUR || Math.max(caseDay, inboxDay) >= SENDS_PER_DAY) {
      return NextResponse.json(
        {
          error: 'send_limit_reached',
          message: 'You have reached the email sending limit for now — try again later.',
        },
        { status: 429 },
      );
    }

    const { address } = await getOrMintInboxAddress(g.user.id);
    const headers: Record<string, string> = {};
    if (kind === 'reply' && ctx.messageIdHeader) {
      const mid = ctx.messageIdHeader.startsWith('<') ? ctx.messageIdHeader : `<${ctx.messageIdHeader}>`;
      headers['In-Reply-To'] = mid;
      headers['References'] = mid;
    }
    const sent = await sendViaResend({
      apiKey,
      from: formatFromHeader(g.user.fullName, address),
      to,
      subject,
      text,
      replyTo: address,
      headers,
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

    const reply = await recordInboxReply({
      userId: g.user.id,
      messageId: params.id,
      kind,
      toEmail: to,
      subject,
      body: text,
      providerId: sent.id,
    });
    await applyMailboxAction(g.user.id, [params.id], 'read');
    if (ctx.caseId) {
      await addComm(g.user.id, ctx.caseId, {
        direction: 'to_court',
        method: 'Email',
        subject,
        body: text,
        sentAt: new Date().toISOString().slice(0, 10),
        responseDeadline: null,
        status: `${APP_SENT_STATUS_PREFIX}${to} from ${address} (Resend ${sent.id})`,
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true, from: address, reply });
  } catch {
    return dbUnavailable();
  }
}
