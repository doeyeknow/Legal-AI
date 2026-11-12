import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, notFound } from '@/lib/api-guard';
import { getCaseFacts } from '@/lib/inbox';
import { getOwnedCaseLite } from '@/lib/cases';

// GET /api/cases/[id]/facts — the confirmed-facts bag for a case
// the signed-in user owns, with a provenance line per fact. This
// is what the interview's case-facts screen shows and what it
// seeds from; proposed (unconfirmed) facts are never in here.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const lite = await getOwnedCaseLite(auth.user.id, params.id);
    if (!lite) return notFound();
    const { facts, sources } = await getCaseFacts(auth.user.id, params.id);
    return NextResponse.json({ facts, sources });
  } catch {
    return dbUnavailable();
  }
}
