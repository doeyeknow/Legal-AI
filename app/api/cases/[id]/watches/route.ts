import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { addWatch } from '@/lib/cases';
import { portalByKey } from '@/lib/portals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST: register a docket watch on a case. The watch records the
// portal + case number + party name; what checking can actually do
// depends on the portal (see the cron check route and the research
// in legal-docket-and-remote.md). 'manual-other' is the honest
// fallback for courts with no portal in the directory.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const portalKey = cleanStr(body?.portalKey, 80);
  if (portalKey !== 'manual-other' && !portalByKey(portalKey)) {
    return NextResponse.json({ error: 'Unknown portal.' }, { status: 400 });
  }
  const caseNumber = cleanStr(body?.caseNumber, 120);
  if (!caseNumber) {
    return NextResponse.json(
      { error: 'A case number is required — a name-only watch matches strangers.' },
      { status: 400 },
    );
  }
  try {
    const created = await addWatch(g.user.id, params.id, {
      portalKey,
      caseNumber,
      partyName: cleanStr(body?.partyName, 200),
    });
    if (!created) return notFound();
    return NextResponse.json({ watch: created }, { status: 201 });
  } catch {
    return dbUnavailable();
  }
}
