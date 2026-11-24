type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
};

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechEvent) => void) | null;
  start(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

export type RecognitionStatus = 'idle' | 'starting' | 'listening';

export function browserRecognition() {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  const browser = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
      return 'Microphone access was blocked. Allow it in this site’s browser permissions and your device settings, then try again.';
    case 'audio-capture':
      return 'The browser could not use the microphone. Check that a microphone is connected and not in use by another app. If a phone call is using it, try running the companion on a second device.';
    case 'network':
      return 'The browser could not reach its speech recognition service. Check your connection and try again in a full browser tab, not an in-app browser.';
    case 'service-not-allowed':
    case 'language-not-supported':
    case 'language-unavailable':
      return 'English speech recognition is unavailable in this browser. Try opening the site in an up-to-date version of Chrome.';
    case 'aborted':
      return 'The browser interrupted listening. Select Start listening to try again.';
    default:
      return 'The browser could not start or continue listening. Select Start listening to try again.';
  }
}

export function createCompanionRecognition(
  Ctor: RecognitionConstructor,
  handlers: {
    status: (status: RecognitionStatus) => void;
    error: (message: string) => void;
    transcript: (final: string[], interim: string) => void;
  },
) {
  let active = false;
  let current: Recognition | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let emptyRetries = 0;
  const maxEmptyRetries = 2;

  function detach(rec: Recognition) {
    current = null;
    rec.onstart = rec.onend = rec.onerror = rec.onresult = null;
  }

  function reset() {
    active = false;
    clearTimeout(timer);
    const rec = current;
    if (rec) {
      detach(rec);
      try { rec.abort(); } catch { /* The browser has already disconnected. */ }
    }
  }

  function fail(message: string) {
    reset();
    handlers.status('idle');
    handlers.transcript([], '');
    handlers.error(message);
  }

  function connect() {
    if (!active) return;
    handlers.status('starting');
    try {
      const rec = new Ctor();
      current = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      let started = false;
      let noSpeech = false;
      rec.onstart = () => {
        if (current !== rec) return;
        started = true;
        clearTimeout(timer);
        handlers.status('listening');
      };
      rec.onresult = (event) => {
        if (current !== rec) return;
        const final: string[] = [];
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal && text.trim()) final.push(text);
          if (!result.isFinal) interim += text;
        }
        if (final.length || interim.trim()) emptyRetries = 0;
        handlers.transcript(final, interim);
      };
      rec.onerror = ({ error }) => {
        if (current !== rec) return;
        if (error === 'no-speech') {
          noSpeech = true;
          return; // The browser sends an end event after silence.
        }
        fail(errorMessage(error));
      };
      rec.onend = () => {
        if (current !== rec) return;
        clearTimeout(timer);
        detach(rec);
        handlers.transcript([], '');
        if ((!started && !noSpeech) || emptyRetries >= maxEmptyRetries) {
          fail(noSpeech
            ? 'No speech was detected. Check that the microphone can hear you, then start again.'
            : 'The browser stopped listening. Select Start listening to try again.');
          return;
        }
        emptyRetries += 1;
        handlers.status('starting');
        timer = setTimeout(connect, 400);
      };
      timer = setTimeout(() => {
        if (current === rec) fail('The browser did not start listening. Check for a microphone permission prompt, then try again.');
      }, 30_000);
      rec.start();
    } catch (error) {
      fail(errorMessage(error instanceof Error && error.name === 'NotAllowedError' ? 'not-allowed' : 'unknown'));
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      emptyRetries = 0;
      connect();
    },
    stop() {
      reset();
      handlers.status('idle');
      handlers.transcript([], '');
    },
    dispose: reset,
  };
}
