'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal Web Speech API typing (not in the standard DOM lib).
interface SRResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start: () => void;
  stop: () => void;
}

interface Suggestion {
  key: string;
  title: string;
  consider: string[];
  at: number;
}

const TRIGGERS: { key: string; title: string; patterns: RegExp; consider: string[] }[] = [
  {
    key: 'objection',
    title: 'An objection was raised',
    patterns: /objection|overruled|sustained/,
    consider: [
      'Stop talking and let the judge rule — never argue with the other side directly.',
      'If the objection is sustained, move on to your next point without repeating the excluded material.',
      'If it is overruled, continue calmly from where you stopped.',
    ],
  },
  {
    key: 'turn',
    title: 'It sounds like your turn to respond',
    patterns: /what do you say|your response|do you agree|your position|how do you respond|what is your (request|position)/,
    consider: [
      'Address the judge, not the other party: “Your Honor, …”',
      'Answer the exact question asked, in one or two sentences — then stop.',
      'End with what you are asking the court to order, in one plain sentence.',
    ],
  },
  {
    key: 'dates',
    title: 'Dates are being discussed',
    patterns: /what date|when did|when was|schedule|calendar|deadline|how long/,
    consider: [
      'Give exact dates, not “a while ago” — check your one-page timeline before answering.',
      'If you are unsure of a date, say so and offer the document that shows it.',
      'If you need more time, name a specific date you can meet — judges grant dates, not open-ended time.',
    ],
  },
  {
    key: 'money',
    title: 'Amounts or income came up',
    patterns: /how much|amount|income|salary|wages|pay stub|arrears|dollars|\$/,
    consider: [
      'Use the figures from your documents, not estimates — hand up the pay stub or statement if you have it.',
      'Separate past-due amounts from future amounts; they are decided differently.',
      '“I don’t know, Your Honor, but I can provide that by [date]” beats a guess.',
    ],
  },
  {
    key: 'documents',
    title: 'Documents or evidence came up',
    patterns: /document|exhibit|evidence|proof|copy of|paperwork|record/,
    consider: [
      'Name the document and its date: “The lease dated …, Your Honor — I have a copy for the court and for the other side.”',
      'Courts usually want three copies: judge, other side, and yours.',
      'If you do not have it, say what it is, where it is, and when you can file it.',
    ],
  },
  {
    key: 'why',
    title: 'You are being asked to explain something',
    patterns: /why didn'?t you|why did you not|why haven'?t|explain why|how come/,
    consider: [
      'Give the factual reason in one sentence, with the date it happened.',
      'If part of it was your fault, concede that part plainly — candor is the currency here — and return to the documented facts.',
      'Do not blame the court or “the system”; state what you did and when you did it.',
    ],
  },
];

export default function HearingLive() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [cards, setCards] = useState<Suggestion[]>([]);
  const [errNote, setErrNote] = useState<string | null>(null);
  const recogRef = useRef<SRecognition | null>(null);
  const liveRef = useRef(false);
  const lastCardAt = useRef<Record<string, number>>({});

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      liveRef.current = false;
      try {
        recogRef.current?.stop();
      } catch { /* already stopped */ }
    };
  }, []);

  function evaluate(chunk: string) {
    const text = chunk.toLowerCase();
    const now = Date.now();
    for (const t of TRIGGERS) {
      if (t.patterns.test(text)) {
        if (now - (lastCardAt.current[t.key] || 0) < 60000) continue;
        lastCardAt.current[t.key] = now;
        setCards((c) => [{ key: t.key, title: t.title, consider: t.consider, at: now }, ...c].slice(0, 4));
      }
    }
  }

  function start() {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => SRecognition)
      | undefined;
    if (!Ctor) return;
    setErrNote(null);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let interimNow = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const chunk = r[0].transcript;
          setFinalText((prev) => `${prev} ${chunk}`.trim());
          evaluate(chunk);
        } else {
          interimNow += r[0].transcript;
        }
      }
      setInterim(interimNow);
    };
    rec.onend = () => {
      if (liveRef.current) {
        try {
          rec.start();
        } catch { /* restart race — the next onend settles it */ }
      } else {
        setListening(false);
      }
    };
    rec.onerror = () => {
      setErrNote('The microphone reported a problem. Check the browser’s microphone permission, then start again.');
    };
    recogRef.current = rec;
    liveRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      setErrNote('Listening could not be started in this browser.');
      setListening(false);
      liveRef.current = false;
    }
  }

  function stop() {
    liveRef.current = false;
    try {
      recogRef.current?.stop();
    } catch { /* already stopped */ }
    setListening(false);
    setInterim('');
  }

  return (
    <div>
      <div className="warn livewarn">
        <h2>Before you ever turn this on in a courtroom</h2>
        <p>
          <strong>Many courts prohibit recording, transcription, and even phone use in the
          courtroom.</strong> Appearing by video is not permission to record. Only use this
          companion where the judge has expressly allowed it — ask first, outside the hearing
          if you can. If you are not sure, keep the phone away and use the{' '}
          practice pages instead.
        </p>
        <p>
          <strong>Nothing here is recorded or stored.</strong> The transcript exists only on
          this screen and is gone when you close the page; the app never saves or uploads it.
          The suggestion cards are general information drawn from hearing practice — not legal
          advice, and not a lawyer speaking for you.
        </p>
      </div>

      {supported === false && (
        <p className="warn">
          This browser does not offer speech recognition (the Web Speech API), so the live
          companion cannot run here. It works in Chrome on Android and desktop. The simulated
          hearing practice works in every browser.
        </p>
      )}

      <div className="livecontrols">
        {!listening ? (
          <button className="btn primary big" disabled={!supported} onClick={start}>
            Start listening
          </button>
        ) : (
          <button className="btn big stopbtn" onClick={stop}>
            ■ Stop listening
          </button>
        )}
        {listening && <span className="livelabel">● Listening — speak normally</span>}
      </div>
      {errNote && <p className="error">{errNote}</p>}

      {cards.length > 0 && (
        <section className="dashsection">
          <h2 className="srhead">Consider</h2>
          {cards.map((c) => (
            <div key={`${c.key}-${c.at}`} className="coachcard bigcard">
              <p className="cardtitle">{c.title}</p>
              <p className="fineprint">Consider saying — in your own words:</p>
              <ul>
                {c.consider.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="dashsection">
        <h2 className="srhead">What is being said</h2>
        <div className="transcript" aria-live="polite">
          {finalText || interim ? (
            <p>
              {finalText} <span className="interim">{interim}</span>
            </p>
          ) : (
            <p className="fineprint">
              {listening
                ? 'Listening… the transcript will appear here as people speak.'
                : 'The transcript will appear here while listening is on. It is never saved.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
