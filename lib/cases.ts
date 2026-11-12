// Dashboard data access (server only). Every read and write is
// scoped to the owning user: case ids are never trusted on their own,
// each query joins or filters by user_id so one account can never see
// or touch another account's cases.

import { ensureSchema, query } from "./db";
import type {
  Appearance,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  CommEntry,
  Deadline,
  Relation,
  RemoteStatus,
  Watch,
} from "./dashboard-types";
import type { Answers, MotionDef } from "./motions/types";
import { caseReplyState, utcToday } from "./reply-state";

/** The in-progress interview snapshot stored on a draft case row.
 *  Everything the interview needs to resume where it left off —
 *  except the signature, which is never stored. */
export interface DraftData {
  motionId: string;
  answers: Answers;
  subject: Relation | null;
  feeWaiverAdded: boolean;
}

export interface DraftSnapshot extends DraftData {
  id: string;
  updatedAt: string;
}

export const DRAFT_STATUS = "Draft";

interface CaseRow {
  id: string;
  title: string;
  subject_name: string;
  relation: string;
  court_name: string;
  county: string;
  state: string;
  case_number: string | null;
  status: string;
  draft_data: DraftData | null;
  created_at: string;
  updated_at: string;
  document_count?: string;
  next_deadline_id?: string | null;
  next_deadline_type?: string | null;
  next_deadline_label?: string | null;
  next_deadline_due?: string | null;
}

const CASE_COLS = `c.id, c.title, c.subject_name, c.relation, c.court_name,
  c.county, c.state, c.case_number, c.status, c.draft_data, c.created_at, c.updated_at`;

interface DeadlineRow {
  id: string; case_id: string; type: string; label: string;
  due_at: string; done: boolean; created_at: string; case_title?: string;
}
interface DocRow {
  id: string; motion_id: string; motion_name: string; fee_waiver: boolean;
  answers: Record<string, string>; created_at: string;
  case_facts: Record<string, string> | null;
}
interface CommRow {
  id: string; case_id: string; direction: "to_court" | "from_court";
  method: string; subject: string; body: string; sent_at: string;
  response_deadline: string | null; status: string; created_at: string;
}
interface WatchRow {
  id: string; case_id: string; portal_key: string; case_number: string;
  party_name: string; last_checked_at: string | null; last_note: string;
  created_at: string; case_title?: string;
}
interface AppearanceRow {
  id: string; case_id: string; hearing_at: string | null; platform: string;
  join_url: string; phone_backup: string; remote_status: string;
}

function rowToSummary(r: CaseRow): CaseSummary {
  return {
    id: r.id,
    title: r.title,
    subjectName: r.subject_name,
    relation: r.relation === "other" ? "other" : "self",
    courtName: r.court_name,
    county: r.county,
    state: r.state,
    caseNumber: r.case_number,
    status: r.status,
    draftMotionId:
      r.status === DRAFT_STATUS && r.draft_data?.motionId
        ? String(r.draft_data.motionId)
        : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    documentCount: r.document_count ? parseInt(r.document_count, 10) : 0,
    nextDeadline: r.next_deadline_id
      ? {
          id: r.next_deadline_id,
          type: r.next_deadline_type || "",
          label: r.next_deadline_label || "",
          dueAt: String(r.next_deadline_due).slice(0, 10),
        }
      : null,
    // Filled in by listCases / getCaseDetail from the comms log;
    // a bare summary (a just-created case) has no comms at all.
    awaitingReply: false,
    replyOverdue: false,
    awaitingDeadline: null,
  };
}

