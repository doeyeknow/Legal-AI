'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { MotionDef, MotionField, Answers } from '@/lib/motions/types';
import { SHARED_FIELDS, DISCLAIMER, fill } from '@/lib/motions/types';
import { ALL_MOTIONS, CATEGORIES } from '@/lib/motions/data';
import { matchSituation, getMotion } from '@/lib/motions/match';
import { Icon, CATEGORY_ICONS, type IconName } from './icons';
import { FACT_ANSWER_KEYS, SEED_EXCLUDED_KEYS } from '@/lib/case-facts';
import type { ProfileInfo } from '@/lib/profile';
import { EMPTY_PROFILE, PROFILE_FIELDS, composeAddress } from '@/lib/profile';
import SignaturePad from './SignaturePad';
import HelpTip from './HelpTip';
import DatePicker from './DatePicker';
import DialPad from './DialPad';
import { SpeechPlayer } from '@/lib/speech';
import type { CourtRecord } from '@/lib/courts/index';
import { isCriminalAdversarial, statePartyName } from '@/lib/state-party';

interface Msg { from: 'bot' | 'user'; text: string }
/** A ready-made answer offered as a tappable badge above the
 *  composer. Only ever built for questions whose answer set is
 *  genuinely known — never for open factual fields. */
interface QuickBadge { label: string; primary?: boolean; icon?: IconName; sel?: boolean; action: () => void }

// Criminal-matter party rules live in lib/state-party (shared
// with the PDF generator): the other side is the State.

/** The answers as the document generator should see them: for a
 *  criminal matter, an opposingParty that was never filled (the
 *  question is skipped) is derived from the state answer here as
 *  the final guarantee. */
function withStateParty(m: MotionDef, a: Answers): Answers {
  if (isCriminalAdversarial(m) && !a.opposingParty && a.state) {
    const p = statePartyName(a.state);
    if (p) return { ...a, opposingParty: p };
  }
  return a;
}

/** Build a motion's question queue: shared fields (minus the
 *  seeded/skipped keys) + the motion's own fields. Two matter
 *  types never get the adversarial shared questions:
 *  - in-re matters (name change, probate, guardianship, adoption,
 *    record relief): there IS no opposing party — the caption's
 *    matter name comes from the motion's own answers (lib/pdf.ts
 *    inReMatter).
 *  - criminal / post-conviction matters: the other side is the
 *    State, auto-filled from the state answer (statePartyName),
 *    and there is no opposing attorney to name either.
 *  Everything else (protection orders, custody, civil) keeps both
 *  questions — there genuinely is a respondent/other party. */
function buildQueue(m: MotionDef, skip: Set<string>): MotionField[] {
  const s = new Set(skip);
  if (m.captionStyle === 'in-re' || isCriminalAdversarial(m)) {
    s.add('opposingParty');
    s.add('opposingAttorney');
  }
  const shared = SHARED_FIELDS.filter((f) => !s.has(f.key));
  return [...shared, ...m.fields.filter((f) => !s.has(f.key))];
}
interface FilingInfo {
  heading: string;
  countyName: string | null;
  approximate: boolean;
  steps: { text: string; links?: { label: string; url: string }[] }[];
}

type Stage =
  | 'boot' | 'gate' | 'who' | 'subject' | 'situation' | 'confirm' | 'pick' | 'fields' | 'feew-choice'
  | 'feew-fields' | 'review' | 'signature' | 'pay' | 'generating' | 'done' | 'casefacts';

/** The person the motion is FOR: the profile-shaped basic info plus
 *  the email that goes on the document. For "for me" this starts as
 *  the account profile; for "someone else" it is collected fresh and
 *  never written back to the account. */
interface SubjectInfo extends ProfileInfo {
  email: string;
}

/** Shared caption fields that a confirmed subject already answers,
 *  so the question queue skips them. The rest of SHARED_FIELDS
 *  (filer role, county, court, case number, opposing party) are
 *  case-specific and are still asked every time. */
const SUBJECT_SEEDED_KEYS = ['fullName', 'address', 'phone', 'email', 'zip', 'state'];

const IFP_FIELDS: MotionField[] = [
  { key: 'ifpHousehold', label: 'For the fee waiver: how many people are in your household, including dependents?', required: true },
  { key: 'ifpIncome', label: 'List your income sources and monthly amounts.', required: true },
  { key: 'ifpBenefits', label: 'Do you receive means-tested benefits (SNAP, SSI, TANF, Medicaid)? Which ones, or "none"?', required: true },
  { key: 'ifpExpenses', label: 'What are your essential monthly expenses?', required: true },
  { key: 'ifpAssets', label: 'What cash and bank balances do you have, approximately?', required: true },
];

const STORE_KEY = 'legal-interview-v1';

