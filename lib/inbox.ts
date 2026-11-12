// Court-mail inbox — server side. See research_notes/
// legal-inbox-design.md for the full design and its golden rule:
//
//   Facts are PROPOSED until the user confirms them. An unconfirmed
//   fact never reaches a case file or a generated document. Nothing
//   auto-files, auto-sends, or auto-replies — ever.
//
// getCaseFacts() below is the ONE place the document generator
// reads facts from, and it reads status = 'confirmed' rows only.

import { randomBytes } from 'node:crypto';
import { ensureSchema, query } from './db';
import {
  addComm,
  addDeadline,
  createCase,
  getOwnedCaseLite,
  upsertAppearance,
} from './cases';
import type { RemoteStatus } from './dashboard-types';

type AppearanceInput = Parameters<typeof upsertAppearance>[2];
import { extractFromMessage, longDate, longTime, type ParseCaseRef } from './inbox-parse';
import { deadlineType } from './comm-templates';
import { FACT_KIND_TO_BAG_KEY } from './case-facts';
import type { Answers } from './motions/types';
import type {
  ExtractedFact,
  InboundMessage,
  InboundMessageDetail,
} from './dashboard-types';

export function inboxDomain(): string {
  return (process.env.INBOX_DOMAIN || 'inbox.eyeknow.app').toLowerCase();
}

export function inboxSimulateEnabled(): boolean {
  return process.env.LEGAL_INBOX_SIMULATE === '1';
}

// ------------------------------------------------------------------
// The address: '<slug>-<token>' on the inbox domain. The token is
// 4 chars from an alphabet with no look-alike characters (Adam's
// call, 2026-11-10), generated with crypto.randomBytes, and never
// changes — the slug is cosmetics; the token keeps addresses for
// people who share a slug distinct (unique index on the full local
// part enforces it).
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 unambiguous symbols
export function mintToken(): string {
  const bytes = randomBytes(4);
  let out = '';
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return out;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,19}$/;

function slugFromEmail(email: string): string {
  const raw = (email.split('@')[0] || 'mail').toLowerCase();
  const clean = raw.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const slug = clean.slice(0, 20).replace(/-$/, '');
  return slug.length >= 3 ? slug : 'court-mail';
}

