import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { assistCall } from '@/lib/call-companion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST {caseId, transcriptTail, newText, callWith?, today?}: what the
// person might say next, and any case details just heard. Nothing is
// stored here — adding details is a separate call the screen makes.
export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const caseId = cleanStr(body?.caseId, 40);
  const newText = cleanStr(body?.newText, 4000);
  if (!caseId || !newText) {
    return NextResponse.json({ error: 'caseId and newText are required' }, { status: 400 });
  }
  const todayIn = cleanStr(body?.today, 10);
  try {
    const out = await assistCall({
      userId: g.user.id,
      caseId,
      transcriptTail: cleanStr(body?.transcriptTail, 8000),
      newText,
      callWith: cleanStr(body?.callWith, 200),
      today: /^\d{4}-\d{2}-\d{2}$/.test(todayIn) ? todayIn : new Date().toISOString().slice(0, 10),
    });
    if (!out) return notFound();
    return NextResponse.json(out);
  } catch {
    return dbUnavailable();
  }
}
