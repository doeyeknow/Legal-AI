'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CHARGE_KINDS, DEFENSE_DISCLAIMER, DEFENSE_MYTHS,
  activeQuestions, guessChargeKind, scoreDefenses, strengthLabel,
  type ChargeKind, type DefenseMatch, type ScreenAnswer,
} from '@/lib/defenses';
import { getMotion } from '@/lib/motions/match';
import { Icon } from './icons';

/**
 * "Ways to get the charges dropped" — one question per page, then a
 * ranked list of the defenses the answers point to, each with how
 * to raise it, the deadline, what to collect, and a button into the
 * matching motion template.
 *
 * Used inside the interview (onStartMotion picks the motion in
 * place) and on the standalone /defenses/check page (links to
 * /interview?motion=...).
 */
export default function DefenseCheck({
  situation = '',
  continueLabel,
  onContinue,
  onStartMotion,
}: {
  situation?: string;
  /** e.g. "Continue to Motion to Dismiss Charges" */
  continueLabel?: string;
  onContinue?: () => void;
  onStartMotion?: (motionId: string) => void;
}) {
  const guessed = useMemo(() => guessChargeKind(situation), [situation]);
  const [phase, setPhase] = useState<'intro' | 'kind' | 'q' | 'results'>('intro');
  const [kind, setKind] = useState<ChargeKind | null>(guessed);
  const [answers, setAnswers] = useState<Record<string, ScreenAnswer>>({});
  const [idx, setIdx] = useState(0);

  const questions = activeQuestions(kind, answers);
  const q = questions[idx];
  const results = useMemo(() => (phase === 'results' ? scoreDefenses(kind, answers) : []), [phase, kind, answers]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 });
  }, [phase, idx]);

  function answer(a: ScreenAnswer) {
    if (!q) return;
    const next = { ...answers, [q.id]: a };
    // Drop answers to follow-ups that no longer apply.
    const still = new Set(activeQuestions(kind, next).map((x) => x.id));
    for (const k of Object.keys(next)) if (!still.has(k)) delete next[k];
    setAnswers(next);
    const list = activeQuestions(kind, next);
    const pos = list.findIndex((x) => x.id === q.id);
    if (pos + 1 >= list.length) setPhase('results');
    else setIdx(pos + 1);
  }

  function back() {
    if (phase === 'results') { setPhase('q'); setIdx(Math.max(0, questions.length - 1)); return; }
    if (phase === 'q') { if (idx > 0) setIdx(idx - 1); else setPhase('kind'); return; }
    if (phase === 'kind') setPhase('intro');
  }

  function restart() {
    setAnswers({}); setIdx(0); setPhase('kind');
  }

  return (
    <div className="defcheck">
      {phase === 'intro' && (
        <div className="chatcard defintro">
          <p className="stepkicker">Before we write anything</p>
          <h4>Let&apos;s look for ways to get the charges dropped</h4>
          <p className="cardsub">
            A few quick yes / no questions about the stop, the search, the questioning, and the
            evidence. Your answers point to the defenses and dismissal paths that most often work —
            illegal stops, missed deadlines, missing evidence, diversion — with how to raise each one.
          </p>
          <p className="fineprint">{DEFENSE_DISCLAIMER}</p>
          <div className="defnav">
            <button type="button" className="btn primary big" onClick={() => setPhase(kind ? 'q' : 'kind')}>
              Start the questions
            </button>
            {onContinue && (
              <button type="button" className="btn ghost" onClick={onContinue}>
                {continueLabel || 'Skip this'}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'kind' && (
        <div className="chatcard">
          <p className="stepkicker">Step 1</p>
          <h4>What are you charged with?</h4>
          <div className="defkinds">
            {CHARGE_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                className={`defkind${kind === k.key ? ' on' : ''}`}
                onClick={() => { setKind(k.key); setAnswers({}); setIdx(0); setPhase('q'); }}
              >
                <strong>{k.label}</strong>
                <span>{k.hint}</span>
              </button>
            ))}
          </div>
          <div className="defnav">
            <button type="button" className="btn ghost" onClick={back}>Back</button>
          </div>
        </div>
      )}

      {phase === 'q' && q && (
        <div className="chatcard defq" key={q.id}>
          <div className="defprog" aria-hidden="true">
            <span style={{ width: `${Math.round(((idx + 1) / Math.max(1, questions.length)) * 100)}%` }} />
          </div>
          <p className="stepkicker">
            Question {idx + 1} of {questions.length}
            {kind && <> · {CHARGE_KINDS.find((k) => k.key === kind)?.label}</>}
          </p>
          <h4>{q.text}</h4>
          {q.help && <p className="cardsub">{q.help}</p>}
          <div className="defanswers">
            {(['yes', 'no', 'unsure'] as ScreenAnswer[]).map((a) => (
              <button
                key={a}
                type="button"
                className={`btn big${answers[q.id] === a ? ' primary' : ''}`}
                onClick={() => answer(a)}
              >
                {a === 'yes' ? 'Yes' : a === 'no' ? 'No' : 'Not sure'}
              </button>
            ))}
          </div>
          <div className="defnav">
            <button type="button" className="btn ghost" onClick={back}>Back</button>
            <button type="button" className="btn ghost" onClick={() => setPhase('results')}>
              Skip to results
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <DefenseResults
          results={results}
          kind={kind}
          onBack={back}
          onRestart={restart}
          onStartMotion={onStartMotion}
          onContinue={onContinue}
          continueLabel={continueLabel}
          answers={answers}
        />
      )}
    </div>
  );
}