export async function getOrMintInboxAddress(
  userId: string,
): Promise<{ address: string; local: string; slug: string }> {
  await ensureSchema();
  const rows = await query<{ inbox_local: string | null; inbox_slug: string | null; email: string }>(
    `SELECT inbox_local, inbox_slug, email FROM users WHERE id = $1`,
    [userId],
  );
  const u = rows[0];
  if (!u) throw new Error('user not found');
  if (u.inbox_local) {
    // Token-length standard is 4 (Adam, 2026-11-10 — final call
    // after first saying 4, then 12, then settling on 4). An
    // address minted at another length gets ONE re-mint to a fresh
    // 4-char token — but only while it has never received mail, so
    // an address anyone is already sending to never changes.
    const dash = u.inbox_local.lastIndexOf('-');
    const curToken = dash >= 0 ? u.inbox_local.slice(dash + 1) : '';
    if (curToken.length !== 4) {
      const mail = await query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM inbound_messages WHERE user_id = $1`,
        [userId],
      );
      if (Number(mail[0]?.n || 0) === 0) {
        const slug = u.inbox_slug
          || (dash > 0 ? u.inbox_local.slice(0, dash) : slugFromEmail(u.email));
        for (let attempt = 0; attempt < 6; attempt++) {
          const local = `${slug}-${mintToken()}`;
          try {
            const upd = await query<{ inbox_local: string }>(
              `UPDATE users SET inbox_local = $2 WHERE id = $1 AND inbox_local = $3
               RETURNING inbox_local`,
              [userId, local, u.inbox_local],
            );
            if (upd[0]) {
              return { address: `${local}@${inboxDomain()}`, local, slug };
            }
            break; // row changed under us — fall through to stored value
          } catch {
            // unique-index collision on the new local — mint another
          }
        }
      }
    }
    return {
      address: `${u.inbox_local}@${inboxDomain()}`,
      local: u.inbox_local,
      slug: u.inbox_slug || u.inbox_local,
    };
  }
  const base = slugFromEmail(u.email);
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = attempt === 0 ? base : `${base.slice(0, 16)}-${attempt + 1}`;
    const local = `${slug}-${mintToken()}`;
    const upd = await query<{ inbox_local: string }>(
      `UPDATE users SET inbox_local = $2, inbox_slug = $3
       WHERE id = $1 AND inbox_local IS NULL RETURNING inbox_local`,
      [userId, local, slug],
    );
    if (upd[0]) {
      return { address: `${local}@${inboxDomain()}`, local, slug };
    }
    // Someone else claimed that slug in the meantime (unique index)
    // or the user was minted concurrently — re-read and retry.
    const again = await query<{ inbox_local: string | null; inbox_slug: string | null }>(
      `SELECT inbox_local, inbox_slug FROM users WHERE id = $1`,
      [userId],
    );
    if (again[0]?.inbox_local) {
      return {
        address: `${again[0].inbox_local}@${inboxDomain()}`,
        local: again[0].inbox_local,
        slug: again[0].inbox_slug || again[0].inbox_local,
      };
    }
  }
  throw new Error('could not mint inbox address');
}

export async function changeInboxSlug(
  userId: string,
  newSlugRaw: string,
): Promise<{ ok: boolean; error?: string; address?: string }> {
  await ensureSchema();
  const slug = (newSlugRaw || '').toLowerCase().trim();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: 'Use 3–20 characters: lowercase letters, numbers, and hyphens, starting with a letter or number.' };
  }
  const cur = await query<{ inbox_local: string | null }>(
    `SELECT inbox_local FROM users WHERE id = $1`,
    [userId],
  );
  if (!cur[0]?.inbox_local) await getOrMintInboxAddress(userId);
  const rows = await query<{ inbox_local: string }>(
    `SELECT inbox_local FROM users WHERE id = $1`,
    [userId],
  );
  const local = rows[0].inbox_local;
  const token = local.slice(local.lastIndexOf('-') + 1);
  const newLocal = `${slug}-${token}`;
  const taken = await query<{ id: string }>(
    `SELECT id FROM users WHERE lower(inbox_local) = $1 AND id <> $2`,
    [newLocal, userId],
  );
  if (taken[0]) return { ok: false, error: 'That name is taken — try another.' };
  await query(`UPDATE users SET inbox_local = $2, inbox_slug = $3 WHERE id = $1`, [userId, newLocal, slug]);
  return { ok: true, address: `${newLocal}@${inboxDomain()}` };
}

/** The full local part ('slug-token') → the user, or null. */
export async function resolveInboxLocal(
  local: string,
): Promise<{ userId: string } | null> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `SELECT id FROM users WHERE lower(inbox_local) = $1`,
    [(local || '').toLowerCase()],
  );
  return rows[0] ? { userId: rows[0].id } : null;
}

// ------------------------------------------------------------------
// Ingestion: store the message (idempotently), then parse and
// propose. Both the Resend webhook and the simulate endpoint land
// here — there is exactly one code path into the inbox.
export interface InboundAttachmentInput {
  providerAttachmentId?: string | null;
  filename: string;
  contentType: string;
  content?: Buffer | null;
  /** True when the provider's file exceeded our storage cap. */
  skipped?: boolean;
}

export interface StoreInboundInput {
  provider?: string;
  providerEmailId?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  userId: string | null;
  fromName: string;
  fromEmail: string;
  toAddresses: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  headers?: Record<string, unknown>;
  receivedAt?: string | null;
  attachments?: InboundAttachmentInput[];
  rawMeta?: Record<string, unknown>;
  /** Store only, in 'received' status: the content fetch failed
   *  and the sweeper will retry the parse later. */
  deferParse?: boolean;
}

async function userCasesForParse(userId: string): Promise<ParseCaseRef[]> {
  const rows = await query<{
    id: string; case_number: string | null; title: string; subject_name: string; court_name: string;
  }>(
    `SELECT id, case_number, title, subject_name, court_name FROM cases
     WHERE user_id = $1 AND status <> 'Draft' ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    caseNumber: r.case_number,
    title: r.title,
    subjectName: r.subject_name,
    courtName: r.court_name,
  }));
}

