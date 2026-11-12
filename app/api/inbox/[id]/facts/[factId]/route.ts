import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, notFound, cleanStr, cleanDate } from '@/lib/api-guard';
import { confirmFact, dismissFact } from '@/lib/inbox';

// POST /api/inbox/[id]/facts/[factId] {action: 'confirm'|'dismiss',
// valueText?, valueDate?} — the user's decision on one proposed
// fact. Confirming applies it to the case through the existing
// writers (lib/inbox.ts); dismissing records the decision and the
// fact never reaches anything.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; factId: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  let body: { action?: string; valueText?: string; valueDate?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  try {
    if (body.action === 'dismiss') {
      const ok = await dismissFact(auth.user.id, params.id, params.factId);
      if (!ok) return notFound();
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'confirm') {
      const fact = await confirmFact(auth.user.id, params.id, params.factId, {
        valueText: body.valueText ? cleanStr(body.valueText, 500) : undefined,
        valueDate: body.valueDate !== undefined ? cleanDate(body.valueDate ?? '') : undefined,
      });
      if (!fact) return notFound();
      return NextResponse.json({ fact });
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 422 });
  } catch {
    return dbUnavailable();
  }
}
