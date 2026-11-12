// Response options for court mail (design §5): which document /
// letter each kind of mail suggests. Client-safe (no server
// imports) — the inbox UI and lib/inbox.ts share these maps.
// Suggestions only — the user always chooses; nothing here files,
// sends, or replies to anything.

export const DOC_TYPE_RESPONSE_MOTIONS: Record<string, { id: string; label: string }[]> = {
  hearing_notice: [
    { id: 'continuance', label: 'Ask to move the hearing (continuance)' },
    { id: 'remote-appearance', label: 'Ask to appear by video or phone' },
  ],
  scheduling_order: [
    { id: 'extension-of-time', label: 'Ask for more time (extension)' },
  ],
  order: [
    { id: 'reconsideration', label: 'Ask the court to reconsider' },
    { id: 'set-aside-default', label: 'Ask to set aside a default' },
  ],
  continuance_ruling: [
    { id: 'remote-appearance', label: 'Ask to appear by video or phone' },
  ],
  judgment: [
    { id: 'set-aside-default', label: 'Ask to set aside the judgment' },
    { id: 'notice-of-appeal-civil', label: 'Start an appeal' },
  ],
};

/** Summons responses depend on the kind of case, not the mail. */
export function summonsMotionsForCaseType(caseType: string): { id: string; label: string }[] {
  if (caseType === 'debt') return [{ id: 'debt-answer', label: 'Answer the debt claim' }];
  if (caseType === 'foreclosure') return [{ id: 'foreclosure-answer', label: 'Answer the foreclosure' }];
  if (caseType === 'eviction') return [{ id: 'eviction-answer', label: 'Answer the eviction' }];
  return [{ id: 'answer-general', label: 'Answer the complaint' }];
}

export const OPPOSING_MOTION_RESPONSES: { id: string; label: string }[] = [
  { id: 'response-to-request-for-order', label: 'Respond to their motion' },
  { id: 'affidavit-in-opposition', label: 'Sworn statement opposing it' },
];

/** Doc type → the CommDraft letter template to suggest first. */
export const DOC_TYPE_COMM_TEMPLATE: Record<string, string> = {
  hearing_notice: 'comm-template-2',
  order: 'comm-template-4',
  scheduling_order: 'comm-template-4',
  continuance_ruling: 'comm-template-2',
  judgment: 'comm-template-4',
};
