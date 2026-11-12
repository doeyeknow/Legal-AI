import { NextRequest, NextResponse } from 'next/server';
import { cleanDate, cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { addComm } from '@/lib/cases';
import { COMM_METHODS } from '@/lib/dashboard-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST: add an entry to a case's communication log by hand. The
// log records what the user sent or received; email the app itself
// sends (from the user's own court-mail address) is logged by
// /api/comms/send after Resend accepts it — never from here.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const direction = body?.direction === 'from_court' ? 'from_court' : 'to_court';
  const method = cleanStr(body?.method, 60);
  if (!(COMM_METHODS as readonly string[]).includes(method)) {
    return NextResponse.json({ error: 'Unknown communication method.' }, { status: 400 });
  }
  const subject = cleanStr(body?.subject, 300);
  if (!subject) {
    return NextResponse.json({ error: 'A subject is required.' }, { status: 400 });
  }
  const sentAt = cleanDate(body?.sentAt) || new Date().toISOString().slice(0, 10);
  try {
    const created = await addComm(g.user.id, params.id, {
      direction,
      method,
      subject,
      body: cleanStr(body?.body, 8000),
      sentAt,
      responseDeadline: cleanDate(body?.responseDeadline),
      status: cleanStr(body?.status, 120),
    });
    if (!created) return notFound();
    return NextResponse.json({ comm: created }, { status: 201 });
  } catch {
    return dbUnavailable();
  }
}
