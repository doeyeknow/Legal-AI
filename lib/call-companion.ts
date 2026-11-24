// The hearing companion's call mode, server side: suggestions for
// what to say next, details heard on the call added to the case,
// and the call summary saved to the case timeline when it ends.
//
// Every detail added from a call is reported back to the screen with
// an Undo, and the transcript itself is only saved when the user
// asks for it.

import { query } from './db';
import {
  addCaseEvent,
  addComm,
  addDeadline,
  deleteCaseEvent,
  deleteDeadline,
  getAppearance,
  getOwnedCaseLite,
  getOwnedEvent,
  setCaseEventDone,
  upsertAppearance,
} from './cases';
import { chatJson } from './ai';
import { COMPANION_STATUS, TRANSCRIPT_MARK } from './dashboard-types';
import { extractFromMessage, longDate, longTime } from './inbox-parse';

export interface CallFact {
  kind: 'hearing' | 'deadline' | 'response_due' | 'case_number' | 'judge' | 'court' | 'person' | 'phone' | 'note';
  label: string;
  valueText: string;
  valueDate: string | null;
  valueTime: string | null;
}

export interface CallAdvice {
  title: string;
  say: string;
  tips: string[];
}

export interface AppliedRef {
  type: 'deadline' | 'event' | 'case_number' | 'appearance';
  id: string;
  label: string;
  valueText: string;
}

const FACT_KINDS = new Set<CallFact['kind']>([
  'hearing', 'deadline', 'response_due', 'case_number', 'judge', 'court', 'person', 'phone', 'note',
]);

const SYSTEM_ASSIST = `You are a calm, practical assistant listening (through a live transcript) to a phone call a self-represented person (no lawyer) is having about their court case — often with a court clerk, an opposing attorney, a mediator, or a caseworker.

Your two jobs:
1. ADVICE: Give the person at most two short, specific suggestions for what to say or ask next, based on the latest part of the call. Plain words. Examples: ask the clerk to repeat a date, confirm the case number, ask for something in writing, don't agree to anything on the spot, ask how to appear remotely. Never tell them to lie. Never give legal conclusions. If nothing useful to add, return an empty list.
2. FACTS: List any NEW concrete case details stated in the latest part of the call: hearing dates/times, deadlines, response due dates, the case number, the judge's name, the court, names and roles of people, phone numbers, and important agreements or instructions. Only facts actually said — never guess. Dates as YYYY-MM-DD (use the reference date for relative dates like "next Tuesday"), times as HH:MM 24-hour.

Return JSON only:
{"advice":[{"title":"short heading","say":"one sentence they could say, in quotes-ready form","tips":["short tip"]}],
 "facts":[{"kind":"hearing|deadline|response_due|case_number|judge|court|person|phone|note","label":"short label","valueText":"the detail as a sentence or value","valueDate":"YYYY-MM-DD or null","valueTime":"HH:MM or null"}]}`;

const SYSTEM_SUMMARY = `Summarize a phone call about a court case for the person's own case notes. Plain text, no markdown. 3–8 short lines: who they spoke with (if known), what was said, any dates or deadlines, what each side agreed to, and what the person needs to do next. Only what the transcript supports — never invent. Return JSON only: {"summary":"..."}`;

// A light per-user rate limit so a long call can't run up the model.
const lastAssist = new Map<string, number>();

export async function assistCall(input: {
  userId: string;
  caseId: string;
  transcriptTail: string;
  newText: string;
  callWith?: string;
  today: string;
}): Promise<{ advice: CallAdvice[]; facts: CallFact[]; ai: boolean } | null> {
  const lite = await getOwnedCaseLite(input.userId, input.caseId);
  if (!lite) return null;
  const now = Date.now();
  const since = now - (lastAssist.get(input.userId) || 0);
  const allowAi = since > 5000;
  if (allowAi) {
    lastAssist.set(input.userId, now);
    const user = JSON.stringify({
      referenceDate: input.today,
      case: {
        title: lite.title, caseNumber: lite.caseNumber, court: lite.courtName,
        county: lite.county, state: lite.state,
      },
      callWith: input.callWith || undefined,
      earlierInCall: input.transcriptTail.slice(-4000),
      latest: input.newText.slice(-2000),
    });
    const out = await chatJson<{ advice?: unknown[]; facts?: unknown[] }>(SYSTEM_ASSIST, user);
    if (out) {
      return { advice: cleanAdvice(out.advice), facts: cleanFacts(out.facts), ai: true };
    }
  }
  return { advice: [], facts: deterministicFacts(input.newText, lite), ai: false };
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function cleanAdvice(raw: unknown[] | undefined): CallAdvice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      const o = (a || {}) as Record<string, unknown>;
      return {
        title: str(o.title, 120),
        say: str(o.say, 400),
        tips: Array.isArray(o.tips) ? o.tips.map((t) => str(t, 240)).filter(Boolean).slice(0, 3) : [],
      };
    })
    .filter((a) => a.title && (a.say || a.tips.length))
    .slice(0, 2);
}

