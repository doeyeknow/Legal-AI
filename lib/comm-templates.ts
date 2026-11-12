// Court-communication templates + deadline types — converted from
// research_notes/legal-hearing-sim-and-comms.md Part B. Templates are
// drafting aids: the user reviews everything, then either sends it
// from the compose form (by email, from their own court-mail
// address — see /api/comms/send) or copies it and sends it through
// the court's own channels.

export interface CommTemplate {
  id: string;
  name: string;
  usedWhen: string;
  requiredElements: string;
  toneRules: string;
  /** Fill-in skeleton with [bracketed] blanks. */
  skeleton: string;
}

export interface DeadlineType {
  key: string;
  label: string;
  what: string;
  source: string;
  ifMissed: string;
}

export const COMM_TONE_RULES: string[] = [
  "Everything filed or sent to a court is part of a public record and may be read aloud in a hearing. Write nothing you would not say to the judge in person.",
  "Formal, short, factual. Courts process paper by the stack. One subject per letter; state what happened, what you are asking for, and the relevant dates in the first three sentences.",
  "No argument, no adjectives about the other party, no legal conclusions dressed up as fact. (\"The respondent has failed to comply with paragraph 4 since March 3\" — yes. \"The respondent is a liar who ignores the law\" — no.)",
  "Every communication carries the case caption and case number, your name, address, phone, and email, and the date.",
  "Send a copy to the other party (or their attorney) on everything and say so in the letter (\"Copy sent to [name] on [date]\") — courts in most jurisdictions forbid one-sided (\"ex parte\") written communication with the judge about the merits, and clerks may return or disregard letters that break the rule.",
  "File the original with the clerk; keep your own copy with a file-stamp or mailing receipt. A letter that cannot be proven sent did not happen, for deadline purposes.",
  "Address judges as \"Your Honor\" in person; in letters, the envelope/heading goes to the court or clerk (\"Clerk of the Court\" / \"Honorable [Name], [Court]\") — most case communications are properly addressed to the clerk, not the judge personally. ---"
];

