import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, notFound } from '@/lib/api-guard';
import {
  MAILBOX_ACTIONS,
  applyMailboxAction,
  deleteMessagesForever,
  getMessageDetail,
  setMessageStatus,
  type MailboxAction,
} from '@/lib/inbox';

// GET /api/inbox/[id] — one message with its facts, attachments,
// and the replies/forwards sent from it.
// PATCH {status} — 'filed' (done reviewing) or 'dismissed'.
// PATCH {action} — a mailbox action (read, unread, star, unstar,
//   archive, unarchive, trash, restore).
// DELETE — delete forever; only allowed once the mail is in the Trash.
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
  let body: { status?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (body.action) {
    if (!(MAILBOX_ACTIONS as string[]).includes(body.action)) {
      return NextResponse.json({ error: 'invalid_action' }, { status: 422 });
    }
    try {
      const n = await applyMailboxAction(auth.user.id, [params.id], body.action as MailboxAction);
      if (!n) return notFound();
      return NextResponse.json({ ok: true });
    } catch {
      return dbUnavailable();
    }
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const n = await deleteMessagesForever(auth.user.id, [params.id]);
    if (!n) {
      return NextResponse.json(
        { error: 'not_in_trash', message: 'Move the message to the Trash first.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return dbUnavailable();
  }
}