export function cleanFacts(raw: unknown[] | undefined): CallFact[] {
  if (!Array.isArray(raw)) return [];
  const out: CallFact[] = [];
  for (const f of raw.slice(0, 12)) {
    const o = (f || {}) as Record<string, unknown>;
    const kind = str(o.kind, 20) as CallFact['kind'];
    if (!FACT_KINDS.has(kind)) continue;
    const valueText = str(o.valueText, 500);
    if (!valueText) continue;
    const d = str(o.valueDate, 10);
    const t = str(o.valueTime, 5);
    out.push({
      kind,
      label: str(o.label, 80) || kind,
      valueText,
      valueDate: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
      valueTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null,
    });
  }
  return out;
}

/** Without a model: the same deterministic reader used for court
 *  mail, run over what was just said. */
function deterministicFacts(
  text: string,
  lite: { id: string; title: string; caseNumber: string | null; subjectName: string; courtName: string },
): CallFact[] {
  const r = extractFromMessage({
    subject: '',
    bodyText: text,
    userCases: [{ id: lite.id, caseNumber: lite.caseNumber, title: lite.title, subjectName: lite.subjectName, courtName: lite.courtName }],
  });
  const out: CallFact[] = [];
  for (const f of r.facts) {
    if (f.confidence === 'low') continue;
    const time = f.valueAt ? f.valueAt.slice(11, 16) : null;
    if (f.kind === 'hearing_date' || f.kind === 'trial_date') {
      out.push({ kind: 'hearing', label: f.kind === 'trial_date' ? 'Trial date' : 'Hearing', valueText: f.valueText, valueDate: f.valueDate, valueTime: time });
    } else if (f.kind === 'response_due' || f.kind === 'deadline' || f.kind === 'discovery_due') {
      out.push({ kind: f.kind === 'response_due' ? 'response_due' : 'deadline', label: f.kind === 'response_due' ? 'Response due' : 'Deadline', valueText: f.valueText, valueDate: f.valueDate, valueTime: null });
    } else if (f.kind === 'case_number' && !lite.caseNumber) {
      out.push({ kind: 'case_number', label: 'Case number', valueText: f.valueText, valueDate: null, valueTime: null });
    } else if (f.kind === 'judge_name') {
      out.push({ kind: 'judge', label: 'Judge', valueText: f.valueText, valueDate: null, valueTime: null });
    } else if (f.kind === 'callback_phone' || f.kind === 'dial_in') {
      out.push({ kind: 'phone', label: 'Phone number', valueText: f.valueText, valueDate: null, valueTime: null });
    }
  }
  return out;
}