export async function listCases(userId: string): Promise<CaseSummary[]> {
  await ensureSchema();
  const rows = await query<CaseRow>(
    `SELECT ${CASE_COLS},
       (SELECT count(*) FROM documents d WHERE d.case_id = c.id) AS document_count,
       nd.id AS next_deadline_id, nd.type AS next_deadline_type,
       nd.label AS next_deadline_label, nd.due_at AS next_deadline_due
     FROM cases c
     LEFT JOIN LATERAL (
       SELECT id, type, label, due_at FROM deadlines
       WHERE case_id = c.id AND done = false
       ORDER BY due_at ASC LIMIT 1
     ) nd ON true
     WHERE c.user_id = $1
     ORDER BY c.updated_at DESC`,
    [userId],
  );
  const summaries = rows.map(rowToSummary);
  if (summaries.length > 0) {
    // One lightweight pass over the listed cases' comm logs for the
    // unanswered-reply badges (see lib/reply-state for the rules).
    const commRows = await query<CommRow>(
      `SELECT id, case_id, direction, method, subject, body, sent_at,
              response_deadline, status, created_at
       FROM comms WHERE case_id = ANY($1::uuid[])`,
      [summaries.map((s) => s.id)],
    );
    const byCase = new Map<string, CommRow[]>();
    for (const c of commRows) {
      const list = byCase.get(c.case_id) || [];
      list.push(c);
      byCase.set(c.case_id, list);
    }
    const today = utcToday();
    for (const s of summaries) {
      const mine = (byCase.get(s.id) || []).map((c) => ({
        id: c.id,
        direction: c.direction,
        sentAt: String(c.sent_at).slice(0, 10),
        createdAt: new Date(c.created_at).toISOString(),
        responseDeadline: c.response_deadline
          ? String(c.response_deadline).slice(0, 10)
          : null,
      }));
      const st = caseReplyState(mine, today);
      s.awaitingReply = st.awaitingReply;
      s.replyOverdue = st.replyOverdue;
      s.awaitingDeadline = st.awaitingDeadline;
    }
  }
  return summaries;
}

