/**
 * Unread/unanswered-reply state for a case's communication log.
 *
 * A comm entry that carries a responseDeadline is AWAITING a reply
 * until a LATER entry in the opposite direction exists (ordering by
 * sentAt, with createdAt as the tiebreak):
 *  - a "to_court" entry (you sent it, the court owes you a reply)
 *    is closed by any later "from_court" entry;
 *  - a "from_court" entry (the court sent it, you owe the response)
 *    is closed by any later "to_court" entry.
 * An awaiting entry is OVERDUE when its deadline is strictly before
 * today (date-only comparison, YYYY-MM-DD strings).
 *
 * Used server-side by the cases list (booleans per case) and
 * client-side by the case page (per-entry marks) so both surfaces
 * mean exactly the same thing by "awaiting reply".
 */

export interface CommLike {
  id: string;
  direction: 'to_court' | 'from_court';
  /** YYYY-MM-DD */
  sentAt: string;
  /** ISO timestamp */
  createdAt: string;
  /** YYYY-MM-DD or null */
  responseDeadline: string | null;
}

export type ReplyMark = 'awaiting' | 'overdue';

function cmp(a: CommLike, b: CommLike): number {
  if (a.sentAt !== b.sentAt) return a.sentAt < b.sentAt ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Entries with a response deadline that no later opposite-direction
 *  entry has closed, in log order. */
export function unansweredEntries<T extends CommLike>(comms: T[]): T[] {
  const sorted = [...comms].sort(cmp);
  const open: T[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (!e.responseDeadline) continue;
    const closed = sorted.some(
      (o) => o.direction !== e.direction && cmp(o, e) > 0,
    );
    if (!closed) open.push(e);
  }
  return open;
}

/** Per-entry marks for the entries still awaiting a reply. */
export function replyMarks(
  comms: CommLike[],
  today: string,
): Map<string, ReplyMark> {
  const marks = new Map<string, ReplyMark>();
  for (const e of unansweredEntries(comms)) {
    marks.set(e.id, e.responseDeadline! < today ? 'overdue' : 'awaiting');
  }
  return marks;
}

export interface CaseReplyState {
  awaitingReply: boolean;
  replyOverdue: boolean;
  /** Earliest deadline among the unanswered entries, or null. */
  awaitingDeadline: string | null;
}

export function caseReplyState(
  comms: CommLike[],
  today: string,
): CaseReplyState {
  const open = unansweredEntries(comms);
  if (open.length === 0) {
    return { awaitingReply: false, replyOverdue: false, awaitingDeadline: null };
  }
  const deadlines = open.map((e) => e.responseDeadline!).sort();
  return {
    awaitingReply: true,
    replyOverdue: deadlines[0] < today,
    awaitingDeadline: deadlines[0],
  };
}

/** The user's local today as YYYY-MM-DD (client-side date). */
export function localToday(d: Date = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today as YYYY-MM-DD in UTC (server-side date for list booleans;
 *  clients refine overdue with their local date via the deadline). */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
