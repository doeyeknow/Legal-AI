'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ETIQUETTE, SIM_BANKS, type SimBank } from '@/lib/practice';
import { SpeechPlayer } from '@/lib/speech';
import { Icon } from './icons';

interface CaseOption {
  id: string;
  title: string;
}

type Phase = 'pick' | 'run' | 'done';

export default function PracticeSim() {
  const [phase, setPhase] = useState<Phase>('pick');
  const [bank, setBank] = useState<SimBank | null>(null);
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  // Voice: the judge speaks each question aloud (same voice and
  // /api/tts route as the interview). Off by default.
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const spokenKeyRef = useRef('');

  function getPlayer(): SpeechPlayer {
    if (!playerRef.current) {
      const p = new SpeechPlayer();
      p.onUnavailable = () => {
        setVoiceOn(false);
        setSpeaking(false);
        setVoiceNote('Voice is not set up on this site yet — the written practice works exactly the same.');
      };
      p.onActiveChange = (active) => setSpeaking(active);
      playerRef.current = p;
    }
    return playerRef.current;
  }

  function toggleVoice() {
    if (voiceOn) {
      playerRef.current?.stop();
      setVoiceOn(false);
      setSpeaking(false);
      return;
    }
    setVoiceNote(null);
    spokenKeyRef.current = '';
    setVoiceOn(true);
  }

  // Speak the judge's current question whenever it changes while
  // voice is on (the key ref keeps re-renders from re-asking it).
  useEffect(() => {
    if (!voiceOn || phase !== 'run' || !bank) return;
    const key = `${bank.motionId}:${qi}`;
    if (spokenKeyRef.current === key) return;
    spokenKeyRef.current = key;
    getPlayer().enqueue(`The judge asks: ${bank.questions[qi].question}`);
  }, [voiceOn, phase, bank, qi]);

  useEffect(() => {
    return () => { playerRef.current?.stop(); };
  }, []);

  const voiceCtl = (
    <div className="voicectl">
      <button
        type="button"
        className={`btn${voiceOn ? '' : ' primary'}`}
        onClick={toggleVoice}
        aria-pressed={voiceOn}
      >
        <Icon name="speaker" size={16} /> {voiceOn ? 'Voice on — tap to turn off' : 'Hear the judge ask'}
      </button>
      {voiceOn && (
        <span className="vstatus">Each question is read aloud, like the real thing.</span>
      )}
      {voiceOn && speaking && (
        <button type="button" className="btn ghost" onClick={() => playerRef.current?.stop()}>
          Stop speaking
        </button>
      )}
      {voiceNote && <p className="voicenote" role="status">{voiceNote}</p>}
    </div>
  );

  // Optional case tie: only offered when signed in (fails quietly).
  useEffect(() => {
    fetch('/api/cases')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.cases)) {
          setCases(data.cases.map((c: CaseOption) => ({ id: c.id, title: c.title })));
        }
      })
      .catch(() => {});
  }, []);

  function start(b: SimBank) {
    setBank(b);
    setQi(0);
    setAnswer('');
    setRevealed(false);
    setPhase('run');
  }

  function next() {
    if (!bank) return;
    if (qi + 1 >= bank.questions.length) {
      setPhase('done');
    } else {
      setQi(qi + 1);
      setAnswer('');
      setRevealed(false);
    }
  }

  if (phase === 'pick' || !bank) {
    return (
      <div>
        {voiceCtl}
        <p>
          The judge will ask questions like these. Answer each one out loud or in writing,
          the way you would in the courtroom — then see what the judge was really testing and
          how a strong answer is built. No simulation can predict a specific judge; these are
          the questions judges commonly ask on each motion.
        </p>
        {cases.length > 0 && (
          <div className="field">
            <label htmlFor="sim-case">Practice for one of your cases (optional)</label>
            <select id="sim-case" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">No specific case</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        )}
        <div className="picklist">
          {SIM_BANKS.map((b) => (
            <button key={b.motionId} className="pickitem" onClick={() => start(b)}>
              <strong>{b.name}</strong>
              <span>{b.questions.length} likely questions, with coaching</span>
            </button>
          ))}
        </div>
        <EtiquetteRecap />
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div>
        {voiceCtl}
        <h2>Practice complete — {bank.name}</h2>
        {caseId && (
          <p className="fineprint">
            Practiced for your case: <Link href={`/dashboard/cases/${caseId}`}>open the case</Link>.
          </p>
        )}
        <section className="dashsection">
          <h3>How a strong answer is structured</h3>
          <ul>
            {bank.outline.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
        <section className="dashsection">
          <h3>The mistakes that lose these hearings</h3>
          <ul>
            {bank.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
        <EtiquetteRecap />
        <div className="choices">
          <button className="btn primary" onClick={() => start(bank)}>Run it again</button>
          <button className="btn" onClick={() => setPhase('pick')}>Pick another motion</button>
          <Link className="btn ghost" href="/interview">Prepare the document</Link>
        </div>
      </div>
    );
  }

  const q = bank.questions[qi];
  return (
    <div>
      {voiceCtl}
      <p className="progress">
        {bank.name} — Question {qi + 1} of {bank.questions.length}
      </p>
      <div className="simq">
        <p className="fineprint">The judge asks:</p>
        <p className="simquestion">“{q.question}”</p>
      </div>
      <div className="field full">
        <label htmlFor="sim-answer">Your answer (say it out loud too — that is the real practice)</label>
        <textarea
          id="sim-answer"
          rows={4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer the question that was asked — then stop."
        />
      </div>
      {!revealed ? (
        <button className="btn primary" onClick={() => setRevealed(true)}>
          See the coaching
        </button>
      ) : (
        <div className="coachcard">
          <p><strong>What the judge is testing:</strong> {q.testing}</p>
          <p><strong>How a strong answer is built:</strong></p>
          <ul>
            {bank.outline.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
          <p><strong>Mistakes to avoid:</strong></p>
          <ul>
            {bank.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <button className="btn primary" onClick={next}>
            {qi + 1 >= bank.questions.length ? 'Finish' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}

function EtiquetteRecap() {
  return (
    <section className="dashsection">
      <h3>Every hearing: the basics</h3>
      <div className="grid">
        <div className="card">
          <strong>Addressing the court</strong>
          {ETIQUETTE.address.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
        <div className="card">
          <strong>When to speak</strong>
          {ETIQUETTE.speaking.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
        <div className="card">
          <strong>What to bring</strong>
          {ETIQUETTE.bring.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
        <div className="card">
          <strong>How it usually runs</strong>
          {ETIQUETTE.flow.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
