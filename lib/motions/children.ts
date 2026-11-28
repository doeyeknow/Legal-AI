// Children gate for the interview: questions about children are
// asked only when the filer has children. Before the first gated
// field the interview asks "Do you have children?" and, when yes,
// "How many?" — then each list-style children question is asked
// once per child ("Child 1 — ...", "Child 2 — ..."). When no,
// every gated field is skipped.
//
// Key sets were derived from the catalog audit
// (children-audit-20261124.md): every key here was verified
// against the compiled catalog for collisions — a key shared with
// a non-children motion is deliberately NOT in these sets (see the
// notes on each set). The gate is a pure function of (base queue,
// answers), so fresh start, draft resume and go-back all agree.

import type { Answers, MotionDef, MotionField } from './types';

export const HAS_CHILDREN_KEY = 'hasChildren';
export const CHILDREN_COUNT_KEY = 'childrenCount';
// Ten covers every realistic family; above this the count reads
// as unusable and the gate would hold the children questions back
// forever, so the cap must stay above any family that could file.
export const MAX_CHILDREN = 10;

/** LIST keys: one answer that lists all children ("List each
 *  child's full name (one per line)"). Each expands to one
 *  question per child. 'children' is here, not COMPOUND: two of
 *  its three uses are pure name-and-birthdate lists, and the third
 *  (legal-separation) composes sensibly per child.
 *  NOT here: 'heirs' (letters-of-administration heir list, not
 *  children-only), 'protectedPersons' (protection orders: labels
 *  explicitly cover adults/household members too — gating it
 *  would skip protection for adults and ask per-child nonsense),
 *  'applicantFamily' (years-support: the label is primarily the
 *  applicant's relationship to the decedent). */
export const CHILD_LIST_KEYS: readonly string[] = [
  'childrenNames',
  'childrenDatesOfBirth',
  'childrenAddresses',
  'childrenPlacesOfBirth',
  'childrenLivesWith',
  'childrenAges',
  'childrenLocation',
  'childrenFiveYearHistory',
  'livingHistory',
  'residenceHistory',
  'childrenLivingSituation',
  'children',
];

/** COMPOUND keys: one answer mixing child info with relief or
 *  terms. Asked once, unchanged, after the per-child blocks;
 *  skipped entirely when there are no children.
 *  NOT here: 'children' (in LIST above) and 'eligibility' — the
 *  same key is used by resentencing-petition for non-children
 *  criminal eligibility, so gating on it would wrongly skip that
 *  question. Simplified-dissolution keeps asking its eligibility
 *  question; its label also covers marriage length, property and
 *  debt ceilings, so asking it is not wrong. */
export const CHILD_COMPOUND_KEYS: readonly string[] = [
  'custodyPosition',
  'childrenProperty',
  'childrenTerms',
  'termsRequested',
];

/** ARRANGEMENT keys: single questions that only make sense when
 *  children exist. Asked once, unchanged, after the per-child
 *  blocks; skipped entirely when there are no children.
 *  NOT here (verified key collisions or mixed topics):
 *  'supportRequests' (divorce-no-children uses it for a
 *  spousal-support-only select), 'reliefRequested' (19 motions,
 *  mostly appeals/civil/criminal generic relief),
 *  'ordersRequested' (ex-parte-emergency-civil uses it for
 *  generic temporary orders), 'relationship' (13 motions incl.
 *  adult guardianship, elder-abuse, quash-subpoena),
 *  'amountRequested' (attorneys-fees motions),
 *  'riskFacts' (extreme-risk-order, confidential-address),
 *  'otherProceedings' / 'otherClaimants' / 'confidentiality'
 *  (UCCJEA: about proceedings, claims and procedure, not the
 *  children themselves), 'supportTerms' / 'propertySupport' /
 *  'propertyDebts' / 'withholdingInsurance' / 'basis' /
 *  'incomes' / 'expenses' (mixed spousal/property/financial),
 *  'existingOrder' / 'change' / 'mediation' / 'agency' /
 *  'casePending' / 'urgency' (about an order, the change, or
 *  procedure). */
