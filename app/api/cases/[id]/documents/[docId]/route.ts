import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { deleteDocument, renameDocument } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// DELETE: remove one document from one of the user's own cases.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const ok = await deleteDocument(g.user.id, params.id, params.docId);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}

// PATCH: rename a document (its display label).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const label = cleanStr(body?.label, 200);
  if (!label) {
    return NextResponse.json({ error: 'A name is required.' }, { status: 400 });
  }
  try {
    const ok = await renameDocument(g.user.id, params.id, params.docId, label);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true, label });
  } catch {
    return dbUnavailable();
  }
}
