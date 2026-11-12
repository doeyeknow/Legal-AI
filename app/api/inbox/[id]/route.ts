import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, notFound } from '@/lib/api-guard';
import { getMessageDetail, setMessageStatus } from '@/lib/inbox';

// GET /api/inbox/[id] — one message with its facts and attachments.
// PATCH {status} — 'filed' (done reviewing) or 'dismissed'.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const detail = await getMessageDetail(auth.user.id, params.id);
    if (!detail) return notFound();
    return NextResponse.json({ message: detail });
  } catch {
    return dbUnavailable();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (body.status !== 'filed' && body.status !== 'dismissed' && body.status !== 'parsed') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 422 });
  }
  try {
    const ok = await setMessageStatus(auth.user.id, params.id, body.status);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
