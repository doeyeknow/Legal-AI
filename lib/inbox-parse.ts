// Deterministic extraction for court mail — pure, no network, no
// model calls. Every fact it proposes carries the exact source span
// it came from so the review UI can quote the email's own words.
// NOTHING this module returns is ever applied anywhere on its own:
// facts land as 'proposed' in extracted_facts and only a user's
// confirmation moves them (see lib/inbox.ts and the design doc,
// research_notes/legal-inbox-design.md §3.4).

export type Confidence = 'high' | 'medium' | 'low';

export interface ParseCaseRef {
  id: string;
  caseNumber: string | null;
  title: string;
  subjectName: string;
  courtName: string;
}

export interface ParsedFact {
  kind: string;
  /** The value exactly as it should read in a document. */
  valueText: string;
  /** Normalized YYYY-MM-DD when the fact is a date. */
  valueDate: string | null;
  /** ISO local datetime when a time is known (hearing facts). */
  valueAt: string | null;
  confidence: Confidence;
  /** Source excerpt the review card quotes. */
  span: string;
  spanOffset: number;
  /** For computed dates: the arithmetic, shown to the user. */
  basis: string;
  /** Suggested deadlines.type when this fact is confirmed. */
  deadlineType: string | null;
  /** Extra warning for the review card (appeal windows). */
  warning: string | null;
}

export interface ParseInput {
  subject: string;
  bodyText: string;
  headers?: Record<string, unknown>;
  fromEmail?: string;
  fromName?: string;
  userCases: ParseCaseRef[];
}