/** Open deadlines across all of the user's cases, soonest first. */
export async function upcomingDeadlines(
  userId: string,
  limit = 10,
): Promise<(Deadline & { caseTitle: string })[]> {
  await ensureSchema();
  const rows = await query<DeadlineRow & { case_title: string }>(
    `SELECT d.id, d.case_id, d.type, d.label, d.due_at, d.done, d.created_at,
            c.title AS case_title
     FROM deadlines d
     JOIN cases c ON c.id = d.case_id
     WHERE c.user_id = $1 AND d.done = false
     ORDER BY d.due_at ASC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    type: r.type,
    label: r.label,
    dueAt: String(r.due_at).slice(0, 10),
    done: r.done,
    createdAt: new Date(r.created_at).toISOString(),
    caseTitle: r.case_title,
  }));
}

async function getOwnedCaseRow(userId: string, caseId: string): Promise<CaseRow | null> {
  const rows = await query<CaseRow>(
    `SELECT ${CASE_COLS} FROM cases c WHERE c.id = $1 AND c.user_id = $2`,
    [caseId, userId],
  );
  return rows[0] ?? null;
}

export async function getCaseDetail(
  userId: string,
  caseId: string,
): Promise<CaseDetail | null> {
  await ensureSchema();
  const row = await getOwnedCaseRow(userId, caseId);
  if (!row) return null;
  const summary = rowToSummary(row);
  const docs = await query<DocRow>(
    `SELECT id, motion_id, motion_name, fee_waiver, answers, created_at, case_facts
     FROM documents WHERE case_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
    [caseId, userId],
  );
  const mail = await query<{
    id: string; from_name: string; from_email: string; subject: string;
    doc_type: string; status: string; received_at: string; proposed_count: string;
  }>(
    `SELECT m.id, m.from_name, m.from_email, m.subject, m.doc_type, m.status,
            m.received_at,
            (SELECT count(*) FROM extracted_facts f
              WHERE f.message_id = m.id AND f.status = 'proposed') AS proposed_count
     FROM inbound_messages m
     WHERE m.case_id = $1 AND m.user_id = $2
     ORDER BY m.received_at DESC`,
    [caseId, userId],
  );
  const dls = await query<DeadlineRow>(
    `SELECT id, case_id, type, label, due_at, done, created_at
     FROM deadlines WHERE case_id = $1 ORDER BY done ASC, due_at ASC`,
    [caseId],
  );
  const comms = await query<CommRow>(
    `SELECT id, case_id, direction, method, subject, body, sent_at,
            response_deadline, status, created_at
     FROM comms WHERE case_id = $1 ORDER BY sent_at DESC, created_at DESC`,
    [caseId],
  );
  const watches = await query<WatchRow>(
    `SELECT id, case_id, portal_key, case_number, party_name, last_checked_at,
            last_note, created_at
     FROM watches WHERE case_id = $1 ORDER BY created_at DESC`,
    [caseId],
  );
  const apps = await query<AppearanceRow>(
    `SELECT id, case_id, hearing_at, platform, join_url, phone_backup, remote_status
     FROM appearances WHERE case_id = $1`,
    [caseId],
  );
  const reply = caseReplyState(
    comms.map((c) => ({
      id: c.id,
      direction: c.direction,
      sentAt: String(c.sent_at).slice(0, 10),
      createdAt: new Date(c.created_at).toISOString(),
      responseDeadline: c.response_deadline
        ? String(c.response_deadline).slice(0, 10)
        : null,
    })),
    utcToday(),
  );
  return {
    ...summary,
    awaitingReply: reply.awaitingReply,
    replyOverdue: reply.replyOverdue,
    awaitingDeadline: reply.awaitingDeadline,
    documentCount: docs.length,
    documents: docs.map((d) => ({
      id: d.id,
      motionId: d.motion_id,
      motionName: d.motion_name,
      feeWaiver: d.fee_waiver,
      createdAt: new Date(d.created_at).toISOString(),
      answers: d.answers || {},
    })),
    deadlines: dls.map((d) => ({
      id: d.id,
      caseId: d.case_id,
      type: d.type,
      label: d.label,
      dueAt: String(d.due_at).slice(0, 10),
      done: d.done,
      createdAt: new Date(d.created_at).toISOString(),
    })),
    comms: comms.map((c) => ({
      id: c.id,
      caseId: c.case_id,
      direction: c.direction,
      method: c.method,
      subject: c.subject,
      body: c.body,
      sentAt: String(c.sent_at).slice(0, 10),
      responseDeadline: c.response_deadline
        ? String(c.response_deadline).slice(0, 10)
        : null,
      status: c.status,
      createdAt: new Date(c.created_at).toISOString(),
    })),
    watches: watches.map((w) => ({
      id: w.id,
      caseId: w.case_id,
      portalKey: w.portal_key,
      caseNumber: w.case_number,
      partyName: w.party_name,
      lastCheckedAt: w.last_checked_at
        ? new Date(w.last_checked_at).toISOString()
        : null,
      lastNote: w.last_note,
      createdAt: new Date(w.created_at).toISOString(),
    })),
    appearance: apps[0]
      ? {
          id: apps[0].id,
          caseId: apps[0].case_id,
          hearingAt: apps[0].hearing_at
            ? new Date(apps[0].hearing_at).toISOString()
            : null,
          platform: apps[0].platform,
          joinUrl: apps[0].join_url,
          phoneBackup: apps[0].phone_backup,
          remoteStatus: apps[0].remote_status as RemoteStatus,
        }
      : null,
    courtMail: mail.map((m) => ({
      id: m.id,
      fromName: m.from_name,
      fromEmail: m.from_email,
      subject: m.subject,
      docType: m.doc_type,
      status: m.status,
      receivedAt: String(m.received_at),
      proposedCount: Number(m.proposed_count) || 0,
    })),
  };
}

/** Lightweight owned-case lookup for the inbox module (confirm
 *  flows need the case number/court without the full detail
 *  assembly). */
export async function getOwnedCaseLite(
  userId: string,
  caseId: string,
): Promise<{
  id: string; title: string; subjectName: string; courtName: string;
  county: string; state: string; caseNumber: string | null;
} | null> {
  await ensureSchema();
  const row = await getOwnedCaseRow(userId, caseId);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subjectName: row.subject_name,
    courtName: row.court_name,
    county: row.county,
    state: row.state,
    caseNumber: row.case_number,
  };
}

export interface NewCaseInput {
  title: string;
  subjectName: string;
  relation: Relation;
  courtName: string;
  county: string;
  state: string;
  caseNumber: string | null;
}

