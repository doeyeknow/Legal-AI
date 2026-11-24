// Dashboard data shapes shared by the API routes and the client
// components. Client-safe (no server imports).

export type Relation = 'self' | 'other';

export interface CaseSummary {
  id: string;
  title: string;
  subjectName: string;
  relation: Relation;
  courtName: string;
  county: string;
  state: string;
  caseNumber: string | null;
  status: string;
  /** For a draft case (status 'Draft'): the motion whose interview
   *  is in progress, so the dashboard can name it. Null otherwise. */
  draftMotionId: string | null;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  nextDeadline: { id: string; type: string; label: string; dueAt: string } | null;
  /** Unanswered-reply state from the comms log (lib/reply-state):
   *  awaitingReply = some entry with a response deadline has no
   *  later opposite-direction entry closing it; replyOverdue = the
   *  earliest such deadline is before today (server UTC); clients
   *  refine overdue against awaitingDeadline with the local date. */
  awaitingReply: boolean;
  replyOverdue: boolean;
  awaitingDeadline: string | null;
}

export interface CaseDocument {
  id: string;
  motionId: string;
  motionName: string;
  feeWaiver: boolean;
  /** Optional user-given display name (evidence locker / rename). */
  label: string | null;
  createdAt: string;
}

export interface Deadline {
  id: string;
  caseId: string;
  /** One of the six research types (lib/comm-templates.ts keys). */
  type: string;
  label: string;
  /** YYYY-MM-DD */
  dueAt: string;
  done: boolean;
  createdAt: string;
}

export interface CommEntry {
  id: string;
  caseId: string;
  direction: 'to_court' | 'from_court';
  method: string;
  subject: string;
  body: string;
  /** YYYY-MM-DD */
  sentAt: string;
  responseDeadline: string | null;
  status: string;
  createdAt: string;
}

export interface Watch {
  id: string;
  caseId: string;
  portalKey: string;
  caseNumber: string;
  partyName: string;
  lastCheckedAt: string | null;
  lastNote: string;
  createdAt: string;
}

export type RemoteStatus = 'not_requested' | 'requested' | 'granted' | 'denied';

export interface Appearance {
  id: string;
  caseId: string;
  hearingAt: string | null;
  platform: string;
  joinUrl: string;
  phoneBackup: string;
  remoteStatus: RemoteStatus;
  /** Remote-appearance details (from court mail or typed in). */
  meetingId: string;
  passcode: string;
  dialIn: string;
  instructions: string;
}

/** One extracted fact from a court-mail message. Facts are
 *  PROPOSED until the user confirms them; only confirmed facts are
 *  ever applied to a case or read by the document generator. */
export interface ExtractedFact {
  id: string;
  messageId: string;
  caseId: string | null;
  kind: string;
  valueText: string;
  /** YYYY-MM-DD when the fact is a date. */
  valueDate: string | null;
  /** ISO datetime when a time is known. */
  valueAt: string | null;
  confidence: 'high' | 'medium' | 'low';
  span: string;
  basis: string;
  status: 'proposed' | 'confirmed' | 'dismissed';
  applied: Record<string, unknown>;
  createdAt: string;
}

export interface InboundAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** False when the file was over the storage cap and only its
   *  metadata was kept (the note in the UI explains). */
  stored: boolean;
}

export interface InboundMessage {
  id: string;
  caseId: string | null;
  caseMatch: 'none' | 'proposed' | 'confirmed';
  fromName: string;
  fromEmail: string;
  subject: string;
  docType: string;
  status: 'received' | 'parsed' | 'filed' | 'dismissed' | 'failed';
  authWarning: boolean;
  isForward: boolean;
  receivedAt: string;
  /** Proposed facts still waiting for the user's review. */
  proposedCount: number;
  /** Mailbox state — separate from the review status above. */
  read: boolean;
  starred: boolean;
  archived: boolean;
  deleted: boolean;
  /** A short plain-text preview of the body for the list. */
  snippet: string;
  attachmentCount: number;
  replyCount: number;
}