export async function storeInboundMessage(
  input: StoreInboundInput,
): Promise<{ messageId: string; duplicate: boolean }> {
  await ensureSchema();
  const provider = input.provider || 'resend';
  const rows = await query<{ id: string }>(
    `INSERT INTO inbound_messages
       (user_id, provider, provider_email_id, message_id, in_reply_to,
        from_name, from_email, to_addresses, subject, body_text, body_html,
        headers, raw_meta, received_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
             COALESCE($14::timestamptz, now()), 'received')
     ON CONFLICT (provider, provider_email_id)
       WHERE provider_email_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      input.userId, provider, input.providerEmailId || null,
      input.messageId || null, input.inReplyTo || null,
      (input.fromName || '').slice(0, 300), (input.fromEmail || '').slice(0, 300),
      JSON.stringify(input.toAddresses || []),
      (input.subject || '').slice(0, 500),
      input.bodyText || '', input.bodyHtml || '',
      JSON.stringify(input.headers || {}),
      JSON.stringify(input.rawMeta || {}),
      input.receivedAt || null,
    ],
  );
  if (!rows[0]) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM inbound_messages WHERE provider = $1 AND provider_email_id = $2`,
      [provider, input.providerEmailId],
    );
    return { messageId: existing[0]?.id || '', duplicate: true };
  }
  const id = rows[0].id;
  for (const att of input.attachments || []) {
    await query(
      `INSERT INTO inbound_attachments
         (message_id, provider_attachment_id, filename, content_type, size_bytes, content)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id, att.providerAttachmentId || null,
        (att.filename || 'attachment').slice(0, 300),
        (att.contentType || '').slice(0, 120),
        att.content ? att.content.length : 0,
        att.skipped ? null : att.content || null,
      ],
    );
  }
  if (input.userId && !input.deferParse) await parseAndPropose(id, input.userId);
  return { messageId: id, duplicate: false };
}

/** Run the deterministic parser over a stored message and record
 *  its facts as PROPOSED. Never applies anything. */
export async function parseAndPropose(messageId: string, userId: string): Promise<void> {
  const rows = await query<{
    subject: string; body_text: string; headers: Record<string, unknown>;
    from_email: string; from_name: string;
  }>(
    `SELECT subject, body_text, headers, from_email, from_name
     FROM inbound_messages WHERE id = $1 AND user_id = $2`,
    [messageId, userId],
  );
  const msg = rows[0];
  if (!msg) return;
  const cases = await userCasesForParse(userId);
  const result = extractFromMessage({
    subject: msg.subject,
    bodyText: msg.body_text,
    headers: msg.headers || {},
    fromEmail: msg.from_email,
    fromName: msg.from_name,
    userCases: cases,
  });
  const matched = result.matchedCaseId
    ? cases.find((c) => c.id === result.matchedCaseId) || null
    : null;
  const strongMatch = Boolean(matched && result.caseNumberFound && matched.caseNumber &&
    result.caseNumberFound.replace(/\s/g, '').toUpperCase() ===
      (matched.caseNumber || '').replace(/\s/g, '').toUpperCase());
  await query(
    `UPDATE inbound_messages
     SET doc_type = $3, auth_warning = $4, is_forward = $5,
         case_id = $6, case_match = $7, status = 'parsed'
     WHERE id = $1 AND user_id = $2`,
    [
      messageId, userId, result.docType, result.authWarning, result.isForward,
      matched ? matched.id : null,
      matched ? (strongMatch ? 'confirmed' : 'proposed') : 'none',
    ],
  );
  for (const f of result.facts) {
    await query(
      `INSERT INTO extracted_facts
         (message_id, user_id, case_id, kind, value_text, value_date, value_at,
          confidence, span, span_offset, basis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        messageId, userId, matched ? matched.id : null, f.kind, f.valueText,
        f.valueDate, f.valueAt, f.confidence, f.span, f.spanOffset, f.basis,
      ],
    );
  }
}

// ------------------------------------------------------------------
// Reads for the review queue.
interface MsgRow {
  id: string; case_id: string | null; case_match: string;
  from_name: string; from_email: string; subject: string;
  doc_type: string; status: string; auth_warning: boolean;
  is_forward: boolean; received_at: string; proposed_count: string;
}