async function deadlineExists(caseId: string, type: string, dueAt: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM deadlines WHERE case_id = $1 AND type = $2 AND due_at = $3 LIMIT 1`,
    [caseId, type, dueAt],
  );
  return rows.length > 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add details heard on a call to the case. Returns what was
 *  created so the screen can offer Undo for each one. */
export async function applyCallFacts(
  userId: string,
  caseId: string,
  facts: CallFact[],
  opts: { eventId?: string | null; callWith?: string; tz?: string } = {},
): Promise<AppliedRef[] | null> {
  const lite = await getOwnedCaseLite(userId, caseId);
  if (!lite) return null;
  const refs: AppliedRef[] = [];
  for (const f of facts.slice(0, 12)) {
    if ((f.kind === 'hearing') && f.valueDate) {
      const type = 'hearing_date';
      if (!(await deadlineExists(caseId, type, f.valueDate))) {
        const d = await addDeadline(userId, caseId, { type, label: f.label || 'Hearing', dueAt: f.valueDate });
        if (d) refs.push({ type: 'deadline', id: d.id, label: f.label || 'Hearing', valueText: f.valueText });
      }
      if (f.valueTime) {
        const ex = await getAppearance(caseId);
        // Local wall-clock time from the user's device offset.
        const at = new Date(`${f.valueDate}T${f.valueTime}:00${opts.tz || ''}`);
        if (!Number.isNaN(at.getTime())) {
          const app = await upsertAppearance(userId, caseId, {
            hearingAt: at.toISOString(),
            platform: ex?.platform || 'Other',
            joinUrl: ex?.joinUrl || '',
            phoneBackup: ex?.phoneBackup || '',
            remoteStatus: ex?.remoteStatus || 'not_requested',
          });
          if (app) refs.push({ type: 'appearance', id: app.id, label: 'Hearing time', valueText: f.valueText });
        }
      }
      continue;
    }
    if ((f.kind === 'deadline' || f.kind === 'response_due') && f.valueDate) {
      const type = f.kind === 'response_due' ? 'response_due' : 'compliance_due';
      if (await deadlineExists(caseId, type, f.valueDate)) continue;
      const d = await addDeadline(userId, caseId, { type, label: f.label || 'Deadline from a call', dueAt: f.valueDate });
      if (d) refs.push({ type: 'deadline', id: d.id, label: f.label, valueText: f.valueText });
      continue;
    }
    if (f.kind === 'case_number') {
      const fresh = await getOwnedCaseLite(userId, caseId);
      if (fresh && !fresh.caseNumber) {
        await query(`UPDATE cases SET case_number = $3, updated_at = now() WHERE id = $1 AND user_id = $2`,
          [caseId, userId, f.valueText.slice(0, 80)]);
        refs.push({ type: 'case_number', id: caseId, label: 'Case number', valueText: f.valueText });
        continue;
      }
    }
    if (f.kind === 'court' && !lite.courtName) {
      await query(`UPDATE cases SET court_name = $3, updated_at = now() WHERE id = $1 AND user_id = $2 AND court_name = ''`,
        [caseId, userId, f.valueText.slice(0, 200)]);
    }
    // Everything else becomes a note on the case timeline.
    const ev = await addCaseEvent(userId, caseId, {
      kind: 'note',
      title: `${f.label}: ${f.valueText}`.slice(0, 200),
      details: `Heard on a phone call${opts.callWith ? ` with ${opts.callWith}` : ''}.`,
      occurredOn: f.valueDate || today(),
      occurredTime: f.valueTime,
      location: '',
      people: (opts.callWith || '').slice(0, 500),
      phone: f.kind === 'phone' ? f.valueText.slice(0, 60) : '',
      source: 'call',
      sourceRef: opts.eventId || null,
    });
    if (ev) refs.push({ type: 'event', id: ev.id, label: f.label, valueText: f.valueText });
  }
  return refs;
}

export async function undoCallRef(userId: string, caseId: string, ref: AppliedRef): Promise<boolean> {
  if (ref.type === 'deadline') return deleteDeadline(userId, caseId, ref.id);
  if (ref.type === 'event') return deleteCaseEvent(userId, caseId, ref.id);
  if (ref.type === 'case_number') {
    const rows = await query<{ id: string }>(
      `UPDATE cases SET case_number = NULL, updated_at = now() WHERE id = $1 AND user_id = $2 AND case_number = $3 RETURNING id`,
      [caseId, userId, ref.valueText.slice(0, 80)],
    );
    return rows.length > 0;
  }
  return false;
}

/** End of the call: the summary (and the transcript, unless the user
 *  turned that off) goes into the case's communication log, which
 *  also shows on the case timeline, and the call is ticked off. */
export async function finishCall(
  userId: string,
  caseId: string,
  input: {
    eventId?: string | null;
    callWith?: string;
    transcript: string;
    saveTranscript: boolean;
    notes: string[];
    startedAt?: string;
    callDate?: string;
    direction?: 'to_court' | 'from_court';
  },
): Promise<{ commId: string; summary: string; comm: Awaited<ReturnType<typeof addComm>> } | null> {
  const lite = await getOwnedCaseLite(userId, caseId);
  if (!lite) return null;
  let summary = '';
  if (input.transcript.trim().length > 40) {
    const out = await chatJson<{ summary?: string }>(
      SYSTEM_SUMMARY,
      JSON.stringify({ case: lite.title, callWith: input.callWith || undefined, transcript: input.transcript.slice(-12000) }),
      { timeoutMs: 25_000 },
    );
    summary = (out?.summary || '').trim().slice(0, 4000);
  }
  if (!summary) {
    summary = input.notes.length
      ? `Details noted on the call:\n${input.notes.map((n) => `- ${n}`).join('\n')}`
      : 'Phone call — no details were picked up automatically.';
  }
  let body = summary;
  if (input.saveTranscript && input.transcript.trim()) {
    body += `${TRANSCRIPT_MARK}${input.transcript.trim().slice(0, 20000)}`;
  }
  const started = input.startedAt ? new Date(input.startedAt) : new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.callDate || '')
    ? input.callDate!
    : (Number.isNaN(started.getTime()) ? new Date() : started).toISOString().slice(0, 10);
  const comm = await addComm(userId, caseId, {
    direction: input.direction === 'from_court' ? 'from_court' : 'to_court',
    method: 'Phone',
    subject: `Phone call${input.callWith ? ` with ${input.callWith}` : ''}`.slice(0, 200),
    body,
    sentAt: date,
    responseDeadline: null,
    status: COMPANION_STATUS,
  });
  if (input.eventId) {
    const call = await getOwnedEvent(userId, input.eventId);
    if (call && call.caseId === caseId) await setCaseEventDone(userId, input.eventId, true);
  }
  return comm ? { commId: comm.id, summary, comm } : null;
}
