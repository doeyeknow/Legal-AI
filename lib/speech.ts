/**
 * Browser-side speech for the voice layer: a small queue player
 * over POST /api/tts. Lines are spoken strictly in order, one at a
 * time — the way a phone call works. If the server answers 503
 * (voice not configured) the player reports it once through
 * onUnavailable and goes silent; the text flow is never affected.
 *
 * Client code only — do not import from server components.
 */

/** Split a message into sentence-sized chunks so each /api/tts
 *  request stays under the server's per-request cap. */
export function chunkForSpeech(text: string, max = 700): string[] {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const out: string[] = [];
  let rest = t;
  while (rest.length > max) {
    const cut = rest.slice(0, max);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    const at = stop > max * 0.4 ? stop + 1 : cut.lastIndexOf(' ');
    const splitAt = at > 0 ? at : max;
    out.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

export class SpeechPlayer {
  /** Fires once if the server says voice is not configured. */
  onUnavailable: (() => void) | null = null;
  /** Fires when playback starts/stops being audible (for the UI's
   *  stop-speaking control). */
  onActiveChange: ((active: boolean) => void) | null = null;
  /** Fires when the queue has fully drained: the last clip finished
   *  and nothing remains to say. The hands-free voice loop uses this
   *  as its "your turn" signal — it only fires on a natural drain,
   *  never after stop() and never once voice proved unavailable. */
  onDrained: (() => void) | null = null;

  private queue: string[] = [];
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private pumping = false;
  private generation = 0;
  private unavailable = false;

  enqueue(text: string) {
    if (this.unavailable) return;
    for (const chunk of chunkForSpeech(text)) this.queue.push(chunk);
    void this.pump();
  }

  /** Halt everything: clear the queue and stop the current clip. */
  stop() {
    this.generation += 1;
    this.queue = [];
    this.teardownAudio();
    this.onActiveChange?.(false);
  }

  private teardownAudio() {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    const gen = this.generation;
    try {
      while (this.queue.length > 0 && gen === this.generation && !this.unavailable) {
        const text = this.queue.shift() as string;
        let res: Response;
        try {
          res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
        } catch {
          // Network hiccup: drop this line, keep the call going.
          continue;
        }
        if (gen !== this.generation) return;
        if (res.status === 503) {
          this.unavailable = true;
          this.queue = [];
          this.onUnavailable?.();
          return;
        }
        if (!res.ok) continue;
        const blob = await res.blob().catch(() => null);
        if (!blob || gen !== this.generation) continue;
        await this.playBlob(blob, gen);
      }
    } finally {
      this.pumping = false;
      if (gen === this.generation && this.queue.length === 0) {
        this.onActiveChange?.(false);
        if (!this.unavailable) this.onDrained?.();
      }
    }
  }

  private playBlob(blob: Blob, gen: number): Promise<void> {
    return new Promise((resolve) => {
      if (gen !== this.generation) return resolve();
      this.teardownAudio();
      const url = URL.createObjectURL(blob);
      this.objectUrl = url;
      const audio = new Audio(url);
      this.audio = audio;
      this.onActiveChange?.(true);
      const done = () => {
        if (this.audio === audio) this.audio = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      // A blocked/failed play must never stall the queue.
      audio.play().catch(() => done());
    });
  }
}
