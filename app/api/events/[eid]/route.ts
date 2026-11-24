import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { getOwnedEvent, setCaseEventDone } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: one of the user's events (used by the call companion).
export async function GET(req: NextRequest, { params }: { params: { eid: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const event = await getOwnedEvent(g.user.id, params.eid);
    if (!event) return notFound();
    return NextResponse.json({ event });
  } catch {
    return dbUnavailable();
  }
}

// PATCH {done}: tick an event off (e.g. the call has been made).
export async function PATCH(req: NextRequest, { params }: { params: { eid: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as { done?: unknown } | null;
  if (typeof body?.done !== 'boolean') {
    return NextResponse.json({ error: 'done must be true or false' }, { status: 400 });
  }
  try {
    const event = await setCaseEventDone(g.user.id, params.eid, body.done);
    if (!event) return notFound();
    return NextResponse.json({ event });
  } catch {
    return dbUnavailable();
  }
}
