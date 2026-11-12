import { NextRequest, NextResponse } from 'next/server';
import { generateTextPdf } from '@/lib/text-pdf';

export const runtime = 'nodejs';

// Renders a plain-text draft (a court communication the user wrote
// or edited from a template) as a simple PDF. Stateless: the text is
// the user's own draft, sent in the request and never stored.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.slice(0, 20000) : '';
  if (!text.trim()) {
    return NextResponse.json({ error: 'empty', message: 'The draft is empty.' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : '';
  const pdf = await generateTextPdf(title, text);
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="communication-draft.pdf"',
    },
  });
}
