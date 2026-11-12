import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable } from '@/lib/api-guard';
import { getOrMintInboxAddress, listInbox } from '@/lib/inbox';

// GET /api/inbox — the signed-in user's court mail + review counts.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const [address, inbox] = await Promise.all([
      getOrMintInboxAddress(auth.user.id),
      listInbox(auth.user.id, {
        unreadOnly: url.searchParams.get('unread') === '1',
        caseId: url.searchParams.get('caseId'),
      }),
    ]);
    return NextResponse.json({
      address: address.address,
      slug: address.slug,
      messages: inbox.messages,
      unreviewed: inbox.unreviewed,
    });
  } catch {
    return dbUnavailable();
  }
}