function DefenseResults({
  results, kind, answers, onBack, onRestart, onStartMotion, onContinue, continueLabel,
}: {
  results: DefenseMatch[];
  kind: ChargeKind | null;
  answers: Record<string, ScreenAnswer>;
  onBack: () => void;
  onRestart: () => void;
  onStartMotion?: (id: string) => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const [open, setOpen] = useState<string | null>(results[0]?.defense.id ?? null);
  const flagged = results.filter((r) => r.score > 0);
  const always = results.filter((r) => r.score === 0);

  return (
    <div className="defresults">
      <div className="chatcard">
        <p className="stepkicker">Your results</p>
        <h4>
          {flagged.length
            ? `${flagged.length} possible way${flagged.length === 1 ? '' : 's'} to fight or drop the charge`
            : 'No specific red flags from your answers — here is what still helps'}
        </h4>
        <p className="cardsub">
          Ranked by how strongly your answers point to each one. Open any of them for the steps,
          the deadline, and what to collect now. Bring this list to your lawyer or public defender.
        </p>
        <div className="defnav">
          <button type="button" className="btn ghost small" onClick={onBack}>Back</button>
          <button type="button" className="btn ghost small" onClick={onRestart}>Start over</button>
          <button type="button" className="btn ghost small" onClick={() => window.print()}>
            <Icon name="printer" size={14} /> Print
          </button>
          <SaveToCase results={results} kind={kind} answers={answers} />
        </div>
      </div>

      {[...flagged, ...always].map((r) => (
        <DefenseCard
          key={r.defense.id}
          match={r}
          open={open === r.defense.id}
          onToggle={() => setOpen(open === r.defense.id ? null : r.defense.id)}
          onStartMotion={onStartMotion}
        />
      ))}

      <div className="chatcard defmyths">
        <h4>Common beliefs that do not get charges dropped</h4>
        <ul>
          {DEFENSE_MYTHS.map((m) => (
            <li key={m.myth}><strong>{m.myth}</strong> {m.truth}</li>
          ))}
        </ul>
        <p className="fineprint">{DEFENSE_DISCLAIMER}</p>
        <p className="fineprint">
          <Link href="/defenses">Browse the full defense guide</Link>
        </p>
      </div>

      {onContinue && (
        <div className="defnav defcontinue">
          <button type="button" className="btn primary big" onClick={onContinue}>
            {continueLabel || 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}

export function DefenseCard({
  match, open, onToggle, onStartMotion,
}: {
  match: DefenseMatch;
  open: boolean;
  onToggle: () => void;
  onStartMotion?: (id: string) => void;
}) {
  const d = match.defense;
  const motions = d.motionIds.map((id) => getMotion(id)).filter(Boolean);
  return (
    <article className={`chatcard defcard${open ? ' open' : ''}`}>
      <button type="button" className="defcardhead" onClick={onToggle} aria-expanded={open}>
        <span className={`defstrength s${Math.min(3, match.score)}`}>{strengthLabel(match.score)}</span>
        <strong>{d.name}</strong>
        <span className="defoutcome">{d.outcome}</span>
        <span className="defchev"><Icon name="chevronRight" size={16} /></span>
      </button>
      {match.reasons.length > 0 && (
        <ul className="defwhy">
          {match.reasons.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {open && (
        <div className="defbody">
          <p>{d.summary}</p>
          <h5>How to raise it</h5>
          <ol>{d.howToRaise.map((s) => <li key={s}>{s}</li>)}</ol>
          <h5>Deadline</h5>
          <p className="defdeadline"><Icon name="calendar" size={14} /> {d.timing}</p>
          <h5>Collect now</h5>
          <ul>{d.evidence.map((s) => <li key={s}>{s}</li>)}</ul>
          <h5>Honest limits</h5>
          <ul>{d.limits.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="defsources">
            Sources:{' '}
            {d.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && '; '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              </span>
            ))}
          </p>
          <div className="defnav">
            {motions.map((m) =>
              onStartMotion ? (
                <button key={m!.id} type="button" className="btn primary" onClick={() => onStartMotion(m!.id)}>
                  Start: {m!.name}
                </button>
              ) : (
                <Link key={m!.id} className="btn primary" href={`/interview?motion=${encodeURIComponent(m!.id)}`}>
                  Start: {m!.name}
                </Link>
              ),
            )}
            <Link className="btn ghost" href={`/defenses/${d.id}`}>Full guide</Link>
          </div>
        </div>
      )}
    </article>
  );
}

/** Saves the results as a note on one of the user's cases. Hidden
 *  for signed-out visitors (the case list call returns 401). */
function SaveToCase({
  results, kind, answers,
}: {
  results: DefenseMatch[];
  kind: ChargeKind | null;
  answers: Record<string, ScreenAnswer>;
}) {
  const [cases, setCases] = useState<{ id: string; title: string }[] | null>(null);
  const [pick, setPick] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let live = true;
    fetch('/api/cases')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.cases) return;
        const list = (d.cases as { id: string; title: string; status: string }[])
          .filter((c) => c.status !== 'Draft')
          .map((c) => ({ id: c.id, title: c.title }));
        setCases(list);
        if (list[0]) setPick(list[0].id);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (!cases || !cases.length) return null;

  async function save() {
    setState('saving');
    const label = CHARGE_KINDS.find((k) => k.key === kind)?.label || 'Criminal charge';
    const lines = results.map((r) => `- ${r.defense.name} (${strengthLabel(r.score)}): ${r.reasons.join(' ')} Deadline: ${r.defense.timing}`);
    const yes = Object.entries(answers).filter(([, a]) => a === 'yes').length;
    const today = new Date();
    const occurredOn = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(pick)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'note',
          title: `Defense check: ${results.filter((r) => r.score > 0).length} possible defenses`,
          details: `${label}. ${yes} yes answers.\n\n${lines.join('\n')}\n\n${DEFENSE_DISCLAIMER}`,
          occurredOn,
        }),
      });
      setState(res.ok ? 'saved' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <span className="defsave">
      <select value={pick} onChange={(e) => { setPick(e.target.value); setState('idle'); }} aria-label="Case to save to">
        {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <button type="button" className="btn small" disabled={state === 'saving' || state === 'saved'} onClick={save}>
        {state === 'saved' ? 'Saved to case timeline' : state === 'saving' ? 'Saving…' : 'Save to case'}
      </button>
      {state === 'error' && <span className="err">Could not save.</span>}
    </span>
  );
}
