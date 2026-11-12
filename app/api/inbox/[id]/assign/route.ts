import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, notFound, cleanStr } from '@/lib/api-guard';
import { assignMessageToCase, createCaseFromMessage, getMessageDetail } from '@/lib/inbox';

// POST /api/inbox/[id]/assign {caseId?, newCase?, setCaseNumber?}
// Assigns the message to one of the user's cases (or a fresh case
// started from this mail). Assignment is always the user's act —
// the parser only ever suggests.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  let body: { caseId?: string | null; newCase?: boolean; setCaseNumber?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  try {
    const detail = await getMessageDetail(auth.user.id, params.id);
    if (!detail) return notFound();
    if (body.newCase) {
      const caseId = await createCaseFromMessage(auth.user.id, params.id);
      if (!caseId) return notFound();
      return NextResponse.json({ ok: true, caseId });
    }
    const caseId = body.caseId ? cleanStr(body.caseId, 64) : null;
    const ok = await assignMessageToCase(auth.user.id, params.id, caseId, {
      setCaseNumber: body.setCaseNumber === true,
    });
    if (!ok) return notFound();
    return NextResponse.json({ ok: true, caseId });
  } catch {
    return dbUnavailable();
  }
}
