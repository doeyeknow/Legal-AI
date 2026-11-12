// Case-facts plumbing shared by the server (lib/inbox.ts builds the
// facts bag from CONFIRMED extracted facts) and the client (the
// interview maps bag keys onto its question queue). Client-safe:
// no server imports live here.
//
// The golden rule of the court-mail inbox: only facts the user has
// confirmed ever reach a case file or a generated document. This
// module only defines the key mappings — the enforcement lives in
// getCaseFacts() (confirmed-only read) and in lib/pdf.ts (the bag
// is an underlay; the filer's own answers always win).

import type { Answers } from './motions/types';

/** extracted_facts.kind → the generator "bag" key it feeds. */
export const FACT_KIND_TO_BAG_KEY: Record<string, string> = {
  hearing_date: 'hearingDate',
  hearing_time: 'hearingTime',
  trial_date: 'trialDate',
  order_date: 'orderDate',
  filed_date: 'filedDate',
  service_date: 'serviceDate',
  response_due: 'responseDueDate',
  deadline: 'deadlineDate',
  discovery_due: 'discoveryDueDate',
  case_number: 'caseNumber',
  court_name: 'courtName',
  judge_name: 'judgeName',
  opposing_party: 'opposingParty',
  opposing_attorney: 'opposingAttorney',
  join_info: 'joinInfo',
};

/** Bag key → the interview answer keys it may seed, in preference
 *  order. The interview fills whichever of these keys actually
 *  exist in the chosen motion's queue and are still unanswered —
 *  motions name the same fact differently (the continuance family
 *  asks for {currentDate}; remote appearance asks {hearingDate}). */
export const FACT_ANSWER_KEYS: Record<string, string[]> = {
  hearingDate: ['hearingDate', 'currentDate', 'currentHearingDate', 'dateOfHearing'],
  hearingTime: ['hearingTime', 'currentTime', 'timeOfHearing'],
  trialDate: ['trialDate', 'currentDate'],
  orderDate: ['orderDate', 'dateOfOrder'],
  filedDate: ['filedDate', 'filingDate'],
  serviceDate: ['serviceDate', 'dateOfService', 'dateServed'],
  responseDueDate: ['responseDueDate', 'responseDue', 'dueDate', 'currentDeadline', 'deadline'],
  deadlineDate: ['deadlineDate', 'dueDate', 'currentDeadline', 'deadline'],
  discoveryDueDate: ['discoveryDueDate', 'dueDate', 'currentDeadline'],
  caseNumber: ['caseNumber'],
  courtName: ['courtName'],
  judgeName: ['judgeName'],
  opposingParty: ['opposingParty'],
  opposingAttorney: ['opposingAttorney'],
  county: ['county'],
  state: ['state'],
  fullName: ['fullName'],
};

/** Answer keys that must NEVER be seeded from extracted facts:
 *  the fee-waiver (IFP) fields are sworn financial statements, and
 *  the signature is drawn fresh every time. Extraction never
 *  produces these keys and the alias table has no path to them;
 *  this set is the belt-and-braces assertion on top of that. */
export const SEED_EXCLUDED_KEYS = new Set([
  'ifpHousehold',
  'ifpIncome',
  'ifpBenefits',
  'ifpExpenses',
  'ifpAssets',
  'signature',
]);

/** What GET /api/cases/[id]/facts returns: the flat facts bag plus,
 *  per bag key, a provenance line the UI can quote ("Court's
 *  hearing notice, received Jan 5 — you confirmed this"). */
export interface CaseFactsPayload {
  facts: Answers;
  sources: Record<string, string>;
}