export const COMM_TEMPLATES: CommTemplate[] = [
  {
    "id": "comm-template-1",
    "name": "Notice of change of address / contact information",
    "usedWhen": "You move, or your phone/email changes, at any point while a case is open (and for a reasonable time after, while orders can still be enforced). Courts mail notices to the address on file; a missed hearing notice because you moved is usually treated as your problem, not the court's.",
    "requiredElements": "Caption + case number; old address/contact; new address/contact; effective date; a sentence confirming you will keep the court updated; signature; certificate that a copy was sent to the other party.",
    "toneRules": "Purely administrative — no case facts, no requests other than updating the record. ---",
    "skeleton": "[Your name]\n[New address] · [Phone] · [Email]\n[Date]\n\nClerk of the Court, [Court name], [Court address]\n\nRe: [Case caption], Case No. [______]\n\nPlease update my contact information in this case, effective [date]:\n\n  Previous: [old address, phone, email]\n  New:      [new address, phone, email]\n\nI understand notices will be sent to the new address above and that I am\nresponsible for keeping it current.\n\nRespectfully,\n[Signature] — [Printed name], appearing pro se\n\nCopy sent to [other party/attorney name] on [date] by [mail/email/hand delivery]."
  },
  {
    "id": "comm-template-2",
    "name": "Letter requesting a hearing setting",
    "usedWhen": "A motion has been filed and no hearing has been scheduled after a reasonable time, or the court's procedures ask parties to request a setting in writing. (Many courts set hearings automatically or through a coordinator's phone line — check the local rule first; this letter is for courts that take written requests.)",
    "requiredElements": "Caption + case number; what is pending (motion name + filing date); confirmation that the response time has run or the matter is ready; estimated hearing length; any dates you or the other side are unavailable in the near window; your contact information; statement that a copy went to the other side.",
    "toneRules": "Ask, don't demand. Never suggest the court is slow or at fault (\"Following up on…\" beats \"It has been two months and…\"). ---",
    "skeleton": "Re: [Case caption], Case No. [______]\n\nDear Clerk of the Court:\n\nOn [filing date] I filed [motion name]. The time for a response has\npassed / the matter is ready to be heard. I respectfully request that the\nmotion be set for a hearing.\n\nEstimated time needed: [15/30] minutes. I am unavailable on [dates, if\nany]. The other party is [name/address or attorney], copied below.\n\nPlease let me know the date and time set, or if the Court prefers to\ndecide the motion on the papers.\n\nRespectfully,\n[Signature] — [Printed name], appearing pro se · [Phone] · [Email]\n\nCopy sent to [other party/attorney] on [date] by [method]."
  },
  {
    "id": "comm-template-3",
    "name": "Notice of filing / proof-of-service follow-up",
    "usedWhen": "You filed a document and must put formal proof in the record that the other side was served (the certificate of service filed after a mailing, hand delivery, or e-service), or you are notifying the court and parties that a required document (an ordered report, a financial statement, a proposed order) has been filed or delivered.",
    "requiredElements": "Caption + case number; the document's exact title; the filing date; the service method, date, address used, and the name of the person who served it (for personal service, the server's details and signature — often a separate affidavit form); signature of the filer.",
    "toneRules": "A proof document, not an argument — no summary of what the document says or why it should win. signed affidavit/return of service instead: server name, age/qualification statement per local rule, date/place/person served, and the server's signature — use the court's own form where one exists.)* ---",
    "skeleton": "CERTIFICATE OF SERVICE\n\nI certify that on [date] I served a true copy of [document title], filed\n[file date], on:\n\n  [Name of party/attorney], at [mailing address / email address used],\n  by [U.S. mail, postage prepaid / hand delivery / the court's e-service\n  system].\n\n[Signature] — [Printed name], appearing pro se · [Date]"
  },
  {
    "id": "comm-template-4",
    "name": "Request for a ruling / status inquiry",
    "usedWhen": "A motion was fully briefed and/or heard, the time the judge indicated (or a reasonable period) has passed, and no order has issued. Also used to ask the clerk — not the judge — about the status of something filed.",
    "requiredElements": "Caption + case number; the motion and the date it was filed and heard/ripe; a neutral statement that no order has been received; a polite request that the matter be brought to the judge's attention or the status be confirmed; note of anything time-sensitive riding on the ruling (a deadline, a sale, a school start) stated factually; copy to the other side.",
    "toneRules": "This is the highest-risk letter for tone — one inquiry is diligent, repeated inquiries become pressure. One letter, complete patience afterward. No criticism, no comparison to other cases, no hint that delay is anyone's fault. ---",
    "skeleton": "Re: [Case caption], Case No. [______]\n\nDear Clerk of the Court:\n\nI am writing to inquire about the status of [motion name], which was\nfiled on [date] and [heard on [date] / fully briefed as of [date]]. I\nhave not received an order, and I am writing to confirm nothing further\nis needed from me and to respectfully ask that the matter be brought to\nthe Court's attention when convenient.\n\n[Optional, only if true and factual:] A related deadline — [describe,\ne.g., \"the current temporary orders expire on [date]\"] — makes the\ntiming relevant to both parties.\n\nThank you for your time.\n\nRespectfully,\n[Signature] — [Printed name], appearing pro se · [Phone] · [Email]\n\nCopy sent to [other party/attorney] on [date] by [method]."
  },
  {
    "id": "comm-template-5",
    "name": "Notice of inability to appear",
    "usedWhen": "You cannot attend a scheduled hearing (illness, emergency, work, transport failure). This notice does not move the hearing by itself — in most courts only the judge can continue a setting, and many courts require a motion for continuance instead of, or in addition to, this notice. The notice's real job is to make the absence explained and documented rather than silent, and to ask what the court wants you to do.",
    "requiredElements": "Caption + case number; the hearing date/time and type; the specific reason with documentation attached if it exists (doctor's note, employer letter); when you learned of the conflict; a request — for a continuance to a stated window, or to appear by phone/ video if the court allows it (see the remote-appearance note in the companion docket/remote research file); a phone number where the court can reach you at the time of the hearing; copy to the other side, sent as early as possible.",
    "toneRules": "Send it the moment the problem is known — a notice filed the morning of the hearing (or after) is close to no notice. Apologetic and brief. If the hearing happens without you anyway, the notice plus documentation becomes the core of a later motion to reconsider or set aside what was decided. ---",
    "skeleton": "NOTICE OF INABILITY TO APPEAR AND REQUEST FOR CONTINUANCE\n\nRe: [Case caption], Case No. [______]\n\nI am scheduled to appear on [date] at [time] for [hearing type]. I am\nunable to appear because [specific reason]. I learned of this on [date].\n[Documentation is attached: describe.]\n\nI respectfully request that the hearing be continued to a date after\n[date/window], or, if the Court prefers, that I be permitted to appear\nby telephone/video. I can be reached at the time set at [phone number].\n\nI have sent a copy of this notice to [other party/attorney] on [date] by\n[method].\n\nRespectfully submitted under penalty of perjury [where local practice\nuses verification],\n[Signature] — [Printed name], appearing pro se · [Phone] · [Email]"
  }
];