export async function createCase(
  userId: string,
  input: NewCaseInput,
): Promise<CaseSummary> {
  await ensureSchema();
  const rows = await query<CaseRow>(
    `INSERT INTO cases (user_id, title, subject_name, relation, court_name,
                        county, state, case_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${CASE_COLS.replaceAll("c.", "")}`,
    [
      userId,
      input.title,
      input.subjectName,
      input.relation,
      input.courtName,
      input.county,
      input.state,
      input.caseNumber,
    ],
  );
  return rowToSummary(rows[0]);
}

export async function updateCase(
  userId: string,
  caseId: string,
  patch: { title?: string; status?: string },
): Promise<CaseSummary | null> {
  await ensureSchema();
  const rows = await query<CaseRow>(
    `UPDATE cases SET
       title = COALESCE($3, title),
       status = COALESCE($4, status),
       updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${CASE_COLS.replaceAll("c.", "")}`,
    [caseId, userId, patch.title ?? null, patch.status ?? null],
  );
  return rows[0] ? rowToSummary(rows[0]) : null;
}

/** The case title an interview's answers imply — shared by draft
 *  rows and finished cases so a draft keeps its name on completion. */
function titleFromAnswers(motion: MotionDef, a: Answers): string {
  const title =
    a.fullName && a.opposingParty
      ? `${a.fullName} v. ${a.opposingParty}`
      : `${motion.name}${a.fullName ? ` — ${a.fullName}` : ""}`;
  return title.slice(0, 300);
}

function caseNumberFromAnswers(a: Answers): string | null {
  const raw = (a.caseNumber || "").trim();
  return raw && raw.toLowerCase() !== "none" ? raw : null;
}

/**
 * Create-or-update the draft case for an in-progress interview.
 * When `id` names one of the user's own still-draft cases it is
 * updated in place; anything else (no id, another user's id, a case
 * that already completed) starts a fresh draft row — the interview
 * autosave is best-effort and must never fail over identity. The
 * caption columns mirror whatever answers exist so far, so the
 * dashboard list reads sensibly mid-interview.
 */
