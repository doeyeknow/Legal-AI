import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { upsertAppearance } from '@/lib/cases';
import type { RemoteStatus } from '@/lib/dashboard-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES: RemoteStatus[] = ['not_requested', 'requested', 'granted', 'denied'];

// PUT: create or replace the case's appearance card (one per case).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const remoteStatus = STATUSES.includes(body?.remoteStatus as RemoteStatus)
    ? (body!.remoteStatus as RemoteStatus)
    : 'not_requested';
  let hearingAt: string | null = null;
  if (typeof body?.hearingAt === 'string' && body.hearingAt.trim()) {
    const d = new Date(body.hearingAt);
    if (!Number.isNaN(d.getTime())) hearingAt = d.toISOString();
  }
  const joinUrl = cleanStr(body?.joinUrl, 500);
  if (joinUrl && !/^https?:\/\//i.test(joinUrl)) {
    return NextResponse.json(
      { error: 'The join link must be a full web address (https://…).' },
      { status: 400 },
    );
  }
  try {
    const saved = await upsertAppearance(g.user.id, params.id, {
      hearingAt,
      platform: cleanStr(body?.platform, 60),
      joinUrl,
      phoneBackup: cleanStr(body?.phoneBackup, 80),
      remoteStatus,
      ...(typeof body?.meetingId === 'string' ? { meetingId: cleanStr(body.meetingId, 80) } : {}),
      ...(typeof body?.passcode === 'string' ? { passcode: cleanStr(body.passcode, 80) } : {}),
      ...(typeof body?.dialIn === 'string' ? { dialIn: cleanStr(body.dialIn, 120) } : {}),
      ...(typeof body?.instructions === 'string' ? { instructions: cleanStr(body.instructions, 2000) } : {}),
    });
    if (!saved) return notFound();
    return NextResponse.json({ appearance: saved });
  } catch {
    return dbUnavailable();
  }
}