export const CHILD_ARRANGEMENT_KEYS: readonly string[] = [
  'newArrangement',
  'planRequested',
  'custodyWishes',
  'timeSplit',
  'insurance',
  'childcare',
  'costs',
  'parentageStatus',
  'caregivers',
  'currentCaregiver',
  'legalCustody',
  'disputes',
  'childrenAndSafety',
  'bondAndReliance',
  'familyFacts',
  'agreedAmount',
  'adjustments',
  'supportRequested',
  'regularSchedule',
  'holidays',
  'logistics',
  'overnights',
  'result',
  'parentageFacts',
  'testingStatus',
  'safety',
  'schoolMedical',
  'currentSchedule',
  'requestedAmount',
];

const LIST_KEYS = new Set<string>(CHILD_LIST_KEYS);
const COMPOUND_KEYS = new Set<string>(CHILD_COMPOUND_KEYS);
const ARRANGEMENT_KEYS = new Set<string>(CHILD_ARRANGEMENT_KEYS);

/** True when a field key is gated (LIST, COMPOUND or ARRANGEMENT). */
export function isGatedFieldKey(key: string): boolean {
  return LIST_KEYS.has(key) || COMPOUND_KEYS.has(key) || ARRANGEMENT_KEYS.has(key);
}

/** A motion about one specific child (singular childName /
 *  childDateOfBirth fields) never takes the gate: there is exactly
 *  one child, so "how many?" is moot and the questions already
 *  name that child. This also keeps adoption-stepparent (whose
 *  familyFacts is an ARRANGEMENT key) ungated. Emancipation never
 *  gates either — the "child" is the petitioner — and it has no
 *  gated keys at all. */
export function isSingularChildMotion(m: MotionDef): boolean {
  return m.fields.some((f) => f.key === 'childName' || f.key === 'childDateOfBirth');
}

/** True when the interview must run the children gate for this
 *  motion: at least one gated field, and not a singular-child
 *  motion. The IFP household question is not a children question
 *  and never triggers the gate. */
export function motionGatesChildren(m: MotionDef): boolean {
  if (isSingularChildMotion(m)) return false;
  return m.fields.some((f) => isGatedFieldKey(f.key));
}

export const HAS_CHILDREN_FIELD: MotionField = {
  key: HAS_CHILDREN_KEY,
  label: 'Do you have children?',
  type: 'select',
  options: ['Yes', 'No'],
  required: true,
};

export const CHILDREN_COUNT_FIELD: MotionField = {
  key: CHILDREN_COUNT_KEY,
  label: 'How many children do you have?',
  type: 'select',
  options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  required: true,
};

function childKey(i: number, origKey: string): string {
  return `child${i}_${origKey}`;
}

/** The gate answer, normalized: voice transcripts arrive verbatim
 *  ("yes"), badges store the exact option ("Yes"). */
export function readHasChildren(answers: Answers): 'yes' | 'no' | null {
  const v = String(answers[HAS_CHILDREN_KEY] ?? '').trim().toLowerCase();
  if (v === 'yes' || v === 'y') return 'yes';
  if (v === 'no' || v === 'n') return 'no';
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};

/** The count answer, 1..MAX_CHILDREN, or null when unanswered or
 *  unusable. Accepts digits ("2") and number words ("two") so a
 *  spoken count works as well as a tapped badge. */
export function readChildrenCount(answers: Answers): number | null {
  const raw = String(answers[CHILDREN_COUNT_KEY] ?? '').trim().toLowerCase();
  if (!raw) return null;
  const n = NUMBER_WORDS[raw] ?? Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= MAX_CHILDREN ? n : null;
}

