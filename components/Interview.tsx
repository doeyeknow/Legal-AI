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
    { from: 'bot', text: 'Hey there! How can I help?' }
    
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
  /** True after getUserMedia has succeeded once this page session. */
  const micPrimedRef = useRef(false);
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
      try { rec.abort?.(); } catch { /* older engines */ }
      try { rec.stop(); } catch { /* already stopped */ }
    }
  }

  /** Ask for microphone access while we still have a user gesture.
   *  Web Speech often fails instantly (mic flash) if the first
   *  recognition.start() happens later, after TTS, with no gesture. */
  async function ensureMicAccess(): Promise<boolean> {
    if (micPrimedRef.current) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // Still try SpeechRecognition — some browsers expose it without mediaDevices.
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release tracks immediately; we only needed the permission grant.
      for (const t of stream.getTracks()) t.stop();
      micPrimedRef.current = true;
      autoBlockedRef.current = false;
      return true;
    } catch (err: any) {
      const name = String(err?.name || err || '');
      autoBlockedRef.current = true;
      if (name.includes('NotAllowed') || name.includes('PermissionDenied')) {
        setVoiceNote('Microphone access was blocked — typing works just the same.');
      } else if (name.includes('NotFound') || name.includes('DevicesNotFound')) {
        setVoiceNote('No microphone was found on this device — typing works just the same.');
      } else {
        setVoiceNote('Could not open the microphone — typing works just the same.');
      }
      return false;
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

    // Tear down any prior instance so a stale onend cannot clear the new session.
    const prev = recogRef.current;
    if (prev) {
      try { prev.onend = null; prev.onerror = null; prev.onresult = null; } catch { /* */ }
      try { prev.abort?.(); } catch { /* */ }
      try { prev.stop(); } catch { /* */ }
      recogRef.current = null;
    }

    const rec = new SR();
    const session = { auto, gotResult: false, suppressEnd: false };
    recogSessionRef.current = session;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      // Ignore results from a superseded instance.
      if (recogRef.current !== rec) return;
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
      // Stale session: a newer recognition is already running (or was started).
      if (recogRef.current !== rec) return;
      setListening(false);
      listeningRef.current = false;
      recogRef.current = null;
      handleRecogEnd(session);
    };
    rec.onerror = (e: any) => {
      if (recogRef.current !== rec && recogRef.current !== null) return;
      const err = String(e?.error || 'unknown');
      try { console.warn('[speech]', err, e); } catch { /* */ }
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        // Retrying can never fix a denied permission: the loop
        // stays off (TTS is unaffected) and the note shows once.
        autoBlockedRef.current = true;
        session.suppressEnd = true;
        const text = 'Microphone access was blocked — typing works just the same.';
        if (session.auto) showNoteOnce('blocked', text);
        else setVoiceNote(text);
      } else if (err === 'network') {
        session.suppressEnd = !session.auto;
        const text =
          'Voice typing could not reach the speech service (network). Check your connection, disable VPN/ad-block for this site, or type your answer.';
        if (session.auto) showNoteOnce('network', text);
        else setVoiceNote(text);
      } else if (err === 'audio-capture') {
        session.suppressEnd = !session.auto;
        const text = 'Could not capture audio from the microphone — typing works just the same.';
        if (session.auto) showNoteOnce('audio-capture', text);
        else setVoiceNote(text);
      } else if (err === 'aborted') {
        session.suppressEnd = true;
      } else if (err === 'no-speech') {
        // Normal for a quiet room; the empty-turn loop handles retries.
      } else if (!session.auto) {
        setVoiceNote(`Voice typing hit a problem (${err}) — typing works just the same.`);
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
      recogRef.current = null;
      if (!auto) {
        setVoiceNote('Listening could not be started in this browser — typing works just the same.');
      }
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

  async function toggleVoice() {
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
    // Prime mic permission on this user gesture so auto-listen after
    // TTS is not the first time the browser sees a mic request.
    const ok = await ensureMicAccess();
    if (!ok) {
      // Still allow TTS-only voice mode; listening stays manual/blocked.
    }
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

  async function toggleMic() {
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
  }
