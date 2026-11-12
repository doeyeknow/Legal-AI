import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, requireUser } from '@/lib/api-guard';
import { upsertDraft, type DraftData } from '@/lib/cases';
import { getMotion } from '@/lib/motions/match';
import type { Answers } from '@/lib/motions/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST: autosave an in-progress interview as a draft case. Called
// debounced by the interview while a signed-in user answers, and
// flushed on pagehide. Best-effort by design — the interview treats
// every failure as "try again on the next change" and never blocks
// on it. Guests get the guard's 401 and simply never call this.
export async function POST(req: NextRequest) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const motion = getMotion(typeof body?.motionId === 'string' ? body.motionId : '');
  if (!motion) {
    return NextResponse.json({ error: 'unknown_motion' }, { status: 400 });
  }
  // Keep only string answers, capped — the snapshot is interview
  // state, not a document store.
  const rawAnswers =
    body?.answers && typeof body.answers === 'object'
      ? (body.answers as Record<string, unknown>)
      : {};
  const answers: Answers = {};
  for (const [k, v] of Object.entries(rawAnswers).slice(0, 200)) {
    if (typeof v === 'string') answers[k.slice(0, 80)] = v.slice(0, 4000);
  }
  const data: DraftData = {
    motionId: motion.id,
    answers,
    subject: body?.subject === 'other' ? 'other' : body?.subject === 'self' ? 'self' : null,
    feeWaiverAdded: body?.feeWaiverAdded === true,
  };
  const draftId = typeof body?.draftId === 'string' && body.draftId ? body.draftId : null;
  try {
    const id = await upsertDraft(g.user.id, { id: draftId, motion, data });
    return NextResponse.json({ draft: { id } });
  } catch {
    return dbUnavailable();
  }
}
