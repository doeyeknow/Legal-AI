import { NextRequest, NextResponse } from 'next/server';
import { requireUser, dbUnavailable, notFound } from '@/lib/api-guard';
import { getAttachmentBytes } from '@/lib/inbox';

// GET /api/inbox/[id]/attachments/[attId] — download an attachment
// stored at ingestion (provider signed URLs expire within ~1h, so
// the inbox serves its own copy; ownership checked in the query).
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; attId: string } },
) {
  const auth = await requireUser(req);
  if ('error' in auth) return auth.error;
  try {
    const att = await getAttachmentBytes(auth.user.id, params.id, params.attId);
    if (!att) return notFound();
    return new NextResponse(new Uint8Array(att.content), {
      headers: {
        'Content-Type': att.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${att.filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return dbUnavailable();
  }
}
