import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { getDraft } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: the caller's own in-progress draft, for resuming an
// interview. Another user's draft, a completed case, and a missing
// row are all the same 404 — drafts are private to their owner.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const draft = await getDraft(g.user.id, params.id);
    if (!draft) return notFound();
    return NextResponse.json({ draft });
  } catch {
    return dbUnavailable();
  }
}
