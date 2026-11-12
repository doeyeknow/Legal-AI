import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { getCaseDetail, updateCase, deleteCase } from '@/lib/cases';
import { CASE_STATUSES } from '@/lib/dashboard-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: one case with documents, deadlines, comms, watches, appearance.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const detail = await getCaseDetail(g.user.id, params.id);
    if (!detail) return notFound();
    return NextResponse.json({ case: detail });
  } catch {
    return dbUnavailable();
  }
}

// PATCH: rename a case or change its status.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: { title?: string; status?: string } = {};
  const title = cleanStr(body?.title, 300);
  if (title) patch.title = title;
  if (typeof body?.status === 'string' && (CASE_STATUSES as readonly string[]).includes(body.status)) {
    patch.status = body.status;
  }
  if (!patch.title && !patch.status) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }
  try {
    const updated = await updateCase(g.user.id, params.id, patch);
    if (!updated) return notFound();
    return NextResponse.json({ case: updated });
  } catch {
    return dbUnavailable();
  }
}

// DELETE: remove one of the user's own cases. Documents, deadlines,
// comms, watches, and the appearance cascade with it; court mail is
// only unassigned, never deleted.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const ok = await deleteCase(g.user.id, params.id);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
