// Shared types for the motion template engine.
// Data lives in lib/motions/data-top.ts (top 10, full prose) and
// lib/motions/data-rest.ts (remaining 21, full fields + structure).

export type MotionCategory =
  | 'General Civil'
  | 'Initiating & Small Claims'
  | 'Family'
  | 'Criminal & Post-Conviction'
  | 'Landlord–Tenant'
  | 'Post-Judgment & Enforcement'
  | 'Probate, Guardianship & Estates'
  | 'Debt, Consumer & Foreclosure'
  | 'Traffic & Municipal'
  | 'Appeals'
  | 'Protection Orders'
  | 'Administrative Review'
  | 'Forms & Companions';

export interface MotionField {
  key: string;
  /** The exact question the chatbot asks, one field at a time.
   *  Interview-only: this text must NEVER appear in the generated
   *  document — questions belong to the chat, not the motion. */
  label: string;
  /** Declarative sentence template for the generated document,
   *  composed with fill(): {value} is this field's own answer, any
   *  other {fieldKey} pulls that answer in. Motions without a prose
   *  bodyTemplate build their Statement of Facts from these; a
   *  field with no statement renders its answer alone. */
  statement?: string;
  hint?: string;
  type?: 'text' | 'date' | 'textarea' | 'select' | 'phone';
  options?: string[];
  required?: boolean;
}

export interface MotionDef {
  id: string;
  num: number; // catalog number 1..32
  name: string;
  category: MotionCategory;
  /** Plain-English "what it does". */
  purpose: string;
  /** Situation descriptions from the catalog — the matching keys. */
  situations: string[];
  /** Extra matching tokens/phrases. */
  keywords: string[];
  /** Motion-specific fields, in addition to the shared caption fields. */
  fields: MotionField[];
  /** Prayer for relief, with {fieldKey} / {sharedKey} placeholders. */
  prayer: string;
  /** Companion document display names (from the catalog's "File with it"). */
  companions: string[];
  needsConferenceCert?: boolean;
  needsProposedOrder?: boolean;
  needsAffidavit?: boolean;
  /** Honest pro-se reality tag from the catalog. */
  proSe: string;
  /** Per-motion filing gotchas, carried into the filing-steps page. */
  gotchas: string[];
  /** Extra warning shown before the interview (criminal flows, emergencies). */
  warning?: string;
  /** Top-10 motions carry full prose body paragraphs with {placeholders}. */
  bodyTemplate?: string[];
  /** Non-adversarial caption for "In re" matters (probate, guardianship,
   *  name change, adoption): the caption names the matter instead of a
   *  "v." party block. Default (absent) is the adversarial caption. */
  captionStyle?: 'adversarial' | 'in-re';
  /** Overrides the default "Statement of Facts and Grounds" body heading
   *  for non-motion kinds (affidavits, subpoenas, worksheets, briefs). */
  bodyHeading?: string;
  /** Overrides the default "Prayer for Relief" closing heading for
   *  non-motion kinds (notices, commands, certifications, conclusions). */
  prayerHeading?: string;
}

/** Caption fields collected once for every motion (catalog Part 1A). */
export const SHARED_FIELDS: MotionField[] = [
  { key: 'fullName', label: 'What is your full legal name?', required: true },
  { key: 'address', label: 'What is your mailing address?', required: true },
  { key: 'phone', label: 'What is your phone number?', type: 'phone', required: true },
  { key: 'email', label: 'What is your email address?', required: true },
  {
    key: 'filerRole',
    label: 'In this case, are you the plaintiff/petitioner or the defendant/respondent?',
    type: 'select',
    options: ['Plaintiff', 'Defendant', 'Petitioner', 'Respondent'],
    required: true,
  },
  { key: 'zip', label: 'What is your ZIP code? (We use it to find your court\'s filing information at the end.)', required: true },
  { key: 'state', label: 'What state is your case in?', required: true },
  { key: 'county', label: 'What county is your case in?', required: true },
  { key: 'courtName', label: 'What is the name of the court? (For example: "District Court of Taos County". If you are not sure, type "not sure" and we will use your county court.)', required: true },
  { key: 'caseNumber', label: 'What is your case number? If your case has not been filed yet, type "none".' },
  { key: 'opposingParty', label: 'What is the full name of the other party in the case?', required: true },
  { key: 'opposingAttorney', label: 'If the other party has a lawyer, what is the lawyer\'s name? If not, type "none".' },
];

export const DISCLAIMER =
  'Document preparation, not a law firm — this is not legal advice.';

export type Answers = Record<string, string>;

/** Fill {key} placeholders from answers; unknown keys become "__________". */
export function fill(template: string, answers: Answers): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, k: string) =>
    answers[k] && answers[k].trim() ? answers[k].trim() : '__________'
  );
}
