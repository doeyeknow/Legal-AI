import { NextRequest, NextResponse } from 'next/server';
import { cleanForSpeech, fetchSpeechAudio, speechConfigured } from '@/lib/elevenlabs';

export const runtime = 'nodejs';

// Voice layer for the interview + simulated hearing. POST { text }
// and get audio/mpeg back, synthesized by ElevenLabs. Fail-soft by
// design: with no ELEVENLABS_API_KEY in the environment this answers
// 503 { error: 'voice_not_configured' } and the client simply keeps
// the text experience — nothing else in the app depends on it.
export async function POST(req: NextRequest) {
  if (!speechConfigured()) {
    return NextResponse.json({ error: 'voice_not_configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const text = cleanForSpeech(String(body.text || ''));
  if (!text) {
    return NextResponse.json({ error: 'empty_text' }, { status: 400 });
  }

  try {
    const upstream = await fetchSpeechAudio(text);
    if (!upstream.ok || !upstream.body) {
      // Upstream detail stays server-side; the client only needs to
      // know this line could not be spoken.
      return NextResponse.json({ error: 'tts_failed' }, { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'tts_failed' }, { status: 502 });
  }
}