export async function upsertDraft(
  userId: string,
  args: { id?: string | null; motion: MotionDef; data: DraftData },
): Promise<string> {
  await ensureSchema();
  const { motion, data } = args;
  const a = data.answers;
  const caption = {
    title: titleFromAnswers(motion, a),
    subjectName: (a.fullName || "").slice(0, 200),
    relation: (data.subject === "other" ? "other" : "self") as Relation,
    courtName: (a.courtName || "").slice(0, 200),
    county: (a.county || "").slice(0, 120),
    state: (a.state || "").slice(0, 120),
    caseNumber: caseNumberFromAnswers(a),
  };
  if (args.id) {
    const rows = await query<{ id: string }>(
      `UPDATE cases SET title = $3, subject_name = $4, relation = $5,
         court_name = $6, county = $7, state = $8, case_number = $9,
         draft_data = $10, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = $11
       RETURNING id`,
      [
        args.id, userId, caption.title, caption.subjectName,
        caption.relation, caption.courtName, caption.county,
        caption.state, caption.caseNumber, JSON.stringify(data),
        DRAFT_STATUS,
      ],
    );
    if (rows[0]) return rows[0].id;
  }
  const rows = await query<{ id: string }>(
    `INSERT INTO cases (user_id, title, subject_name, relation, court_name,
                        county, state, case_number, status, draft_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      userId, caption.title, caption.subjectName, caption.relation,
      caption.courtName, caption.county, caption.state,
      caption.caseNumber, DRAFT_STATUS, JSON.stringify(data),
    ],
  );
  return rows[0].id;
}

/** One of the user's own in-progress drafts, or null — another
 *  user's draft, a completed case, and a missing row all read the
 *  same way: not a resumable draft. */
export async function getDraft(
  userId: string,
  draftId: string,
): Promise<DraftSnapshot | null> {
  await ensureSchema();
  const rows = await query<{ draft_data: DraftData | null; updated_at: string }>(
    `SELECT draft_data, updated_at FROM cases
     WHERE id = $1 AND user_id = $2 AND status = $3`,
    [draftId, userId, DRAFT_STATUS],
  );
  const row = rows[0];
  if (!row || !row.draft_data || !row.draft_data.motionId) return null;
  return {
    id: draftId,
    motionId: String(row.draft_data.motionId),
    answers: row.draft_data.answers || {},
    subject:
      row.draft_data.subject === "other" || row.draft_data.subject === "self"
        ? row.draft_data.subject
        : null,
    feeWaiverAdded: row.draft_data.feeWaiverAdded === true,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Save a completed interview document for a signed-in user, creating
 * or attaching the case it belongs to. When the interview carries a
 * draftId for one of the user's own draft cases, THAT case is
 * completed in place — the document is filed onto it, its caption
 * refreshed, its status leaves 'Draft' and its snapshot cleared —
 * so finishing an interview never leaves a duplicate behind.
 * Otherwise the attach rule: when the caption carries a real case
 * number, the document joins the user's existing case with that
 * number; otherwise a new case is created from the caption.
 * Returns the case id.
 */
export async function saveDocumentForUser(
  userId: string,
  args: {
    motion: MotionDef;
    answers: Answers;
    feeWaiver: boolean;
    relation: Relation;
    draftId?: string | null;
    /** Explicit case the interview ran against (court-mail deep
     *  links). Takes precedence over the attach fallbacks below. */
    caseId?: string | null;
    /** The confirmed-facts bag the PDF was generated with, stored
     *  verbatim so re-downloads reproduce the same document. */
    caseFacts?: Record<string, string> | null;
  },
): Promise<string> {
  await ensureSchema();
  const { motion, answers: a, feeWaiver, relation } = args;
  const caseNumber = caseNumberFromAnswers(a);

  let caseId: string | null = null;
  if (args.caseId) {
    const owned = await getOwnedCaseRow(userId, args.caseId);
    if (owned) caseId = owned.id;
  }
  if (!caseId && args.draftId) {
    const rows = await query<{ id: string }>(
      `UPDATE cases SET title = $3, subject_name = $4, relation = $5,
         court_name = $6, county = $7, state = $8, case_number = $9,
         status = 'Active', draft_data = NULL, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = $10
       RETURNING id`,
      [
        args.draftId, userId, titleFromAnswers(motion, a),
        (a.fullName || "").slice(0, 200), relation,
        (a.courtName || "").slice(0, 200), (a.county || "").slice(0, 120),
        (a.state || "").slice(0, 120), caseNumber, DRAFT_STATUS,
      ],
    );
    if (rows[0]) caseId = rows[0].id;
  }
  if (!caseId && caseNumber) {
    const found = await query<{ id: string }>(
      `SELECT id FROM cases WHERE user_id = $1 AND lower(case_number) = lower($2)
       ORDER BY created_at ASC LIMIT 1`,
      [userId, caseNumber],
    );
    caseId = found[0]?.id ?? null;
  }
  if (!caseId) {
    const created = await createCase(userId, {
      title: titleFromAnswers(motion, a),
      subjectName: (a.fullName || "").slice(0, 200),
      relation,
      courtName: (a.courtName || "").slice(0, 200),
      county: (a.county || "").slice(0, 120),
      state: (a.state || "").slice(0, 120),
      caseNumber,
    });
    caseId = created.id;
  }
  await query(
    `INSERT INTO documents (case_id, user_id, motion_id, motion_name, answers, fee_waiver, case_facts)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      caseId, userId, motion.id, motion.name, JSON.stringify(a), feeWaiver,
      args.caseFacts ? JSON.stringify(args.caseFacts) : null,
    ],
  );
  await query(`UPDATE cases SET updated_at = now() WHERE id = $1`, [caseId]);
  return caseId;
}

