import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { deleteDeadline, setDeadlineDone } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PATCH: mark a deadline done / not done.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; did: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const ok = await setDeadlineDone(g.user.id, params.id, params.did, body?.done === true);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}

// DELETE: remove a deadline.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; did: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const ok = await deleteDeadline(g.user.id, params.id, params.did);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
