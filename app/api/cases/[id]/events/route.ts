import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { addCaseEvent } from '@/lib/cases';
import { cleanEventInput } from './clean';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST: add an event to the case timeline.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const c = cleanEventInput(body);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  try {
    const event = await addCaseEvent(g.user.id, params.id, c.input);
    if (!event) return notFound();
    return NextResponse.json({ event }, { status: 201 });
  } catch {
    return dbUnavailable();
  }
}