export async function getDocument(
  userId: string,
  caseId: string,
  docId: string,
): Promise<(CaseDocument & {
  answers: Record<string, string>;
  /** Confirmed-facts bag this document was generated with, or null
   *  for documents saved before the inbox existed. Re-downloads
   *  render from this snapshot, never from live facts. */
  caseFacts: Record<string, string> | null;
}) | null> {
  await ensureSchema();
  const rows = await query<DocRow>(
    `SELECT id, motion_id, motion_name, fee_waiver, answers, created_at, case_facts
     FROM documents WHERE id = $1 AND case_id = $2 AND user_id = $3`,
    [docId, caseId, userId],
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    motionId: rows[0].motion_id,
    motionName: rows[0].motion_name,
    feeWaiver: rows[0].fee_waiver,
    createdAt: new Date(rows[0].created_at).toISOString(),
    answers: rows[0].answers || {},
    caseFacts: rows[0].case_facts || null,
  };
}

export async function addDeadline(
  userId: string,
  caseId: string,
  input: { type: string; label: string; dueAt: string },
): Promise<Deadline | null> {
  await ensureSchema();
  if (!(await getOwnedCaseRow(userId, caseId))) return null;
  const rows = await query<DeadlineRow>(
    `INSERT INTO deadlines (case_id, type, label, due_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, case_id, type, label, due_at, done, created_at`,
    [caseId, input.type, input.label, input.dueAt],
  );
  const d = rows[0];
  return {
    id: d.id, caseId: d.case_id, type: d.type, label: d.label,
    dueAt: String(d.due_at).slice(0, 10), done: d.done,
    createdAt: new Date(d.created_at).toISOString(),
  };
}

export async function setDeadlineDone(
  userId: string,
  caseId: string,
  deadlineId: string,
  done: boolean,
): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE deadlines d SET done = $4
     FROM cases c
     WHERE d.id = $1 AND d.case_id = $2 AND c.id = d.case_id AND c.user_id = $3
     RETURNING d.id`,
    [deadlineId, caseId, userId, done],
  );
  return rows.length > 0;
}

export async function deleteDeadline(
  userId: string,
  caseId: string,
  deadlineId: string,
): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `DELETE FROM deadlines d
     USING cases c
     WHERE d.id = $1 AND d.case_id = $2 AND c.id = d.case_id AND c.user_id = $3
     RETURNING d.id`,
    [deadlineId, caseId, userId],
  );
  return rows.length > 0;
}

export async function addComm(
  userId: string,
  caseId: string,
  input: {
    direction: "to_court" | "from_court";
    method: string;
    subject: string;
    body: string;
    sentAt: string;
    responseDeadline: string | null;
    status: string;
  },
): Promise<CommEntry | null> {
  await ensureSchema();
  if (!(await getOwnedCaseRow(userId, caseId))) return null;
  const rows = await query<CommRow>(
    `INSERT INTO comms (case_id, direction, method, subject, body, sent_at,
                        response_deadline, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, case_id, direction, method, subject, body, sent_at,
               response_deadline, status, created_at`,
    [
      caseId, input.direction, input.method, input.subject, input.body,
      input.sentAt, input.responseDeadline, input.status,
    ],
  );
  const c = rows[0];
  return {
    id: c.id, caseId: c.case_id, direction: c.direction, method: c.method,
    subject: c.subject, body: c.body, sentAt: String(c.sent_at).slice(0, 10),
    responseDeadline: c.response_deadline
      ? String(c.response_deadline).slice(0, 10)
      : null,
    status: c.status, createdAt: new Date(c.created_at).toISOString(),
  };
}

/** How the comm log marks an email this app actually sent (see
 *  /api/comms/send): the status starts with this prefix. Entries
 *  the user logs by hand never use it, so the send rate limit can
 *  count real sends only. */
export const APP_SENT_STATUS_PREFIX = 'Sent by email to ';

/** Count emails this app sent for the user in the last `minutes`
 *  minutes — the per-user send rate limit (counted from the comm
 *  log itself; a failed send is never logged, so it never counts). */
export async function countAppSentComms(
  userId: string,
  minutes: number,
): Promise<number> {
  await ensureSchema();
  const rows = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM comms cm
     JOIN cases c ON c.id = cm.case_id
     WHERE c.user_id = $1 AND cm.direction = 'to_court'
       AND cm.status LIKE $2
       AND cm.created_at > now() - ($3 || ' minutes')::interval`,
    [userId, `${APP_SENT_STATUS_PREFIX}%`, String(Math.max(1, Math.floor(minutes)))],
  );
  return Number(rows[0]?.n || 0);
}

