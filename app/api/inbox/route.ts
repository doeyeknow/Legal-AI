import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable } from '@/lib/api-guard';
import {
  MAILBOX_ACTIONS,
  applyMailboxAction,
  deleteMessagesForever,
  emptyTrash,
  getOrMintInboxAddress,
  inboxCounts,
  listInbox,
  type MailboxAction,
} from '@/lib/inbox';
import type { InboxFolder } from '@/lib/dashboard-types';

const FOLDERS: InboxFolder[] = ['inbox', 'unread', 'starred', 'archived', 'trash'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/inbox — the signed-in user's court mail + review counts.
// ?folder=inbox|unread|starred|archived|trash  ?q=search  ?caseId=
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const f = url.searchParams.get('folder') as InboxFolder | null;
    const folder: InboxFolder = f && FOLDERS.includes(f) ? f : 'inbox';
    const [address, inbox] = await Promise.all([
      getOrMintInboxAddress(auth.user.id),
      listInbox(auth.user.id, {
        unreadOnly: url.searchParams.get('unread') === '1',
        caseId: url.searchParams.get('caseId'),
        folder,
        q: url.searchParams.get('q'),
      }),
    ]);
    return NextResponse.json({
      address: address.address,
      slug: address.slug,
      messages: inbox.messages,
      unreviewed: inbox.unreviewed,
      counts: inbox.counts,
    });
  } catch {
    return dbUnavailable();
  }
}

// PATCH /api/inbox — bulk mailbox actions.
// { ids: string[], action: read|unread|star|unstar|archive|unarchive|trash|restore|delete_forever }
// { action: 'empty_trash' }
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { ids?: unknown; action?: unknown } | null;
  const action = typeof body?.action === 'string' ? body.action : '';
  const ids = Array.isArray(body?.ids)
    ? (body!.ids as unknown[]).filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)).slice(0, 200)
    : [];
  try {
    let changed = 0;
    if (action === 'empty_trash') {
      changed = await emptyTrash(auth.user.id);
    } else if (action === 'delete_forever') {
      changed = await deleteMessagesForever(auth.user.id, ids);
    } else if ((MAILBOX_ACTIONS as string[]).includes(action)) {
      changed = await applyMailboxAction(auth.user.id, ids, action as MailboxAction);
    } else {
      return NextResponse.json({ error: 'invalid_action' }, { status: 422 });
    }
    const counts = await inboxCounts(auth.user.id);
    return NextResponse.json({ ok: true, changed, counts });
  } catch {
    return dbUnavailable();
  }
}
