import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { deleteWatch } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// DELETE: remove a docket watch.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; wid: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const ok = await deleteWatch(g.user.id, params.id, params.wid);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
