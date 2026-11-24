import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, requireUser } from '@/lib/api-guard';
import { getInboxSettings, setInboxAutoApply } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: court-mail settings. PATCH {autoApply}: turn automatic adding
// of mail details to cases on or off.
export async function GET(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    return NextResponse.json(await getInboxSettings(g.user.id));
  } catch {
    return dbUnavailable();
  }
}

export async function PATCH(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as { autoApply?: unknown } | null;
  if (typeof body?.autoApply !== 'boolean') {
    return NextResponse.json({ error: 'autoApply must be true or false' }, { status: 400 });
  }
  try {
    await setInboxAutoApply(g.user.id, body.autoApply);
    return NextResponse.json({ autoApply: body.autoApply });
  } catch {
    return dbUnavailable();
  }
}
