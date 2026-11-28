'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { MotionDef, MotionField, Answers } from '@/lib/motions/types';
import { SHARED_FIELDS, DISCLAIMER, fill } from '@/lib/motions/types';
import { composeChildrenAnswers, expandChildrenQueue, readChildrenCount, readHasChildren, CHILDREN_COUNT_KEY, HAS_CHILDREN_KEY } from '@/lib/motions/children';
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
import DefenseCheck from './DefenseCheck';
import EmbeddedCheckoutBox from './EmbeddedCheckoutBox';
import { looksCriminal } from '@/lib/defenses';

/** One AI suggestion on the review page: the user's own words, the
 *  suggested professional rewording (editable), and their choice. */
interface PolishItem {
  key: string;
  label: string;
  original: string;
  text: string;
  choice: 'ai' | 'mine';
}

/** A chat message. `speak` is what voice mode reads aloud for a
 *  bot message — when set, the spoken line differs from the
 *  displayed text (questions show their full detail on screen but
 *  speak only the main question). */
interface Msg { from: 'bot' | 'user'; text: string; speak?: string }
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
  | 'boot' | 'mode' | 'gate' | 'who' | 'subject' | 'situation' | 'confirm' | 'pick' | 'fields' | 'feew-choice'
  | 'feew-fields' | 'review' | 'signature' | 'pay' | 'generating' | 'done' | 'casefacts' | 'defense';

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
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>('boot');
  const afterModeRef = useRef<(() => void) | null>(null);
  const [input, setInput] = useState('');
  const [motion, setMotion] = useState<MotionDef | null>(null);
  const [candidates, setCandidates] = useState<MotionDef[]>([]);
  /** The situation text, kept for the criminal defense check. */
  const [situationText, setSituationText] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [queue, setQueue] = useState<MotionField[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [qTotal, setQTotal] = useState(0);
  /** The motion's base queue from buildQueue (before the children
   *  gate expands it) — proceedWith rebuilds the effective queue
   *  from this + the latest answers on every answer, so the gate
   *  can add the count question, expand per-child blocks, or drop
   *  every gated field when the answer changes. */
  const baseQueueRef = useRef<MotionField[]>([]);
  /** The latest expanded fields-stage queue, for the review screen:
   *  reviewPairs lists the per-child and gate questions from here
   *  (the raw motion fields have no childN_* entries). */
  const motionQueueRef = useRef<MotionField[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [feeWaiverAdded, setFeeWaiverAdded] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [embeddedClientSecret, setEmbeddedClientSecret] = useState('');
  const [embeddedSessionId, setEmbeddedSessionId] = useState('');
  const [member, setMember] = useState(false);
  const restoredPacket = useRef(false);
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
  /** Last speech/mic diagnostic — visible in the voice strip when set. */
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const spokenUptoRef = useRef(0);
  const announcedStageRef = useRef('');
  /** Live Web Speech recognition instance — one fresh instance per take, never reused (see startWebSpeechRecognition). */
  const recogRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micAttemptRef = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Silence timer for a Web Speech take (100ms interval; never the VAD's). */
  const webSpeechTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Barge-in watcher: its own interval (never the VAD's) while the
   *  voice is speaking. bargeArmingRef guards the async mic
   *  acquisition so two overlapping starts cannot open two streams. */
  const bargeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bargeArmingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
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
  /** The live Web Speech take, if any: auto = hands-free take,
   *  gotResult = a final result arrived, suppressEnd = the take
   *  was stopped programmatically (its onend must do nothing),
   *  handled = onend already submitted or ran the empty path,
   *  finalText = final transcript so far, lastResultAt = when
   *  speech was last heard (drives the 1.4s silence stop). */
  const recogSessionRef = useRef<{
    auto: boolean; gotResult: boolean; suppressEnd: boolean; handled: boolean;
    finalText: string; lastResultAt: number; startedAt: number;
  } | null>(null);
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
  // --- One-page-per-step presentation ---
  // Which way the page transition slides (Back slides the other way).
  const navDirRef = useRef<'fwd' | 'back'>('fwd');
  // --- Review: inline edits + the optional AI "make it professional" pass ---
  const [aiAvailable, setAiAvailable] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [polish, setPolish] = useState<
    | null
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; items: PolishItem[] }
    | { status: 'applied'; count: number }
  >(null);
  const [polishSkipped, setPolishSkipped] = useState(false);

  const say = (from: 'bot' | 'user', text: string, speak?: string) =>
    setMsgs((m) => [...m, { from, text, speak }]);

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
    const returning = params.get('payment');
    if (returning) {
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
            restoredPacket.current = true;
            if (returning === 'success') setRestoredSession(params.get('session_id'));
            setStage('pay');
            if (returning === 'success') say('bot', 'Welcome back. Select Download to verify your payment and get your motion PDF.');
            else if (returning === 'cancelled') say('bot', 'You returned from checkout. Your answers are still here.');
            return;
          }
        }
      } catch { /* fall through to a fresh interview */ }
      if (returning === 'success') say('bot', 'This browser no longer has the interview answers used at checkout. If you were charged, contact us with your receipt before paying again.');
      else say('bot', 'Tell me what is going on, in your own words.');
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
      if (!restoredPacket.current) setStage('situation');
    }
    let live = true;
    fetch('/api/me')
      .then(async (res) => {
        if (!live) return;
        if (params.get('payment')) {
          const data = await res.json().catch(() => ({}));
          if (!live) return;
          setAcct(data.user ? 'user' : 'guest');
          setMember(Boolean(data.membership));
          return;
        }
        if (res.status === 503) {
          setAcct('off');
          offerMode(beginFresh);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!live) return;
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
          setMember(Boolean(data.membership));
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
            offerMode(() => {
              say('bot', `Welcome back${u.fullName ? `, ${String(u.fullName).split(' ')[0]}` : ''}. Before the questions: your court mail for this case gave us some facts you already confirmed. Use the ones that belong in this document — anything you leave off is simply asked about as usual.`);
              setStage('casefacts');
            });
            return;
          }
          offerMode(() => {
            say('bot', `Welcome back${u.fullName ? `, ${String(u.fullName).split(' ')[0]}` : ''}. Is this motion for you, or for someone else?`);
            setStage('who');
          });
        } else {
          setAcct('guest');
          offerMode(() => setStage('gate'));
        }
      })
      .catch(() => {
        if (!live) return;
        setAcct('off');
        if (!params.get('payment')) offerMode(beginFresh);
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
      if (msgs[i].from === 'bot') p.enqueue(msgs[i].speak ?? msgs[i].text);
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
      voiceOnRef.current = false;
      playerRef.current?.stop();
      stopRecognition(true);
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
    if (acct !== 'user' || !member || !motion) {
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
  }, [acct, member, motion, answers, subject, feeWaiverAdded, stage]);

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

  function offerMode(next: () => void) {
    afterModeRef.current = next;
    setStage('mode');
  }

  function selectMode(useVoice: boolean) {
    const next = afterModeRef.current;
    if (!next) return;
    afterModeRef.current = null;
    if (useVoice) {
      getPlayer();
      spokenUptoRef.current = msgs.length;
      voiceOnRef.current = true;
      setVoiceOn(true);
    }
    next();
  }

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
      say('bot', 'Tell me what is going on, in your own words.');
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
      setSituationText(t);
      // Someone facing a pending criminal charge: look for ways to
      // get it dropped before drafting anything.
      if (member && looksCriminal(t)) {
        say('bot', 'Since this is a criminal charge, a few yes / no questions first could turn up a way to get it dismissed.');
        setStage('defense');
      } else {
        setStage('confirm');
      }
    } else if (member && looksCriminal(t)) {
      setSituationText(t);
      say('bot', 'Since this is a criminal charge, a few yes / no questions first could turn up a way to get it dismissed.');
      setStage('defense');
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
    // The queue is expanded for the children gate from the saved
    // answers, so a resumed draft lands on the same question it
    // would have asked live (gate, count, or per-child block).
    const base = buildQueue(m, new Set(subj !== null ? SUBJECT_SEEDED_KEYS : []));
    baseQueueRef.current = base;
    const q = expandChildrenQueue(base, restored);
    motionQueueRef.current = q;
    const firstOpen = q.findIndex((f) => !String(saved[f.key] ?? '').trim());
    if (firstOpen >= 0) {
      setQueue(q);
      setQTotal(q.length);
      setQIdx(firstOpen);
      setStage('fields');
      say('bot', q[firstOpen].label + (q[firstOpen].hint ? ` ${q[firstOpen].hint}` : ''), q[firstOpen].label);
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
    const base = buildQueue(m, skip);
    baseQueueRef.current = base;
    // The children gate expands from the answers already known
    // (a seeded subject never changes the gate; the gate question
    // itself is inserted where the first gated field stood).
    const q = expandChildrenQueue(base, answers);
    motionQueueRef.current = q;
    setQueue(q);
    setQTotal(q.length);
    setQIdx(0);
    setStage('fields');
    if (isSeeded) {
      say('bot', `I already have the filer's basic information from the first step, so I will ask ${q.length} short questions — a few about the case itself, then the ones specific to this motion.`);
    } else {
      say('bot', `I will ask ${q.length} short questions — first a few about you and your case (used in the caption of every court document), then the ones specific to this motion.`);
    }
    say('bot', q[0].label + (q[0].hint ? ` ${q[0].hint}` : ''), q[0].label);
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
    say('bot', prev.label + (prev.hint ? ` ${prev.hint}` : ''), prev.label);
  }

  /** Advance the interview after an answer has been recorded
   *  into `next` — shared by typed answers and by the county
   *  confirmation, which records county + state together.
   *  The children gate can reshape the queue (a Yes answer adds
   *  the count question, a count answer expands the per-child
   *  blocks, a No drops every gated field), so the effective queue
   *  is rebuilt from the base queue + the new answers first, and
   *  the next question is the one after the answered field in
   *  that rebuilt queue. Fee-waiver fields have no gate and
   *  advance in place, exactly as before. */
  function proceedWith(next: Answers, answeredKey?: string) {
    if (stage === 'fields' && motion) {
      const expanded = expandChildrenQueue(baseQueueRef.current, next);
      motionQueueRef.current = expanded;
      setQueue(expanded);
      setQTotal(expanded.length);
      const key = answeredKey ?? queue[qIdx]?.key;
      const answeredIdx = key ? expanded.findIndex((f) => f.key === key) : -1;
      const ni = answeredIdx >= 0 ? answeredIdx + 1 : qIdx + 1;
      if (ni < expanded.length) {
        setQIdx(ni);
        const nf = expanded[ni];
        say('bot', nf.label + (nf.hint ? ` ${nf.hint}` : ''), nf.label);
        return;
      }
    } else if (stage === 'feew-fields') {
      const ni = qIdx + 1;
      if (ni < queue.length) {
        setQIdx(ni);
        const nf = queue[ni];
        say('bot', nf.label + (nf.hint ? ` ${nf.hint}` : ''), nf.label);
        return;
      }
    } else if (stage !== 'fields') {
      return;
    }
    if (stage === 'fields') {
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
    // Children gate: a changed gate answer retires the answers it
    // no longer covers, so a lowered count or a No never leaves
    // stale per-child answers behind in the draft.
    if (field.key === HAS_CHILDREN_KEY && readHasChildren(next) === 'no') {
      delete next[CHILDREN_COUNT_KEY];
      for (const k of Object.keys(next)) if (/^child\d+_/.test(k)) delete next[k];
    }
    if (field.key === CHILDREN_COUNT_KEY) {
      const n = readChildrenCount(next);
      if (n !== null) {
        for (const k of Object.keys(next)) {
          const mm = /^child(\d+)_/.exec(k);
          if (mm && Number(mm[1]) > n) delete next[k];
        }
      }
    }
    setAnswers(next);
    proceedWith(next, field.key);
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
        // While the bot speaks, stop any in-progress listening so we
        // do not transcribe the assistant's voice as an answer.
        if (active) {
          stopRecognition(true);
          setSpeechStatus('Speaking…');
          // Barge-in: watch the mic while the question plays — if
          // the user starts answering mid-question, the watcher
          // stops the voice and opens the mic on the same stream.
          void startBargeInWatcher();
        } else {
          // Playback ended (natural drain or stop): the watcher
          // stands down; the normal drain path opens the mic.
          stopBargeInWatcher();
        }
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

  /** Stop any live listening — Web Speech recognition or the
   *  MediaRecorder fallback — and release the mic stream and VAD. */
  function stopRecognition(_suppressEnd = true) {
    // The barge-in watcher goes first: its analyser context is
    // released here, and its mic tracks with the stream below.
    stopBargeInWatcher();
    micAttemptRef.current += 1;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (webSpeechTimerRef.current) {
      clearInterval(webSpeechTimerRef.current);
      webSpeechTimerRef.current = null;
    }
    // Web Speech: stop the live recognition (if any). The
    // micAttemptRef bump above makes its late onend/onerror
    // callbacks no-ops (the attempt token), and suppressEnd
    // swallows onend entirely. Never call abort() here: stop()
    // lets a pending final result flush, and the guards above
    // keep it from submitting.
    if (recogSessionRef.current) recogSessionRef.current.suppressEnd = true;
    const recog = recogRef.current;
    recogRef.current = null;
    if (recog) {
      try { recog.stop(); } catch { /* */ }
    }
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch { /* */ }
    }
    const stream = mediaStreamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) {
        try { t.stop(); } catch { /* */ }
      }
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch { /* */ }
      audioCtxRef.current = null;
    }
    setListening(false);
    listeningRef.current = false;
  }

  function reportSpeech(msg: string) {
    setSpeechStatus(msg);
    setVoiceNote(msg);
    try { console.warn('[speech]', msg); } catch { /* */ }
  }

  /**
   * Barge-in: while the voice is asking a question, watch the mic
   * for the user starting to answer — then stop the voice at once
   * and open the mic on the same stream, so the answer already in
   * progress is captured and the next question follows as usual.
   *
   * Echo assumption: the mic is opened with echoCancellation +
   * noiseSuppression (the same constraints as startRecognition),
   * so the phone speaker's own voice is suppressed at the source.
   * The watcher still requires sustained speech — RMS at or above
   * the shared 0.02 threshold on 2 consecutive 100ms ticks
   * (200ms) — and skips the first 300ms after it starts, so a
   * tap, a cough, or the TTS onset transient before echo
   * cancellation converges cannot trip it. The watcher only
   * measures; it never records. It cannot be proven live without
   * a real mic + speaker in the room: if echo cancellation proves
   * weak on a device, the 2-tick sustain is the only guard, and
   * the threshold may need raising for that device.
   *
   * Lifecycle: armed once per spoken clip from onActiveChange
   * (a no-op while already watching); stops when playback ends
   * (the normal onDrained → maybeAutoListen path takes over),
   * when the stage leaves an answer stage, when voice is switched
   * off, when a recording starts, or after it fires once. It never
   * runs concurrently with an active recording — the VAD owns the
   * mic then, on its own interval (vadTimerRef).
   */
  function stopBargeInWatcher() {
    const wasWatching = bargeTimerRef.current !== null;
    if (bargeTimerRef.current) {
      clearInterval(bargeTimerRef.current);
      bargeTimerRef.current = null;
    }
    bargeArmingRef.current = false;
    // The analyser context goes only when the watcher was the one
    // using it — never the VAD's context mid-recording. The mic
    // tracks stay live: the recorder reuses this stream on
    // barge-in, and stopRecognition releases them on every other
    // teardown.
    if (wasWatching && audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch { /* */ }
      audioCtxRef.current = null;
    }
  }

  async function startBargeInWatcher() {
    if (!voiceOnRef.current) return;
    if (!isAnswerStage(stageRef.current)) return;
    if (bargeTimerRef.current || bargeArmingRef.current) return;
    if (listeningRef.current || mediaRecorderRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    bargeArmingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
    } catch {
      // Mic unavailable mid-question: no barge-in, but the normal
      // drain path still opens the mic (or reports the block).
      bargeArmingRef.current = false;
      return;
    }
    // Playback may have ended, voice may have been switched off,
    // or a recording may have started while the mic was opening.
    if (!voiceOnRef.current || !speakingRef.current || !isAnswerStage(stageRef.current) ||
        listeningRef.current || mediaRecorderRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      bargeArmingRef.current = false;
      return;
    }
    mediaStreamRef.current = stream;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error('no AudioContext');
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        try { void ctx.resume(); } catch { /* */ }
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      // Same threshold as the recording VAD below.
      const SPEECH_RMS = 0.02;
      const startedAt = Date.now();
      let loudTicks = 0;
      bargeTimerRef.current = setInterval(() => {
        if (!voiceOnRef.current || !speakingRef.current || !isAnswerStage(stageRef.current)) {
          stopBargeInWatcher();
          return;
        }
        if (listeningRef.current || mediaRecorderRef.current) {
          stopBargeInWatcher();
          return;
        }
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms >= SPEECH_RMS) loudTicks += 1;
        else loudTicks = 0;
        if (loudTicks >= 2 && Date.now() - startedAt >= 300) {
          // Sustained speech: the user is answering mid-question.
          // Stop the watcher (timer + analyser context only), halt
          // the voice at once — stop() clears the queue and fires
          // onActiveChange(false) but never onDrained, so nothing
          // else will open the mic — then open it here, on the
          // same live stream, to catch the answer in progress.
          // The user just proved they are present, so the paused
          // auto-listen state (if any) is cleared too.
          stopBargeInWatcher();
          playerRef.current?.stop();
          listenPausedRef.current = false;
          emptyCyclesRef.current = 0;
          void fnRef.current.startRecognition(true);
        }
      }, 100);
      bargeArmingRef.current = false;
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      if (mediaStreamRef.current === stream) mediaStreamRef.current = null;
      stopBargeInWatcher();
    }
  }

  async function transcribeBlob(blob: Blob, attempt: number): Promise<string | null> {
    setSpeechStatus('Transcribing…');
    try {
      const form = new FormData();
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', blob, `answer.${ext}`);
      const res = await fetch('/api/stt', { method: 'POST', body: form });
      if (attempt !== micAttemptRef.current) return null;
      if (res.status === 503) {
        reportSpeech('Voice typing is not set up on this site yet — typing works just the same.');
        return null;
      }
      if (res.status === 422 || res.status === 400) {
        reportSpeech('No speech detected. Tap the mic and try again, or type your answer.');
        return null;
      }
      if (!res.ok) {
        reportSpeech('Transcription failed. Check your connection, or type your answer.');
        return null;
      }
      const data = await res.json().catch(() => ({}));
      if (attempt !== micAttemptRef.current) return null;
      const text = String((data as any).text || '').trim();
      if (!text) {
        reportSpeech('No speech detected. Tap the mic and try again, or type your answer.');
        return null;
      }
      return text;
    } catch {
      if (attempt === micAttemptRef.current) reportSpeech('Transcription failed. Check your connection, or type your answer.');
      return null;
    }
  }

  /** The browser Web Speech recognizer constructor, or null when
   *  this browser has none (Firefox, older Safari). Chrome, Edge
   *  and modern Safari expose it (webkit-prefixed in some). */
  function getSpeechRecognition(): any | null {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  /** Empty-take handling for the Web Speech path: auto mode counts
   *  quiet cycles and pauses after 3 (same message and timing as
   *  the Scribe path); manual mode reports its own message at the
   *  call site, so this is a no-op there. */
  function noteEmptyTake(auto: boolean) {
    if (!auto) return;
    if (!voiceOnRef.current || autoBlockedRef.current) return;
    emptyCyclesRef.current += 1;
    if (emptyCyclesRef.current >= 3) {
      listenPausedRef.current = true;
      setSpeechStatus("Say your answer, or tap the mic when you're ready");
      return;
    }
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      fnRef.current.maybeAutoListen();
    }, 700);
  }

  /**
   * Open the mic for one answer. Primary path is the browser Web
   * Speech API (client-side transcription); when the browser has
   * no SpeechRecognition, the MediaRecorder + server Scribe path
   * (startScribeRecognition) runs instead.
   *
   * auto=true: started after TTS (hands-free). Stops on mic tap,
   * max duration, or when stopRecognition runs (next TTS / end call).
   */
  async function startRecognition(auto: boolean): Promise<boolean> {
    if (listeningRef.current) return true;
    if (auto && (autoBlockedRef.current || listenPausedRef.current)) return false;
    if (auto && speakingRef.current) return false;
    if (typeof window === 'undefined') return false;
    const SR = getSpeechRecognition();
    if (SR) return startWebSpeechRecognition(auto, SR);
    return startScribeRecognition(auto);
  }

  /**
   * Client-side speech-to-text via the browser Web Speech API
   * (Chrome / Edge / modern Safari). No audio is sent to our
   * server or to ElevenLabs for transcription — the browser
   * vendor's recognizer does it.
   *
   * The old Web Speech implementation aborted on this deployment.
   * This one does not repeat it:
   * - A FRESH SpeechRecognition instance is created for every
   *   take and never reused: reusing an instance after stop()
   *   is what produced the aborts.
   * - start() is never called while one is active: the
   *   dispatcher returns early while listeningRef is set.
   * - stopRecognition() stops the live instance and bumps
   *   micAttemptRef, so the instance's late onend/onerror
   *   callbacks are no-ops (the attempt token), and the
   *   session's suppressEnd flag swallows onend entirely.
   * - onerror 'aborted' is treated as a clean stop: no message,
   *   no retry, no loop — an abort is expected whenever
   *   recognition is stopped programmatically.
   * - The mic stream the barge-in watcher holds is stopped, not
   *   reused: Web Speech captures its own audio, and two live
   *   mic captures on one phone can starve each other.
   *
   * Silence stop mirrors the Scribe path's VAD: ~1.4s of quiet
   * after speech ends the take, 12s with no speech at all ends
   * it empty, 30s caps a take. The browser's own end-of-speech
   * also ends the take through onend.
   */
  async function startWebSpeechRecognition(auto: boolean, SR: any): Promise<boolean> {
    // Barge-in handoff: the watcher already holds a live mic
    // stream, opened while the question played. Web Speech does
    // not need it — it captures its own audio — so stop its
    // tracks instead of reusing them (the Scribe path reuses
    // them; here a second live capture could starve the
    // recognizer on a phone). stopRecognition would also stop
    // the stream's tracks, so it is skipped on this path — only
    // the watcher timer/context go (already stopped by the fire
    // handler; this is a no-op guard).
    const watcherStream =
      mediaStreamRef.current && !mediaRecorderRef.current &&
      mediaStreamRef.current.getTracks().some((t) => t.readyState === 'live')
        ? mediaStreamRef.current
        : null;
    if (watcherStream) {
      stopBargeInWatcher();
      for (const t of watcherStream.getTracks()) {
        try { t.stop(); } catch { /* */ }
      }
      mediaStreamRef.current = null;
    } else {
      stopRecognition(true);
    }
    const attempt = micAttemptRef.current;

    let recog: any;
    try {
      recog = new SR();
    } catch {
      // Constructor unavailable after all — fall back silently
      // to the server path; no instance is running.
      return startScribeRecognition(auto);
    }
    recog.lang = 'en-US';
    recog.interimResults = true;
    recog.continuous = true;
    recog.maxAlternatives = 1;

    const session = {
      auto, gotResult: false, suppressEnd: false, handled: false,
      finalText: '', lastResultAt: 0, startedAt: Date.now(),
    };
    recogSessionRef.current = session;
    recogRef.current = recog;

    // The one submit point, through onend only, so a transcript
    // is never submitted twice (timer stop + onend both firing).
    const finishTake = () => {
      if (session.handled) return;
      session.handled = true;
      setListening(false);
      listeningRef.current = false;
      const text = session.finalText.trim();
      if (text) {
        emptyCyclesRef.current = 0;
        listenPausedRef.current = false;
        setSpeechStatus(null);
        fnRef.current.submitInput(text);
      } else if (session.auto) {
        noteEmptyTake(true);
      } else {
        reportSpeech('No speech detected. Tap the mic and try again, or type your answer.');
      }
    };

    recog.onresult = (e: any) => {
      if (attempt !== micAttemptRef.current) return;
      let interim = '';
      try {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r || !r[0]) continue;
          if (r.isFinal) {
            const piece = String(r[0].transcript || '');
            if (piece) {
              if (session.finalText && !session.finalText.endsWith(' ') && !piece.startsWith(' ')) session.finalText += ' ';
              session.finalText += piece;
            }
            session.gotResult = true;
          } else {
            interim += r[0].transcript;
          }
        }
      } catch { /* */ }
      if (session.finalText || interim) session.lastResultAt = Date.now();
      if (interim.trim()) {
        setSpeechStatus(`Hearing you… ${interim.trim().slice(0, 80)}`);
      } else if (session.gotResult) {
        setSpeechStatus('Hearing you…');
      }
    };

    recog.onerror = (e: any) => {
      if (attempt !== micAttemptRef.current) return;
      const err = String(e?.error || '');
      if (err === 'aborted') return; // programmatic stop — clean, silent
      if (err === 'no-speech') return; // onend follows and runs the empty path
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        session.handled = true;
        autoBlockedRef.current = true;
        reportSpeech('Microphone access was blocked — typing works just the same.');
        return;
      }
      if (err === 'audio-capture') {
        session.handled = true;
        autoBlockedRef.current = true;
        reportSpeech('No microphone was found — typing works just the same.');
        return;
      }
      // 'network', 'language-not-supported', and anything else:
      // the take is dead. Count it as an empty take in auto mode
      // (retry, pause at 3) like a failed Scribe take.
      session.handled = true;
      if (session.auto) {
        noteEmptyTake(true);
      } else {
        reportSpeech('Transcription failed. Check your connection, or type your answer.');
      }
    };

    recog.onend = () => {
      if (webSpeechTimerRef.current) {
        clearInterval(webSpeechTimerRef.current);
        webSpeechTimerRef.current = null;
      }
      if (recogRef.current === recog) recogRef.current = null;
      if (attempt !== micAttemptRef.current) return;
      if (session.suppressEnd) return;
      finishTake();
    };

    // Silence stop: the same timing as the Scribe path's VAD.
    const SILENCE_MS = 1400;         // quiet this long after speech → stop
    const MAX_INITIAL_WAIT_MS = 12000; // no speech at all → stop & empty
    const MAX_TAKE_MS = 30000;       // safety cap
    const clearSilenceTimer = () => {
      if (webSpeechTimerRef.current) {
        clearInterval(webSpeechTimerRef.current);
        webSpeechTimerRef.current = null;
      }
    };
    webSpeechTimerRef.current = setInterval(() => {
      if (attempt !== micAttemptRef.current) {
        clearSilenceTimer();
        return;
      }
      const now = Date.now();
      if (session.finalText && now - session.lastResultAt >= SILENCE_MS) {
        clearSilenceTimer();
        try { recog.stop(); } catch { /* */ }
        return;
      }
      if (!session.finalText && now - session.startedAt >= MAX_INITIAL_WAIT_MS) {
        clearSilenceTimer();
        try { recog.stop(); } catch { /* */ }
        return;
      }
      if (now - session.startedAt >= MAX_TAKE_MS) {
        clearSilenceTimer();
        try { recog.stop(); } catch { /* */ }
      }
    }, 100);

    try {
      recog.start();
    } catch {
      // start() threw (should not happen with the guards above):
      // nothing is running — fall back to the server path.
      clearSilenceTimer();
      recogRef.current = null;
      recogSessionRef.current = null;
      return startScribeRecognition(auto);
    }

    setListening(true);
    listeningRef.current = true;
    autoBlockedRef.current = false;
    setSpeechStatus(auto ? 'Listening for your answer…' : 'Listening…');
    return true;
  }

  /**
   * Fallback path — used only when the browser has no Web Speech
   * API (Firefox, older Safari). Records with MediaRecorder and
   * transcribes via ElevenLabs Scribe (POST /api/stt). Unchanged
   * behavior: same auto-listen, empty-cycle, and mic-button flow
   * as before the switch.
   *
   * auto=true: started after TTS (hands-free). Stops on mic tap,
   * max duration, or when stopRecognition runs (next TTS / end call).
   */
  async function startScribeRecognition(auto: boolean): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      reportSpeech('This browser cannot access the microphone — typing works just the same.');
      autoBlockedRef.current = true;
      return false;
    }
    if (typeof MediaRecorder === 'undefined') {
      reportSpeech('This browser cannot record audio — typing works just the same.');
      autoBlockedRef.current = true;
      return false;
    }

    // Barge-in handoff: the watcher already holds a live mic
    // stream, opened while the question played. Reuse it instead
    // of re-acquiring, so the answer the user is already giving is
    // not clipped at its start. stopRecognition would stop the
    // stream's tracks, so it is skipped on this path — only the
    // watcher timer/context go (already stopped by the fire
    // handler; this is a no-op guard). A live stream in
    // mediaStreamRef with no recorder can only be the watcher's:
    // every finished take clears the ref in onstop, and every
    // other teardown goes through stopRecognition.
    const watcherStream =
      mediaStreamRef.current && !mediaRecorderRef.current &&
      mediaStreamRef.current.getTracks().some((t) => t.readyState === 'live')
        ? mediaStreamRef.current
        : null;
    if (watcherStream) {
      stopBargeInWatcher();
    } else {
      stopRecognition(true);
    }
    const attempt = micAttemptRef.current;

    let stream: MediaStream;
    if (watcherStream) {
      stream = watcherStream;
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        });
      } catch (err: any) {
        if (attempt !== micAttemptRef.current) return false;
        const name = String(err?.name || '');
        autoBlockedRef.current = true;
        if (name.includes('NotAllowed') || name.includes('PermissionDenied')) {
          reportSpeech('Microphone access was blocked — typing works just the same.');
        } else if (name.includes('NotFound')) {
          reportSpeech('No microphone was found — typing works just the same.');
        } else {
          reportSpeech('Could not open the microphone — typing works just the same.');
        }
        return false;
      }
    }

    if (attempt !== micAttemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    mediaStreamRef.current = stream;
    mediaChunksRef.current = [];

    const prefer = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    let mime = '';
    for (const t of prefer) {
      if (MediaRecorder.isTypeSupported(t)) {
        mime = t;
        break;
      }
    }

    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      for (const t of stream.getTracks()) t.stop();
      mediaStreamRef.current = null;
      reportSpeech('Could not start audio recording — typing works just the same.');
      return false;
    }

    mediaRecorderRef.current = recorder;
    const sessionAuto = auto;

    recorder.ondataavailable = (e) => {
      if (attempt === micAttemptRef.current && e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
    };

    recorder.onerror = () => {
      if (attempt !== micAttemptRef.current) return;
      reportSpeech('Recording failed — typing works just the same.');
      stopRecognition(true);
    };

    recorder.onstop = () => {
      if (attempt !== micAttemptRef.current) return;
      const chunks = mediaChunksRef.current.slice();
      mediaChunksRef.current = [];
      const stream2 = mediaStreamRef.current;
      if (stream2) {
        for (const t of stream2.getTracks()) {
          try { t.stop(); } catch { /* */ }
        }
        mediaStreamRef.current = null;
      }
      mediaRecorderRef.current = null;
      setListening(false);
      listeningRef.current = false;

      if (!chunks.length) {
        if (!sessionAuto) reportSpeech('No audio captured. Tap the mic and try again, or type.');
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size < 800) {
        if (!sessionAuto) reportSpeech('Recording was too short. Hold a bit longer, or type.');
        // Auto: quiet room — schedule another listen attempt via handleRecogEnd path
        if (sessionAuto && voiceOnRef.current && !speakingRef.current) {
          emptyCyclesRef.current += 1;
          if (emptyCyclesRef.current >= 3) {
            listenPausedRef.current = true;
            reportSpeech("Say your answer, or tap the mic when you're ready");
            return;
          }
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            fnRef.current.maybeAutoListen();
          }, 700);
        }
        return;
      }

      void (async () => {
        const text = await transcribeBlob(blob, attempt);
        if (attempt !== micAttemptRef.current) return;
        if (text) {
          emptyCyclesRef.current = 0;
          listenPausedRef.current = false;
          setSpeechStatus(null);
          fnRef.current.submitInput(text);
        } else if (sessionAuto && voiceOnRef.current && !autoBlockedRef.current) {
          emptyCyclesRef.current += 1;
          if (emptyCyclesRef.current >= 3) {
            listenPausedRef.current = true;
            setSpeechStatus("Say your answer, or tap the mic when you're ready");
            return;
          }
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            fnRef.current.maybeAutoListen();
          }, 700);
        }
      })();
    };

    try {
      recorder.start(250);
    } catch {
      stopRecognition(true);
      reportSpeech('Could not start audio recording — typing works just the same.');
      return false;
    }

    setListening(true);
    listeningRef.current = true;
    autoBlockedRef.current = false;
    setSpeechStatus(
      sessionAuto
        ? 'Listening for your answer…'
        : 'Listening…',
    );

    // --- End-of-speech detection (simple energy VAD) ---
    // After we hear speech, a stretch of silence means the user finished.
    // No need to tap the mic when done (mic tap still works as an early stop).
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          try { void ctx.resume(); } catch { /* */ }
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        // Tuned for close-talk interview answers on phone/laptop mics.
        const SPEECH_RMS = 0.02;       // above this ≈ speaking
        const SILENCE_MS = 1400;       // quiet this long after speech → stop
        const MIN_MS_BEFORE_END = 700; // don't cut off the first syllable
        const MAX_INITIAL_WAIT_MS = 12000; // no speech at all → stop & retry/empty
        const startedAt = Date.now();
        let everSpoke = false;
        let lastLoudAt = startedAt;

        if (vadTimerRef.current) clearInterval(vadTimerRef.current);
        vadTimerRef.current = setInterval(() => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
            if (vadTimerRef.current) {
              clearInterval(vadTimerRef.current);
              vadTimerRef.current = null;
            }
            return;
          }
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const now = Date.now();

          if (rms >= SPEECH_RMS) {
            everSpoke = true;
            lastLoudAt = now;
            setSpeechStatus('Hearing you…');
          } else if (everSpoke && now - lastLoudAt >= SILENCE_MS && now - startedAt >= MIN_MS_BEFORE_END) {
            // User finished talking.
            if (vadTimerRef.current) {
              clearInterval(vadTimerRef.current);
              vadTimerRef.current = null;
            }
            setSpeechStatus('Transcribing…');
            try { mediaRecorderRef.current.stop(); } catch { /* */ }
          } else if (!everSpoke && now - startedAt >= MAX_INITIAL_WAIT_MS) {
            // No speech detected — stop; onstop handles empty/retry.
            if (vadTimerRef.current) {
              clearInterval(vadTimerRef.current);
              vadTimerRef.current = null;
            }
            try { mediaRecorderRef.current.stop(); } catch { /* */ }
          } else if (everSpoke) {
            setSpeechStatus('Listening…');
          }
        }, 100);
      }
    } catch {
      // VAD optional — max duration + mic tap still end the take.
    }

    // Safety cap so a forgotten mic cannot run forever.
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    recordTimerRef.current = setTimeout(() => {
      recordTimerRef.current = null;
      const r = mediaRecorderRef.current;
      if (r && r.state === 'recording') {
        setSpeechStatus('Transcribing…');
        try { r.stop(); } catch { /* */ }
      }
    }, 30000);

    return true;
  }

  /** After the assistant finishes speaking, open the mic and record. */
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
      void fnRef.current.startRecognition(true);
    }, 400);
  }

  function switchToTyping() {
    voiceOnRef.current = false;
    playerRef.current?.stop();
    stopRecognition(true);
    setVoiceOn(false);
    setVoiceNote(null);
    setSpeechStatus(null);
  }

  /** Mic button: start listening, or finish the take if already listening. */
  function toggleMic() {
    if (listeningRef.current || listening) {
      // Web Speech take: stop it; onend submits the final
      // transcript (or runs the empty path).
      const recog = recogRef.current;
      if (recog) {
        try { recog.stop(); } catch { /* */ }
        return;
      }
      // Scribe take: finish the recording and send it to /api/stt.
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const rec = mediaRecorderRef.current;
      if (rec && rec.state === 'recording') {
        setSpeechStatus('Transcribing…');
        try { rec.stop(); } catch { /* */ }
      } else {
        stopRecognition(true);
      }
      return;
    }
    setVoiceNote(null);
    setSpeechStatus('Starting microphone…');
    listenPausedRef.current = false;
    emptyCyclesRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (voiceOnRef.current && speakingRef.current) playerRef.current?.stop();
    void startRecognition(false);
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
    proceedWith(next, 'county');
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

  function checkoutPacket() {
    // Per-child answers compose back into the list keys the PDF
    // expects; the gate keys never leave the browser.
    return motion ? {
      motionId: motion.id, answers: composeChildrenAnswers(withStateParty(motion, answers)), signature, feeWaiverAdded,
      subject, draftId: draftIdRef.current, caseId: caseIdRef.current,
    } : null;
  }

  function openMembership() {
    const packet = checkoutPacket();
    if (!packet) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(packet));
      window.location.assign('/membership?return=interview');
    } catch { setPayError('This browser could not keep your answers. Open the interview in a browser tab that allows session storage.'); }
  }

  async function startPayment() {
    const packet = checkoutPacket();
    if (!packet || checkoutBusy) return;
    setPayError(null);
    setCheckoutBusy(true);
    try {
      if (!member) sessionStorage.setItem(STORE_KEY, JSON.stringify(packet));
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...packet, coupon: coupon.trim() || undefined, memberOnly: member }),
      });
      const data = await res.json();
      if (data.member) setMember(true);
      if (data.devFree || data.member) return await generatePdf(null);
      if (data.couponFree) return await generatePdf(null, coupon.trim());
      if (data.error === 'membership_required') setMember(false);
      if (data.clientSecret) {
        if (member) {
          // Membership could have expired since this page loaded. Do not start a paid checkout without the buyer choosing it.
          setMember(false);
          setPayError('Your membership is not active. Choose the $5 one-time purchase or renew your membership.');
          return;
        }
        setEmbeddedClientSecret(data.clientSecret);
        setEmbeddedSessionId(data.sessionId || '');
        return;
      }
      if (data.url) {
        setPayError('Checkout could not load on this page. No charge was made. Please try again.');
        return;
      }
      setPayError(data.message || 'Payments are not available right now.');
    } catch {
      setPayError('Something went wrong starting checkout. No charge was made.');
    } finally { setCheckoutBusy(false); }
  }

  async function generatePdf(sessionId: string | null, couponCode?: string) {
    if (!motion) return;
    setStage('generating');
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motionId: motion.id, answers: composeChildrenAnswers(withStateParty(motion, answers)), signature, feeWaiverAdded, sessionId, coupon: couponCode || undefined, forWhom: subject, draftId: draftIdRef.current || undefined, caseId: caseIdRef.current || undefined }),
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
      say('bot', 'Your document is downloading. The PDF ends with filing instructions for you to keep. Do not file the instruction pages with the court.');
      const fres = await fetch('/api/courts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motionId: motion.id, zip: answers.zip, state: answers.state, county: answers.county }),
      }).catch(() => null);
      if (fres?.ok) setFiling(await fres.json().catch(() => null));
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
    startRecognition: (_auto: boolean): boolean | Promise<boolean> => false,
    maybeAutoListen: () => {},
  });
  fnRef.current = { submitInput, startRecognition, maybeAutoListen };

  const currentField = (stage === 'fields' || stage === 'feew-fields') ? queue[qIdx] : null;

  // Date questions: open the calendar automatically so the user does not
  // have to hunt for the icon. They can still type a date if they prefer.
  useEffect(() => {
    if (currentField?.type === 'date') {
      setDatePickOpen(true);
    } else {
      setDatePickOpen(false);
    }
  }, [currentField?.key, currentField?.type]);
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
  if (stage === 'mode') {
    badges.push(
      { label: 'Talk it through', icon: 'mic', action: () => selectMode(true) },
      { label: 'Type my answers', icon: 'pencil', action: () => selectMode(false) },
    );
  } else if (pendingCounty) {
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
    if (member && motion.category === 'Criminal & Post-Conviction' && looksCriminal(situationText || motion.name)) {
      badges.push({
        label: 'Check for ways to get the charges dropped',
        action: () => { say('user', 'Check for ways to get the charges dropped'); setStage('defense'); },
      });
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
    // The motion half comes from the expanded fields queue, not the
    // raw motion fields: that is where the gate questions and the
    // per-child questions live. Seeded subject fields are not in
    // the queue, so the shared fields are still listed first.
    const all = [
      ...SHARED_FIELDS,
      ...(motionQueueRef.current.length ? motionQueueRef.current : (motion?.fields || [])),
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
  } else if (stage === 'defense') {
    progressLabel = 'Ways to get charges dropped';
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

  // ---------- One-page-per-step presentation ----------
  // The engine above is unchanged. Each step of the interview is
  // its own full page: a heading (the question), any supporting
  // copy from this turn, the answer controls, and a Back / Next
  // bar pinned to the bottom. Moving on slides the next page in.
  const isQStage = stage === 'situation' || stage === 'fields' || stage === 'feew-fields';

  // The long "honest note" and warning copy a matched motion
  // produces belongs in the confirm card's "?" popup, not on the page.
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

  // This turn's bot copy, minus the tips that live behind "?".
  const turnTexts = msgs
    .slice(lastUserIdx + 1)
    .filter((m) => m.from === 'bot' && !isHiddenTip(m))
    .map((m) => m.text);
  // Cards bring their own heading; plain steps use the last bot
  // line as the page heading and anything before it as intro copy.
  const cardStage =
    stage === 'gate' || stage === 'casefacts' || stage === 'subject' || stage === 'confirm' ||
    stage === 'pick' || stage === 'review' || stage === 'signature' || stage === 'pay' || stage === 'done' ||
    stage === 'defense';
  let pageHeading: string | null = null;
  let pageIntro: string[] = [];
  if (liveQuestion) {
    pageHeading = liveQuestion;
    pageIntro = turnTexts.slice(0, -1);
  } else if (stage === 'mode') {
    pageHeading = 'How would you like to do this interview?';
  } else if (stage === 'boot' || stage === 'generating') {
    pageHeading = stage === 'generating' ? 'Preparing your document…' : null;
    pageIntro = stage === 'generating' ? turnTexts.slice(-1) : [];
  } else if (stage === 'confirm' || stage === 'defense') {
    // The motion card / defense check already says it.
    pageIntro = [];
  } else if (cardStage) {
    pageIntro = turnTexts.filter((t) => t !== signPrompt());
  } else {
    pageHeading = turnTexts[turnTexts.length - 1] || null;
    pageIntro = turnTexts.slice(0, -1);
  }
  // Fields re-say the label + hint; the heading and "?" already
  // carry both, so drop exact repeats from the intro.
  if (currentField) {
    const said = currentField.label + (currentField.hint ? ` ${currentField.hint}` : '');
    pageIntro = pageIntro.filter((t) => t !== said && t !== currentField.label);
  }

  // Fresh page: back to the top, and (on desktop) focus the answer box.
  useEffect(() => {
    const page = logRef.current;
    if (page) page.scrollTop = 0;
    const t = setTimeout(() => { navDirRef.current = 'fwd'; }, 400);
    if (isQStage && typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      setTimeout(() => {
        document
          .querySelector<HTMLInputElement | HTMLTextAreaElement>('.wizpage .stepcomposer input, .wizpage .stepcomposer textarea')
          ?.focus();
      }, 120);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey]);

  // Is the AI rewrite set up on this site? (Hides the offer if not.)
  useEffect(() => {
    let live = true;
    fetch('/api/ai/rewrite')
      .then((r) => r.json())
      .then((j) => { if (live) setAiAvailable(!!j?.available); })
      .catch(() => { /* stays off */ });
    return () => { live = false; };
  }, []);

  // Leaving review resets the per-visit review UI.
  useEffect(() => {
    if (stage !== 'review') { setEditKey(null); }
  }, [stage]);

  // ---- Back navigation, including out of the review page ----
  const lastQueueField = queue[queue.length - 1];
  function onBack() {
    navDirRef.current = 'back';
    if (stage === 'review') {
      stopRecognition(true);
      if (feeWaiverAdded && queue.length) {
        setStage('feew-fields');
        setQIdx(queue.length - 1);
        say('bot', lastQueueField.label + (lastQueueField.hint ? ` ${lastQueueField.hint}` : ''));
      } else if (motion && motion.id !== 'fee-waiver') {
        setStage('feew-choice');
        say('bot', feewPitch(subject === 'other', answers.fullName || ''));
      } else if (queue.length) {
        setStage('fields');
        setQIdx(queue.length - 1);
        say('bot', lastQueueField.label + (lastQueueField.hint ? ` ${lastQueueField.hint}` : ''));
      }
      return;
    }
    if (stage === 'feew-choice' && !feeWaiverAdded && queue.length > 0) {
      // Back from the fee-waiver offer: the motion's last question.
      setStage('fields');
      setQIdx(queue.length - 1);
      say('bot', lastQueueField.label + (lastQueueField.hint ? ` ${lastQueueField.hint}` : ''));
      return;
    }
    goBack();
  }
  const backVisible =
    goBackVisible ||
    (stage === 'review' && queue.length > 0) ||
    (stage === 'feew-choice' && !feeWaiverAdded && queue.length > 0);

  // ---- AI polish: which answers are "statements" worth rewording ----
  // Only the person's own descriptive writing — never names,
  // addresses, dates, amounts, picks from a list, or caption data.
  const sharedKeys = new Set(SHARED_FIELDS.map((f) => f.key));
  const polishCandidates = (() => {
    const out: { key: string; label: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const f of motion?.fields || []) {
      if (seen.has(f.key) || sharedKeys.has(f.key)) continue;
      seen.add(f.key);
      if (f.type === 'select' || f.type === 'date' || f.type === 'phone') continue;
      const v = (answers[f.key] || '').trim();
      if (!v) continue;
      const words = v.split(/\s+/).length;
      if (f.type === 'textarea' ? words >= 4 : words >= 12) {
        out.push({ key: f.key, label: f.label, text: v });
      }
    }
    return out;
  })();

  async function runPolish() {
    if (!polishCandidates.length) return;
    setPolish({ status: 'loading' });
    try {
      const r = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'statements',
          context: motion ? `Document: ${motion.name}` : undefined,
          items: polishCandidates,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(j?.items)) {
        setPolish({ status: 'error', message: j?.message || 'The AI rewrite failed. Your answers are unchanged.' });
        return;
      }
      const byKey = new Map<string, string>(
        (j.items as { key: string; text: string }[]).map((i) => [i.key, i.text]),
      );
      const items: PolishItem[] = polishCandidates
        .filter((c) => byKey.has(c.key) && byKey.get(c.key)!.trim() !== c.text)
        .map((c) => ({ key: c.key, label: c.label, original: c.text, text: byKey.get(c.key)!, choice: 'ai' }));
      if (!items.length) {
        setPolish({ status: 'applied', count: 0 });
        return;
      }
      setPolish({ status: 'ready', items });
    } catch {
      setPolish({ status: 'error', message: 'The AI service could not be reached. Your answers are unchanged.' });
    }
  }
  function updatePolishItem(key: string, patch: Partial<PolishItem>) {
    setPolish((p) =>
      p && p.status === 'ready'
        ? { ...p, items: p.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }
        : p,
    );
  }
  function applyPolish() {
    if (!polish || polish.status !== 'ready') return;
    const chosen = polish.items.filter((i) => i.choice === 'ai' && i.text.trim());
    if (chosen.length) {
      setAnswers((a) => {
        const next = { ...a };
        for (const i of chosen) next[i.key] = i.text.trim();
        return next;
      });
    }
    setPolish({ status: 'applied', count: chosen.length });
  }

  function saveEdit() {
    if (!editKey) return;
    const v = editVal.trim();
    if (v) setAnswers((a) => ({ ...a, [editKey]: v }));
    setEditKey(null);
  }

  const composer = (
    <div className="stepcomposer wizcomposer">
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
      <div className={`wizfield${currentField?.type === 'textarea' || stage === 'situation' ? ' tall' : ''}`}>
        {currentField?.type === 'textarea' || stage === 'situation' ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            placeholder={stage === 'situation' ? 'Describe your situation in your own words…' : 'Type your answer…'}
            aria-label={stage === 'situation' ? 'Describe your situation' : 'Your answer'}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitInput(); }}
          />
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentField?.type === 'phone' ? 'Phone number' : currentField?.type === 'date' ? 'Type a date, or use the calendar' : 'Type your answer…'}
            aria-label="Your answer"
            inputMode={currentField?.type === 'phone' ? 'tel' : undefined}
            autoComplete={currentField?.type === 'phone' ? 'tel' : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') submitInput(); }}
          />
        )}
        <div className="wizfield-tools">
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
          {voiceOn && <button
            type="button"
            className={`composericon micbtn${listening ? ' listening' : ''}`}
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? 'Stop listening' : 'Answer by voice'}
            title={listening ? 'Stop listening' : 'Answer by voice'}
          >
            {listening ? <Icon name="stop" size={18} /> : <Icon name="mic" size={18} />}
          </button>}
        </div>
      </div>
      {currentField?.type === 'phone' && (
        <DialPad value={input} onChange={setInput} />
      )}
    </div>
  );

  // Text entry is offered on question pages — except a pick-one
  // list, where tapping an option IS the answer (its "Other…"
  // option opens the text box).
  const showComposer =
    isQStage &&
    !pendingCounty &&
    !(currentField?.type === 'select' && !otherMode) &&
    !(courtBadgesActive && !courtTyped);
  const showNext = showComposer;
  const canNext = input.trim().length > 0;
  const isLastQuestion = isQStage && stage !== 'situation' && qIdx + 1 >= qTotal;

  const progressPct =
    stage === 'fields' || stage === 'feew-fields'
      ? Math.round(((qIdx + 1) / Math.max(1, qTotal)) * 100)
      : stage === 'review' ? 100 : null;

  const options = badges.length === 0 ? null : (
    <div className="wizoptions" ref={railRef} role="group" aria-label="Choose an answer">
      {badges.map((b, i) => (
        <button
          key={i}
          type="button"
          className={`wizoption${b.primary ? ' primary' : ''}${b.sel ? ' sel' : ''}`}
          onClick={b.action}
        >
          {b.icon && <Icon name={b.icon} size={18} />}
          <span>{b.label}</span>
          <Icon name="chevronRight" size={18} />
        </button>
      ))}
    </div>
  );

  const polishPanel = stage === 'review' && aiAvailable && polishCandidates.length > 0 && !polishSkipped && (
    <div className="polishcard">
      {(!polish || polish.status === 'error') && (
        <>
          <div className="polishhead">
            <Icon name="sparkle" size={20} />
            <strong>Make your statements sound more professional?</strong>
          </div>
          <p className="cardsub">
            {polishCandidates.length === 1
              ? 'AI can reword the description you wrote so it reads clearly and formally for the court.'
              : `AI can reword the ${polishCandidates.length} descriptions you wrote so they read clearly and formally for the court.`} Your facts, names, dates, and amounts stay the
            same, and you choose which changes to keep.
          </p>
          {polish?.status === 'error' && <p className="error">{polish.message}</p>}
          <div className="choices">
            <button type="button" className="btn primary" onClick={runPolish}>
              <Icon name="sparkle" size={16} /> {polish?.status === 'error' ? 'Try again' : 'Yes, rewrite with AI'}
            </button>
            <button type="button" className="btn ghost" onClick={() => setPolishSkipped(true)}>
              No thanks, keep my words
            </button>
          </div>
        </>
      )}
      {polish?.status === 'loading' && (
        <div className="polishloading" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>Rewording your statements…</span>
        </div>
      )}
      {polish?.status === 'ready' && (
        <>
          <div className="polishhead">
            <Icon name="sparkle" size={20} />
            <strong>Suggested rewrites</strong>
          </div>
          <p className="cardsub">
            Compare each one with what you wrote. Edit the suggestion if you like, or keep your original.
            Read them carefully — you are responsible for everything in your document.
          </p>
          <div className="polishlist">
            {polish.items.map((it) => (
              <div className={`polishitem${it.choice === 'ai' ? ' useai' : ''}`} key={it.key}>
                <p className="reviewq">{it.label}</p>
                <div className="polishcols">
                  <div className="polishcol">
                    <span className="polishtag">What you wrote</span>
                    <p className="polishorig">{it.original}</p>
                  </div>
                  <div className="polishcol">
                    <span className="polishtag ai">AI suggestion</span>
                    <textarea
                      value={it.text}
                      rows={Math.min(12, Math.max(4, Math.ceil(it.text.length / 38)))}
                      aria-label={`AI suggestion for: ${it.label}`}
                      onChange={(e) => updatePolishItem(it.key, { text: e.target.value, choice: 'ai' })}
                    />
                  </div>
                </div>
                <div className="polishpick" role="radiogroup" aria-label="Which version to use">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={it.choice === 'ai'}
                    className={`btn small${it.choice === 'ai' ? ' primary' : ' ghost'}`}
                    onClick={() => updatePolishItem(it.key, { choice: 'ai' })}
                  >
                    Use suggestion
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={it.choice === 'mine'}
                    className={`btn small${it.choice === 'mine' ? ' primary' : ' ghost'}`}
                    onClick={() => updatePolishItem(it.key, { choice: 'mine' })}
                  >
                    Keep mine
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="choices">
            <button type="button" className="btn primary" onClick={applyPolish}>
              Apply {polish.items.filter((i) => i.choice === 'ai').length} of {polish.items.length} changes
            </button>
            <button type="button" className="btn ghost" onClick={() => { setPolish(null); setPolishSkipped(true); }}>
              Discard all
            </button>
          </div>
        </>
      )}
      {polish?.status === 'applied' && (
        <div className="polishdone">
          <Icon name="sparkle" size={18} />
          <span>
            {polish.count === 0
              ? 'Your statements already read professionally — nothing was changed.'
              : `Updated ${polish.count} ${polish.count === 1 ? 'statement' : 'statements'}. You can still edit any answer below.`}
          </span>
          <button type="button" className="btn ghost small" onClick={() => setPolish(null)}>Rewrite again</button>
        </div>
      )}
    </div>
  );

  const dir = navDirRef.current;

  return (
    <div className="interviewpage wizard">
      <header className="stephead">
        <Link className="homelink" href="/" aria-label="Home">‹</Link>
        <span className="stepmotion">{motion ? motion.name : 'New document'}</span>
        {progressLabel && <span className="progress stepprogress">{progressLabel}</span>}
      </header>
      <div className={`wizprogress${progressPct === null ? ' idle' : ''}`} aria-hidden="true">
        <span style={{ width: `${progressPct ?? 0}%` }} />
      </div>

      {(voiceOn || voiceNote || speechStatus) && (
        <div className="voicestrip">
          {voiceOn && (
            <span className="vstatus">
              {listening
                ? 'Listening… speak your answer.'
                : 'Voice on — questions are read aloud, then I listen.'}
            </span>
          )}
          {voiceOn && speaking && (
            <button type="button" className="btn ghost small" onClick={() => {
              playerRef.current?.stop();
              setSpeechStatus(null);
              maybeAutoListen();
            }}>
              Stop speaking
            </button>
          )}
          {voiceOn && (
            <button type="button" className="btn ghost small" onClick={switchToTyping}>
              Switch to typing
            </button>
          )}
          {(speechStatus || voiceNote) && <p className="voicenote" role="status">{speechStatus || voiceNote}</p>}
        </div>
      )}

      <div className="wizscroll" ref={logRef}>
        <section key={screenKey} className={`wizpage ${dir}`} aria-live="polite">
          {(stage === 'fields' || stage === 'feew-fields') && !pendingCounty && (
            <p className="wizstep">
              {stage === 'feew-fields' ? 'Fee waiver · ' : ''}Question {qIdx + 1} of {qTotal}
            </p>
          )}

          {(stage === 'boot' || stage === 'generating') && (
            <div className="wizworking" role="status">
              <span className="spinner" aria-hidden="true" />
              {stage === 'boot' && <span>Getting things ready…</span>}
            </div>
          )}

          {pageIntro.map((t, i) => (
            <p key={i} className="wizintro">{t}</p>
          ))}

          {pageHeading && (
            <h1 className="wizq">
              {pageHeading}
            </h1>
          )}
          {stage === 'mode' && (
            <p className="wizhint">The assistant can read the questions aloud and listen to your answers, or you can read and type at your own pace.</p>
          )}
          {liveHint && <p className="wizhint">{liveHint}</p>}
          {courtBadgesActive && !courtTyped && (
            <p className="qhint">Courts for {answers.county} County, from the court database — pick yours, or type it instead.</p>
          )}
          {otherMode && currentField?.type === 'select' && (
            <p className="qhint">Type your own answer — it will be used exactly as written.</p>
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
              <button type="button" className="btn primary big" onClick={continueFromCaseFacts}>
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
              <button className="btn primary big" disabled={!subjectInfo.fullName.trim()} onClick={applySubject}>
                Use this information
              </button>
            </div>
          )}

          {stage === 'defense' && (
            <DefenseCheck
              situation={situationText}
              continueLabel={motion ? `Continue to ${motion.name}` : 'Pick a document from the library'}
              onContinue={() => {
                if (motion) { say('user', 'Continue'); setStage('confirm'); }
                else setStage('pick');
              }}
              onStartMotion={(id) => {
                const m = getMotion(id);
                if (m) { say('user', `Start the ${m.name}`); chooseMotion(m); }
              }}
            />
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
            <>
              {polishPanel}
              <div className="chatcard">
                <h4>
                  Check your answers
                  <HelpTip title="What happens now?">
                    <p className="hintbody">
                      This is exactly what goes into your {motion ? motion.name : 'document'}.
                      Read it over — tap Edit next to any answer to fix it, or Back to step
                      through the questions again, before you sign.
                    </p>
                  </HelpTip>
                </h4>
                <div className="reviewlist">
                  {reviewPairs.map((p) => (
                    <div className="reviewrow" key={p.key}>
                      <div className="reviewrow-head">
                        <span className="reviewq">{p.label}</span>
                        {editKey !== p.key && (
                          <button
                            type="button"
                            className="linkbtn"
                            onClick={() => { setEditKey(p.key); setEditVal(p.value); }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editKey === p.key ? (
                        <div className="reviewedit">
                          <textarea
                            value={editVal}
                            rows={Math.min(8, Math.max(2, Math.ceil(editVal.length / 60)))}
                            aria-label={p.label}
                            autoFocus
                            onChange={(e) => setEditVal(e.target.value)}
                          />
                          <div className="choices">
                            <button type="button" className="btn primary small" onClick={saveEdit} disabled={!editVal.trim()}>
                              Save
                            </button>
                            <button type="button" className="btn ghost small" onClick={() => setEditKey(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="reviewa">{p.value}</span>
                      )}
                      {caseFactSourcesRef.current[p.key] && (
                        <span className="fineprint block">{caseFactSourcesRef.current[p.key]}</span>
                      )}
                    </div>
                  ))}
                  {reviewPairs.length === 0 && (
                    <p className="steptext">Nothing to review yet.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {stage === 'signature' && (
            <div className="chatcard">
              <h4>{signPrompt()}</h4>
              <div className="sigblock" data-noswipe>
                <SignaturePad onChange={setSignature} />
                {!signature && <p className="fineprint">Draw your signature to continue.</p>}
              </div>
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
                  ? 'Verify your payment and download your PDF with filing instructions.'
                  : member
                    ? 'Your PDF and filing instructions are included with your membership.'
                    : coupon.trim()
                    ? 'Your document will be generated with the promo code applied.'
                    : 'Download your motion PDF with filing instructions for $5, or get it included with membership.'}
              </p>
              {payError && <p className="error">{payError}</p>}
              {embeddedClientSecret && (
                <>
                  <EmbeddedCheckoutBox
                    clientSecret={embeddedClientSecret}
                    onComplete={() => {
                      const sessionId = embeddedSessionId;
                      setEmbeddedClientSecret('');
                      setEmbeddedSessionId('');
                      void generatePdf(sessionId || null);
                    }}
                    onError={setPayError}
                  />
                  <button className="btn" disabled={checkoutBusy} onClick={() => { setEmbeddedClientSecret(''); setEmbeddedSessionId(''); }}>
                    Cancel checkout
                  </button>
                </>
              )}
              {!restoredSession && !member && !embeddedClientSecret && (
                <div className="field">
                  <label htmlFor="coupon-code">Promo code (optional)</label>
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
                <div className="choices">
                  <button className="btn primary big" disabled={checkoutBusy || Boolean(embeddedClientSecret)} onClick={startPayment}>
                    {checkoutBusy ? 'Please wait…' : member ? 'Download my included PDF' : coupon.trim() ? 'Apply promo code and download' : 'Get my PDF for $5'}
                  </button>
                  {!member && <button className="btn" disabled={checkoutBusy || Boolean(embeddedClientSecret)} onClick={openMembership}>See subscription plans</button>}
                </div>
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

          {options}
          {showComposer && composer}
        </section>
      </div>

      {(backVisible || showNext || stage === 'review' || stage === 'signature') && (
        <nav className="wiznav" aria-label="Step navigation">
          {backVisible ? (
            <button type="button" className="btn ghost wizback" onClick={onBack}>
              <Icon name="chevronLeft" size={18} /> Back
            </button>
          ) : <span />}
          {showNext && (
            <button
              type="button"
              className="btn primary wiznext"
              disabled={!canNext}
              onClick={() => { navDirRef.current = 'fwd'; submitInput(); }}
            >
              {stage === 'situation' ? 'Continue' : isLastQuestion ? 'Finish' : 'Next'}
              <Icon name="chevronRight" size={18} />
            </button>
          )}
          {stage === 'review' && (
            <button type="button" className="btn primary wiznext" onClick={continueFromReview} disabled={polish?.status === 'loading' || editKey !== null}>
              Continue to signature <Icon name="chevronRight" size={18} />
            </button>
          )}
          {stage === 'signature' && (
            <button
              type="button"
              className="btn primary wiznext"
              disabled={!signature}
              onClick={() => { say('user', '(signed)'); setStage('pay'); }}
            >
              Continue to my document <Icon name="chevronRight" size={18} />
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