export default function Interview() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: 'Tell me what is going on, in your own words. I will match it to the right court motion, ask its questions one at a time, and prepare a filing-ready document.' },
    { from: 'bot', text: 'The interview is free. A prepared document is $3 — charged only when your PDF is generated.' },
  ]);
  const [stage, setStage] = useState<Stage>('boot');
  const [input, setInput] = useState('');
  const [motion, setMotion] = useState<MotionDef | null>(null);
  const [candidates, setCandidates] = useState<MotionDef[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [queue, setQueue] = useState<MotionField[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [qTotal, setQTotal] = useState(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [feeWaiverAdded, setFeeWaiverAdded] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [filing, setFiling] = useState<FilingInfo | null>(null);
  const [restoredSession, setRestoredSession] = useState<string | null>(null);
  // Account state: 'off' = accounts not configured (guest flow,
  // exactly as before), 'guest' = accounts live but continuing
  // without signing in, 'user' = signed in.
  const [acct, setAcct] = useState<'unknown' | 'off' | 'guest' | 'user'>('unknown');
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [subject, setSubject] = useState<'self' | 'other' | null>(null);
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo>({ ...EMPTY_PROFILE, email: '' });
  const [saveBack, setSaveBack] = useState(true);
  const [subjectSeeded, setSubjectSeeded] = useState(false);
  // --- Chat-thread presentation state (display only) ---
  // Motion picking is a drill-down: categories first, then one
  // category's motions. The thread itself scrolls, so review and
  // filing steps simply show in full — no pagination.
  const [pickCat, setPickCat] = useState<string | null>(null);
  const [datePickOpen, setDatePickOpen] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  // A motion deep-linked from the library (?motion=<id>): once the
  // flow reaches its natural start (guest start, or the subject
  // step for signed-in users) it begins there instead of at the
  // situation question.
  const preselectRef = useRef<MotionDef | null>(null);
  // --- Court-mail case facts (deep links ?case=<id>&fromInbox=<id>) ---
  // The bag comes from GET /api/cases/[id]/facts, which reads
  // CONFIRMED facts only. Rows map bag keys onto this motion's
  // answer keys; the user accepts or declines each on a step screen
  // before the questions start. Guests never carry a case id.
  const caseIdRef = useRef<string | null>(null);
  const caseSeededKeysRef = useRef<Set<string>>(new Set());
  const caseFactSourcesRef = useRef<Record<string, string>>({});
  const [caseFactRows, setCaseFactRows] = useState<
    { bagKey: string; answerKeys: string[]; value: string; source: string }[]
  >([]);
  const [caseFactUse, setCaseFactUse] = useState<Record<string, boolean>>({});
  // --- Voice layer (off by default; a layer over this engine) ---
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const spokenUptoRef = useRef(0);
  const announcedStageRef = useRef('');
  const recogRef = useRef<any>(null);
  // --- Hands-free voice loop: mirrors + bookkeeping the async
  // recognition/playback callbacks read through refs, so a callback
  // created in an old render never acts on stale state. ---
  const stageRef = useRef<Stage>('boot');
  const voiceOnRef = useRef(false);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const pendingCountyRef = useRef<{ county: string; state: string } | null>(null);
  const emptyCyclesRef = useRef(0);
  const listenPausedRef = useRef(false);
  const autoBlockedRef = useRef(false);
  const notesOnceRef = useRef<Set<string>>(new Set());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recogSessionRef = useRef<{ auto: boolean; gotResult: boolean; suppressEnd: boolean } | null>(null);
  // --- Draft autosave (signed-in users only; guests never save) ---
  const draftIdRef = useRef<string | null>(null);
  const draftSavedSigRef = useRef('');
  const draftSnapRef = useRef<{ sig: string; body: Record<string, unknown> } | null>(null);
  const draftDoneRef = useRef(false);
  const resumeDraftIdRef = useRef<string | null>(null);
  // --- County assist (location / ZIP) ---
  const [pendingCounty, setPendingCounty] = useState<{ county: string; state: string } | null>(null);
  const [zipCounty, setZipCounty] = useState<{ county: string; state: string } | null>(null);
  const zipTriedRef = useRef('');
  // --- Select-field "Other…" free-text mode (per step) ---
  const [otherMode, setOtherMode] = useState(false);
  // --- Court-name step: real courts from the courts database ---
  const [courtOpts, setCourtOpts] = useState<{ key: string; courts: { name: string; kind: string }[] } | null>(null);
  const [courtTyped, setCourtTyped] = useState(false);
  const [courtCard, setCourtCard] = useState<CourtRecord | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const say = (from: 'bot' | 'user', text: string) =>
    setMsgs((m) => [...m, { from, text }]);

  // The signature prompt names the subject when the motion is for
  // someone else — their name is on the signature block, not the
  // account holder's.
  const signPrompt = () =>
    subject === 'other'
      ? `Last step before the document: ${answers.fullName || 'the person this motion is for'} signs below, the way they would sign the paper copy.`
      : 'Last step before your document: sign below, the way you would sign the paper copy.';

  // Returning from Stripe Checkout: restore the interview from sessionStorage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pre = params.get('motion');
    if (pre && !params.get('payment')) {
      const pm = getMotion(pre);
      if (pm) preselectRef.current = pm;
    }
    const draftParam = params.get('draft');
    if (draftParam && !params.get('payment')) {
      resumeDraftIdRef.current = draftParam;
    }
    const caseParam = params.get('case');
    if (caseParam && !params.get('payment')) {
      caseIdRef.current = caseParam;
    }
    if (params.get('payment') === 'success' && params.get('session_id')) {
      try {
        const raw = sessionStorage.getItem(STORE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const m = getMotion(saved.motionId);
          if (m) {
            setMotion(m);
            setAnswers(saved.answers || {});
            setSignature(saved.signature || null);
            setFeeWaiverAdded(!!saved.feeWaiverAdded);
            if (saved.draftId) draftIdRef.current = saved.draftId;
            if (saved.caseId) caseIdRef.current = saved.caseId;
            if (saved.subject === 'self' || saved.subject === 'other') {
              setSubject(saved.subject);
            }
            setRestoredSession(params.get('session_id'));
            setStage('pay');
            say('bot', 'Welcome back — your payment went through. Click below and your document will be generated and downloaded.');
            return;
          }
        }
      } catch { /* fall through to a fresh interview */ }
      say('bot', 'Your payment went through, but this browser no longer has your interview answers. Please run the interview again — and contact us if you were charged, so we can make it right.');
    } else if (params.get('payment') === 'cancelled') {
      say('bot', 'No problem — checkout was cancelled and nothing was charged. Your answers are still here if you want to continue.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account probe: when accounts are configured, the interview opens
  // with sign-in/create-account (signed out) or the for-you /
  // someone-else question (signed in). When accounts are NOT
  // configured — /api/me answers 503, or the probe fails at all —
  // the interview falls back to the guest flow, unchanged.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment')) {
      // Returning from Stripe: when the restore effect above claimed
      // the session it owns the stage ('pay') — leave it alone. In
      // every other return case (cancelled, or the saved answers are
      // gone) start over at the situation question.
      setAcct('guest');
      if (params.get('payment') === 'success' && params.get('session_id')) {
        try {
          const raw = sessionStorage.getItem(STORE_KEY);
          const saved = raw ? JSON.parse(raw) : null;
          if (saved && getMotion(saved.motionId)) return;
        } catch {
          /* fall through to a fresh start */
        }
      }
      setStage('situation');
      return;
    }
    let live = true;
    fetch('/api/me')
      .then(async (res) => {
        if (!live) return;
        if (res.status === 503) {
          setAcct('off');
          beginFresh();
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data.user) {
          const u = data.user;
          setProfile({
            fullName: u.fullName || '',
            street: u.street || '',
            city: u.city || '',
            state: u.state || '',
            zip: u.zip || '',
            phone: u.phone || '',
          });
          setAccountEmail(u.email || '');
          setAcct('user');
          // A ?draft=<id> link resumes that interview instead of
          // opening with the who-question. Anything wrong with the
          // draft (missing, not theirs, motion gone) falls back to
          // the normal greeting below.
          const did = resumeDraftIdRef.current;
          resumeDraftIdRef.current = null;
          if (did && (await tryResumeDraft(did))) return;
          // Court-mail deep link: when this interview runs against
          // one of the user's cases and a motion was picked, offer
          // the case's confirmed facts first (its own step screen).
          if (caseIdRef.current && preselectRef.current && (await tryLoadCaseFacts())) {
            say('bot', `Welcome back${u.fullName ? `, ${String(u.fullName).split(' ')[0]}` : ''}. Before the questions: your court mail for this case gave us some facts you already confirmed. Use the ones that belong in this document — anything you leave off is simply asked about as usual.`);
            setStage('casefacts');
            return;
          }
          say('bot', `Welcome back${u.fullName ? `, ${String(u.fullName).split(' ')[0]}` : ''}. First question: is this motion for you, or for someone else?`);
          setStage('who');
        } else {
          setAcct('guest');
          setStage('gate');
        }
      })
      .catch(() => {
        if (!live) return;
        setAcct('off');
        beginFresh();
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice: speak each NEW assistant message, in order, while
  // voice mode is on. The ref marks what has already been handed
  // to the player, so re-renders never re-speak a line.
  useEffect(() => {
    if (!voiceOn) {
      spokenUptoRef.current = msgs.length;
      return;
    }
    const p = playerRef.current;
    if (!p) return;
    for (let i = spokenUptoRef.current; i < msgs.length; i++) {
      if (msgs[i].from === 'bot') p.enqueue(msgs[i].text);
    }
    spokenUptoRef.current = msgs.length;
  }, [msgs, voiceOn]);

  // Voice: signature and payment are NOT voice-driven. When the
  // flow reaches them, say so in one spoken line and let the
  // on-screen controls take over.
  useEffect(() => {
    if (!voiceOn) return;
    if (stage === 'signature' && announcedStageRef.current !== 'signature') {
      announcedStageRef.current = 'signature';
      playerRef.current?.enqueue(
        'This step happens on screen — I cannot take a signature by voice. Draw it in the box when you are ready.',
      );
    } else if (stage === 'pay' && announcedStageRef.current !== 'pay') {
      announcedStageRef.current = 'pay';
      playerRef.current?.enqueue(
        'Payment also happens on screen — use the button on this screen when you are ready.',
      );
    }
  }, [stage, voiceOn]);

  // Stop any playback / listening when the interview unmounts.
  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      try { recogRef.current?.abort?.(); } catch { /* already gone */ }
    };
  }, []);

  // Ref mirrors the voice loop's async callbacks consult.
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { pendingCountyRef.current = pendingCounty; }, [pendingCounty]);

  // Hands-free loop: when the flow leaves an answer-expecting stage
  // (a badge stage, the subject card, signature, payment…), the
  // microphone closes — it only ever runs at a spoken question.
  useEffect(() => {
    if (stage !== 'situation' && stage !== 'fields' && stage !== 'feew-fields') {
      stopRecognition(true);
    }
  }, [stage]);

  // Draft autosave: while a signed-in user's interview has a motion
  // and at least one answer, keep a draft case in step — debounced
  // on every change. Best-effort: a failed save is silent and the
  // next change tries again; the interview never blocks on it.
  useEffect(() => {
    if (acct !== 'user' || !motion) {
      draftSnapRef.current = null;
      return;
    }
    const sig = JSON.stringify({
      m: motion.id, a: answers, s: subject, f: feeWaiverAdded,
    });
    draftSnapRef.current = {
      sig,
      body: { motionId: motion.id, answers, subject, feeWaiverAdded },
    };
    if (draftDoneRef.current) return;
    if (stage === 'generating' || stage === 'done') return;
    if (!Object.values(answers).some((v) => typeof v === 'string' && v.trim())) return;
    if (sig === draftSavedSigRef.current) return;
    const t = setTimeout(() => {
      fetch('/api/cases/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motionId: motion.id,
          answers,
          subject,
          feeWaiverAdded,
          draftId: draftIdRef.current,
        }),
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) return;
          const d = await res.json().catch(() => null);
          if (d?.draft?.id) {
            draftIdRef.current = d.draft.id;
            draftSavedSigRef.current = sig;
          }
        })
        .catch(() => { /* best-effort: the next change retries */ });
    }, 1500);
    return () => clearTimeout(t);
  }, [acct, motion, answers, subject, feeWaiverAdded, stage]);

  // Flush the newest snapshot when the page goes away mid-interview,
  // so closing the tab doesn't lose the last answers typed.
  useEffect(() => {
    const flush = () => {
      if (draftDoneRef.current) return;
      const snap = draftSnapRef.current;
      if (!snap || snap.sig === draftSavedSigRef.current) return;
      try {
        navigator.sendBeacon(
          '/api/cases/draft',
          new Blob(
            [JSON.stringify({ ...snap.body, draftId: draftIdRef.current })],
            { type: 'application/json' },
          ),
        );
      } catch { /* best-effort */ }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // County assist: when the county question arrives and a ZIP is
  // already known, resolve it silently so the "Use my ZIP" badge
  // can offer the match. No chat noise either way.
  const atCountyRef = useRef(false);
  useEffect(() => {
    const atCounty =
      stage === 'fields' && queue[qIdx]?.key === 'county';
    atCountyRef.current = !!atCounty;
    if (!atCounty) return;
    const zip = (answers.zip || '').trim().slice(0, 5);
    if (!/^\d{5}$/.test(zip)) return;
    if (zipTriedRef.current === zip) return;
    zipTriedRef.current = zip;
    let live = true;
    fetch(`/api/county?zip=${zip}`)
      .then(async (res) => {
        if (!live || !res.ok) return;
        const d = await res.json().catch(() => null);
        if (d && d.county && d.state) {
          setZipCounty({ county: String(d.county), state: String(d.state) });
        }
      })
      .catch(() => { /* silent: typing keeps working */ });
    return () => { live = false; };
  }, [stage, queue, qIdx, answers.zip]);

  // Step screens: when the current question changes, the composer
  // starts from that question's existing answer (empty for a fresh
  // question; the typed answer when the user stepped Back to fix
  // it, so Send alone re-accepts it). Keyed on question identity
  // only — typing and voice interim results are never overwritten.
  const fieldKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const f = stage === 'fields' || stage === 'feew-fields' ? queue[qIdx] : null;
    const key = f ? `${stage}:${f.key}` : null;
    if (key !== fieldKeyRef.current) {
      fieldKeyRef.current = key;
      setInput(f ? answers[f.key] || '' : '');
    }
  });

  // Entering the pick stage always starts at the category screen
  // (the drill-down within it is presentation state only).
  useEffect(() => {
    if (stage === 'pick') { setPickCat(null); }
  }, [stage]);

  const grouped = useMemo(() => {
    const g: Record<string, MotionDef[]> = {};
    for (const m of ALL_MOTIONS) (g[m.category] = g[m.category] || []).push(m);
    return g;
  }, []);

  /** Fresh start for a guest: a motion deep-linked from the
   *  library begins straight into its questions; otherwise the
   *  situation question, exactly as before. */
  function beginFresh() {
    const pm = preselectRef.current;
    if (pm) {
      preselectRef.current = null;
      say('bot', 'You picked this one in the library — we will go through it now.');
      chooseMotion(pm);
    } else {
      setStage('situation');
    }
  }

  function chooseSelf() {
    if (!profile) return;
    say('user', 'For me');
    setSubject('self');
    setSubjectInfo({ ...profile, email: accountEmail });
    setStage('subject');
    say('bot', 'Here is the basic information from your profile. Look it over and fix anything that has changed — the document is built from exactly this.');
  }

  function chooseOther() {
    say('user', 'For someone else');
    setSubject('other');
    setSubjectInfo({ ...EMPTY_PROFILE, email: '' });
    setStage('subject');
    say('bot', 'Tell me about the person this motion is for. Their information goes on the document — the caption, the signature block, the fee waiver if one is added, and the filing steps at the end. It is used for this filing only: your account profile is not changed, and you remain the preparer.');
  }

  async function applySubject() {
    const info = subjectInfo;
    if (!info.fullName.trim()) return;
    say('user', `File it for: ${info.fullName.trim()}`);
    // Seed the shared caption answers from the subject, so the PDF
    // caption, signature block, fee waiver and ZIP filing steps all
    // describe the SUBJECT — and the question queue skips these.
    setAnswers((a) => ({
      ...a,
      fullName: info.fullName.trim(),
      address: composeAddress(info),
      phone: info.phone.trim(),
      email: info.email.trim(),
      state: info.state.trim(),
      zip: info.zip.trim(),
      // A preselected criminal motion: the State is the other
      // side, derived from the subject's state — never asked.
      ...(preselectRef.current && isCriminalAdversarial(preselectRef.current) && info.state.trim()
        ? { opposingParty: statePartyName(info.state.trim()) }
        : {}),
    }));
    setSubjectSeeded(true);
    // For "for me": offer-to-save is the checkbox on the card
    // (default on). Corrections always apply to this filing; they
    // are written back to the profile only when the box is checked.
    if (subject === 'self' && profile) {
      const changed = PROFILE_FIELDS.some(
        (f) => (info[f.key] || '').trim() !== (profile[f.key] || '').trim(),
      );
      if (changed && saveBack) {
        try {
          const res = await fetch('/api/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: info.fullName,
              street: info.street,
              city: info.city,
              state: info.state,
              zip: info.zip,
              phone: info.phone,
            }),
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.user) {
              setProfile({
                fullName: data.user.fullName || '',
                street: data.user.street || '',
                city: data.user.city || '',
                state: data.user.state || '',
                zip: data.user.zip || '',
                phone: data.user.phone || '',
              });
            }
            say('bot', 'Saved — your profile now carries those corrections for next time.');
          }
        } catch {
          /* saving back is a convenience; the filing is unaffected */
        }
      } else if (changed) {
        say('bot', 'Using those corrections for this filing only — your saved profile is unchanged.');
      }
    }
    const pm = preselectRef.current;
    if (pm) {
      preselectRef.current = null;
      say('bot', 'Now the motion you picked in the library:');
      chooseMotion(pm, true);
    } else {
      say('bot', 'Now tell me what is going on, in your own words.');
      setStage('situation');
    }
  }

  function submitSituation(text: string) {
    const t = text.trim();
    if (!t) return;
    stopRecognition(true);
    say('user', t);
    setInput('');
    const results = matchSituation(t);
    if (results.length) {
      const best = results[0].motion;
      setCandidates(results.map((r) => r.motion));
      say('bot', `That sounds like a ${best.name}. ${best.purpose}`);
      say('bot', `Honest note: ${best.proSe}`);
      if (best.warning) say('bot', best.warning);
      setMotion(best);
      setStage('confirm');
    } else {
      say('bot', 'I could not match that confidently. No problem — pick the closest fit from the full library below, or try describing it a different way.');
      setStage('pick');
    }
  }

  /** Load one of the signed-in user's saved drafts for resuming.
   *  Returns false when it is missing, not theirs, or its motion is
   *  gone from the library — the caller falls back to a fresh start. */
  async function tryResumeDraft(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/cases/draft/${encodeURIComponent(id)}`);
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      const d = data?.draft;
      if (!d) return false;
      const m = getMotion(String(d.motionId || ''));
      if (!m) return false;
      resumeDraft(
        {
          id: String(d.id || id),
          answers: (d.answers || {}) as Answers,
          subject: d.subject === 'other' ? 'other' : d.subject === 'self' ? 'self' : null,
          feeWaiverAdded: d.feeWaiverAdded === true,
        },
        m,
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Restore a draft's state and pick the interview up at its first
   *  unanswered question, rebuilding the queue the way chooseMotion
   *  does (a confirmed subject's seeded fields stay skipped). The
   *  signature is not restored — it is drawn fresh at the end. */
  function resumeDraft(
    d: { id: string; answers: Answers; subject: 'self' | 'other' | null; feeWaiverAdded: boolean },
    m: MotionDef,
  ) {
    const saved = d.answers;
    // Criminal matters: the other side is the State, derived from
    // the saved state answer — never re-asked.
    const restored = isCriminalAdversarial(m) && saved.state && !saved.opposingParty
      ? { ...saved, opposingParty: statePartyName(saved.state) }
      : saved;
    const subj = d.subject;
    setMotion(m);
    setAnswers(restored);
    setSubject(subj);
    setFeeWaiverAdded(d.feeWaiverAdded);
    setSubjectSeeded(subj !== null);
    draftIdRef.current = d.id;
    draftSavedSigRef.current = JSON.stringify({
      m: m.id, a: saved, s: subj, f: d.feeWaiverAdded,
    });
    say('bot', `Welcome back — I picked up your ${m.name} where you left off.`);
    const q = buildQueue(m, new Set(subj !== null ? SUBJECT_SEEDED_KEYS : []));
    const firstOpen = q.findIndex((f) => !String(saved[f.key] ?? '').trim());
    if (firstOpen >= 0) {
      setQueue(q);
      setQTotal(q.length);
      setQIdx(firstOpen);
      setStage('fields');
      say('bot', q[firstOpen].label + (q[firstOpen].hint ? ` ${q[firstOpen].hint}` : ''));
      return;
    }
    // The whole queue is answered — land where the normal flow
    // would have gone next.
    if (m.id !== 'fee-waiver' && !d.feeWaiverAdded) {
      setStage('feew-choice');
      say('bot', feewPitch(subj === 'other', saved.fullName || ''));
      return;
    }
    if (m.id !== 'fee-waiver' && d.feeWaiverAdded) {
      const fi = IFP_FIELDS.findIndex((f) => !String(saved[f.key] ?? '').trim());
      if (fi >= 0) {
        setQueue(IFP_FIELDS);
        setQTotal(IFP_FIELDS.length);
        setQIdx(fi);
        setStage('feew-fields');
        say('bot', IFP_FIELDS[fi].label);
        return;
      }
    }
    // A fully answered draft still stops at review before signing.
    enterReview();
  }

  /** Fetch the case's confirmed-facts bag and work out which of
   *  its facts map onto the deep-linked motion's questions.
   *  Returns true when there is anything worth showing on the
   *  case-facts screen. The server reads CONFIRMED facts only —
   *  a proposed fact can never appear here. */
  async function tryLoadCaseFacts(): Promise<boolean> {
    const cid = caseIdRef.current;
    const m = preselectRef.current;
    if (!cid || !m) return false;
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(cid)}/facts`);
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      const bag: Answers = (data?.facts || {}) as Answers;
      const sources: Record<string, string> = data?.sources || {};
      const queueKeys = new Set([...SHARED_FIELDS, ...m.fields].map((f) => f.key));
      const rows: { bagKey: string; answerKeys: string[]; value: string; source: string }[] = [];
      for (const [bagKey, value] of Object.entries(bag)) {
        if (!value || !String(value).trim()) continue;
        const aliases = FACT_ANSWER_KEYS[bagKey] || [bagKey];
        const answerKeys = aliases.filter(
          (k) => queueKeys.has(k) && !SEED_EXCLUDED_KEYS.has(k),
        );
        if (!answerKeys.length) continue;
        rows.push({ bagKey, answerKeys, value: String(value), source: sources[bagKey] || 'From your case file' });
      }
      if (!rows.length) return false;
      setCaseFactRows(rows);
      setCaseFactUse(Object.fromEntries(rows.map((r) => [r.bagKey, true])));
      return true;
    } catch {
      return false;
    }
  }

  /** The case-facts screen's Continue: accepted facts become
   *  ordinary answers (draft autosave and the review screen treat
   *  them like any other answer), and their keys join the seeded
   *  set so chooseMotion never re-asks them. Declined facts are
   *  simply not merged — the questions run as usual. */
  function continueFromCaseFacts() {
    const merged: Answers = { ...answers };
    const used: string[] = [];
    for (const row of caseFactRows) {
      if (caseFactUse[row.bagKey] === false) continue;
      for (const key of row.answerKeys) {
        if (SEED_EXCLUDED_KEYS.has(key)) continue;
        if (String(merged[key] ?? '').trim()) continue;
        merged[key] = row.value;
        caseSeededKeysRef.current.add(key);
        caseFactSourcesRef.current[key] = row.source;
        used.push(key);
      }
    }
    setAnswers(merged);
    say('user', 'Use the facts I picked');
    say('bot', used.length
      ? 'Done — those are in. I will not ask about them again, and you will see them on the review screen before you sign, marked with where they came from.'
      : 'No problem — I will ask everything as usual.');
    say('bot', 'First question: is this motion for you, or for someone else?');
    setStage('who');
  }

  function chooseMotion(m: MotionDef, seeded?: boolean) {
    const isSeeded = seeded ?? subjectSeeded;
    setMotion(m);
    say('user', m.name);
    say('bot', `${m.name}. ${m.purpose}`);
    say('bot', `Honest note: ${m.proSe}`);
    if (m.warning) say('bot', m.warning);
    const skip = new Set<string>([
      ...(isSeeded ? SUBJECT_SEEDED_KEYS : []),
      ...caseSeededKeysRef.current,
    ]);
    const q = buildQueue(m, skip);
    setQueue(q);
    setQTotal(q.length);
    setQIdx(0);
    setStage('fields');
    if (isSeeded) {
      say('bot', `I already have the filer's basic information from the first step, so I will ask ${q.length} short questions — a few about the case itself, then the ones specific to this motion.`);
    } else {
      say('bot', `I will ask ${q.length} short questions — first a few about you and your case (used in the caption of every court document), then the ones specific to this motion.`);
    }
    say('bot', q[0].label + (q[0].hint ? ` ${q[0].hint}` : ''));
  }

  /** The fee-waiver pitch, worded for the subject — shared by the
   *  flow, the resume path, and the choice screen's own copy. */
  function feewPitch(forOther: boolean, name: string): string {
    return forOther
      ? `One optional add-on: court filing fees can run from about $20 to a few hundred dollars. If paying is a hardship for ${name || 'the person this motion is for'}, I can add a fee-waiver (in forma pauperis) request to the packet at no extra charge. It asks five short money questions about them, and the answers are sworn — they must be accurate. Add it?`
      : 'One optional add-on: court filing fees can run from about $20 to a few hundred dollars. If paying is a hardship, I can add a fee-waiver (in forma pauperis) request to your packet at no extra charge. It asks five short money questions, and your answers are sworn — they must be accurate. Add it?';
  }

  /** Every path that used to land on the signature step now stops
   *  at the review screen first; Continue there goes to signing. */
  function enterReview() {
    setStage('review');
    say('bot', 'Before you sign, here is everything you told me — check it over.');
  }

  function continueFromReview() {
    setStage('signature');
    say('bot', signPrompt());
  }

  /** Back one question (fields and fee-waiver fields only): the
   *  previous question comes back with its answer still in the
   *  composer, ready to correct or simply re-send. From the first
   *  fee-waiver question, Back returns to the fee-waiver choice. */
  function goBack() {
    stopRecognition(true);
    setPendingCounty(null);
    if (stage === 'feew-fields' && qIdx === 0) {
      setStage('feew-choice');
      say('bot', feewPitch(subject === 'other', answers.fullName || ''));
      return;
    }
    if (stage !== 'fields' && stage !== 'feew-fields') return;
    if (qIdx <= 0) return;
    const prev = queue[qIdx - 1];
    if (!prev) return;
    setQIdx(qIdx - 1);
    say('bot', prev.label + (prev.hint ? ` ${prev.hint}` : ''));
  }

  /** Advance the interview after an answer has been recorded
   *  into `next` — shared by typed answers and by the county
   *  confirmation, which records county + state together. */
  function proceedWith(next: Answers) {
    const ni = qIdx + 1;
    if (ni < queue.length) {
      setQIdx(ni);
      const nf = queue[ni];
      say('bot', nf.label + (nf.hint ? ` ${nf.hint}` : ''));
    } else if (stage === 'fields') {
      if (motion && motion.id === 'fee-waiver') {
        enterReview();
      } else {
        setStage('feew-choice');
        say('bot', feewPitch(subject === 'other', next.fullName || ''));
      }
    } else if (stage === 'feew-fields') {
      enterReview();
    }
  }

  function answerField(value: string) {
    const field = queue[qIdx];
    if (!field) return;
    stopRecognition(true);
    setPendingCounty(null);
    say('user', value);
    const next = { ...answers, [field.key]: value };
    // Criminal matters: the moment the state is known, the other
    // side is the State — filled automatically, never asked.
    if (motion && isCriminalAdversarial(motion) && field.key === 'state') {
      const p = statePartyName(value);
      if (p) next.opposingParty = p;
    }
    setAnswers(next);
    proceedWith(next);
  }

  // ---------- Voice layer ----------

  function getPlayer(): SpeechPlayer {
    if (!playerRef.current) {
      const p = new SpeechPlayer();
      p.onUnavailable = () => {
        voiceOnRef.current = false;
        setVoiceOn(false);
        setSpeaking(false);
        speakingRef.current = false;
        setVoiceNote('Voice is not set up on this site yet, so I cannot speak out loud — the interview works exactly the same in text.');
      };
      p.onActiveChange = (active) => {
        speakingRef.current = active;
        setSpeaking(active);
        // Echo guard: the microphone never runs while the
        // assistant is speaking.
        if (active) stopRecognition(true);
      };
      p.onDrained = () => {
        // The assistant finished a question — in voice mode that
        // is the user's cue to speak (hands-free loop).
        fnRef.current.maybeAutoListen();
      };
      playerRef.current = p;
    }
    return playerRef.current;
  }

  /** A note the loop may need to show repeatedly across cycles
   *  (unsupported browser, blocked mic) is spoken on screen once. */
  function showNoteOnce(key: string, text: string) {
    if (notesOnceRef.current.has(key)) return;
    notesOnceRef.current.add(key);
    setVoiceNote(text);
  }

  /** The stages where the interview is waiting on an answer — the
   *  only stages the hands-free loop may open the microphone at. */
  function isAnswerStage(s: Stage): boolean {
    return s === 'situation' || s === 'fields' || s === 'feew-fields';
  }

  /** Stop any running recognition and cancel a pending listen.
   *  suppressEnd marks the session's onend as "we meant to stop",
   *  so it doesn't count as an empty turn in the loop. */
  function stopRecognition(suppressEnd = true) {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    const rec = recogRef.current;
    if (rec) {
      if (recogSessionRef.current) recogSessionRef.current.suppressEnd = suppressEnd;
      try { rec.stop(); } catch { /* already stopped */ }
    }
  }

  /** Start one recognition session. `auto` sessions belong to the
   *  hands-free loop (they retry on silence and count empty turns);
   *  manual ones come from the mic button and behave as voice v1. */
  function startRecognition(auto: boolean): boolean {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      const text = 'Voice typing is not supported in this browser — typing, or the answer buttons above, work just the same.';
      if (auto) {
        autoBlockedRef.current = true;
        showNoteOnce('unsupported', text);
      } else {
        setVoiceNote(text);
      }
      return false;
    }
    if (listeningRef.current) return true;
    const rec = new SR();
    const session = { auto, gotResult: false, suppressEnd: false };
    recogSessionRef.current = session;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) setInput(interim);
      if (finalText.trim()) {
        session.gotResult = true;
        emptyCyclesRef.current = 0;
        setInput('');
        fnRef.current.submitInput(finalText);
      }
    };
    rec.onend = () => {
      setListening(false);
      listeningRef.current = false;
      if (recogRef.current === rec) recogRef.current = null;
      handleRecogEnd(session);
    };
    rec.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        // Retrying can never fix a denied permission: the loop
        // stays off (TTS is unaffected) and the note shows once.
        autoBlockedRef.current = true;
        session.suppressEnd = true;
        const text = 'Microphone access was blocked — typing works just the same.';
        if (session.auto) showNoteOnce('blocked', text);
        else setVoiceNote(text);
      } else if (e?.error === 'network' || e?.error === 'audio-capture') {
        // In the loop this simply counts as an empty turn (see
        // handleRecogEnd); a manual tap keeps the v1 note.
        if (!session.auto) {
          setVoiceNote('Voice typing is not available right now — typing works just the same.');
        }
      } else if (e?.error === 'aborted') {
        session.suppressEnd = true;
      }
    };
    recogRef.current = rec;
    try {
      rec.start();
      setListening(true);
      listeningRef.current = true;
      // A mic that demonstrably works (a manual start after an
      // earlier denial, say) re-arms the loop's permission state.
      if (!auto) autoBlockedRef.current = false;
      return true;
    } catch {
      setListening(false);
      listeningRef.current = false;
      return false;
    }
  }

  /** A recognition session ended. Successful answers reset the
   *  loop; deliberate stops are ignored; a silent AUTO session is
   *  retried a couple of times (silence is normal on a call), then
   *  the loop pauses and hands control to the mic button. */
  function handleRecogEnd(session: { auto: boolean; gotResult: boolean; suppressEnd: boolean }) {
    if (session.gotResult) {
      emptyCyclesRef.current = 0;
      listenPausedRef.current = false;
      return;
    }
    if (session.suppressEnd) return;
    if (!voiceOnRef.current) return;
    if (autoBlockedRef.current) return;
    if (!session.auto) {
      // A manual attempt that heard nothing: stay manual.
      listenPausedRef.current = true;
      return;
    }
    if (!isAnswerStage(stageRef.current) || pendingCountyRef.current) return;
    emptyCyclesRef.current += 1;
    if (emptyCyclesRef.current >= 3) {
      listenPausedRef.current = true;
      setVoiceNote("Say your answer, or tap the mic button when you're ready");
      return;
    }
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      fnRef.current.maybeAutoListen();
    }, 800);
  }

  /** The hands-free loop's "your turn" moment: the assistant has
   *  finished speaking at an answer-expecting stage, so the
   *  microphone opens by itself. Every guard is checked again when
   *  the short delay fires — speech may have restarted, the stage
   *  may have moved, the user may have taken over. */
  function maybeAutoListen() {
    if (!voiceOnRef.current) return;
    if (!isAnswerStage(stageRef.current)) return;
    if (pendingCountyRef.current) return;
    if (speakingRef.current || listeningRef.current) return;
    if (autoBlockedRef.current || listenPausedRef.current) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (!voiceOnRef.current) return;
      if (!isAnswerStage(stageRef.current)) return;
      if (pendingCountyRef.current) return;
      if (speakingRef.current || listeningRef.current) return;
      if (autoBlockedRef.current || listenPausedRef.current) return;
      fnRef.current.startRecognition(true);
    }, 300);
  }

  function toggleVoice() {
    if (voiceOn) {
      voiceOnRef.current = false;
      playerRef.current?.stop();
      stopRecognition(true);
      listenPausedRef.current = false;
      emptyCyclesRef.current = 0;
      setListening(false);
      listeningRef.current = false;
      setVoiceOn(false);
      setSpeaking(false);
      speakingRef.current = false;
      return;
    }
    setVoiceNote(null);
    listenPausedRef.current = false;
    emptyCyclesRef.current = 0;
    const p = getPlayer();
    // Everything already on screen counts as heard except the
    // current question, which is re-read to open the "call".
    spokenUptoRef.current = msgs.length;
    p.enqueue(
      'Voice mode is on. One thing to know up front: I am an automated assistant, not a lawyer — this is document preparation, not legal advice, the same note that is on your screen. I will read each question out loud, then listen for your answer — no need to tap anything. You can still tap an answer button or type, whichever you like.',
    );
    const lastBot = [...msgs].reverse().find((m) => m.from === 'bot');
    if (lastBot) p.enqueue(lastBot.text);
    voiceOnRef.current = true;
    setVoiceOn(true);
  }

  function toggleMic() {
    if (listening) {
      // Tapping mid-listen takes manual control of the call: the
      // loop pauses until the next tap.
      if (voiceOnRef.current) listenPausedRef.current = true;
      stopRecognition(true);
      setListening(false);
      listeningRef.current = false;
      return;
    }
    setVoiceNote(null);
    listenPausedRef.current = false;
    emptyCyclesRef.current = 0;
    // Barge-in: tapping Speak while the assistant is talking stops
    // the speech first, so the mic never hears the assistant.
    if (voiceOnRef.current && speakingRef.current) playerRef.current?.stop();
    startRecognition(false);
  }

  // ---------- County assist ----------

  /** "Use my location" (pin badge): geolocation is requested ONLY on this
   *  tap, never uninvited. Coordinates go to /api/county for one
   *  lookup and are not stored anywhere. */
  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      say('bot', "No problem — type the county, or your ZIP and I'll match it.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`/api/county?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
          .then(async (res) => {
            const d = res.ok ? await res.json().catch(() => null) : null;
            if (d && d.county && d.state) {
              setPendingCounty({ county: String(d.county), state: String(d.state) });
              say('bot', `You're in ${d.county} County, ${d.state} — use that?`);
            } else {
              say('bot', "I couldn't pin down the county from here — type the county, or your ZIP and I'll match it.");
            }
          })
          .catch(() => {
            say('bot', "I couldn't pin down the county from here — type the county, or your ZIP and I'll match it.");
          });
      },
      () => {
        say('bot', "No problem — type the county, or your ZIP and I'll match it.");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  function useMyZip() {
    if (!zipCounty) return;
    const zip = (answers.zip || '').trim().slice(0, 5);
    setPendingCounty({ county: zipCounty.county, state: zipCounty.state });
    say('bot', `Your ZIP ${zip} points to ${zipCounty.county} County, ${zipCounty.state} — use that?`);
  }

  /** Yes on the county confirmation: seed BOTH the county and
   *  state answers and advance exactly as if typed. */
  function confirmCounty() {
    const pc = pendingCounty;
    if (!pc) return;
    stopRecognition(true);
    const field = queue[qIdx];
    setPendingCounty(null);
    if (!field || field.key !== 'county') return;
    say('user', 'Yes');
    const next = { ...answers, county: pc.county, state: pc.state };
    setAnswers(next);
    proceedWith(next);
  }

  function declineCounty() {
    if (!pendingCounty) return;
    stopRecognition(true);
    setPendingCounty(null);
    say('user', "No, I'll type it");
    say('bot', 'No problem — type the county name.');
  }

  /** One submit path for typing, badges-adjacent input, and the
   *  microphone's final transcript alike. */
  function submitInput(override?: string) {
    if (stage === 'situation') return submitSituation(override ?? input);
    if (stage === 'fields' || stage === 'feew-fields') {
      const v = (override ?? input).trim();
      if (!v) return;
      setInput('');
      return answerField(v);
    }
  }

  function startFeeWaiverFields() {
    say('user', 'Yes, add the fee waiver');
    setFeeWaiverAdded(true);
    setQueue(IFP_FIELDS);
    setQTotal(IFP_FIELDS.length);
    setQIdx(0);
    setStage('feew-fields');
    say('bot', IFP_FIELDS[0].label);
  }

  function skipFeeWaiver() {
    say('user', 'No, skip it');
    enterReview();
  }

  async function startPayment() {
    if (!motion) return;
    setPayError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motionId: motion.id, coupon: coupon.trim() || undefined }),
      });
      const data = await res.json();
      if (data.devFree) return generatePdf(null);
      if (data.couponFree) return generatePdf(null, coupon.trim());
      if (data.url) {
        sessionStorage.setItem(STORE_KEY, JSON.stringify({ motionId: motion.id, answers: withStateParty(motion, answers), signature, feeWaiverAdded, subject, draftId: draftIdRef.current, caseId: caseIdRef.current }));
        window.location.href = data.url;
        return;
      }
      setPayError(data.message || 'Payments are not available right now.');
    } catch {
      setPayError('Something went wrong starting checkout. No charge was made.');
    }
  }

  async function generatePdf(sessionId: string | null, couponCode?: string) {
    if (!motion) return;
    setStage('generating');
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motionId: motion.id, answers: withStateParty(motion, answers), signature, feeWaiverAdded, sessionId, coupon: couponCode || undefined, forWhom: subject, draftId: draftIdRef.current || undefined, caseId: caseIdRef.current || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPayError(data.message || 'The document could not be generated.');
        setStage('pay');
        return;
      }
      // The document exists: the draft (if any) has completed, so
      // the autosave stands down for good.
      draftDoneRef.current = true;
      const savedId = res.headers.get('x-legal-case-id');
      if (savedId) setSavedCaseId(savedId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${motion.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      say('bot', 'Your document is downloading. Print it, and file the whole packet — motion, any companions listed in it, and the certificate of service.');
      const fres = await fetch('/api/courts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motionId: motion.id, zip: answers.zip, state: answers.state, county: answers.county }),
      });
      if (fres.ok) setFiling(await fres.json());
      setStage('done');
    } catch {
      setPayError('The document could not be generated. If you paid, contact us and we will make it right.');
      setStage('pay');
    }
  }

  // The voice loop's async callbacks (speech drain, recognition
  // events, retry timers) always reach the CURRENT render's
  // handlers through this ref — a closure captured by an earlier
  // render would act on stale interview state.
  const fnRef = useRef({
    submitInput: (_t?: string) => {},
    startRecognition: (_auto: boolean): boolean => false,
    maybeAutoListen: () => {},
  });
  fnRef.current = { submitInput, startRecognition, maybeAutoListen };

  const currentField = (stage === 'fields' || stage === 'feew-fields') ? queue[qIdx] : null;
  // Courts-database key for the court-name step (state+county are
  // collected before courtName in the shared field order).
  const courtKey = answers.state && answers.county
    ? `${answers.state}|${answers.county}`.toLowerCase()
    : '';
  const courtBadgesActive =
    currentField?.key === 'courtName' &&
    !courtTyped &&
    !!courtOpts &&
    courtOpts.key === courtKey &&
    courtOpts.courts.length > 0;

  // Quick-answer badges for the composer dock — ONLY where the
  // answer set is genuinely known ahead of time. Open factual
  // fields (names, dates, amounts, free text) get none.
  const badges: QuickBadge[] = [];
  if (pendingCounty) {
    badges.push(
      { label: 'Yes', primary: true, action: confirmCounty },
      { label: "No, I'll type it", action: declineCounty },
    );
  } else if (stage === 'who') {
    badges.push(
      { label: 'For me', primary: true, action: chooseSelf },
      { label: 'For someone else', action: chooseOther },
    );
  } else if (stage === 'confirm' && motion) {
    badges.push({ label: 'Yes — that is the one', primary: true, action: () => chooseMotion(motion) });
    for (const c of candidates) {
      if (c.id !== motion.id) {
        badges.push({ label: `Closer: ${c.name}`, action: () => chooseMotion(c) });
      }
    }
    badges.push({
      label: 'Show me the full library',
      action: () => { say('user', 'Show me the full list'); setStage('pick'); },
    });
  } else if (stage === 'feew-choice') {
    badges.push(
      { label: 'Yes, add the fee waiver (free)', primary: true, action: startFeeWaiverFields },
      { label: 'No, skip it', action: skipFeeWaiver },
    );
  } else if (currentField) {
    if (currentField.type === 'select' && currentField.options) {
      for (const o of currentField.options) {
        // An option literally named "Other" IS the free-text
        // path (rendered as "Other…" below), never a stored
        // literal answer.
        if (o === 'Other') continue;
        badges.push({
          label: o,
          sel: (answers[currentField.key] || '') === o,
          action: () => answerField(o),
        });
      }
      // Every select gets an "Other…" path: it reveals the text
      // composer, and the typed text becomes the answer verbatim.
      badges.push({
        label: 'Other…',
        sel: otherMode,
        action: () => {
          setOtherMode(true);
          setTimeout(() => {
            document
              .querySelector<HTMLInputElement | HTMLTextAreaElement>(
                '.stepcomposer input, .stepcomposer textarea',
              )
              ?.focus();
          }, 60);
        },
      });
    } else if (currentField.key === 'county') {
      badges.push({ label: 'Use my location', icon: 'pin', primary: true, action: useMyLocation });
      if (zipCounty) {
        const z = (answers.zip || '').trim().slice(0, 5);
        badges.push({ label: `Use my ZIP: ${z}`, action: useMyZip });
      }
    } else if (currentField.key === 'courtName') {
      if (courtBadgesActive && courtOpts) {
        // Real courts for this county from the courts database —
        // no invented options; an uncovered county never gets here.
        for (const c of courtOpts.courts) {
          badges.push({ label: c.name, action: () => answerField(c.name) });
        }
        badges.push({ label: 'Type it instead', action: () => setCourtTyped(true) });
      }
      badges.push({ label: 'Not sure', action: () => answerField('not sure') });
    } else if (
      currentField.key === 'caseNumber' ||
      currentField.key === 'opposingAttorney' ||
      currentField.key === 'ifpBenefits'
    ) {
      // These questions name "none" as an answer in their own text.
      badges.push({ label: 'None', action: () => answerField('none') });
    }
  }

  // ---- Chat-thread derivation ----------------------------------
  // The engine above is untouched; what follows only decides how
  // the CURRENT step is displayed. The full conversation renders
  // as bubbles; the current turn's LAST bot message is the live
  // question for Q&A stages, so it is rendered from state (with
  // its hint behind a "?") instead of appearing twice.
  const lastUserIdx = msgs.reduce((acc, m, i) => (m.from === 'user' ? i : acc), -1);
  const turnBots = msgs
    .slice(lastUserIdx + 1)
    .filter((m) => m.from === 'bot')
    .map((m) => m.text);
  const countyPrompt = pendingCounty
    ? turnBots[turnBots.length - 1] || ''
    : '';

  // Review: every answered question, in the order the document
  // uses them — shared caption fields, the motion's own fields,
  // then the fee-waiver questions when one was added.
  const reviewPairs = (() => {
    const seen = new Set<string>();
    const out: { key: string; label: string; value: string }[] = [];
    const all = [
      ...SHARED_FIELDS,
      ...(motion?.fields || []),
      ...(feeWaiverAdded ? IFP_FIELDS : []),
    ];
    for (const f of all) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      const v = (answers[f.key] || '').trim();
      if (v) out.push({ key: f.key, label: f.label, value: v });
    }
    return out;
  })();
  const doneSteps = filing ? filing.steps : [];

  let progressLabel: string | null = null;
  if (stage === 'casefacts') {
    progressLabel = 'Facts from your court mail';
  } else if (stage === 'fields' || stage === 'feew-fields') {
    progressLabel = `Question ${qIdx + 1} of ${qTotal}`;
  } else if (stage === 'review') {
    progressLabel = 'Review your answers';
  } else if (stage === 'signature') {
    progressLabel = 'Sign';
  } else if (stage === 'pay') {
    progressLabel = 'Your document';
  } else if (stage === 'done') {
    progressLabel = 'Filing steps';
  }

  const screenKey = [
    stage,
    stage === 'fields' || stage === 'feew-fields' ? qIdx : '',
    pendingCounty ? 'county' : '',
  ].join('-');

  const goBackVisible =
    !pendingCounty &&
    ((stage === 'fields' && qIdx > 0) || stage === 'feew-fields');

  // Selectable options render as ONE single-line horizontal rail
  // of badges: no wrapping, chips never shrink, the rail scrolls
  // sideways, and a selected chip is marked (.sel) and scrolled
  // into view inside the rail only (see the effect below).
  const badgeButtons = () => badges.length === 0 ? null : (
    <div className="badgerail" ref={railRef} aria-label="Quick answers">
      {badges.map((b, i) => (
        <button
          key={i}
          type="button"
          className={`badge${b.primary ? ' primary' : ''}${b.sel ? ' sel' : ''}`}
          onClick={b.action}
        >
          {b.icon && <Icon name={b.icon} size={16} />}{b.label}
        </button>
      ))}
    </div>
  );
  const badgeSig = badges.map((b) => b.label + (b.sel ? '*' : '')).join('|');
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const sel = rail.querySelector<HTMLElement>('.badge.sel');
    if (!sel) return;
    const r = rail.getBoundingClientRect();
    const s = sel.getBoundingClientRect();
    if (s.left < r.left || s.right > r.right) {
      rail.scrollLeft += s.left - r.left - 12;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeSig, screenKey]);

  // Per-step resets + the courts-database fetch for the court-name
  // step. The fetch is local data only and fail-soft: any error or
  // empty result leaves today's typed question untouched.
  useEffect(() => {
    setOtherMode(false);
    setCourtTyped(false);
  }, [screenKey]);
  useEffect(() => {
    if (!courtKey || courtTyped) return;
    if (courtOpts && courtOpts.key === courtKey) return;
    let live = true;
    fetch(`/api/courts?state=${encodeURIComponent(answers.state)}&county=${encodeURIComponent(answers.county)}`)
      .then((r) => r.json())
      .then((j) => {
        if (live) {
          setCourtOpts({
            key: courtKey,
            courts: Array.isArray(j.courts) ? j.courts : [],
          });
        }
      })
      .catch(() => {
        if (live) setCourtOpts({ key: courtKey, courts: [] });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtKey, courtTyped]);
  // Done screen: if the chosen court matches a database record for
  // the case's county, its contact card is shown with the steps.
  useEffect(() => {
    if (stage !== 'done') return;
    let live = true;
    fetch(`/api/courts?detail=1&state=${encodeURIComponent(answers.state || '')}&county=${encodeURIComponent(answers.county || '')}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        const want = (answers.courtName || '').trim().toLowerCase();
        const rec = (Array.isArray(j.courts) ? j.courts : []).find(
          (c: CourtRecord) => c.name.toLowerCase() === want,
        );
        setCourtCard(rec || null);
      })
      .catch(() => { if (live) setCourtCard(null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Pick drill-down: categories first (in the fixed taxonomy
  // order), then one category's motions. The thread scrolls, so
  // every option is shown — no pagination.
  const pickCats = CATEGORIES.filter((c) => (grouped[c] || []).length > 0);
  const pickList = pickCat ? grouped[pickCat] || [] : [];

  // ---------- Chat-thread presentation ----------
  // The whole conversation renders as bubbles in a scrolling
  // thread; the current step is the live area at its foot — a
  // question bubble for Q&A stages, an interactive card for the
  // form-like ones. Quick-answer chips and the composer sit in a
  // dock pinned to the bottom of the screen. The page itself
  // never scrolls and never zooms.
  const isQStage = stage === 'situation' || stage === 'fields' || stage === 'feew-fields';

  // History: everything except the live question (the current
  // turn's last bot message) on Q&A stages.
  const historyMsgs =
    stage === 'fields' || stage === 'feew-fields'
      ? [
          ...msgs.slice(0, lastUserIdx + 1),
          ...msgs.slice(lastUserIdx + 1).filter((m) => m.from === 'bot').slice(0, -1),
        ]
      : msgs;

  // The long "honest note" and warning copy a matched motion
  // produces belongs in the confirm card's "?" popup, not as
  // walls of text in the thread.
  const isHiddenTip = (m: Msg) =>
    m.from === 'bot' &&
    (m.text.startsWith('Honest note:') || (motion ? m.text === motion.warning : false));

  const liveQuestion =
    stage === 'fields' || stage === 'feew-fields'
      ? pendingCounty
        ? countyPrompt
        : currentField
          ? currentField.label
          : null
      : null;
  const liveHint = currentField && !pendingCounty ? currentField.hint : null;

  // Keep the thread glued to the newest content as it arrives.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [msgs.length, screenKey, liveQuestion]);

  const composer = (
    <div className="stepcomposer composer">
      {datePickOpen && currentField?.type === 'date' && (
        <DatePicker
          title={currentField.label}
          onClose={() => setDatePickOpen(false)}
          onPick={(d) => {
            setDatePickOpen(false);
            submitInput(d);
          }}
        />
      )}
      {currentField?.type === 'phone' && (
        <DialPad value={input} onChange={setInput} />
      )}
      <div className="composerrow">
        {currentField?.type === 'date' && (
          <button
            type="button"
            className="composericon"
            aria-label="Pick a date from the calendar"
            title="Pick a date"
            onClick={() => setDatePickOpen(true)}
          >
            <Icon name="calendar" size={19} />
          </button>
        )}
        {currentField?.type === 'textarea' ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Type your answer…"
            aria-label="Your answer"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitInput(); }}
          />
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={stage === 'situation' ? 'Describe your situation…' : 'Type your answer…'}
            aria-label={stage === 'situation' ? 'Describe your situation' : 'Your answer'}
            inputMode={currentField?.type === 'phone' ? 'tel' : undefined}
            autoComplete={currentField?.type === 'phone' ? 'tel' : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') submitInput(); }}
          />
        )}
        <button
          type="button"
          className={`composericon micbtn${listening ? ' listening' : ''}`}
          onClick={toggleMic}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Answer by voice'}
        >
          {listening ? <Icon name="stop" size={18} /> : <Icon name="mic" size={18} />}
        </button>
        <button
          type="button"
          className="sendbtn"
          onClick={() => submitInput()}
          aria-label="Send"
        >
          <Icon name="arrowUpCircle" size={22} />
        </button>
      </div>
    </div>
  );

  const botFace = (
    <span className="botface" aria-hidden="true"><Icon name="scales" size={12} /></span>
  );

  const dockHasComposer = stage === 'situation' || stage === 'fields' || stage === 'feew-fields';
  const dockEmpty =
    !dockHasComposer && badges.length === 0 && !goBackVisible;

  return (
    <div className="interviewpage chatpage">
      <header className="stephead voicebar">
        <Link className="homelink" href="/" aria-label="Home">‹</Link>
        <span className="stepmotion">{motion ? motion.name : 'New document'}</span>
        {progressLabel && <span className="progress stepprogress">{progressLabel}</span>}
        <button
          type="button"
          className={`btn voicebtn${voiceOn ? '' : ' primary'}`}
          onClick={toggleVoice}
          aria-pressed={voiceOn}
        >
          <Icon name="phone" size={15} /> {voiceOn ? 'End voice call' : 'Voice call'}
        </button>
      </header>

      {(voiceOn || voiceNote) && (
        <div className="voicestrip">
          {voiceOn && (
            <span className="vstatus">
              {listening
                ? 'Listening… speak your answer.'
                : 'Voice on — questions are read aloud, then I listen.'}
            </span>
          )}
          {voiceOn && speaking && (
            <button type="button" className="btn ghost small" onClick={() => playerRef.current?.stop()}>
              Stop speaking
            </button>
          )}
          {voiceNote && <p className="voicenote" role="status">{voiceNote}</p>}
        </div>
      )}

      <div className="chatlog" ref={logRef}>
        {historyMsgs.map((m, i) =>
          isHiddenTip(m) ? null : (
            <div key={i} className={`msgrow ${m.from}`}>
              {m.from === 'bot' && botFace}
              <div className={`msg ${m.from}`}>{m.text}</div>
            </div>
          )
        )}

        {(stage === 'boot' || stage === 'generating') && (
          <div className="msgrow bot">
            {botFace}
            <div className="msg bot typing" aria-label="Working…">
              <span /><span /><span />
            </div>
          </div>
        )}

        {liveQuestion && (
          <div className="msgrow bot">
            {botFace}
            <div className="msg bot qbubble">
              {liveQuestion}
              {liveHint && (
                <HelpTip title="Tip">
                  <p className="hintbody">{liveHint}</p>
                </HelpTip>
              )}
              {courtBadgesActive && !courtTyped && (
                <p className="qhint">Courts for {answers.county} County, from the court database — pick yours below, or type it instead.</p>
              )}
              {otherMode && currentField?.type === 'select' && (
                <p className="qhint">Type your own answer below — it will be used exactly as written.</p>
              )}
            </div>
          </div>
        )}

        {stage === 'gate' && (
          <div className="chatcard">
            <h4>
              Start with a free account
              <HelpTip title="Why sign in?">
                <p className="hintbody">
                  Create an account or sign in, and your basic information — name, address,
                  phone — fills out the forms for you, this time and every time after.
                </p>
              </HelpTip>
            </h4>
            <div className="choices">
              <Link className="btn primary" href="/account">Sign in / Create account</Link>
              <button
                className="btn ghost"
                onClick={() => {
                  say('user', 'Continue as guest');
                  if (preselectRef.current) {
                    say('bot', 'No problem — I will ask for the information as we go.');
                    beginFresh();
                  } else {
                    say('bot', 'No problem — I will ask for the information as we go. Tell me what is going on, in your own words.');
                    setStage('situation');
                  }
                }}
              >
                Continue as guest
              </button>
            </div>
            <p className="fineprint cardfoot">
              <HelpTip title="The fine print">{DISCLAIMER}</HelpTip>
            </p>
          </div>
        )}

        {stage === 'casefacts' && (
          <div className="chatcard">
            <h4>
              Facts from your court mail
              <HelpTip title="What is this?">
                <p className="hintbody">
                  You confirmed these from email the court sent. Pick the ones that belong in
                  this document — anything you switch off is asked about as usual, and
                  nothing here is used unless you leave it on.
                </p>
              </HelpTip>
            </h4>
            <ul className="casefacts-list">
              {caseFactRows.map((row) => (
                <li className="factcard" key={row.bagKey}>
                  <div className="factcard-head">
                    <strong>{row.value}</strong>
                    <button
                      type="button"
                      className={`btn small ${caseFactUse[row.bagKey] === false ? 'ghost' : 'primary'}`}
                      onClick={() =>
                        setCaseFactUse((u) => ({ ...u, [row.bagKey]: u[row.bagKey] === false }))
                      }
                    >
                      {caseFactUse[row.bagKey] === false ? "Don't use" : 'Use this'}
                    </button>
                  </div>
                  <p className="fineprint">{row.source}</p>
                </li>
              ))}
            </ul>
            <button type="button" className="btn primary" onClick={continueFromCaseFacts}>
              Continue
            </button>
          </div>
        )}

        {stage === 'subject' && (
          <div className="chatcard">
            <h4>
              {subject === 'self' ? 'Your information, from your profile' : 'The person this motion is for'}
              <HelpTip title="Where does this go?">
                <p className="hintbody">
                  {subject === 'self'
                    ? 'These details fill the caption, signature block, and filing steps of every document you prepare. Corrections here apply to this filing; the checkbox below also saves them to your profile for next time.'
                    : 'Their information goes on the document — the caption, the signature block, and the filing steps at the end. It is used for this filing only: your account profile is not changed, and you remain the preparer.'}
                </p>
              </HelpTip>
            </h4>
            <div className="formgrid">
              {PROFILE_FIELDS.map((f) => (
                <div className={`field${f.full ? ' full' : ''}`} key={f.key}>
                  <label htmlFor={`subj-${f.key}`}>{f.label}</label>
                  <input
                    id={`subj-${f.key}`}
                    value={subjectInfo[f.key]}
                    autoComplete={f.autoComplete}
                    onChange={(e) => setSubjectInfo((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="field full">
                <label htmlFor="subj-email">Email address</label>
                <input
                  id="subj-email"
                  type="email"
                  value={subjectInfo.email}
                  autoComplete="email"
                  onChange={(e) => setSubjectInfo((s) => ({ ...s, email: e.target.value }))}
                />
              </div>
            </div>
            {subject === 'self' ? (
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={saveBack}
                  onChange={(e) => setSaveBack(e.target.checked)}
                />
                Save any changes to my profile
              </label>
            ) : null}
            <button className="btn primary" disabled={!subjectInfo.fullName.trim()} onClick={applySubject}>
              Use this information
            </button>
          </div>
        )}

        {stage === 'confirm' && motion && (
          <div className="chatcard confirmcard">
            <p className="stepkicker">This sounds like</p>
            <h4>{motion.name}</h4>
            <p className="cardsub">{motion.purpose}</p>
            <HelpTip title="Is this the right one?">
              <p className="hintbody">Honest note: {motion.proSe}</p>
              {motion.warning && <p className="warn">{motion.warning}</p>}
            </HelpTip>
          </div>
        )}

        {stage === 'pick' && !pickCat && (
          <div className="chatcard">
            <h4>Pick the closest fit</h4>
            <div className="catgrid">
              {pickCats.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="catitem"
                  onClick={() => setPickCat(cat)}
                >
                  <Icon name={CATEGORY_ICONS[cat] || 'doc'} size={20} />
                  <strong>{cat}</strong>
                  <span>{(grouped[cat] || []).length} documents</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === 'pick' && pickCat && (
          <div className="chatcard">
            <div className="pickhead">
              <button type="button" className="backbtn" onClick={() => setPickCat(null)}>
                ‹ Kinds of case
              </button>
              <h4>{pickCat}</h4>
            </div>
            <div className="pickgrid">
              {pickList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="pickitem"
                  onClick={() => chooseMotion(m)}
                >
                  <strong>{m.name}</strong>
                  <span>{m.purpose}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === 'review' && (
          <div className="chatcard">
            <h4>
              Check your answers
              <HelpTip title="What happens now?">
                <p className="hintbody">
                  This is exactly what goes into your {motion ? motion.name : 'document'}.
                  Read it over — if something is wrong, tap Back above the answer bar to fix
                  it before you sign.
                </p>
              </HelpTip>
            </h4>
            <div className="reviewlist">
              {reviewPairs.map((p) => (
                <div className="reviewrow" key={p.key}>
                  <span className="reviewq">{p.label}</span>
                  <span className="reviewa">{p.value}</span>
                  {caseFactSourcesRef.current[p.key] && (
                    <span className="fineprint block">{caseFactSourcesRef.current[p.key]}</span>
                  )}
                </div>
              ))}
              {reviewPairs.length === 0 && (
                <p className="steptext">Nothing to review yet.</p>
              )}
            </div>
            <button type="button" className="btn primary" onClick={continueFromReview}>
              Continue to signature
            </button>
          </div>
        )}

        {stage === 'signature' && (
          <div className="chatcard">
            <h4>{signPrompt()}</h4>
            <div className="sigblock">
              <SignaturePad onChange={setSignature} />
              {!signature && <p className="fineprint">Draw your signature to continue.</p>}
            </div>
            <button
              className="btn primary"
              disabled={!signature}
              onClick={() => { say('user', '(signed)'); setStage('pay'); }}
            >
              Continue to my document
            </button>
          </div>
        )}

        {stage === 'pay' && motion && (
          <div className="chatcard">
            <h4>
              {motion.name}
              <HelpTip title="What am I asking the court for?">
                <p className="hintbody">{fill(motion.prayer, answers)}</p>
              </HelpTip>
            </h4>
            <p className="cardsub">
              {restoredSession
                ? 'Your payment went through — generate your document below.'
                : coupon.trim()
                  ? 'Your document will be generated with the coupon applied.'
                  : 'Your filing-ready PDF — $3, charged only when it is generated.'}
            </p>
            {payError && <p className="error">{payError}</p>}
            {!restoredSession && (
              <div className="field">
                <label htmlFor="coupon-code">Coupon code (optional)</label>
                <input
                  id="coupon-code"
                  value={coupon}
                  autoComplete="off"
                  placeholder="Have a code? Enter it here"
                  onChange={(e) => setCoupon(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') startPayment(); }}
                />
              </div>
            )}
            {restoredSession ? (
              <button className="btn primary big" onClick={() => generatePdf(restoredSession)}>Download my document</button>
            ) : (
              <button className="btn primary big" onClick={startPayment}>
                {coupon.trim() ? 'Generate my document' : 'Generate my document — $3'}
              </button>
            )}
            <p className="fineprint cardfoot">
              <HelpTip title="What's included?">
                <p className="hintbody">
                  Your packet includes the motion{motion.needsProposedOrder ? ', a proposed order' : ''}{motion.needsConferenceCert ? ', a certificate of conference' : ''} and a certificate of service.
                  {feeWaiverAdded ? ' The fee-waiver request is included at no extra charge.' : ''}
                </p>
              </HelpTip>
              <HelpTip title="The fine print">{DISCLAIMER}</HelpTip>
            </p>
          </div>
        )}

        {stage === 'done' && filing && (
          <div className="chatcard">
            {savedCaseId && (
              <p className="savednote">
                Saved to your dashboard —{' '}
                <Link href={`/dashboard/cases/${savedCaseId}`}>view the case</Link>, where its
                deadlines, documents, and hearing details now live.
              </p>
            )}
            <h4>{filing.heading}</h4>
            {filing.approximate && (
              <p className="warn">
                We matched your ZIP to {filing.countyName || 'your'} County approximately —
                double-check the county on your case paperwork before you file.
              </p>
            )}
            <ol>
              {doneSteps.map((s, i) => (
                <li key={i}>
                  <p>{s.text}</p>
                  {s.links && (
                    <p className="steplinks">
                      {s.links.map((l) => (
                        <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {courtCard && (
              <div className="courtcard">
                <h4>{courtCard.name}</h4>
                <p className="fineprint">Your court — contact details from the court database.</p>
                {courtCard.address
                  ? <p><strong>Address:</strong> {courtCard.address}{courtCard.city ? `, ${courtCard.city}` : ''}</p>
                  : courtCard.city
                    ? <p><strong>City:</strong> {courtCard.city}</p>
                    : null}
                {courtCard.phone && <p><strong>Phone:</strong> {courtCard.phone}</p>}
                {courtCard.fax && <p><strong>Fax:</strong> {courtCard.fax}</p>}
                {courtCard.hours && <p><strong>Hours:</strong> {courtCard.hours}</p>}
                {courtCard.email && <p><strong>Email:</strong> {courtCard.email}</p>}
                {(courtCard.efilingUrl || courtCard.website) && (
                  <p className="steplinks">
                    {courtCard.efilingUrl && (
                      <a href={courtCard.efilingUrl} target="_blank" rel="noreferrer">File online (e-filing) ↗</a>
                    )}
                    {courtCard.website && (
                      <a href={courtCard.website} target="_blank" rel="noreferrer">Court website ↗</a>
                    )}
                  </p>
                )}
              </div>
            )}
            <p className="fineprint cardfoot">
              <HelpTip title="The fine print">
                <p className="hintbody">{DISCLAIMER}</p>
                <p className="hintbody">
                  Court rules change — confirm fees, deadlines, and service rules with the
                  clerk of your court.
                </p>
              </HelpTip>
            </p>
            <Link className="btn" href="/library">Browse the motion library</Link>
          </div>
        )}
      </div>

      {!dockEmpty && (
        <div className="chatdock">
          {goBackVisible && (
            <button type="button" className="backbtn" onClick={goBack}>‹ Back</button>
          )}
          {badgeButtons()}
          {dockHasComposer && composer}
        </div>
      )}
    </div>
  );
}