export async function addWatch(
  userId: string,
  caseId: string,
  input: { portalKey: string; caseNumber: string; partyName: string },
): Promise<Watch | null> {
  await ensureSchema();
  if (!(await getOwnedCaseRow(userId, caseId))) return null;
  const rows = await query<WatchRow>(
    `INSERT INTO watches (case_id, portal_key, case_number, party_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, case_id, portal_key, case_number, party_name,
               last_checked_at, last_note, created_at`,
    [caseId, input.portalKey, input.caseNumber, input.partyName],
  );
  const w = rows[0];
  return {
    id: w.id, caseId: w.case_id, portalKey: w.portal_key,
    caseNumber: w.case_number, partyName: w.party_name,
    lastCheckedAt: null, lastNote: w.last_note,
    createdAt: new Date(w.created_at).toISOString(),
  };
}

export async function deleteWatch(
  userId: string,
  caseId: string,
  watchId: string,
): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `DELETE FROM watches w
     USING cases c
     WHERE w.id = $1 AND w.case_id = $2 AND c.id = w.case_id AND c.user_id = $3
     RETURNING w.id`,
    [watchId, caseId, userId],
  );
  return rows.length > 0;
}

export async function upsertAppearance(
  userId: string,
  caseId: string,
  input: {
    hearingAt: string | null;
    platform: string;
    joinUrl: string;
    phoneBackup: string;
    remoteStatus: RemoteStatus;
  },
): Promise<Appearance | null> {
  await ensureSchema();
  if (!(await getOwnedCaseRow(userId, caseId))) return null;
  const rows = await query<AppearanceRow>(
    `INSERT INTO appearances (case_id, hearing_at, platform, join_url,
                              phone_backup, remote_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (case_id) DO UPDATE SET
       hearing_at = EXCLUDED.hearing_at,
       platform = EXCLUDED.platform,
       join_url = EXCLUDED.join_url,
       phone_backup = EXCLUDED.phone_backup,
       remote_status = EXCLUDED.remote_status,
       updated_at = now()
     RETURNING id, case_id, hearing_at, platform, join_url, phone_backup, remote_status`,
    [
      caseId, input.hearingAt, input.platform, input.joinUrl,
      input.phoneBackup, input.remoteStatus,
    ],
  );
  const a = rows[0];
  return {
    id: a.id, caseId: a.case_id,
    hearingAt: a.hearing_at ? new Date(a.hearing_at).toISOString() : null,
    platform: a.platform, joinUrl: a.join_url, phoneBackup: a.phone_backup,
    remoteStatus: a.remote_status as RemoteStatus,
  };
}

/** All watches with their owning case — used ONLY by the cron check,
 *  which records what each check actually established. */
export async function allWatches(): Promise<
  (Watch & { caseTitle: string })[]
> {
  await ensureSchema();
  const rows = await query<WatchRow & { case_title: string }>(
    `SELECT w.id, w.case_id, w.portal_key, w.case_number, w.party_name,
            w.last_checked_at, w.last_note, w.created_at, c.title AS case_title
     FROM watches w JOIN cases c ON c.id = w.case_id
     ORDER BY w.created_at ASC`,
  );
  return rows.map((w) => ({
    id: w.id, caseId: w.case_id, portalKey: w.portal_key,
    caseNumber: w.case_number, partyName: w.party_name,
    lastCheckedAt: w.last_checked_at
      ? new Date(w.last_checked_at).toISOString()
      : null,
    lastNote: w.last_note,
    createdAt: new Date(w.created_at).toISOString(),
    caseTitle: w.case_title,
  }));
}

export async function recordWatchCheck(
  watchId: string,
  note: string,
  stampCheckedAt: boolean,
): Promise<void> {
  await ensureSchema();
  if (stampCheckedAt) {
    await query(
      `UPDATE watches SET last_note = $2, last_checked_at = now() WHERE id = $1`,
      [watchId, note],
    );
  } else {
    await query(`UPDATE watches SET last_note = $2 WHERE id = $1`, [
      watchId,
      note,
    ]);
  }
}
