import { NextRequest, NextResponse } from 'next/server';
import { getMotion } from '@/lib/motions/match';
import { buildFilingInfo } from '@/lib/filing-steps';
import { courtsFor } from '@/lib/courts/index';

export const runtime = 'nodejs';

// Courts database lookup for the interview's court-name step and
// the done screen's contact card. Reads ONLY the real records in
// lib/courts/ — an uncovered county returns an empty list and the
// interview keeps its typed question. Default response is the
// option shape { name, kind }; ?detail=1 returns full records.
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') || '';
  const county = req.nextUrl.searchParams.get('county') || '';
  const detail = req.nextUrl.searchParams.get('detail') === '1';
  const courts = courtsFor(state, county);
  return NextResponse.json({
    courts: detail ? courts : courts.map((c) => ({ name: c.name, kind: c.kind })),
    source: courts.length ? 'database' : null,
  });
}

// ZIP -> county court filing steps (+ links), including the per-motion
// filing gotchas from the catalog.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const motion = getMotion(String(body.motionId || ''));
  if (!motion) {
    return NextResponse.json({ error: 'unknown_motion' }, { status: 400 });
  }
  const info = buildFilingInfo(
    String(body.zip || ''),
    String(body.state || ''),
    String(body.county || ''),
    motion
  );
  return NextResponse.json(info);
}