export interface ParseResult {
  docType: string;
  facts: ParsedFact[];
  /** The user's case the email most likely belongs to (or null). */
  matchedCaseId: string | null;
  caseNumberFound: string | null;
  authWarning: boolean;
  isForward: boolean;
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4,
  apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11,
  nov: 11, december: 12, dec: 12,
};
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function normalizeCaseNumber(s: string): string {
  return s.toUpperCase().replace(/[\s]/g, '');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "January 13, 2027" — the way a person (and a motion) writes it. */
export function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTH_NAMES[m]} ${d}, ${y}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** "9:00 a.m." from 24h parts. */
export function longTime(h: number, min: number): string {
  const suffix = h >= 12 ? 'p.m.' : 'a.m.';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${pad(min)} ${suffix}`;
}

function spanAround(text: string, start: number, end: number): { span: string; offset: number } {
  const s = Math.max(0, start - 60);
  const e = Math.min(text.length, end + 60);
  return { span: text.slice(s, e).replace(/\s+/g, ' ').trim(), offset: start };
}

function downgrade(c: Confidence): Confidence {
  return c === 'high' ? 'medium' : 'low';
}

// ------------------------------------------------------------------
// Document-type classification: keyword scoring over subject + the
// first ~4 KB of body. Order matters — specific shapes are tested
// before the generic "order" bucket.
function classify(subject: string, body: string, fromEmail: string): string {
  const subj = subject.toLowerCase();
  const head = (subject + '\n' + body.slice(0, 4096)).toLowerCase();
  const from = fromEmail.toLowerCase();
  if (
    /envelope\s*no/.test(head) ||
    /filing\s+(submitted|accepted|confirmation)/.test(head) ||
    /\befiling\b|\be-filing\b/.test(head) ||
    /(efile|tyler|odyssey)/.test(from)
  ) return 'efiling_confirmation';
  if (/\bsummons\b/.test(head) || /you have been sued/.test(head)) return 'summons_or_complaint';
  if (/order\s+granting\s+(a\s+)?(motion\s+for\s+)?continuance/.test(head) || /continued\s+to\s+/.test(head)) return 'continuance_ruling';
  if (/notice\s+of\s+hearing/.test(head) || /set\s+for\s+hearing/.test(head) || /hereby\s+notified/.test(head)) return 'hearing_notice';
  if (/scheduling\s+order/.test(head) || /case\s+management\s+order/.test(head)) return 'scheduling_order';
  if (/\bjudgment\b/.test(head) || /\bdecree\b/.test(head)) return 'judgment';
  if (/order\s+(granting|denying)/.test(head) || /so\s+ordered/.test(head) || /minute\s+order/.test(head) || /^order\b/.test(subj.trim())) return 'order';
  if (/(dear\s+(mr|ms|mrs|dr|counsel))/i.test(subject + body) || /attorney\s+for\s+/.test(head) || /\besq\./.test(head)) return 'opposing_letter';
  return 'other';
}

// ------------------------------------------------------------------
// Case numbers: candidates from standard shapes, then two trust
// passes — "labeled" (follows Case No. / Cause No. / Docket No.)
// and "validated" (exactly matches one of the user's own cases,
// via the same normalization cases_user_number_idx supports).
const CASE_TOKEN_RE =
  /\b(?:[A-Z]-\d{3}-[A-Z]{2}-\d{4}-\d{2,6}|\d{1,2}:\d{2}-[a-z]{2}-\d{3,6}|[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,6}){2,5}|\d{5,})\b/gi;

function caseCandidates(text: string): { token: string; offset: number }[] {
  const out: { token: string; offset: number }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(CASE_TOKEN_RE)) {
    const token = (m[0] || '').trim();
    if (!token || token.length < 5) continue;
    // Years and zip-ish numbers are not case numbers on their own.
    if (/^\d{4}$/.test(token)) continue;
    const key = normalizeCaseNumber(token);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ token, offset: m.index ?? 0 });
  }
  return out;
}

function isLabeled(text: string, offset: number): boolean {
  const before = text.slice(Math.max(0, offset - 48), offset).toLowerCase();
  return /(case|cause|docket|court)\s*(no\.?|number|#)?\s*[:#]?\s*$/.test(before);
}

// ------------------------------------------------------------------
// Dates: the formats courts actually use, each with a role read
// from the words around it (±90 chars) and a confidence tier.
interface FoundDate {
  dateStr: string;
  start: number;
  end: number;
  timeH: number | null;
  timeM: number;
  weekdayMismatch: boolean;
}

const MONTH_ALT = Object.keys(MONTHS).join('|');
const DATE_RES: { re: RegExp; parse: (m: RegExpMatchArray) => { y: number; mo: number; d: number; weekday?: string } | null }[] = [
  {
    // Tuesday, January 13, 2027 / January 13, 2027 / Jan. 13, 2027
    re: new RegExp(`(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+)?(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'gi'),
    parse: (m) => ({ weekday: m[1], mo: MONTHS[m[2].toLowerCase()], d: Number(m[3]), y: Number(m[4]) }),
  },
  {
    // 13th day of January, 2027
    re: new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+day\\s+of\\s+(${MONTH_ALT})\\.?,?\\s+(\\d{4})`, 'gi'),
    parse: (m) => ({ d: Number(m[1]), mo: MONTHS[m[2].toLowerCase()], y: Number(m[3]) }),
  },
  {
    // 01/13/2027
    re: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    parse: (m) => ({ mo: Number(m[1]), d: Number(m[2]), y: Number(m[3]) }),
  },
  {
    // 2027-01-13
    re: /(\d{4})-(\d{2})-(\d{2})/g,
    parse: (m) => ({ y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }),
  },
];

const TIME_RE = /^\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'clock)/i;

function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];
  const spans: [number, number][] = [];
  for (const { re, parse } of DATE_RES) {
    for (const m of text.matchAll(re)) {
      const p = parse(m);
      if (!p) continue;
      const dateStr = toDateStr(p.y, p.mo, p.d);
      if (!dateStr) continue;
      const start = m.index ?? 0;
      const end = start + (m[0]?.length || 0);
      if (spans.some(([s, e]) => start < e && end > s)) continue; // overlap: first pattern wins
      spans.push([start, end]);
      let timeH: number | null = null;
      let timeM = 0;
      let fullEnd = end;
      const tm = text.slice(end, end + 28).match(TIME_RE);
      if (tm) {
        let h = Number(tm[1]) % 12;
        if (/p/i.test(tm[3])) h += 12;
        timeH = h;
        timeM = tm[2] ? Number(tm[2]) : 0;
        fullEnd = end + (tm[0]?.length || 0);
      }
      found.push({
        dateStr,
        start,
        end: fullEnd,
        timeH,
        timeM,
        weekdayMismatch: p.weekday ? weekdayOf(dateStr) !== p.weekday : false,
      });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

type DateRole = 'hearing' | 'trial' | 'response_due' | 'deadline' | 'order_date' | 'service_date' | 'filed_date' | 'mentioned';

function roleOf(text: string, fd: FoundDate, docType: string): DateRole {
  // Role words almost always precede their date ("due February 2",
  // "set for January 13"). The window looks 90 chars back and only
  // 40 forward — a long forward window bleeds the NEXT sentence's
  // role words onto this date (a demand date followed by "the
  // hearing on …" is not a hearing date).
  const before = text.slice(Math.max(0, fd.start - 90), fd.start).toLowerCase();
  const after = text.slice(fd.end, Math.min(text.length, fd.end + 40)).toLowerCase();
  const win = `${before} ${after}`;
  if (/serv(ed|ice)/.test(win)) return 'service_date';
  if (/trial/.test(before)) return 'trial';
  if (/hearing/.test(before) && /(set|scheduled|notice|before|on\b)/.test(win)) return 'hearing';
  if (/(respon|answer|reply|opposition)/.test(win) && /(within|due|by|no later)/.test(win)) return 'response_due';
  if (docType === 'efiling_confirmation' || /filed|stamped|submitted/.test(win)) return 'filed_date';
  if (/signed|entered|so ordered|dated|issued/.test(win)) return 'order_date';
  if (/no later than|on or before|shall file|must file|due (on|by)|deadline/.test(win)) return 'deadline';
  return 'mentioned';
}

const ROLE_TO_KIND: Record<DateRole, string> = {
  hearing: 'hearing_date',
  trial: 'trial_date',
  response_due: 'response_due',
  deadline: 'deadline',
  order_date: 'order_date',
  service_date: 'service_date',
  filed_date: 'filed_date',
  mentioned: 'mentioned_date',
};

// ------------------------------------------------------------------
// Computed deadlines: "within N days of this order", "responses due
// 14 days after service". The arithmetic is ALWAYS stored in the
// fact's basis and shown to the user; computed dates are never
// above medium confidence. Appeal windows are only computed when
// both the anchor and the day-count are explicit in the text, and
// they carry the strongest warning (they are jurisdictional).
const NUMBER_WORDS: Record<string, number> = {
  seven: 7, ten: 10, fourteen: 14, fifteen: 15, twenty: 20,
  'twenty-one': 21, thirty: 30, forty: 40, fortyfive: 45, sixty: 60, ninety: 90,
};

const COMPUTED_RE =
  /(within|no later than|not more than)?\s*(\d{1,3}|fourteen|fifteen|thirty|sixty|ninety|twenty-one|seven|ten)\s*(?:\((\d{1,3})\))?\s*days?\s+(?:of|after|from|following|of the date of)\s+(this order|the date of this order|service|the order|filing|entry of)/gi;

function computedDeadlines(
  text: string,
  dates: FoundDate[],
  roles: Map<FoundDate, DateRole>,
  authWarning: boolean,
): ParsedFact[] {
  const out: ParsedFact[] = [];
  const anchorFor = (word: string): FoundDate | null => {
    const want: DateRole = /serv/.test(word) ? 'service_date' : 'order_date';
    return dates.find((d) => roles.get(d) === want) || dates[0] || null;
  };
  for (const m of text.matchAll(COMPUTED_RE)) {
    const anchor = anchorFor((m[5] || '').toLowerCase());
    if (!anchor) continue;
    const n = m[3] ? Number(m[3]) : /^\d+$/.test(m[2]) ? Number(m[2]) : NUMBER_WORDS[m[2].toLowerCase()];
    if (!n || n < 1 || n > 365) continue;
    const window = text.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + (m[0]?.length || 0) + 40).toLowerCase();
    const isAppeal = /appeal/.test(window);
    const isDiscovery = /discover|witness|exhibit|disclosure|interrogator/.test(window);
    // "+3 days for mail service", when the text says so.
    let extra = 0;
    let extraNote = '';
    if (/mail/.test(window) && /(three|3)\s*(?:\(\s*3\s*\))?\s*(additional\s*)?days/.test(window)) {
      extra = 3;
      extraNote = ' + 3 days for mail service (stated in the text)';
    }
    const due = addDays(anchor.dateStr, n + extra);
    const sp = spanAround(text, m.index ?? 0, (m.index ?? 0) + (m[0]?.length || 0));
    out.push({
      kind: isAppeal ? 'deadline' : isDiscovery ? 'discovery_due' : 'response_due',
      valueText: longDate(due),
      valueDate: due,
      valueAt: null,
      confidence: authWarning ? 'low' : 'medium',
      span: sp.span,
      spanOffset: sp.offset,
      basis: `${isAppeal ? 'Appeal window — ' : ''}${roles.get(anchor) === 'service_date' ? 'service date' : 'order date'} ${longDate(anchor.dateStr)} + ${n} days${extraNote} (stated in the message)`,
      deadlineType: isAppeal ? 'appeal_window' : isDiscovery ? 'discovery_due' : 'response_due',
      warning: isAppeal
        ? 'Appeal windows are jurisdictional — the court usually cannot extend one. Verify this date with the clerk before relying on it.'
        : null,
    });
  }
  return out;
}

// ------------------------------------------------------------------
export function extractFromMessage(input: ParseInput): ParseResult {
  const subject = input.subject || '';
  const body = input.bodyText || '';
  const text = `${subject}\n${body}`;
  const fromEmail = input.fromEmail || '';

  const isForward =
    /^\s*(fwd?|fw)\s*:/i.test(subject) ||
    /(-{2,}\s*(original message|forwarded message)\s*-{2,}|begin forwarded message)/i.test(body);

  // SPF/DKIM failure, from the Authentication-Results header when
  // the provider preserved it: every fact from such a message is
  // downgraded and the message itself is badged in the UI.
  let authWarning = false;
  for (const [k, v] of Object.entries(input.headers || {})) {
    if (/authentication-results/i.test(k)) {
      const val = String(v).toLowerCase();
      if (/spf\s*=\s*fail/.test(val) || /dkim\s*=\s*fail/.test(val)) authWarning = true;
    }
  }

  const docType = classify(subject, body, fromEmail);
  const facts: ParsedFact[] = [];
  const push = (f: ParsedFact) => {
    if (authWarning) f.confidence = downgrade(f.confidence);
    // A forward is secondhand: everything in it is one tier less
    // certain than the same words in a direct message.
    if (isForward) f.confidence = downgrade(f.confidence);
    const key = `${f.kind}|${f.valueText}|${f.valueDate || ''}`;
    if (!facts.some((x) => `${x.kind}|${x.valueText}|${x.valueDate || ''}` === key)) facts.push(f);
  };

  // ---- Case number + case matching ------------------------------
  let matchedCaseId: string | null = null;
  let matchedCase: ParseCaseRef | null = null;
  let caseNumberFound: string | null = null;
  const byNumber = new Map<string, ParseCaseRef>();
  for (const c of input.userCases) {
    if (c.caseNumber) byNumber.set(normalizeCaseNumber(c.caseNumber), c);
  }
  for (const cand of caseCandidates(text)) {
    const hit = byNumber.get(normalizeCaseNumber(cand.token));
    const labeled = isLabeled(text, cand.offset);
    if (hit && !matchedCase) {
      matchedCase = hit;
      matchedCaseId = hit.id;
      caseNumberFound = cand.token;
    }
    if (hit || labeled) {
      const sp = spanAround(text, cand.offset, cand.offset + cand.token.length);
      push({
        kind: 'case_number',
        valueText: cand.token,
        valueDate: null,
        valueAt: null,
        confidence: hit ? 'high' : 'medium',
        span: sp.span,
        spanOffset: sp.offset,
        basis: hit ? 'Matches the case number on your case' : '',
        deadlineType: null,
        warning: null,
      });
    }
  }

  // ---- Dates ------------------------------------------------------
  const dates = findDates(text);
  const roles = new Map<FoundDate, DateRole>();
  for (const fd of dates) roles.set(fd, roleOf(text, fd, docType));
  for (const fd of dates) {
    const role = roles.get(fd)!;
    const kind = ROLE_TO_KIND[role];
    const sp = spanAround(text, fd.start, fd.end);
    let confidence: Confidence =
      role === 'mentioned' ? 'low' : role === 'hearing' && fd.timeH !== null ? 'high' : 'medium';
    if (fd.weekdayMismatch) confidence = 'low';
    const valueText =
      fd.timeH !== null ? `${longDate(fd.dateStr)} at ${longTime(fd.timeH, fd.timeM)}` : longDate(fd.dateStr);
    push({
      kind,
      valueText,
      valueDate: fd.dateStr,
      valueAt:
        fd.timeH !== null
          ? `${fd.dateStr}T${pad(fd.timeH)}:${pad(fd.timeM)}:00`
          : null,
      confidence,
      span: sp.span,
      spanOffset: sp.offset,
      basis: fd.weekdayMismatch
        ? 'The weekday named in the message does not match this date — please check it.'
        : '',
      deadlineType:
        kind === 'response_due' ? 'response_due' : kind === 'deadline' ? 'compliance_due' : null,
      warning: null,
    });
  }
  // A hearing time on its own fact key, so the bag carries
  // hearingTime as well as the combined hearing_date.
  for (const fd of dates) {
    if (roles.get(fd) === 'hearing' && fd.timeH !== null) {
      const sp = spanAround(text, fd.start, fd.end);
      push({
        kind: 'hearing_time',
        valueText: longTime(fd.timeH, fd.timeM),
        valueDate: fd.dateStr,
        valueAt: `${fd.dateStr}T${pad(fd.timeH)}:${pad(fd.timeM)}:00`,
        confidence: fd.weekdayMismatch ? 'low' : 'medium',
        span: sp.span,
        spanOffset: sp.offset,
        basis: '',
        deadlineType: null,
        warning: null,
      });
    }
  }
  for (const f of computedDeadlines(text, dates, roles, authWarning)) push(f);

  // ---- Caption parties, court, judge, opposing counsel -----------
  const caption = text.match(/([A-Z][A-Za-z .,'&-]{2,60}?)\s+v\.\s+([A-Z][A-Za-z .,'&-]{2,60}?)(?=[,\n]|Case|No\.)/);
  if (caption) {
    const sides = [caption[1].trim(), caption[2].trim()];
    // The user's own side is identified by the case's subject name
    // (or the first segment of a caption-style case title) — never
    // by the full title, which contains BOTH parties.
    const userSides = new Set(
      input.userCases
        .flatMap((c) => [c.subjectName, c.title.split(/\s+v\.\s+/i)[0]])
        .filter(Boolean)
        .map((s) => s.toLowerCase()),
    );
    const opp = sides.find((s) => ![...userSides].some((n) => n && (n.includes(s.toLowerCase()) || s.toLowerCase().includes(n))));
    if (opp) {
      const off = text.indexOf(caption[0]);
      const sp = spanAround(text, off, off + caption[0].length);
      push({
        kind: 'opposing_party', valueText: opp, valueDate: null, valueAt: null,
        confidence: matchedCase ? 'medium' : 'low', span: sp.span, spanOffset: sp.offset,
        basis: '', deadlineType: null, warning: null,
      });
    }
  }
  const courtM = text.match(/((?:Second|Third|First|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth|Thirteenth)?\s*(?:Judicial\s+)?District Court(?:\s+of\s+[A-Z][a-z]+\s+County)?|District Court of [A-Z][a-z]+ County|[A-Z][a-z]+ County (?:Superior|District) Court|Superior Court of [A-Z][a-z]+ County)/);
  if (courtM) {
    const val = courtM[1].replace(/\s+/g, ' ').trim();
    const off = text.indexOf(courtM[0]);
    const sp = spanAround(text, off, off + courtM[0].length);
    push({
      kind: 'court_name', valueText: val, valueDate: null, valueAt: null,
      confidence: matchedCase && matchedCase.courtName && val.toLowerCase() === matchedCase.courtName.toLowerCase() ? 'high' : 'medium',
      span: sp.span, spanOffset: sp.offset, basis: '', deadlineType: null, warning: null,
    });
  }
  const judgeM = text.match(/(?:before\s+)?(?:Judge|Hon\.|Honorable)\s+([A-Z][a-z]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z]+){0,2})/);
  if (judgeM) {
    const off = text.indexOf(judgeM[0]);
    const sp = spanAround(text, off, off + judgeM[0].length);
    push({
      kind: 'judge_name', valueText: judgeM[1].trim(), valueDate: null, valueAt: null,
      confidence: 'medium', span: sp.span, spanOffset: sp.offset,
      basis: '', deadlineType: null, warning: null,
    });
  }
  const attyM =
    text.match(/([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+),?\s*(?:Esq\.|Attorney for|Attorney at Law)/) ||
    text.match(/Attorney for [^\n:]+:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
  if (attyM) {
    const off = text.indexOf(attyM[0]);
    const sp = spanAround(text, off, off + attyM[0].length);
    push({
      kind: 'opposing_attorney', valueText: attyM[1].trim(), valueDate: null, valueAt: null,
      confidence: 'medium', span: sp.span, spanOffset: sp.offset,
      basis: '', deadlineType: null, warning: null,
    });
  }

  // Weak case matching when no case number matched: sender/court or
  // party names echoing a case the user already tracks. Suggestion
  // only — the review queue asks, it never assigns on this alone.
  if (!matchedCase) {
    for (const c of input.userCases) {
      const parties = c.title.split(/\s+v\.\s+/i).map((s) => s.trim()).filter((s) => s.length > 3);
      if (parties.some((p) => text.toLowerCase().includes(p.toLowerCase()))) {
        matchedCase = c;
        matchedCaseId = c.id;
        break;
      }
    }
  }

  return { docType, facts, matchedCaseId, caseNumberFound, authWarning, isForward };
}