/** Expand a motion's base question queue for the children gate.
 *  Pure function of (base queue, answers).
 *  - No gated field in the queue: returned unchanged.
 *  - Gate unanswered: the gate question is inserted where the
 *    first gated field stood; all gated fields are held back.
 *  - Yes, count unanswered: gate + count questions inserted;
 *    gated fields still held back.
 *  - Yes, count n: each LIST field is replaced by one question
 *    per child ("Child 1 — <label>", key childN_<key>);
 *    COMPOUND and ARRANGEMENT fields stay once, in place, after
 *    the per-child blocks (catalog order is preserved).
 *  - No: every gated field is dropped.
 *  Gate questions stay in the queue once answered, so Back can
 *  revisit them and a changed answer rebuilds the queue. */
export function expandChildrenQueue(base: MotionField[], answers: Answers): MotionField[] {
  const firstGated = base.findIndex((f) => isGatedFieldKey(f.key));
  if (firstGated < 0) return base;
  const has = readHasChildren(answers);
  const count = has === 'yes' ? readChildrenCount(answers) : null;
  const out: MotionField[] = [];
  for (let i = 0; i < base.length; i++) {
    const f = base[i];
    if (i === firstGated) {
      out.push(HAS_CHILDREN_FIELD);
      if (has === 'yes') out.push(CHILDREN_COUNT_FIELD);
    }
    if (!isGatedFieldKey(f.key)) {
      out.push(f);
      continue;
    }
    // Gated field: asked only with children, and only once the
    // count is known (LIST fields need it to expand; COMPOUND and
    // ARRANGEMENT come after the per-child blocks).
    if (has !== 'yes' || count === null) continue;
    if (LIST_KEYS.has(f.key)) {
      for (let c = 1; c <= count; c++) {
        out.push({ ...f, key: childKey(c, f.key), label: `Child ${c} — ${f.label}` });
      }
    } else {
      out.push(f);
    }
  }
  return out;
}

/** Compose per-child answers back into the list-style keys the PDF
 *  templates expect, and strip everything the document must never
 *  see. Returns a new answers object; the input is untouched.
 *  - For each LIST key, the per-child answers (child1_<key> ...
 *    childN_<key>) are joined with newlines into the original key.
 *    Only the count's worth of children is used, so stale answers
 *    from a lowered count never leak in.
 *  - When per-child names were collected, answers['children'] is
 *    also set to the names joined by newlines when it is not
 *    already set — this fills modify-custody's bodyTemplate
 *    {children} placeholder, which today renders blank (no field
 *    in that motion has key 'children').
 *  - The gate keys (hasChildren, childrenCount) and every
 *    childN_* key are deleted: a field with no statement renders
 *    its answer alone in the Statement of Facts, so a leaked gate
 *    answer would print in the document.
 *  Idempotent: answers that were already composed (list keys set,
 *  no childN_* keys) come back unchanged. */
export function composeChildrenAnswers(answers: Answers): Answers {
  const out: Answers = { ...answers };
  const count = readChildrenCount(out);
  const has = readHasChildren(out);
  if (has === 'yes' && count !== null) {
    for (const key of CHILD_LIST_KEYS) {
      const parts: string[] = [];
      for (let c = 1; c <= count; c++) {
        const v = String(out[childKey(c, key)] ?? '').trim();
        if (v) parts.push(v);
      }
      if (parts.length) out[key] = parts.join('\n');
    }
    if (!String(out['children'] ?? '').trim()) {
      const names: string[] = [];
      for (let c = 1; c <= count; c++) {
        const v = String(out[childKey(c, 'childrenNames')] ?? '').trim();
        if (v) names.push(v);
      }
      if (names.length) out['children'] = names.join('\n');
    }
  }
  delete out[HAS_CHILDREN_KEY];
  delete out[CHILDREN_COUNT_KEY];
  for (const k of Object.keys(out)) {
    if (/^child\d+_/.test(k)) delete out[k];
  }
  return out;
}
