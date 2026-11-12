import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, cleanStr } from '@/lib/api-guard';
import { inboxSimulateEnabled, storeInboundMessage } from '@/lib/inbox';

// POST /api/inbox/simulate {from, fromName?, subject, body, headers?,
// date?} — DEV/TEST ONLY. Enabled solely when LEGAL_INBOX_SIMULATE=1
// (never set in production). Injects a message for the SIGNED-IN
// user through the exact production path: store → parse → propose.
// It exists so the whole pipeline — extraction, review, confirm,
// generator seeding — is testable before the mail provider is wired.
export async function POST(req: NextRequest) {
  if (!inboxSimulateEnabled()) {
    return NextResponse.json({ error: 'simulate_disabled' }, { status: 404 });
  }
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  let body: {
    from?: string; fromName?: string; subject?: string; body?: string;
    headers?: Record<string, unknown>; date?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  try {
    const stored = await storeInboundMessage({
      provider: 'simulate',
      providerEmailId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: auth.user.id,
      fromName: cleanStr(body.fromName, 200),
      fromEmail: cleanStr(body.from, 200) || 'clerk@example.test',
      toAddresses: [],
      subject: cleanStr(body.subject, 500),
      bodyText: typeof body.body === 'string' ? body.body.slice(0, 100_000) : '',
      headers: body.headers && typeof body.headers === 'object' ? body.headers : {},
      receivedAt: body.date ? cleanStr(body.date, 40) : null,
      rawMeta: { simulated: true },
    });
    return NextResponse.json({ ok: true, messageId: stored.messageId });
  } catch {
    return dbUnavailable();
  }
}