const MSG_COLS = `m.id, m.case_id, m.case_match, m.from_name, m.from_email,
  m.subject, m.doc_type, m.status, m.auth_warning, m.is_forward, m.received_at,
  (SELECT count(*) FROM extracted_facts f
    WHERE f.message_id = m.id AND f.status = 'proposed') AS proposed_count`;

function rowToMessage(r: MsgRow): InboundMessage {
  return {
    id: r.id,
    caseId: r.case_id,
    caseMatch: r.case_match as InboundMessage['caseMatch'],
    fromName: r.from_name,
    fromEmail: r.from_email,
    subject: r.subject,
    docType: r.doc_type,
    status: r.status as InboundMessage['status'],
    authWarning: r.auth_warning,
    isForward: r.is_forward,
    receivedAt: new Date(r.received_at).toISOString(),
    proposedCount: Number(r.proposed_count) || 0,
  };
}

export async function listInbox(
  userId: string,
  opts: { unreadOnly?: boolean; caseId?: string | null } = {},
): Promise<{ messages: InboundMessage[]; unreviewed: number }> {
  await ensureSchema();
  const where = ['m.user_id = $1'];
  const params: unknown[] = [userId];
  if (opts.caseId) {
    params.push(opts.caseId);
    where.push(`m.case_id = $${params.length}`);
  }
  if (opts.unreadOnly) where.push(`m.status NOT IN ('filed','dismissed')`);
  const rows = await query<MsgRow>(
    `SELECT ${MSG_COLS} FROM inbound_messages m
     WHERE ${where.join(' AND ')} ORDER BY m.received_at DESC LIMIT 200`,
    params,
  );
  const cnt = await query<{ n: string }>(
    `SELECT count(*) AS n FROM inbound_messages m
     WHERE m.user_id = $1 AND m.status NOT IN ('filed','dismissed') AND EXISTS (
       SELECT 1 FROM extracted_facts f WHERE f.message_id = m.id AND f.status = 'proposed'
     )`,
    [userId],
  );
  return { messages: rows.map(rowToMessage), unreviewed: Number(cnt[0]?.n) || 0 };
}

interface FactRow {
  id: string; message_id: string; case_id: string | null; kind: string;
  value_text: string; value_date: string | null; value_at: string | null;
  confidence: 'high' | 'medium' | 'low'; span: string; basis: string;
  status: 'proposed' | 'confirmed' | 'dismissed';
  applied: Record<string, unknown>; created_at: string;
}

