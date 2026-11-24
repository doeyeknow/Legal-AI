import { NextRequest, NextResponse } from 'next/server';
import { fetchTranscription, speechConfigured } from '@/lib/elevenlabs';

export const runtime = 'nodejs';

// Speech-to-text for the interview voice layer. POST multipart form
// with field "audio" (webm/ogg/mp4/wav). Returns { text }.
// Fail-soft: no ELEVENLABS_API_KEY → 503, client falls back to typing.
export async function POST(req: NextRequest) {
  if (!speechConfigured()) {
    return NextResponse.json({ error: 'voice_not_configured' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_form' }, { status: 400 });
  }

  const file = form.get('audio');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'missing_audio' }, { status: 400 });
  }

  const blob = file as Blob;
  if (!blob.size || blob.size < 500) {
    return NextResponse.json({ error: 'audio_too_short' }, { status: 400 });
  }
  // Hard cap ~2 minutes of audio at typical webm bitrates.
  if (blob.size > 3_000_000) {
    return NextResponse.json({ error: 'audio_too_large' }, { status: 413 });
  }

  const name = (file as File).name || 'answer.webm';

  try {
    const { text } = await fetchTranscription(blob, name);
    if (!text) {
      return NextResponse.json({ error: 'empty_transcript' }, { status: 422 });
    }
    return NextResponse.json({ text }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('voice_not_configured')) {
      return NextResponse.json({ error: 'voice_not_configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'stt_failed' }, { status: 502 });
  }
}