export type InboxFolder = 'inbox' | 'unread' | 'starred' | 'archived' | 'trash';

export interface InboxReply {
  id: string;
  kind: 'reply' | 'forward';
  toEmail: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface InboundMessageDetail extends InboundMessage {
  bodyText: string;
  bodyHtml: string;
  toAddresses: string[];
  facts: ExtractedFact[];
  attachments: InboundAttachmentMeta[];
  replies: InboxReply[];
}

/** Court mail assigned to one case, as the case page shows it. */
export interface CourtMailSummary {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  docType: string;
  status: string;
  receivedAt: string;
  proposedCount: number;
}

/** A timeline event the user recorded on a case. */
export interface CaseEvent {
  id: string;
  caseId: string;
  /** One of CASE_EVENT_KINDS keys. */
  kind: string;
  title: string;
  details: string;
  /** YYYY-MM-DD */
  occurredOn: string;
  /** HH:MM (24h), when known. */
  occurredTime: string | null;
  location: string;
  people: string;
  /** For calls to make: the number to dial. */
  phone: string;
  /** A meeting link, when the event is a remote meeting. */
  joinUrl: string;
  /** 'user' (typed in), 'mail' (from court mail), 'call' (heard on a call). */
  source: string;
  sourceRef: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CASE_EVENT_KINDS = [
  { key: 'incident', label: 'Something happened' },
  { key: 'hearing', label: 'Hearing or court date' },
  { key: 'filing', label: 'Filing' },
  { key: 'service', label: 'Papers served or received' },
  { key: 'order', label: 'Court order or ruling' },
  { key: 'call', label: 'Phone call to make' },
  { key: 'communication', label: 'Call, letter, or meeting' },
  { key: 'payment', label: 'Payment' },
  { key: 'evidence', label: 'Evidence gathered' },
  { key: 'note', label: 'Note' },
] as const;

export interface CaseDetail extends CaseSummary {
  documents: (CaseDocument & { answers: Record<string, string> })[];
  deadlines: Deadline[];
  comms: CommEntry[];
  watches: Watch[];
  appearance: Appearance | null;
  courtMail: CourtMailSummary[];
  events: CaseEvent[];
}

export const CASE_STATUSES = [
  'Active',
  'Waiting on the court',
  'Hearing scheduled',
  'Decided',
  'Closed',
] as const;

export const COMM_METHODS = [
  'Filed in person',
  'E-filing',
  'Mail',
  'Email',
  'Phone',
  'Hand delivery',
  'Court portal message',
] as const;

export const APPEARANCE_PLATFORMS = [
  'Webex',
  'Zoom',
  'Google Meet',
  'Microsoft Teams',
  'Phone dial-in',
  'In person only',
  'Other',
] as const;

/** One entry on the calendar: a deadline, the case's hearing, or a
 *  timeline event (calls to make, meetings, user events). */
export interface CalendarItem {
  id: string;
  source: 'deadline' | 'hearing' | 'event';
  /** Deadline type, event kind, or 'hearing'. */
  kind: string;
  caseId: string;
  caseTitle: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h), when known. */
  time: string | null;
  done: boolean;
  details: string;
  joinUrl: string;
  platform: string;
  meetingId: string;
  passcode: string;
  dialIn: string;
  phone: string;
  /** For events: the event id (calls, done toggling). */
  eventId: string | null;
  /** Hearings: the exact timestamp (ISO); the client reads date/time
   *  from it in the user's own time zone. */
  at: string | null;
}

/** Marks where the call summary ends and the transcript begins in a
 *  communication-log entry the companion saved. The case page uses it
 *  to fold the transcript away behind a "Show transcript" toggle. */
export const TRANSCRIPT_MARK = '\n\n--- Transcript (as heard by the companion, may contain errors) ---\n';
export const COMPANION_STATUS = 'Logged by the hearing companion';