export const DEADLINE_TYPES: DeadlineType[] = [
  {
    "label": "Response due",
    "key": "response_due",
    "what": "the date by which a party must answer a filing — a response to a motion, an answer to a complaint, objections to a report.",
    "source": "the procedural rules (commonly a set number of days after service, with extra days added for mail service in many rules) or a judge's order shortening/extending it.",
    "ifMissed": "the court may grant the motion unopposed, or enter a default; the other side usually must still ask — missing a response date rarely ends a case by itself, but it frequently decides the motion."
  },
  {
    "label": "Hearing date",
    "key": "hearing_date",
    "what": "the date/time/place (or video link) of a scheduled appearance, with the hearing type (motion hearing, trial, review).",
    "source": "the notice of hearing issued by the clerk or set by the judge in court.",
    "ifMissed": "the failure-to-appear cascade — the motion can be denied or granted against the absent side, orders can be entered, and in criminal/traffic matters a bench warrant can issue."
  },
  {
    "label": "Service deadline",
    "key": "service_deadline",
    "what": "the last date by which a party must be formally served — with the initial complaint (rules commonly allow a set window, often around 90 days in federal practice and varying periods in state courts) or with a contempt motion requiring personal service before its hearing.",
    "source": "the rules of procedure, counted from filing.",
    "ifMissed": "the case (or the contempt hearing) can be dismissed or continued regardless of the merits — the classic trap flagged in the motion catalog for contempt and eviction-stay matters."
  },
  {
    "label": "Appeal window",
    "key": "appeal_window",
    "what": "the short, hard deadline to file a notice of appeal after a judgment or appealable order — commonly measured in weeks (frequently around 30 days from the order in many state courts; shorter in some landlord-tenant and small-claims tracks).",
    "source": "statute/appellate rules. Unlike most deadlines, appeal windows are generally jurisdictional: the trial court usually cannot extend them, and a late notice is simply ineffective no matter how good the excuse.",
    "ifMissed": "the order becomes final and unreviewable on appeal; remaining options narrow to extraordinary relief."
  },
  {
    "label": "Payment / compliance deadline",
    "key": "compliance_due",
    "what": "a date by which an order must be obeyed — support paid, property exchanged, a class completed, a document produced (the \"purge\" date in contempt is this type).",
    "source": "",
    "ifMissed": "enforcement and contempt exposure (see the contempt simulation above); documented partial compliance is materially better than silence."
  },
  {
    "label": "Discovery / disclosure deadline",
    "key": "discovery_due",
    "what": "dates by which discovery responses, disclosures, and exhibit/witness exchanges are due under the rules or a scheduling order.",
    "source": "",
    "ifMissed": "responses can be compelled, objections can be waived, and evidence can be excluded — the compel-discovery simulation above turns on these dates. (court order vs. rule vs. letter request) because they are not equally hard; appeal windows and personal-service deadlines get the strongest warnings, since those are the ones that cannot be fixed after the fact. --- End of Part B. Part A entries: 10 motions. Part B: 5 templates, 1 comms-log model, 6 deadline types."
  }
];

export function deadlineType(key: string): DeadlineType | undefined {
  return DEADLINE_TYPES.find((d) => d.key === key);
}
