import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, cleanStr } from '@/lib/api-guard';
import { changeInboxSlug, getOrMintInboxAddress } from '@/lib/inbox';

// GET /api/inbox/address — the user's court-mail address.
// PATCH {slug} — rename the cosmetic slug; the security token and
// the address's deliverability pattern stay the same shape.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const a = await getOrMintInboxAddress(auth.user.id);
    return NextResponse.json({
      address: a.address,
      slug: a.slug,
      fromName: auth.user.fullName || '',
    });
  } catch {
    return dbUnavailable();
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  try {
    const res = await changeInboxSlug(auth.user.id, cleanStr(body.slug, 40));
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 422 });
    }
    return NextResponse.json({ address: res.address });
  } catch {
    return dbUnavailable();
  }
}
