// Postgres access for legal accounts.
// Everything degrades gracefully: when no connection string is set,
// dbConfigured() is false, the auth APIs report "accounts are being
// set up" (503), the interview falls back to the guest flow, and
// nothing crashes (lazy pool, same pattern as palm-app/lib/db.ts).

import { Pool, types } from "pg";

// DATE columns (deadlines.due_at, comms.sent_at, ...) must come back
// as plain 'YYYY-MM-DD' strings — pg's default parses them into JS
// Dates at local midnight, which String() renders as 'Wed Nov 25…'
// and silently corrupts the API payloads.
types.setTypeParser(1082, (v: string) => v);

declare global {
  // eslint-disable-next-line no-var
  var __legalPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __legalSchemaReady: Promise<void> | undefined;
}

/** Connection string: plain DATABASE_URL first, then the generic
 *  Vercel Postgres variables, then the legal_-prefixed Neon
 *  integration variables, so the app works in whichever project
 *  shape it is deployed to. */
export function dbConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.legal_DATABASE_URL ||
    process.env.legal_POSTGRES_URL ||
    process.env.legal_POSTGRES_URL_NON_POOLING ||
    ""
  );
}

export function dbConfigured(): boolean {
  return Boolean(dbConnectionString());
}

export function getPool(): Pool {
  const connectionString = dbConnectionString();
  if (!connectionString) throw new Error("database is not configured");
  if (!globalThis.__legalPool) {
    globalThis.__legalPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalThis.__legalPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

export function ensureSchema(): Promise<void> {
  if (!globalThis.__legalSchemaReady) {
    globalThis.__legalSchemaReady = (async () => {
      // The basic-info profile lives on the user row: it is the same
      // information the interview's shared caption fields collect, so
      // a signed-in user's forms can be prefilled from it.
      await query(`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '',
        street TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        zip TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // Emails are stored lowercased by the app; this index keeps the
      // uniqueness rule honest even against mixed-case rows.
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx ON users (lower(email))`,
      );
      // Server-side sessions: only the token's hash is stored.
      await query(`CREATE TABLE IF NOT EXISTS legal_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS membership_grants (
        stripe_source TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_customer TEXT,
        plan TEXT NOT NULL CHECK (plan IN ('weekly', 'yearly', 'lifetime')),
        active BOOLEAN NOT NULL,
        valid_until TIMESTAMPTZ,
        checked_at TIMESTAMPTZ NOT NULL
      )`);
      await query(`CREATE INDEX IF NOT EXISTS membership_grants_user_idx ON membership_grants (user_id)`);
      await query(`CREATE TABLE IF NOT EXISTS membership_checkouts (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        stripe_session TEXT NOT NULL
      )`);
      await query(`CREATE TABLE IF NOT EXISTS legacy_motion_downloads (
        stripe_session TEXT PRIMARY KEY,
        packet_hash TEXT NOT NULL
      )`);
      // ---- Dashboard: cases and everything that hangs off them ----
      // Every row carries the owning user's id (directly or through
      // its case) and every query in lib/cases.ts scopes by it.
      await query(`CREATE TABLE IF NOT EXISTS cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        subject_name TEXT NOT NULL DEFAULT '',
        relation TEXT NOT NULL DEFAULT 'self' CHECK (relation IN ('self','other')),
        court_name TEXT NOT NULL DEFAULT '',
        county TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        case_number TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // Interview drafts: a case row with status 'Draft' carries the
      // in-progress interview snapshot (motion id, answers so far,
      // subject, fee-waiver flag) in draft_data, so an unfinished
      // interview shows up in the user's cases and can be resumed.
      // Completing the interview files the document onto the same
      // row and clears draft_data. The signature is never stored.
      await query(
        `ALTER TABLE cases ADD COLUMN IF NOT EXISTS draft_data JSONB`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS cases_user_idx ON cases (user_id, updated_at DESC)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS cases_user_number_idx ON cases (user_id, lower(case_number))`,
      );
      // One row per generated document; answers are the full interview
      // answer set so the PDF can be regenerated exactly. The drawn
      // signature is NOT stored (it lives only in the original
      // download) — re-downloads carry a blank signature line.
      await query(`CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        motion_id TEXT NOT NULL,
        motion_name TEXT NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        fee_waiver BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS documents_case_idx ON documents (case_id, created_at DESC)`,
      );
      // type is one of the six research deadline types
      // (lib/comm-templates.ts DEADLINE_TYPES keys).
      await query(`CREATE TABLE IF NOT EXISTS deadlines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        due_at DATE NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS deadlines_case_idx ON deadlines (case_id, due_at)`,
      );
      await query(`CREATE TABLE IF NOT EXISTS comms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        direction TEXT NOT NULL CHECK (direction IN ('to_court','from_court')),
        method TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        sent_at DATE NOT NULL DEFAULT CURRENT_DATE,
        response_deadline DATE,
        status TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS comms_case_idx ON comms (case_id, sent_at DESC)`,
      );
      // Docket watches: last_note records exactly what the last check
      // established — never a docket summary the check did not see.
      await query(`CREATE TABLE IF NOT EXISTS watches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        portal_key TEXT NOT NULL,
        case_number TEXT NOT NULL DEFAULT '',
        party_name TEXT NOT NULL DEFAULT '',
        last_checked_at TIMESTAMPTZ,
        last_note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS watches_case_idx ON watches (case_id, created_at DESC)`,
      );
      // ---- Court-mail inbox (design: research_notes/legal-inbox-design.md) ----
      // One address per user: '<slug>-<token>' stored whole and
      // lowercased; the token never changes, the slug is editable.
      await query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS inbox_local TEXT`,
      );
      await query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS inbox_slug TEXT`,
      );
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS users_inbox_local_uidx
         ON users (lower(inbox_local)) WHERE inbox_local IS NOT NULL`,
      );
      // Snapshot of the confirmed-facts bag a document was generated
      // with, so a re-download reproduces the identical document.
      await query(
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS case_facts JSONB`,
      );
      // Optional display name the user can give a document (the
      // evidence locker and case page show it instead of / before
      // the motion's catalog name).
      await query(
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS label TEXT`,
      );
      await query(`CREATE TABLE IF NOT EXISTS inbound_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
        case_match TEXT NOT NULL DEFAULT 'none'
          CHECK (case_match IN ('none','proposed','confirmed')),
        provider TEXT NOT NULL DEFAULT 'resend',
        provider_email_id TEXT,
        message_id TEXT,
        in_reply_to TEXT,
        from_name TEXT NOT NULL DEFAULT '',
        from_email TEXT NOT NULL DEFAULT '',
        to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
        subject TEXT NOT NULL DEFAULT '',
        body_text TEXT NOT NULL DEFAULT '',
        body_html TEXT NOT NULL DEFAULT '',
        headers JSONB NOT NULL DEFAULT '{}'::jsonb,
        auth_warning BOOLEAN NOT NULL DEFAULT false,
        is_forward BOOLEAN NOT NULL DEFAULT false,
        doc_type TEXT NOT NULL DEFAULT 'other',
        status TEXT NOT NULL DEFAULT 'received'
          CHECK (status IN ('received','parsed','filed','dismissed','failed')),
        raw_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS inbound_provider_uidx
         ON inbound_messages (provider, provider_email_id)
         WHERE provider_email_id IS NOT NULL`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS inbound_user_idx ON inbound_messages (user_id, received_at DESC)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS inbound_case_idx ON inbound_messages (case_id, received_at DESC)`,
      );
      await query(`CREATE TABLE IF NOT EXISTS inbound_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
        provider_attachment_id TEXT,
        filename TEXT NOT NULL DEFAULT '',
        content_type TEXT NOT NULL DEFAULT '',
        size_bytes INT NOT NULL DEFAULT 0,
        content BYTEA,
        storage_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS inbound_att_msg_idx ON inbound_attachments (message_id)`,
      );
      await query(`CREATE TABLE IF NOT EXISTS extracted_facts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        value_text TEXT NOT NULL DEFAULT '',
        value_date DATE,
        value_at TIMESTAMPTZ,
        confidence TEXT NOT NULL DEFAULT 'medium'
          CHECK (confidence IN ('high','medium','low')),
        span TEXT NOT NULL DEFAULT '',
        span_offset INT,
        basis TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'proposed'
          CHECK (status IN ('proposed','confirmed','dismissed')),
        applied JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        decided_at TIMESTAMPTZ
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS facts_case_idx ON extracted_facts (case_id, status)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS facts_user_idx ON extracted_facts (user_id, status)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS facts_msg_idx ON extracted_facts (message_id)`,
      );
      await query(`CREATE TABLE IF NOT EXISTS appearances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
        hearing_at TIMESTAMPTZ,
        platform TEXT NOT NULL DEFAULT '',
        join_url TEXT NOT NULL DEFAULT '',
        phone_backup TEXT NOT NULL DEFAULT '',
        remote_status TEXT NOT NULL DEFAULT 'not_requested'
          CHECK (remote_status IN ('not_requested','requested','granted','denied')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // ---- Web Push subscriptions (new court mail only) ----
      // One row per opted-in browser, owned by the signed-in user
      // who turned notifications on. The endpoint is the upsert
      // key, so re-subscribing the same browser refreshes its
      // keys instead of duplicating the row. Dead endpoints
      // (404/410 from the push service) are pruned at send time.
      await query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS push_subs_endpoint_uidx ON push_subscriptions (endpoint)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS push_subs_user_idx ON push_subscriptions (user_id)`,
      );
      // ---- Inbox mailbox state (read / starred / archived / trash) ----
      // Mailbox state is separate from the review status: a message
      // can be read but still have facts waiting, or archived after
      // its facts were filed. read_at NULL = new (drives the unread
      // badge). deleted_at set = in the Trash; "Delete forever"
      // removes the row itself.
      await query(
        `ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`,
      );
      await query(
        `ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`,
      );
      await query(
        `ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
      );
      await query(
        `ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false`,
      );
      // One-time backfill: mail already reviewed before read state
      // existed counts as read, so the badge starts honest.
      await query(
        `UPDATE inbound_messages SET read_at = COALESCE(read_at, received_at)
         WHERE read_at IS NULL AND status IN ('filed','dismissed')`,
      );
      // Replies and forwards sent from the inbox, so the message
      // view can show what was sent and the send limit counts them.
      await query(`CREATE TABLE IF NOT EXISTS inbox_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id UUID REFERENCES inbound_messages(id) ON DELETE SET NULL,
        kind TEXT NOT NULL DEFAULT 'reply' CHECK (kind IN ('reply','forward')),
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        provider_id TEXT,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS inbox_replies_msg_idx ON inbox_replies (message_id, sent_at)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS inbox_replies_user_idx ON inbox_replies (user_id, sent_at DESC)`,
      );
      // Case timeline: events the user records themselves (what
      // happened, when, who was there). The timeline view merges
      // these with the dates the case already holds (documents,
      // deadlines, communications, court mail, hearing).
      await query(`CREATE TABLE IF NOT EXISTS case_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'note',
        title TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        occurred_on DATE NOT NULL,
        occurred_time TEXT,
        location TEXT NOT NULL DEFAULT '',
        people TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(
        `CREATE INDEX IF NOT EXISTS case_events_case_idx ON case_events (case_id, occurred_on, occurred_time)`,
      );
      // Calendar extras (add-only): calls to make carry a phone
      // number, events created from court mail or a call remember
      // where they came from, and an event can be ticked off.
      for (const col of [
        `phone TEXT NOT NULL DEFAULT ''`,
        `join_url TEXT NOT NULL DEFAULT ''`,
        `source TEXT NOT NULL DEFAULT 'user'`,
        `source_ref TEXT`,
        `done BOOLEAN NOT NULL DEFAULT false`,
      ]) {
        await query(`ALTER TABLE case_events ADD COLUMN IF NOT EXISTS ${col}`);
      }
      // Remote-appearance details read from court mail.
      for (const col of [
        `meeting_id TEXT NOT NULL DEFAULT ''`,
        `passcode TEXT NOT NULL DEFAULT ''`,
        `dial_in TEXT NOT NULL DEFAULT ''`,
        `instructions TEXT NOT NULL DEFAULT ''`,
      ]) {
        await query(`ALTER TABLE appearances ADD COLUMN IF NOT EXISTS ${col}`);
      }
      // Court mail: add the details it finds to the case without a
      // confirmation step (the user can switch this off).
      await query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS inbox_auto_apply BOOLEAN NOT NULL DEFAULT true`,
      );
      // The user's time zone, as their browser reports it — court mail
      // times ("9:30 a.m.") are read in it.
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS time_zone TEXT`);
    })().catch((err) => {
      globalThis.__legalSchemaReady = undefined;
      throw err;
    });
  }
  return globalThis.__legalSchemaReady;
}
