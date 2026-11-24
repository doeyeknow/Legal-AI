import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, requireUser } from '@/lib/api-guard';
import { applyExistingMail } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

// POST {ids?}: read mail already in the inbox again and add the
// dates, case numbers, join links, and call requests it contains to
// the matching cases. Without ids, every message not in the Trash.
export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 200)
    : undefined;
  try {
    const result = await applyExistingMail(g.user.id, ids);
    return NextResponse.json(result);
  } catch (err) {
    console.error('apply existing mail failed', err);
    return dbUnavailable();
  }
}
