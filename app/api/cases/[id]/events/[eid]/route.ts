import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { deleteCaseEvent, updateCaseEvent } from '@/lib/cases';
import { cleanEventInput } from '../clean';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH: edit a timeline event (full replace of its fields).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; eid: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const c = cleanEventInput(body);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  try {
    const event = await updateCaseEvent(g.user.id, params.id, params.eid, c.input);
    if (!event) return notFound();
    return NextResponse.json({ event });
  } catch {
    return dbUnavailable();
  }
}

// DELETE: remove a timeline event.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; eid: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const ok = await deleteCaseEvent(g.user.id, params.id, params.eid);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
