import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailable, notFound, requireUser } from '@/lib/api-guard';
import { getDocument } from '@/lib/cases';
import { getMotion } from '@/lib/motions/match';
import { generateMotionPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: re-download a stored document — the PDF is regenerated from
// the saved interview answers with lib/pdf.ts. The drawn signature
// is not stored, so a regenerated copy carries a blank signature
// line to sign on paper; the dashboard says so next to the button.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } },
) {
  const g = await requireUser(req);
  if ('error' in g) return g.error;
  try {
    const doc = await getDocument(g.user.id, params.id, params.docId);
    if (!doc) return notFound();
    const motion = getMotion(doc.motionId);
    if (!motion) return notFound();
    const pdf = await generateMotionPdf({
      motion,
      answers: doc.answers,
      signaturePngDataUrl: null,
      feeWaiverAdded: doc.feeWaiver,
      // The facts snapshot stored at generation time — never a live
      // re-read, so this copy matches the original document.
      caseFacts: doc.caseFacts || undefined,
    });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${motion.id}.pdf"`,
      },
    });
  } catch {
    return dbUnavailable();
  }
}
