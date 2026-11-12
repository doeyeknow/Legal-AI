import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, requireUser } from '@/lib/api-guard';
import { allDeadlines } from '@/lib/cases';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: all deadlines (open and done) across the user's cases — the
// calendar view's data.
export async function GET(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const deadlines = await allDeadlines(g.user.id);
    return NextResponse.json({ deadlines });
  } catch {
    return dbUnavailable();
  }
}
