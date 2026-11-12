import { NextRequest, NextResponse } from 'next/server';
import { cleanDate, cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { addDeadline } from '@/lib/cases';
import { DEADLINE_TYPES } from '@/lib/comm-templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST: add a deadline to a case. Type must be one of the six
// research deadline types.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const type = cleanStr(body?.type, 40);
  if (!DEADLINE_TYPES.some((d) => d.key === type)) {
    return NextResponse.json({ error: 'Unknown deadline type.' }, { status: 400 });
  }
  const dueAt = cleanDate(body?.dueAt);
  if (!dueAt) {
    return NextResponse.json({ error: 'A valid due date is required.' }, { status: 400 });
  }
  try {
    const created = await addDeadline(g.user.id, params.id, {
      type,
      label: cleanStr(body?.label, 300),
      dueAt,
    });
    if (!created) return notFound();
    return NextResponse.json({ deadline: created }, { status: 201 });
  } catch {
    return dbUnavailable();
  }
}
