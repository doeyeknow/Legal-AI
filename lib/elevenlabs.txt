/**
 * ElevenLabs text-to-speech — server side.
 *
 * The request shape mirrors the verified connector helper
 * (~/workspace/custom-connectors/custom.elevenlabs): the API lives
 * at https://api.elevenlabs.io and authenticates with the key in
 * the `xi-api-key` header. The key comes only from the ELEVENLABS_API_KEY
 * env var (in production, Adam pastes it into the legal-app Vercel
 * project). It is never logged and never sent anywhere else.
 *
 * Fail-soft: without a key the voice layer is simply off —
 * speechConfigured() is false, /api/tts answers 503, and the app
 * behaves exactly as the text-only version.
 */

/** Default intake voice: "Eric — Smooth, Trustworthy" (premade,
 *  male, American, middle-aged, conversational). Chosen because it
 *  reads like a calm professional on the phone — the register Adam
 *  asked for ("talking to a lawyer"). Overridable per deployment
 *  with ELEVENLABS_VOICE_ID. */
export const DEFAULT_VOICE_ID = 'cjVigY5qzO86Huf0OWal';

/** Hard cap per synthesis request, so one chat message can never
 *  turn into an unbounded bill or a huge payload. The client splits
 *  longer messages into sentence chunks under this cap. */
export const MAX_SPEECH_CHARS = 800;

const MODEL_ID = 'eleven_turbo_v2_5';

export function speechConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export function voiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}

/**
 * Make arbitrary chat text speakable: drop markup and characters a
 * TTS engine would read aloud literally, normalize whitespace, and
 * cap the length (cutting at a sentence boundary when one is near).
 */
export function cleanForSpeech(raw: string): string {
  let t = String(raw || '');
  t = t
    // Markdown / markup characters that would be spoken literally.
    .replace(/[*_#`>[\](){}]/g, ' ')
    // Em dashes read fine, but normalize the spaced ones.
    .replace(/\s+—\s+/g, ', ')
    .replace(/https?:\/\/\S+/g, 'the link on screen')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > MAX_SPEECH_CHARS) {
    const cut = t.slice(0, MAX_SPEECH_CHARS);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    t = lastStop > MAX_SPEECH_CHARS * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd();
  }
  return t;
}

/**
 * Build and fire the ElevenLabs synthesis request. Split from the
 * route handler so a test can inject a mock fetch and assert the
 * exact request (URL, headers, body) without a real key.
 * Returns the raw upstream Response (audio/mpeg on success).
 */
export async function fetchSpeechAudio(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error('voice_not_configured');
  }
  const clean = cleanForSpeech(text);
  return fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId()}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: clean,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
}


/** Speech-to-text model id (batch Scribe). Override with ELEVENLABS_STT_MODEL. */
export function sttModelId(): string {
  return process.env.ELEVENLABS_STT_MODEL || 'scribe_v2';
}

/**
 * Transcribe an audio blob via ElevenLabs Speech-to-Text (Scribe).
 * Used by POST /api/stt — API key stays on the server.
 */
export async function fetchTranscription(
  audio: Blob,
  filename = 'answer.webm',
  fetchImpl: typeof fetch = fetch,
): Promise<{ text: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error('voice_not_configured');
  }

  const form = new FormData();
  form.append('model_id', sttModelId());
  form.append('file', audio, filename);
  form.append('language_code', 'en');
  form.append('tag_audio_events', 'false');

  const res = await fetchImpl('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': key,
    },
    body: form,
  });

  if (!res.ok) {
    // Do not leak upstream body to clients; route handler maps to 502.
    throw new Error(`stt_failed:${res.status}`);
  }

  const data = (await res.json()) as { text?: string; transcript?: string };
  const text = String(data.text || data.transcript || '').trim();
  return { text };
}
