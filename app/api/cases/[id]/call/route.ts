import { NextRequest, NextResponse } from 'next/server';
import { cleanStr, dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import {
  applyCallFacts,
  cleanFacts,
  finishCall,
  undoCallRef,
  type AppliedRef,
} from '@/lib/call-companion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST {action}:
//   'facts'  {facts, eventId?, callWith?, tz?} — add details heard on
//            the call to the case; returns refs for Undo.
//   'undo'   {ref} — take one of those back off the case.
//   'finish' {eventId?, callWith?, transcript, saveTranscript, notes}
//            — save the call summary to the timeline, tick the call off.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = cleanStr(body?.action, 20);
  const eventId = cleanStr(body?.eventId, 40) || null;
  const callWith = cleanStr(body?.callWith, 200);
  try {
    if (action === 'facts') {
      const tz = cleanStr(body?.tz, 6);
      const refs = await applyCallFacts(g.user.id, params.id, cleanFacts(body?.facts as unknown[]), {
        eventId,
        callWith,
        tz: /^[+-]\d{2}:\d{2}$/.test(tz) ? tz : '',
      });
      if (!refs) return notFound();
      return NextResponse.json({ refs });
    }
    if (action === 'undo') {
      const r = (body?.ref || {}) as Partial<AppliedRef>;
      if (!r.type || !r.id) return NextResponse.json({ error: 'ref required' }, { status: 400 });
      const ok = await undoCallRef(g.user.id, params.id, {
        type: r.type, id: String(r.id), label: String(r.label || ''), valueText: String(r.valueText || ''),
      });
      return NextResponse.json({ ok });
    }
    if (action === 'finish') {
      const notes = Array.isArray(body?.notes)
        ? (body!.notes as unknown[]).map((n) => cleanStr(n, 300)).filter(Boolean).slice(0, 40)
        : [];
      const out = await finishCall(g.user.id, params.id, {
        eventId,
        callWith,
        transcript: cleanStr(body?.transcript, 20000),
        saveTranscript: body?.saveTranscript === true,
        notes,
        startedAt: cleanStr(body?.startedAt, 40),
      });
      if (!out) return notFound();
      return NextResponse.json(out);
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 422 });
  } catch (err) {
    console.error('call companion failed', err);
    return dbUnavailable();
  }
}