function rowToFact(r: FactRow): ExtractedFact {
  return {
    id: r.id,
    messageId: r.message_id,
    caseId: r.case_id,
    kind: r.kind,
    valueText: r.value_text,
    valueDate: r.value_date ? String(r.value_date).slice(0, 10) : null,
    valueAt: r.value_at ? new Date(r.value_at).toISOString() : null,
    confidence: r.confidence,
    span: r.span,
    basis: r.basis,
    status: r.status,
    applied: r.applied || {},
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function getMessageDetail(
  userId: string,
  messageId: string,
): Promise<InboundMessageDetail | null> {
  await ensureSchema();
  const rows = await query<MsgRow & { body_text: string; body_html: string; to_addresses: string[] }>(
    `SELECT ${MSG_COLS}, m.body_text, m.body_html, m.to_addresses
     FROM inbound_messages m WHERE m.id = $1 AND m.user_id = $2`,
    [messageId, userId],
  );
  const m = rows[0];
  if (!m) return null;
  const facts = await query<FactRow>(
    `SELECT * FROM extracted_facts WHERE message_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [messageId, userId],
  );
  const atts = await query<{
    id: string; filename: string; content_type: string; size_bytes: number; has_content: boolean;
  }>(
    `SELECT id, filename, content_type, size_bytes, (content IS NOT NULL) AS has_content
     FROM inbound_attachments WHERE message_id = $1 ORDER BY created_at ASC`,
    [messageId],
  );
  return {
    ...rowToMessage(m),
    bodyText: m.body_text,
    bodyHtml: m.body_html,
    toAddresses: m.to_addresses || [],
    facts: facts.map(rowToFact),
    attachments: atts.map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.content_type,
      sizeBytes: a.size_bytes,
      stored: a.has_content,
    })),
  };
}

export async function getAttachmentBytes(
  userId: string,
  messageId: string,
  attachmentId: string,
): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  await ensureSchema();
  const rows = await query<{ filename: string; content_type: string; content: Buffer }>(
    `SELECT a.filename, a.content_type, a.content
     FROM inbound_attachments a
     JOIN inbound_messages m ON m.id = a.message_id
     WHERE a.id = $1 AND a.message_id = $2 AND m.user_id = $3 AND a.content IS NOT NULL`,
    [attachmentId, messageId, userId],
  );
  const r = rows[0];
  return r ? { filename: r.filename, contentType: r.content_type, content: r.content } : null;
}

// ------------------------------------------------------------------
// Case assignment — always the user's act. Confirming an
// assignment also confirms the case_number fact when the email's
// number differs from the case's: the user is told the case
// number will be set (design §3.2).
export async function assignMessageToCase(
  userId: string,
  messageId: string,
  caseId: string | null,
  opts: { setCaseNumber?: boolean } = {},
): Promise<boolean> {
  await ensureSchema();
  if (caseId) {
    const owned = await getOwnedCaseLite(userId, caseId);
    if (!owned) return false;
    if (opts.setCaseNumber) {
      const numFact = await query<{ value_text: string }>(
        `SELECT value_text FROM extracted_facts
         WHERE message_id = $1 AND user_id = $2 AND kind = 'case_number'
         ORDER BY created_at ASC LIMIT 1`,
        [messageId, userId],
      );
      if (numFact[0]?.value_text) {
        await query(`UPDATE cases SET case_number = $3, updated_at = now() WHERE id = $1 AND user_id = $2`,
          [caseId, userId, numFact[0].value_text.slice(0, 80)]);
      }
    }
  }
  const rows = await query<{ id: string }>(
    `UPDATE inbound_messages
     SET case_id = $3, case_match = $4
     WHERE id = $1 AND user_id = $2 RETURNING id`,
    [messageId, userId, caseId, caseId ? 'confirmed' : 'none'],
  );
  if (!rows[0]) return false;
  await query(
    `UPDATE extracted_facts SET case_id = $3 WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId, caseId],
  );
  return true;
}

/** Create a fresh case from a message (the pick-list's "start a
 *  new case" path) and assign the message to it. */
export async function createCaseFromMessage(
  userId: string,
  messageId: string,
): Promise<string | null> {
  const detail = await getMessageDetail(userId, messageId);
  if (!detail) return null;
  const numFact = detail.facts.find((f) => f.kind === 'case_number');
  const courtFact = detail.facts.find((f) => f.kind === 'court_name');
  const created = await createCase(userId, {
    title: (detail.subject || 'Court mail').slice(0, 200),
    subjectName: '',
    relation: 'self',
    courtName: courtFact ? courtFact.valueText.slice(0, 200) : '',
    county: '',
    state: '',
    caseNumber: numFact ? numFact.valueText.slice(0, 80) : null,
  });
  await assignMessageToCase(userId, messageId, created.id);
  return created.id;
}

// ------------------------------------------------------------------
// Confirmation — THE governance core. Confirming a fact applies it
// through the same writers the dashboard uses (addDeadline /
// upsertAppearance / addComm), records what was created in the
// fact's `applied`, and marks the fact confirmed. The email itself
// is logged to the case's communication record at the same moment.
const FACT_DEADLINE_LABEL: Record<string, string> = {
  response_due: 'Response due',
  deadline: 'Deadline from court mail',
  discovery_due: 'Discovery / disclosure due',
};

async function applyFactToCase(
  userId: string,
  fact: FactRow,
  caseId: string,
): Promise<Record<string, unknown>> {
  const applied: Record<string, unknown> = { ...(fact.applied || {}) };
  if (fact.kind === 'hearing_date' || fact.kind === 'hearing_time') {
    if (fact.value_at && !applied.appearanceId) {
      // Merge, never clobber: carry the existing appearance's
      // platform/join details forward (upsertAppearance replaces
      // the row's fields).
      const existing = await query<{
        hearing_at: string | null; platform: string; join_url: string;
        phone_backup: string; remote_status: string;
      }>(
        `SELECT hearing_at, platform, join_url, phone_backup, remote_status
         FROM appearances WHERE case_id = $1`,
        [caseId],
      );
      const ex = existing[0];
      const input: AppearanceInput = {
        hearingAt: new Date(fact.value_at).toISOString(),
        platform: (ex?.platform as AppearanceInput['platform']) || 'Other',
        joinUrl: ex?.join_url || '',
        phoneBackup: ex?.phone_backup || '',
        remoteStatus: (ex?.remote_status as AppearanceInput['remoteStatus']) || 'not_requested',
      };
      const app = await upsertAppearance(userId, caseId, input);
      if (app) applied.appearanceId = app.id;
    }
    if (fact.value_date && !applied.deadlineId) {
      const d = await addDeadline(userId, caseId, {
        type: 'hearing_date',
        label: 'Hearing',
        dueAt: fact.value_date,
      });
      if (d) applied.deadlineId = d.id;
    }
    return applied;
  }
  if ((fact.kind === 'response_due' || fact.kind === 'deadline' || fact.kind === 'discovery_due') && fact.value_date) {
    if (!applied.deadlineId) {
      const typeKey =
        fact.kind === 'response_due' ? 'response_due' : fact.kind === 'discovery_due' ? 'discovery_due' : 'compliance_due';
      const meta = deadlineType(typeKey);
      const d = await addDeadline(userId, caseId, {
        type: meta?.key || typeKey,
        label: FACT_DEADLINE_LABEL[fact.kind] || meta?.label || 'Deadline from court mail',
        dueAt: fact.value_date,
      });
      if (d) applied.deadlineId = d.id;
    }
    return applied;
  }
  if (fact.kind === 'trial_date' && fact.value_date && !applied.deadlineId) {
    const d = await addDeadline(userId, caseId, {
      type: 'hearing_date',
      label: 'Trial date',
      dueAt: fact.value_date,
    });
    if (d) applied.deadlineId = d.id;
    return applied;
  }
  if (fact.kind === 'case_number') {
    const lite = await getOwnedCaseLite(userId, caseId);
    if (lite && !lite.caseNumber) {
      await query(`UPDATE cases SET case_number = $3, updated_at = now() WHERE id = $1 AND user_id = $2`,
        [caseId, userId, fact.value_text.slice(0, 80)]);
      applied.caseNumberSet = fact.value_text;
    }
    return applied;
  }
  if (fact.kind === 'court_name') {
    const lite = await getOwnedCaseLite(userId, caseId);
    if (lite && !lite.courtName) {
      await query(`UPDATE cases SET court_name = $3, updated_at = now() WHERE id = $1 AND user_id = $2`,
        [caseId, userId, fact.value_text.slice(0, 200)]);
      applied.courtNameSet = fact.value_text;
    }
    return applied;
  }
  // All other kinds (order_date, filed_date, service_date,
  // mentioned_date, judge, parties, join info): the fact itself is
  // the record — it feeds the document generator's facts bag and
  // needs no separate write.
  applied.recorded = true;
  return applied;
}

export async function confirmFact(
  userId: string,
  messageId: string,
  factId: string,
  opts: { valueText?: string; valueDate?: string | null } = {},
): Promise<ExtractedFact | null> {
  await ensureSchema();
  const rows = await query<FactRow>(
    `SELECT * FROM extracted_facts WHERE id = $1 AND message_id = $2 AND user_id = $3`,
    [factId, messageId, userId],
  );
  const fact = rows[0];
  if (!fact) return null;
  if (opts.valueText) fact.value_text = opts.valueText.slice(0, 500);
  if (opts.valueDate !== undefined) fact.value_date = opts.valueDate;
  const msg = await query<{ case_id: string | null; received_at: string; subject: string; from_name: string; from_email: string; body_text: string }>(
    `SELECT case_id, received_at, subject, from_name, from_email, body_text
     FROM inbound_messages WHERE id = $1 AND user_id = $2`,
    [messageId, userId],
  );
  const caseId = fact.case_id || msg[0]?.case_id || null;
  let applied = fact.applied || {};
  if (caseId) {
    applied = await applyFactToCase(userId, fact, caseId);
    // The email itself joins the case's communication record —
    // once, no matter how many of its facts get confirmed.
    const already = await query<{ n: string }>(
      `SELECT count(*) AS n FROM extracted_facts
       WHERE message_id = $1 AND applied ? 'commId'`,
      [messageId],
    );
    if (Number(already[0]?.n) === 0 && msg[0]) {
      const dueFact = await query<{ value_date: string | null }>(
        `SELECT value_date FROM extracted_facts
         WHERE message_id = $1 AND kind = 'response_due' AND status = 'confirmed'
         ORDER BY created_at ASC LIMIT 1`,
        [messageId],
      );
      const comm = await addComm(userId, caseId, {
        direction: 'from_court',
        method: 'Email',
        subject: (msg[0].subject || '(no subject)').slice(0, 300),
        body: `${msg[0].from_name ? `${msg[0].from_name} <${msg[0].from_email}>` : msg[0].from_email}\n\n${msg[0].body_text}`.slice(0, 8000),
        sentAt: new Date(msg[0].received_at).toISOString().slice(0, 10),
        responseDeadline: dueFact[0]?.value_date ? String(dueFact[0].value_date).slice(0, 10) : null,
        status: 'Received by email',
      });
      if (comm) applied.commId = comm.id;
    }
  }
  const upd = await query<FactRow>(
    `UPDATE extracted_facts
     SET status = 'confirmed', decided_at = now(), applied = $4,
         value_text = $5, value_date = $6, case_id = COALESCE(case_id, $7)
     WHERE id = $1 AND message_id = $2 AND user_id = $3 RETURNING *`,
    [factId, messageId, userId, JSON.stringify(applied), fact.value_text, fact.value_date, caseId],
  );
  return upd[0] ? rowToFact(upd[0]) : null;
}

export async function dismissFact(
  userId: string,
  messageId: string,
  factId: string,
): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE extracted_facts SET status = 'dismissed', decided_at = now()
     WHERE id = $1 AND message_id = $2 AND user_id = $3 RETURNING id`,
    [factId, messageId, userId],
  );
  return rows.length > 0;
}

export async function setMessageStatus(
  userId: string,
  messageId: string,
  status: 'filed' | 'dismissed' | 'parsed',
): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: string }>(
    `UPDATE inbound_messages SET status = $3 WHERE id = $1 AND user_id = $2 RETURNING id`,
    [messageId, userId, status],
  );
  return rows.length > 0;
}

// ------------------------------------------------------------------
// THE FACTS BAG — the single enforcement point of the golden rule.
// Only status = 'confirmed' facts are read here. Design keys (§6):
// the case row supplies identity facts; confirmed extracted facts
// supply the document facts; the scheduled appearance supplies the
// hearing date/time when no extracted fact does.
export async function getCaseFacts(
  userId: string,
  caseId: string,
): Promise<{ facts: Answers; sources: Record<string, string> }> {
  await ensureSchema();
  const facts: Answers = {};
  const sources: Record<string, string> = {};
  const lite = await getOwnedCaseLite(userId, caseId);
  if (!lite) return { facts, sources };
  if (lite.caseNumber) { facts.caseNumber = lite.caseNumber; sources.caseNumber = 'From your case file'; }
  if (lite.courtName) { facts.courtName = lite.courtName; sources.courtName = 'From your case file'; }
  if (lite.county) { facts.county = lite.county; sources.county = 'From your case file'; }
  if (lite.state) { facts.state = lite.state; sources.state = 'From your case file'; }
  if (lite.subjectName) { facts.fullName = lite.subjectName; sources.fullName = 'From your case file'; }
  // Opposing party only from a caption the user themselves typed
  // into the case title ("A v. B") — never guessed.
  const vMatch = lite.title.match(/^(.+?)\s+v\.\s+(.+)$/i);
  if (vMatch && lite.subjectName && vMatch[1].trim().toLowerCase() === lite.subjectName.toLowerCase()) {
    facts.opposingParty = vMatch[2].trim();
    sources.opposingParty = 'From your case file';
  }

  const rows = await query<{
    kind: string; value_text: string; value_date: string | null; value_at: string | null;
    subject: string; received_at: string;
  }>(
    `SELECT f.kind, f.value_text, f.value_date, f.value_at, m.subject, m.received_at
     FROM extracted_facts f
     JOIN inbound_messages m ON m.id = f.message_id
     WHERE f.user_id = $1 AND f.case_id = $2 AND f.status = 'confirmed'
     ORDER BY f.decided_at ASC NULLS LAST, f.created_at ASC`,
    [userId, caseId],
  );
  const hearingDates: { date: string; at: string | null; src: string }[] = [];
  for (const r of rows) {
    const src = `From court mail: “${(r.subject || 'email').slice(0, 60)}”, received ${longDate(new Date(r.received_at).toISOString().slice(0, 10))} — you confirmed this`;
    if (r.kind === 'hearing_date' || r.kind === 'hearing_time') {
      if (r.value_date) {
        hearingDates.push({
          date: String(r.value_date).slice(0, 10),
          at: r.value_at ? new Date(r.value_at).toISOString() : null,
          src,
        });
      }
      continue;
    }
    const key = FACT_KIND_TO_BAG_KEY[r.kind];
    if (!key) continue;
    // Identity facts from the case row win over extracted ones.
    if ((key === 'caseNumber' || key === 'courtName') && facts[key]) continue;
    facts[key] = r.value_date ? longDate(String(r.value_date).slice(0, 10)) : r.value_text;
    sources[key] = src;
  }
  if (hearingDates.length) {
    const h = hearingDates[hearingDates.length - 1];
    facts.hearingDate = longDate(h.date);
    sources.hearingDate = h.src;
    facts.currentDate = facts.hearingDate;
    sources.currentDate = h.src;
    if (h.at) {
      const d = new Date(h.at);
      facts.hearingTime = longTime(d.getUTCHours(), d.getUTCMinutes());
      sources.hearingTime = h.src;
    }
  } else {
    const app = await query<{ hearing_at: string | null; join_url: string; platform: string }>(
      `SELECT hearing_at, join_url, platform FROM appearances WHERE case_id = $1`,
      [caseId],
    );
    if (app[0]?.hearing_at) {
      const d = new Date(app[0].hearing_at);
      const dateStr = d.toISOString().slice(0, 10);
      facts.hearingDate = longDate(dateStr);
      sources.hearingDate = 'From the hearing on your case file';
      facts.currentDate = facts.hearingDate;
      sources.currentDate = sources.hearingDate;
      facts.hearingTime = longTime(d.getUTCHours(), d.getUTCMinutes());
      sources.hearingTime = sources.hearingDate;
    }
    if (app[0]?.join_url) {
      facts.joinInfo = app[0].join_url;
      sources.joinInfo = 'From the hearing on your case file';
    }
  }
  return { facts, sources };
}

// Response-option maps live in lib/inbox-options.ts (client-safe)
// and are re-exported here for server-side callers.
export {
  DOC_TYPE_RESPONSE_MOTIONS,
  DOC_TYPE_COMM_TEMPLATE,
  OPPOSING_MOTION_RESPONSES,
  summonsMotionsForCaseType,
} from './inbox-options';

// ------------------------------------------------------------------
// Sweeper support (design §3.3): stuck 'received' rows get their
// parse retried; dead letters are purged after 7 days.
export async function sweepInbox(): Promise<{ retried: number; failed: number; purged: number }> {
  await ensureSchema();
  const stuck = await query<{ id: string; user_id: string; raw_meta: Record<string, unknown> }>(
    `SELECT id, user_id, raw_meta FROM inbound_messages
     WHERE status = 'received' AND user_id IS NOT NULL
       AND received_at < now() - interval '2 minutes' LIMIT 50`,
  );
  let retried = 0;
  let failed = 0;
  for (const m of stuck) {
    const attempts = Number((m.raw_meta || {}).parseAttempts || 0) + 1;
    if (attempts >= 3) {
      await query(
        `UPDATE inbound_messages SET status = 'failed',
           raw_meta = raw_meta || $2::jsonb WHERE id = $1`,
        [m.id, JSON.stringify({ parseAttempts: attempts })],
      );
      failed++;
    } else {
      await query(
        `UPDATE inbound_messages SET raw_meta = raw_meta || $2::jsonb WHERE id = $1`,
        [m.id, JSON.stringify({ parseAttempts: attempts })],
      );
      await parseAndPropose(m.id, m.user_id);
      retried++;
    }
  }
  const purged = await query<{ id: string }>(
    `DELETE FROM inbound_messages
     WHERE user_id IS NULL AND received_at < now() - interval '7 days' RETURNING id`,
  );
  return { retried, failed, purged: purged.length };
}
