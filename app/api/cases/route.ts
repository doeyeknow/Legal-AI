import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, requireUser } from '@/lib/api-guard';
import { createCase, listCases, upcomingDeadlines } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: the signed-in user's cases (with document counts and next
// deadline) plus the soonest open deadlines across all their cases.
export async function GET(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const [cases, upcoming] = await Promise.all([
      listCases(g.user.id),
      upcomingDeadlines(g.user.id),
    ]);
    return NextResponse.json({ cases, upcoming });
  } catch {
    return dbUnavailable();
  }
}

// POST: create a case by hand (for matters the user is tracking that
// did not start with a generated document).
export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = cleanStr(body?.title, 300);
  if (!title) {
    return NextResponse.json({ error: 'A case title is required.' }, { status: 400 });
  }
  const number = cleanStr(body?.caseNumber, 120);
  try {
    const created = await createCase(g.user.id, {
      title,
      subjectName: cleanStr(body?.subjectName, 200),
      relation: body?.relation === 'other' ? 'other' : 'self',
      courtName: cleanStr(body?.courtName, 200),
      county: cleanStr(body?.county, 120),
      state: cleanStr(body?.state, 120),
      caseNumber: number && number.toLowerCase() !== 'none' ? number : null,
    });
    return NextResponse.json({ case: created }, { status: 201 });
  } catch {
    return dbUnavailable();
  }
}
