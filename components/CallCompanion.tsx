'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { refreshCalendar } from '@/lib/calendar-store';
import type { CommEntry } from '@/lib/dashboard-types';
import { useCompanionRecognition } from './useCompanionRecognition';

// The hearing companion in call mode: it listens (through the
// browser's speech recognition) while the person is on a phone call
// about their case, suggests what to say next, and adds the details
// it hears — dates, deadlines, the case number, names — to the case,
// each with an Undo. At the end it saves a short summary of the call
// to the case's communication log, with the transcript (which the
// person can switch off). It runs full-page from the calendar, or
// embedded in the case view (embedded=true).

interface Advice { title: string; say: string; tips: string[]; at: number }
interface CallFact { kind: string; label: string; valueText: string; valueDate: string | null; valueTime: string | null }
interface AppliedRef { type: 'deadline' | 'event' | 'case_number' | 'appearance'; id: string; label: string; valueText: string }
interface Added { key: string; label: string; valueText: string; refs: AppliedRef[]; undone?: boolean }

interface CallEvent {
  id: string; caseId: string; caseTitle: string; title: string; phone: string;
  people: string; details: string; occurredOn: string; done: boolean;
}

/** Quick, offline cards for things that come up on most calls. */
const CALL_TRIGGERS: { key: string; re: RegExp; title: string; say: string; tips: string[] }[] = [
  {
    key: 'date', re: /\b(monday|tuesday|wednesday|thursday|friday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2})\b/i,
    title: 'A date was mentioned',
    say: '“Could you repeat that date and time so I can write it down?”',
    tips: ['Read the date back to them to confirm it.', 'Ask whether it is in person or remote.'],
  },
  {
    key: 'agree', re: /\b(agree|settle|offer|deal|stipulat)/i,
    title: 'They may be asking you to agree to something',
    say: '“I’d like to see that in writing before I agree. Can you email it to me?”',
    tips: ['You do not have to decide on the call.', 'Ask for the exact terms in writing.'],
  },
  {
    key: 'file', re: /\b(file|filing|form|paperwork|submit)\b/i,
    title: 'Paperwork came up',
    say: '“Which form is that, and when is it due?”',
    tips: ['Ask for the form’s name or number.', 'Ask where and how to file it (online, mail, in person).'],
  },
  {
    key: 'remote', re: /\b(webex|zoom|teams|video|remote|virtual)\b/i,
    title: 'Appearing remotely',
    say: '“Can you send me the link and the instructions by email?”',
    tips: ['Ask for the meeting number and passcode.', 'Ask what to do if the video drops — is there a phone number?'],
  },
];

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tzOffset(): string {
  const m = -new Date().getTimezoneOffset();
  const sign = m >= 0 ? '+' : '-';
  const a = Math.abs(m);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export default function CallCompanion({
  caseId,
  eventId,
  embedded = false,
  onChanged,
  onSaved,
  onClose,
}: {
  caseId: string;
  eventId: string | null;
  /** Shown inside the case view: no case header, a who-and-direction row. */
  embedded?: boolean;
  /** Something was added to or removed from the case. */
  onChanged?: () => void;
  /** The call was saved to the communication log. */
  onSaved?: (comm: CommEntry | null) => void;
  onClose?: () => void;
}) {
  const [event, setEvent] = useState<CallEvent | null>(null);
  const [caseTitle, setCaseTitle] = useState('');
  const [finalText, setFinalText] = useState('');
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [added, setAdded] = useState<Added[]>([]);
  const [errNote, setErrNote] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saveTranscript, setSaveTranscript] = useState(true);
  const [whoInput, setWhoInput] = useState('');
  const [direction, setDirection] = useState<'to_court' | 'from_court'>('to_court');
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState<{ summary: string } | null>(null);
  const [aiOn, setAiOn] = useState<boolean | null>(null);

  const textRef = useRef('');
  const pendingRef = useRef('');
  const seenFacts = useRef(new Set<string>());
  const lastLocal = useRef<Record<string, number>>({});
  const startedAt = useRef<string>(new Date().toISOString());
  const busyRef = useRef(false);
  const mic = useCompanionRecognition((chunk) => {
    textRef.current = `${textRef.current} ${chunk}`.trim();
    pendingRef.current = `${pendingRef.current} ${chunk}`;
    setFinalText(textRef.current);
    localCards(chunk);
    if (pendingRef.current.length > 260) void flush();
  }, `${caseId}:${eventId ?? ''}`);
  const listening = mic.status === 'listening';
  const micActive = mic.status !== 'idle';

  const callWith = whoInput.trim() || event?.people || (event?.title || '').replace(/^Call\s+/i, '').replace(/\s+at\s+[\d()+\s.-]+(ext\.\s*\d+)?$/i, '');

  useEffect(() => {
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (b?.event) { setEvent(b.event); setCaseTitle(b.event.caseTitle); }
        })
        .catch(() => undefined);
    }
    if (!eventId) {
      fetch(`/api/cases/${caseId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => { if (b?.case?.title) setCaseTitle(b.case.title); })
        .catch(() => undefined);
    }
  }, [caseId, eventId]);

  // Ask for suggestions every few seconds while new words arrive.
  useEffect(() => {
    if (!micActive) return;
    const t = setInterval(() => { void flush(); }, 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micActive]);

  function localCards(chunk: string) {
    const now = Date.now();
    for (const t of CALL_TRIGGERS) {
      if (!t.re.test(chunk)) continue;
      if (now - (lastLocal.current[t.key] || 0) < 90_000) continue;
      lastLocal.current[t.key] = now;
      setAdvice((a) => [{ title: t.title, say: t.say, tips: t.tips, at: now }, ...a].slice(0, 4));
    }
  }

  async function addFacts(facts: CallFact[]) {
    const fresh = facts.filter((f) => {
      const k = `${f.kind}|${f.valueText.toLowerCase()}|${f.valueDate || ''}`;
      if (seenFacts.current.has(k)) return false;
      seenFacts.current.add(k);
      return true;
    });
    if (!fresh.length) return;
    try {
      const r = await fetch(`/api/cases/${caseId}/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'facts', facts: fresh, eventId, callWith, tz: tzOffset() }),
      });
      const b = await r.json().catch(() => null);
      const refs: AppliedRef[] = (b?.refs || []) as AppliedRef[];
      setAdded((list) => [
        ...fresh.map((f, i) => ({
          key: `${Date.now()}-${i}-${f.valueText}`,
          label: f.label,
          valueText: f.valueText,
          refs: refs.filter((x) => x.valueText === f.valueText),
        })),
        ...list,
      ]);
      void refreshCalendar();
      if (refs.length) onChanged?.();
    } catch { /* the next pass retries new facts only */ }
  }

  async function flush() {
    const newText = pendingRef.current.trim();
    if (!newText || busyRef.current) return;
    busyRef.current = true;
    pendingRef.current = '';
    try {
      const r = await fetch('/api/companion/assist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId,
          transcriptTail: textRef.current.slice(-6000),
          newText,
          callWith,
          today: todayLocal(),
        }),
      });
      const b = await r.json().catch(() => null);
      if (b) {
        setAiOn(Boolean(b.ai));
        const now = Date.now();
        if (Array.isArray(b.advice) && b.advice.length) {
          setAdvice((a) => [...b.advice.map((x: Omit<Advice, 'at'>, i: number) => ({ ...x, at: now + i })), ...a].slice(0, 4));
        }
        if (Array.isArray(b.facts) && b.facts.length) await addFacts(b.facts);
      }
    } catch { /* keep listening */ } finally {
      busyRef.current = false;
    }
  }

  function start() {
    setErrNote(null);
    if (!textRef.current) startedAt.current = new Date().toISOString();
    mic.start();
  }

  function stop() {
    mic.stop();
    void flush();
  }

  async function undo(a: Added) {
    for (const ref of a.refs) {
      await fetch(`/api/cases/${caseId}/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'undo', ref }),
      }).catch(() => undefined);
    }
    setAdded((list) => list.map((x) => (x.key === a.key ? { ...x, undone: true } : x)));
    void refreshCalendar();
    onChanged?.();
  }

  async function addNote() {
    const v = note.trim();
    if (!v) return;
    setNote('');
    await addFacts([{ kind: 'note', label: 'Note', valueText: v, valueDate: null, valueTime: null }]);
  }

  async function finish() {
    stop();
    setErrNote(null);
    setFinishing(true);
    try {
      const r = await fetch(`/api/cases/${caseId}/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'finish',
          eventId,
          callWith,
          transcript: textRef.current,
          saveTranscript,
          notes: added.filter((a) => !a.undone).map((a) => `${a.label}: ${a.valueText}`),
          startedAt: startedAt.current,
          callDate: todayLocal(),
          direction,
        }),
      });
      const b = await r.json().catch(() => null);
      if (r.ok && b) {
        setFinished({ summary: b.summary || '' });
        void refreshCalendar();
        onSaved?.(b.comm || null);
      } else {
        setErrNote('The call summary could not be saved. Try again in a moment.');
      }
    } catch {
      setErrNote('The call summary could not be saved. Check your connection and try again.');
    } finally {
      setFinishing(false);
    }
  }

  const tel = event?.phone ? event.phone.replace(/[^\d+]/g, '') : '';
  const liveAdded = added.filter((a) => !a.undone);

  return (
    <div className={`callcomp${embedded ? ' embedded' : ''}`}>
      {(!embedded || event) && (
      <section className="callhead">
        <span className="callhead-icon"><Icon name="phone" size={22} /></span>
        <div className="callhead-texts">
          <p className="agendakind">Phone call</p>
          <h2>{event?.title || 'Call about your case'}</h2>
          {caseTitle && (
            <p className="fineprint">
              Case: <Link href={`/dashboard/cases/${caseId}`}>{caseTitle}</Link>
            </p>
          )}
        </div>
        {tel && (
          <a className="btn primary" href={`tel:${tel}`}>
            <Icon name="phone" size={16} /> Call {event?.phone}
          </a>
        )}
      </section>
      )}
      {event?.details && <p className="fineprint prewrap callreq">{event.details}</p>}

      {!finished && (
        <div className="callwho formgrid">
          <div className="field">
            <label htmlFor="cc-who">Who is the call with?</label>
            <input
              id="cc-who" value={whoInput} maxLength={200}
              placeholder={event?.people || 'e.g. Court clerk, opposing counsel'}
              onChange={(e) => setWhoInput(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="cc-dir">Who called</label>
            <select id="cc-dir" value={direction} onChange={(e) => setDirection(e.target.value as 'to_court' | 'from_court')}>
              <option value="to_court">I called them</option>
              <option value="from_court">They called me</option>
            </select>
          </div>
        </div>
      )}

      <div className="warn livewarn">
        <h2>{embedded ? 'Before you turn it on' : 'Before you start'}</h2>
        <ul>
          <li>
            <strong>Tell the other person.</strong> In some states everyone on a call must agree
            before it is listened to or transcribed. Start with: “I’m taking notes with an app
            during this call — is that all right?”
          </li>
          <li>
            <strong>Put the call on speaker</strong> near this device, or call from another phone.
            The companion uses this device’s microphone, not the phone line. Your browser may
            send audio to its speech recognition service. quikForm receives transcript text
            for suggestions and saves the transcript to the case only if you leave that option on.
          </li>
          <li>
            Suggestions are general information, not legal advice. Details it hears are added to
            the case right away — each one has an Undo.
          </li>
        </ul>
      </div>

      {mic.unavailable && (
        <p className="warn">{mic.unavailable} You can still add notes by hand below.</p>
      )}

      {!finished && (
        <div className="livecontrols">
          {!micActive ? (
            <button className="btn primary big" disabled={!mic.ready || finishing} onClick={start}>
              <Icon name="headphones" size={18} /> {finalText ? 'Resume listening' : 'Start listening'}
            </button>
          ) : (
            <button className="btn big stopbtn" onClick={stop}>{listening ? 'Pause listening' : 'Cancel'}</button>
          )}
          <span className="livelabel" role="status">
            {listening ? 'Listening: speak normally' : micActive ? 'Connecting to speech recognition…' : ''}
          </span>
        </div>
      )}
      {!finished && mic.error && <p className="error" role="alert">{mic.error} You can still add notes by hand.</p>}
      {errNote && <p className="error" role="alert">{errNote}</p>}
      {aiOn === false && listening && (
        <p className="fineprint">
          Smart suggestions aren’t set up on this site, so the companion is using its built-in
          tips and date reader.
        </p>
      )}

      <div className="callgrid">
        <section className="dashsection">
          <h2 className="srhead">Consider saying</h2>
          {advice.length === 0 && (
            <p className="fineprint">Suggestions appear here as the call goes on.</p>
          )}
          {advice.map((c) => (
            <div key={`${c.title}-${c.at}`} className="coachcard bigcard">
              <p className="cardtitle">{c.title}</p>
              {c.say && <p className="callsay">{c.say}</p>}
              {c.tips.length > 0 && (
                <ul>{c.tips.map((x, i) => <li key={i}>{x}</li>)}</ul>
              )}
            </div>
          ))}
        </section>

        <section className="dashsection">
          <h2 className="srhead">Added to the case</h2>
          {added.length === 0 && (
            <p className="fineprint">Dates, deadlines, names, and numbers heard on the call show up here.</p>
          )}
          <ul className="commlist addedfacts">
            {added.map((a) => (
              <li key={a.key} className="commitem addedfact">
                <span className={`dirbadge ${a.undone ? '' : 'from_court'}`}>{a.undone ? 'Removed' : 'Added'}</span>
                <span className="addedfact-text"><strong>{a.label}:</strong> {a.valueText}</span>
                {!a.undone && a.refs.length > 0 && (
                  <button type="button" className="btn small ghost" onClick={() => undo(a)}>Undo</button>
                )}
              </li>
            ))}
          </ul>
          <form className="callnote" onSubmit={(e) => { e.preventDefault(); void addNote(); }}>
            <label className="srhead fineprint" htmlFor="callnote">Add a note yourself</label>
            <div className="callnote-row field">
              <input
                id="callnote" value={note} placeholder="e.g. Clerk said to bring two copies"
                onChange={(e) => setNote(e.target.value)} maxLength={300}
              />
              <button type="submit" className="btn" disabled={!note.trim()}>Add</button>
            </div>
          </form>
        </section>
      </div>

      <section className="dashsection">
        <h2 className="srhead">What is being said</h2>
        <div className="transcript" aria-live="polite">
          {finalText || mic.interim ? (
            <p>{finalText} <span className="interim">{mic.interim}</span></p>
          ) : (
            <p className="fineprint">
              {listening ? 'Listening… the transcript appears here as people speak.' : 'The transcript appears here while listening is on.'}
            </p>
          )}
        </div>
      </section>

      {!finished ? (
        <section className="dashsection callend">
          <label className="toggleline">
            <input type="checkbox" checked={saveTranscript} onChange={(e) => setSaveTranscript(e.target.checked)} />
            <span>
              <strong>Save the transcript in the communication log</strong>
              <span className="fineprint block">Turn this off to keep only the summary.</span>
            </span>
          </label>
          <button className="btn primary" disabled={finishing} onClick={finish}>
            <Icon name="check" size={16} /> {finishing ? 'Saving…' : 'End call and save to the log'}
          </button>
        </section>
      ) : (
        <section className="dashsection savednote">
          <h2>Call saved to the communication log</h2>
          <p className="prewrap">{finished.summary}</p>
          <p className="fineprint">
            {liveAdded.length} detail{liveAdded.length === 1 ? '' : 's'} added to this case
            {saveTranscript && finalText ? ', transcript saved' : ''}.{' '}
            {embedded ? (
              <a href="#comms">See the communication log</a>
            ) : (
              <Link href={`/dashboard/cases/${caseId}#comms`}>Open the case</Link>
            )}{' '}·{' '}
            <Link href="/dashboard/calendar">Calendar</Link>
          </p>
          {embedded && onClose && (
            <button type="button" className="btn" onClick={onClose}>Done</button>
          )}
        </section>
      )}
    </div>
  );
}
