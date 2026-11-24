import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, requireUser } from '@/lib/api-guard';
import { calendarFeed } from '@/lib/cases';
import { setUserTimeZone } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: everything on the user's calendar — deadlines, hearings (with
// join links), and timeline events such as calls to make.
export async function GET(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    // Remember the browser's time zone so court-mail times ("9:30
    // a.m.") land on the calendar at the right hour.
    const tz = req.nextUrl.searchParams.get('tz');
    if (tz) await setUserTimeZone(g.user.id, tz).catch(() => undefined);
    const items = await calendarFeed(g.user.id);
    return NextResponse.json({ items });
  } catch {
    return dbUnavailable();
  }
}
