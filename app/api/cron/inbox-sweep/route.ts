import { NextResponse } from 'next/server';
import { dbConfigured } from '@/lib/db';
import { sweepInbox } from '@/lib/inbox';

// POST /api/cron/inbox-sweep — housekeeping for the court-mail
// inbox (design §3.3): retry parsing messages stuck in 'received'
// (a webhook whose content fetch failed), mark them 'failed' after
// 3 attempts so the UI can say so honestly, and purge dead-letter
// rows (mail to addresses that are not any user's) after 7 days.
// Same bearer-secret convention as the docket checker.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  if (!dbConfigured()) {
    return NextResponse.json(
      { ok: false, note: 'No database configured — nothing to sweep.' },
      { status: 503 },
    );
  }
  try {
    const result = await sweepInbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'sweep failed' },
      { status: 500 },
    );
  }
}
