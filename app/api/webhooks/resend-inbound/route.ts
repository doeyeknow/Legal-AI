import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { dbConfigured } from '@/lib/db';
import { inboxDomain, resolveInboxLocal, storeInboundMessage } from '@/lib/inbox';

// POST /api/webhooks/resend-inbound — Resend inbound (email.received).
//
// Phase 1 wiring: complete but INERT until Adam finishes the
// provider setup (design §8): the receiving domain verified in
// Resend, this webhook created there, and RESEND_API_KEY +
// RESEND_WEBHOOK_SECRET in the Vercel env. Without the secret this
// route answers 503 inbox_not_configured and processes nothing.
//
// The webhook payload is metadata only — the body and attachments
// come from Resend's Receiving API, fetched at ingestion because
// attachment signed URLs expire within about an hour. Unknown
// recipient addresses are dead-lettered WITHOUT fetching anything.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function verifySvix(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigHeader = headers.get('svix-signature');
  if (!id || !ts || !sigHeader) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  const keyB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(keyB64, 'base64');
  } catch {
    return false;
  }
  const expected = createHmac('sha256', key)
    .update(`${id}.${ts}.${rawBody}`)
    .digest('base64');
  for (const part of sigHeader.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

interface ResendReceived {
  id?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  message_id?: string;
  attachments?: { id?: string; filename?: string; content_type?: string; size?: number }[];
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) {
    return NextResponse.json({ error: 'inbox_not_configured' }, { status: 503 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  }
  const raw = await req.text();
  if (!verifySvix(raw, req.headers, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
  let payload: {
    type?: string;
    data?: {
      email_id?: string;
      from?: string;
      to?: string[];
      cc?: string[];
      subject?: string;
      message_id?: string;
      created_at?: string;
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (payload.type !== 'email.received' || !payload.data?.email_id) {
    return NextResponse.json({ received: true, ignored: true });
  }
  const data = payload.data;
  const domain = inboxDomain();
  const recipients = [...(data.to || []), ...(data.cc || [])];
  const localPart = recipients
    .map((r) => {
      const m = r.toLowerCase().match(/<?([^@<>\s]+)@([^>\s]+)>?$/);
      return m && m[2] === domain ? m[1] : null;
    })
    .find(Boolean) as string | undefined;

  const fromRaw = data.from || '';
  const fromMatch = fromRaw.match(/^(.*?)\s*<([^>]+)>$/);
  const fromName = fromMatch ? fromMatch[1].replace(/^"|"$/g, '') : '';
  const fromEmail = fromMatch ? fromMatch[2] : fromRaw;

  const owner = localPart ? await resolveInboxLocal(localPart) : null;
  if (!owner) {
    // Dead letter: metadata only. The body is NEVER fetched for an
    // address that isn't a user's — it isn't ours to read. The
    // sweeper purges these rows after 7 days.
    await storeInboundMessage({
      provider: 'resend',
      providerEmailId: data.email_id,
      messageId: data.message_id || null,
      userId: null,
      fromName,
      fromEmail,
      toAddresses: recipients,
      subject: data.subject || '',
      bodyText: '',
      receivedAt: data.created_at || null,
      rawMeta: { deadLetter: true, to: recipients },
    });
    return NextResponse.json({ received: true, deadLetter: true });
  }

  // Owned address: fetch the full content now (attachment URLs
  // expire), store, parse, propose — all in the shared path.
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`receiving api ${res.status}`);
    const full = (await res.json()) as ResendReceived;
    const attachments: {
      providerAttachmentId: string | null; filename: string; contentType: string;
      content: Buffer | null; skipped?: boolean;
    }[] = [];
    let total = Buffer.byteLength(full.text || '', 'utf8');
    for (const att of full.attachments || []) {
      const size = att.size || 0;
      if (size > MAX_ATTACHMENT_BYTES || total + size > MAX_MESSAGE_BYTES) {
        attachments.push({
          providerAttachmentId: att.id || null,
          filename: att.filename || 'attachment',
          contentType: att.content_type || '',
          content: null,
          skipped: true,
        });
        continue;
      }
      // Attachment bytes come from the Receiving API's signed
      // download URL for this attachment id.
      const dl = await fetch(
        `https://api.resend.com/emails/receiving/${data.email_id}/attachments/${att.id}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!dl.ok) continue;
      const meta = (await dl.json()) as { download_url?: string };
      if (!meta.download_url) continue;
      const fileRes = await fetch(meta.download_url);
      if (!fileRes.ok) continue;
      const buf = Buffer.from(await fileRes.arrayBuffer());
      total += buf.length;
      attachments.push({
        providerAttachmentId: att.id || null,
        filename: att.filename || 'attachment',
        contentType: att.content_type || '',
        content: buf,
      });
    }
    await storeInboundMessage({
      provider: 'resend',
      providerEmailId: data.email_id,
      messageId: full.message_id || data.message_id || null,
      userId: owner.userId,
      fromName,
      fromEmail,
      toAddresses: recipients,
      subject: data.subject || '',
      bodyText: full.text || '',
      bodyHtml: full.html || '',
      headers: (full.headers || {}) as Record<string, unknown>,
      receivedAt: data.created_at || null,
      attachments,
    });
  } catch {
    // Keep a metadata-only row in 'received' status; the sweeper
    // retries the fetch/parse path and surfaces persistent failures
    // in the UI instead of losing the mail silently.
    await storeInboundMessage({
      provider: 'resend',
      providerEmailId: data.email_id,
      messageId: data.message_id || null,
      userId: owner.userId,
      fromName,
      fromEmail,
      toAddresses: recipients,
      subject: data.subject || '',
      bodyText: '',
      receivedAt: data.created_at || null,
      rawMeta: { fetchFailed: true },
      deferParse: true,
    }).catch(() => undefined);
  }
  return NextResponse.json({ received: true });
}
