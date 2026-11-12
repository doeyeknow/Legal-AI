// Simulated-hearing bank — converted from
// research_notes/legal-hearing-sim-and-comms.md Part A. Practice
// questions are the questions judges commonly ask about these motions;
// no simulation can predict a specific judge. General information,
// not legal advice.

export interface SimQuestion {
  question: string;
  /** What the judge is really testing with this question. */
  testing: string;
}

export interface SimBank {
  motionId: string;
  name: string;
  questions: SimQuestion[];
  outline: string[];
  mistakes: string[];
}

export interface Etiquette {
  address: string[];
  speaking: string[];
  bring: string[];
  flow: string[];
}

export const ETIQUETTE: Etiquette = {
  "address": [
    "Address the judge as \"Your Honor.\" Address everyone else formally (Mr./Ms. + last name); never use first names, and never call the other party by a nickname or label (\"my ex,\" \"the landlord from hell\").",
    "Stand when the judge enters and leaves if the courtroom does so, and stand when you are speaking unless the judge tells you to sit. In many smaller courts this is relaxed — mirror what others in the room do, and when in doubt, stand."
  ],
  "speaking": [
    "Speak only when the judge invites you to, or when it is clearly your turn. Never interrupt the judge — even to correct a mistake. Wait for a pause, then: \"Your Honor, may I clarify one fact?\"",
    "The movant (the person who filed the motion) usually speaks first, the other side responds, and the movant may get a short reply. Expect that order and save your strongest point for your opening — you may not get a long reply.",
    "Answer the question that was asked, then stop. Judges decide on narrow points; wandering into the whole history of the dispute is the single most common way pro se speakers lose a judge's attention.",
    "If you don't know, say so: \"I don't know, Your Honor, but I can provide that by [date].\" Guessing under pressure is worse than admitting a gap.",
    "Never argue with the other party directly. Everything you say goes to the judge: \"Your Honor, the dates in their response are different from the lease, which shows…\" — not \"You're lying.\""
  ],
  "bring": [
    "Three copies of everything you filed and anything you plan to hand the judge: one for the judge, one for the other side, one for you. Courts commonly refuse to look at material the other side hasn't seen.",
    "Your filed motion with the certificate of service, proof of any facts you will state (pay stubs, texts printed out, photos with dates, receipts), a one-page timeline of key dates, a notepad, and the notice of hearing.",
    "Arrive early enough to check in with the clerk or bailiff, watch at least one case before yours if you can, and silence your phone. Dress as you would for a job interview; remove hats and sunglasses indoors.",
    "If children are involved in the case, do not bring them unless the court ordered their presence."
  ],
  "flow": [
    "Judge calls the case by name and number; both sides state their names for the record.",
    "Judge says what the motion is and often states the issue in one sentence.",
    "Movant explains: what happened, what rule or change supports relief, what exactly you are asking the court to order.",
    "Other side responds. Judge asks questions of both sides — those questions often signal what the decision turns on.",
    "Judge rules from the bench or takes it \"under advisement\" and issues a written order later. If you win, the judge may ask you to draft the proposed order — bring one, filled in, to hand up.",
    "Before leaving: confirm the next date, any deadlines the judge set, and who is responsible for preparing the written order. Write them down. ---"
  ]
};

export const SIM_BANKS: SimBank[] = [
  {
    "motionId": "continuance",
    "name": "Continuance",
    "questions": [
      {
        "question": "What is the reason you need more time — specifically?",
        "testing": "whether the reason is concrete and serious (illness, a witness is unavailable, new evidence just surfaced) versus vague (\"I'm not ready\")."
      },
      {
        "question": "When did you learn about the problem?",
        "testing": "diligence. A problem known for a month and raised the day before the hearing reads as delay, not need."
      },
      {
        "question": "How much time are you asking for — a specific date or length?",
        "testing": "whether you have a real plan, and whether the request is the minimum needed rather than open-ended."
      },
      {
        "question": "What have you done so far to prepare?",
        "testing": "good faith — filings made, subpoenas sent, experts contacted. Judges reward visible effort and punish drift."
      },
      {
        "question": "Have you ever asked for a continuance in this case before?",
        "testing": "pattern. A second or third request faces steep skepticism unless something genuinely new happened."
      },
      {
        "question": "Does the other side agree or object? Did you ask them first?",
        "testing": "courtesy and the local-rule requirement (in many courts) to confer before filing. Agreement makes granting far easier."
      },
      {
        "question": "How would this delay harm the other side — or the case itself?",
        "testing": "prejudice: fading witnesses, a child waiting on a decision, a trial setting other cases were bumped for."
      }
    ],
    "outline": [
      "Lead with the specific, dated fact: \"My retained expert received the records on [date] and cannot complete the report before [date].\"",
      "Show the paper trail: when the problem arose, what you did immediately, whom you contacted (attach confirmations if you have them).",
      "Ask for a specific, short new date and show it is enough: \"Thirty days puts the report in hand two weeks before the new setting.\"",
      "Address harm head-on: name the prejudice the other side claims and answer it (\"their witnesses are all documentary; nothing is lost in 30 days\").",
      "Offer a condition if needed: \"I will exchange all exhibits by [earlier date] and take no further continuances on this issue.\""
    ],
    "mistakes": [
      "Filing (or first mentioning it) the morning of the hearing when the problem was known weeks earlier.",
      "Asking for \"a continuance\" with no specific length or new date in mind.",
      "Blaming the court, the other side, or \"the system\" instead of stating a neutral, documented reason. ---"
    ]
  },
  {
    "motionId": "extension-of-time",
    "name": "Extension of time",
    "questions": [
      {
        "question": "What deadline are you asking to move, and to what date?",
        "testing": "precision. Judges grant dates, not vibes — know the current deadline, the rule that sets it, and your proposed new date."
      },
      {
        "question": "Why couldn't this be done in the original time?",
        "testing": "whether the reason is external (late service, documents held by a third party, illness) or simple inattention."
      },
      {
        "question": "Is the deadline jurisdictional or set by rule/order I can change?",
        "testing": "whether the court even has power to grant it — some deadlines (notably many appeal deadlines) cannot be extended by the trial court, and the judge is checking that you understand which this is."
      },
      {
        "question": "Did you ask the other side to agree first?",
        "testing": "conferral. Many courts require it, and an agreed extension is often signed without a hearing at all."
      },
      {
        "question": "Is this the first extension in this case?",
        "testing": "pattern of delay."
      },
      {
        "question": "What will be filed at the end of this extension — and is the work started?",
        "testing": "that the document substantially exists in draft, not that you hope to begin."
      }
    ],
    "outline": [
      "Name the deadline, its source (rule number or order date), and the exact new date requested — keep it as short as the reason honestly allows.",
      "Give the cause in one verifiable sentence and attach proof if it exists (a medical note, a records-request receipt, the late-served document).",
      "State what is already done: \"The response is drafted except for the records from [agency], requested on [date], expected [date].\"",
      "Note conferral: \"I contacted opposing counsel on [date]; they do not object / object because…, and my answer is…\"",
      "Close with a no-more-asking commitment where honest: \"No further extensions will be needed on this deadline.\""
    ],
    "mistakes": [
      "Filing the motion after the deadline has already passed without acknowledging that and explaining it up front (courts call the late version \"excusable neglect\" territory — hiding the lateness is fatal to credibility).",
      "Asking for 60 or 90 days for a task judges know takes two weeks.",
      "Treating an extension of one deadline as moving every deadline in the case — judges usually move only the date named. ---"
    ]
  },
  {
    "motionId": "modify-child-support",
    "name": "Modify child support",
    "questions": [
      {
        "question": "What has changed since the current order was entered?",
        "testing": "the threshold requirement in nearly every state — a material/substantial change in circumstances (job loss, big income change, custody change, a child's changed needs). No change, no modification."
      },
      {
        "question": "What is your current income — and what proof do you have with you?",
        "testing": "evidence, not estimates. Expect to hand up pay stubs, a termination letter, tax returns, or benefit statements."
      },
      {
        "question": "What is the other parent's income, as best you know?",
        "testing": "both sides of the guideline calculation. If the other parent is voluntarily unemployed or underemployed, expect the follow-up: \"Should I base their income on what they can earn?\""
      },
      {
        "question": "Has anything changed about where the child lives or the time split?",
        "testing": "the custody-timeshare input to the guideline, which can move support as much as income does."
      },
      {
        "question": "Are there new costs — childcare, health insurance, medical, school?",
        "testing": "the guideline add-ons and deviations; judges want receipts and premium amounts, not totals from memory."
      },
      {
        "question": "When do you say the change happened — and are you asking me to go back to that date?",
        "testing": "retroactivity. In most states a modification can only reach back to when the motion was filed/served — arrears already owed under the old order usually cannot be erased."
      },
      {
        "question": "Is there an existing arrears balance, and what is happening with it?",
        "testing": "whether you are really asking to reduce future support or quietly asking to forgive the past — two different things."
      }
    ],
    "outline": [
      "Open with the change, dated and documented: \"I was laid off on [date]; my income went from $X to $Y. Termination letter and last pay stub are Exhibit A.\"",
      "Run the guideline yourself before the hearing: present a completed child-support worksheet with each parent's numbers and the resulting figure — judges respond well to a movant who did the math.",
      "Separate the buckets cleanly: income change, timeshare change, add-on costs — with one exhibit per bucket.",
      "State the exact order requested: new monthly amount, effective date (ordinarily the filing/service date), and how arrears are handled (unchanged, on a payment plan).",
      "Address the child's needs last and briefly: the change still covers the child's documented costs, and how."
    ],
    "mistakes": [
      "Arguing the original order was unfair instead of proving a change since it was entered — that was the appeal's job, and its window has usually closed.",
      "Bringing no income documentation and asking the judge to take your word for earnings — for either parent.",
      "Stopping payments (or paying less) on your own before the court modifies the order. The old amount keeps accruing as arrears until a judge changes it, no matter how fair the reason feels. ---"
    ]
  },
  {
    "motionId": "modify-custody",
    "name": "Modify custody",
    "questions": [
      {
        "question": "What has materially changed since the current custody order?",
        "testing": "the threshold gate. In most states custody orders are not revisited without a substantial change affecting the child."
      },
      {
        "question": "How is the current arrangement harming the child — concretely?",
        "testing": "child-focused evidence (school records, missed exchanges, medical or safety facts) versus parent-focused grievances."
      },
      {
        "question": "What exact schedule are you proposing?",
        "testing": "specificity and workability — days, times, exchange place, holidays, transportation. \"More time\" is not a plan."
      },
      {
        "question": "What have you done to try to work this out with the other parent?",
        "testing": "cooperation and whether mediation (required before custody hearings in many courts) happened or was attempted."
      },
      {
        "question": "How will this change affect the child's school, activities, and relationship with the other parent?",
        "testing": "best-interests analysis — continuity for the child and willingness to foster the other parent's relationship both weigh heavily."
      },
      {
        "question": "Is there any safety issue — violence, substance use, neglect — and what is your proof?",
        "testing": "whether the claim is documented (police reports, protective orders, test results) or asserted. Judges treat undocumented safety claims cautiously and documented ones very seriously."
      },
      {
        "question": "What does the child want?\" (only if the child is older)",
        "testing": "the child's preference is one factor among many in most states, weighed by age and maturity — and judges watch hard for coaching. Expect this to be handled by interview or report, not by the child testifying in open court."
      }
    ],
    "outline": [
      "Threshold first: one or two dated, documented changes (a parent's move, a job/schedule change, the child's school change, repeated denial of court-ordered time).",
      "Translate every change into an effect on the child, with the child's records as exhibits (attendance, grades, exchange log).",
      "Present the proposed plan as a complete calendar — weekly schedule, holidays, exchanges, transportation, communication rules — so the judge could sign it as written.",
      "Show your problem-solving: mediation dates, the written proposals you sent, what you accepted and what remains disputed.",
      "Close with the other parent's role in your plan: how your proposal protects the child's time with them, which signals the best-interests mindset judges are listening for."
    ],
    "mistakes": [
      "Making the hearing about the other parent's character (\"she's a bad mother\") instead of documented effects on the child.",
      "Asking for a change with no concrete proposed schedule — the judge cannot order a feeling.",
      "Involving the child: bringing them to court uninvited, showing the judge messages the child was made to send, or reporting what the child \"told you to say.\" ---"
    ]
  },
  {
    "motionId": "contempt",
    "name": "Family contempt / enforcement",
    "questions": [
      {
        "question": "Show me the exact order — which paragraph was violated?",
        "testing": "whether there is a clear, specific, written order. Contempt fails on vague orders; the judge is reading the text, not your summary of it."
      },
      {
        "question": "What exactly did the other party do or fail to do, and when?",
        "testing": "a violation-by-violation accounting (dates, amounts, missed exchanges), not a general claim of non-cooperation."
      },
      {
        "question": "Did the other party know about the order?",
        "testing": "notice — service or presence in court when it was issued. Contempt requires proof the person knew what was ordered."
      },
      {
        "question": "Could they have complied — did they have the ability?",
        "testing": "the central defense. Inability to comply (no money, no job, medical incapacity) defeats contempt; judges probe finances and efforts hard here, and the person accused usually must show their proof."
      },
      {
        "question": "What do you want me to do about it?",
        "testing": "whether your requested remedy is lawful and proportionate: compliance by a date certain, make-up time, payment of arrears on a schedule, attorney's fees — or jail as a coercive last resort (civil contempt) or punishment (criminal contempt, which carries criminal-trial protections in most places)."
      },
      {
        "question": "Have you served this motion on the other party personally?",
        "testing": "jurisdiction over the person. Contempt — especially anything that could end in jail — usually requires personal service, and judges check the certificate before anything else. (This is the filing trap flagged in the motion catalog.)"
      }
    ],
    "outline": [
      "Attach the order and number its paragraphs; build a table: order paragraph → what was required → what happened → date → your proof.",
      "Prove notice: the service record or the hearing at which the person was present and handed the order.",
      "Anticipate the ability defense with facts you can show (their recent purchases, employment, statements), while keeping your own hands clean: state what you did to enable compliance (sent the information, were available for exchanges).",
      "Ask for remedies in order: compliance by a date certain, make-up time/payments, your costs — and frame any jail request as suspended provided they comply (\"purge\"), which is how judges prefer to use it.",
      "Keep tone flat and factual. Contempt hearings are won on documents."
    ],
    "mistakes": [
      "Asking for contempt over an order that is genuinely ambiguous — judges will clarify the order instead of punishing anyone, and credibility is spent.",
      "Mixing old, already-litigated violations with new ones, or piling on grievances that no paragraph of the order covers.",
      "Serving the contempt motion by ordinary mail/email when personal service is required — the hearing gets continued or dismissed regardless of the merits. ---"
    ]
  },
  {
    "motionId": "vacate-default-judgment",
    "name": "Vacate a default judgment",
    "questions": [
      {
        "question": "Were you served with the lawsuit — yes or no, and how do you say it happened?",
        "testing": "the strongest ground first. If service was defective (wrong person, wrong address, no service at all), the judgment may be void regardless of everything else. The judge is examining the return of service against your account."
      },
      {
        "question": "If you were served, why didn't you respond in time?",
        "testing": "the classic standard — mistake, inadvertence, surprise, or excusable neglect. Judges are listening for a real, documented reason (hospitalization, mail failure, being misled), not \"I was busy\" or \"I ignored it hoping it would go away.\""
      },
      {
        "question": "How quickly did you act after you learned about the judgment?",
        "testing": "diligence after discovery. Days-to-weeks reads as serious; months of sitting on it usually ends the inquiry. Note many rules impose hard outer deadlines (commonly measured in months, and longer only for void judgments)."
      },
      {
        "question": "If I reopen this, what is your defense to the underlying claim?",
        "testing": "the meritorious-defense requirement in most courts — you generally must show the case is actually worth reopening, often by attaching the answer you would file."
      },
      {
        "question": "How would reopening this prejudice the other side?",
        "testing": "reliance and delay harm — money already collected and spent, evidence gone cold, third parties who bought property."
      },
      {
        "question": "Is money already being collected — wages garnished, accounts levied?",
        "testing": "urgency and whether a temporary stay of enforcement is needed while the motion is decided."
      }
    ],
    "outline": [
      "Pick your ground and lead with it in the legal order: (a) no valid service → judgment void; (b) excusable neglect + prompt action + meritorious defense — the three-part package most rules require together.",
      "Build a dated timeline: when the suit was filed, what the service return claims, what actually happened, when you first learned of the judgment (garnishment notice, bank freeze, letter), and every step you took after.",
      "Attach the proposed answer/response you would file if reopened — judges routinely require it, and it proves the defense is real.",
      "Ask for the full remedy expressly: vacate the judgment, stay/quash any garnishment or execution in the meantime, and set a deadline for your response to the complaint.",
      "If any part of the delay was your fault, concede it in one sentence and return to the documented excuse — candor is the currency this motion runs on."
    ],
    "mistakes": [
      "Filing the motion but not attaching a proposed answer — in many courts the meritorious-defense showing is mandatory, not optional.",
      "Attacking the underlying claim (\"the debt isn't mine\") while skipping the threshold questions of service and excuse, which are decided first.",
      "Waiting after learning of the judgment — every week of post-knowledge delay is Exhibit A against you. ---"
    ]
  },
  {
    "motionId": "stay-eviction",
    "name": "Stay of eviction",
    "questions": [
      {
        "question": "What stage is the eviction at — has judgment been entered, and has a writ been issued?",
        "testing": "posture and power. A stay is very different before judgment (still litigating) than after a writ of possession/restitution has issued and the sheriff is scheduled — and in several states the stay does nothing until a copy reaches the sheriff, as the motion catalog flags."
      },
      {
        "question": "On what ground should I pause this — payment, a defense, or hardship?",
        "testing": "which of the recognized bases you are claiming: rent tendered/cured, a defect in the eviction process, a pending appeal or related case, or short-term hardship (illness, children, a confirmed new home days away)."
      },
      {
        "question": "How much rent is owed, and what can you pay today?",
        "testing": "money on the table. Many courts condition a stay on paying rent into the court registry going forward; arriving with a concrete payment changes the hearing."
      },
      {
        "question": "How long a stay are you asking for — a specific date?",
        "testing": "proportionality. Stays are measured in days or a few weeks; an open-ended request signals the wrong ask."
      },
      {
        "question": "What is your move-out plan if I grant (or deny) this?",
        "testing": "realism — a signed lease elsewhere, family housing, storage arranged. Judges grant time to execute a plan, not to avoid one."
      },
      {
        "question": "Have you ever had a stay or continuance in this case before?",
        "testing": "pattern; second stays are rare and need new facts."
      },
      {
        "question": "Is the landlord present, and what is their position?",
        "testing": "agreement — a landlord-consented stay with a move-out date is routinely signed on the spot."
      }
    ],
    "outline": [
      "State the posture in one line: judgment date, writ status, the date the sheriff is set to act, and the exact stay length requested (a calendar date, not \"a few weeks\").",
      "Put money first if money is part of it: amount in hand today, amount to be paid into the registry on each due date during the stay.",
      "Give the ground in the court's terms: cure/payment, a process defect (with the document), or hardship with documents (medical letter, new lease with a start date).",
      "Show the exit plan by date: where you will live, when movers/storage are booked, what happens on the final day (keys surrendered, unit empty and cleaned).",
      "Address delivery mechanics: ask for a signed copy before you leave and get it to the sheriff/marshal and the landlord the same day — in many places the stay is only effective once served."
    ],
    "mistakes": [
      "Filing the stay and assuming the eviction stops on its own — in several states the sheriff acts on the writ until the sheriff personally receives the stay order.",
      "Asking for hardship time with no documents and no move-out plan.",
      "Missing that rent for the stay period is usually still owed and often must be paid into court — silence about money reads as asking to stay for free, which judges rarely grant. ---"
    ]
  },
  {
    "motionId": "compel-discovery",
    "name": "Compel discovery",
    "questions": [
      {
        "question": "What exactly did you ask for, and when?",
        "testing": "that real discovery was served — the judge will look at the requests themselves and the service date against the response deadline in the rules."
      },
      {
        "question": "What did you actually receive, and what is still missing — item by item?",
        "testing": "specificity. \"They won't cooperate\" loses; \"Interrogatory 6 unanswered; Requests for Production 3, 4, and 7 answered 'will produce' on [date] with nothing produced since\" wins."
      },
      {
        "question": "Did you try to resolve this before filing — show me.",
        "testing": "the meet-and-confer requirement. Most courts require a good-faith conference (and many require a certification in the motion); judges ask for the letters/emails and what was said."
      },
      {
        "question": "Why do you need these items — what issue in the case do they prove?",
        "testing": "relevance and proportionality. Judges prune fishing expeditions and protect privileged or overly burdensome material; be ready to tie each category to an element or a defense."
      },
      {
        "question": "What is the other side's stated reason for not producing?",
        "testing": "the objections themselves — boilerplate objections are commonly overruled; specific privilege claims get a different analysis (and sometimes in camera review)."
      },
      {
        "question": "What order do you want, exactly — and by when?",
        "testing": "a compellable remedy: production by a date certain, overruled objections listed by number, and — if you want them — sanctions or fees (which usually require a showing that the refusal was unjustified)."
      },
      {
        "question": "How does this affect the case schedule?",
        "testing": "whether deadlines (discovery cutoff, trial) need to move in step with the order, so the victory isn't hollow."
      }
    ],
    "outline": [
      "Exhibit the discovery, the proof of service, and a one-page chart: request → due date → response received → what's missing.",
      "Prove conferral: dated letter/email identifying the deficiencies and giving a deadline, and any reply. Quote their objections verbatim.",
      "Argue relevance in one line per category, tied to the claims/defenses in the pleadings — not to everything you might someday want.",
      "Ask for a precise order: items by number, production deadline (14–30 days is the common ask), objections overruled by number, and fees only if the record shows unjustified refusal.",
      "Offer the reciprocal: confirm your own discovery is complete — judges check, and an unclean movant loses the room fast."
    ],
    "mistakes": [
      "Filing to compel before the response deadline has actually run, or without the required conferral/certification — the motion gets denied on procedure regardless of merits.",
      "Asking to compel \"all discovery\" instead of itemized requests and objections.",
      "Using a discovery motion to relitigate the whole case; judges decide these narrowly, item by item. ---"
    ]
  },
  {
    "motionId": "temporary-orders",
    "name": "Temporary orders",
    "questions": [
      {
        "question": "What is urgent — why can't this wait for the final hearing?",
        "testing": "the defining feature of temporary relief. Judges protect the status quo and children's stability; novelty or strategy is not urgency."
      },
      {
        "question": "What is the situation right now — where do the children live, who pays what, today?",
        "testing": "the status quo baseline, because temporary orders usually preserve it unless change is necessary."
      },
      {
        "question": "What are the current finances — both sides, with documents?",
        "testing": "temporary support and bill-paying orders are built from sworn financial statements/pay evidence. Undocumented claims get little weight at this stage."
      },
      {
        "question": "Are there any safety concerns I need to address today?",
        "testing": "whether protective terms (supervised exchange, no-contact, exclusive use of the home) belong in the temporary order. Documented facts only carry this."
      },
      {
        "question": "Exactly what orders do you want me to sign today — read them to me.",
        "testing": "draftsmanship. Temporary-order hearings are fast; the side that hands up a complete, specific proposed order (schedule, amounts, who pays which bill, exchange logistics) usually shapes the result."
      },
      {
        "question": "How long until the final hearing, and will these terms work until then?",
        "testing": "durability — temporary orders can govern a family for many months, so judges test whether the terms are livable, not just winnable."
      }
    ],
    "outline": [
      "One paragraph of urgency: the specific, near-term harm or instability the order prevents (a move-out date, a school enrollment, unpaid mortgage, a child without a set schedule).",
      "Status quo snapshot with documents: current living arrangement, timeshare in practice, both incomes, the household bills by name and amount.",
      "Present the proposed temporary order as a finished document: parenting schedule by day and hour, support figure with its worksheet, bill assignments, exchange and communication rules, and a review/final- hearing date.",
      "Keep asks conservative: terms you can live under for months signal good faith and are more likely to be signed as written.",
      "Say what you are not asking the court to decide today (property division, final custody) — judges reward parties who respect the hearing's limited purpose."
    ],
    "mistakes": [
      "Treating the temporary hearing as the full trial — bringing every grievance instead of the two or three decisions that cannot wait.",
      "Inflating expenses or understating income on the financial statement; these are usually sworn, and a credibility loss here follows the case.",
      "Arriving without a written proposed order — the hearing ends with the other side's draft as the starting point. ---"
    ]
  },
  {
    "motionId": "fee-waiver",
    "name": "Fee waiver",
    "questions": [
      {
        "question": "What is your household income, and from what sources?",
        "testing": "the core eligibility facts. Expect to walk through the sworn financial statement line by line — the judge compares it against common eligibility lines (many courts use a multiple of the federal poverty guidelines or receipt of means-tested benefits as a fast track)."
      },
      {
        "question": "Do you receive any means-tested benefits?\" (SNAP/food assistance, SSI, TANF, Medicaid, public housing)",
        "testing": "the shortcut — in many courts, proof of a means-tested benefit qualifies a filer with little more inquiry."
      },
      {
        "question": "What are your essential monthly expenses?",
        "testing": "whether, after rent, utilities, food, and necessary transport, anything is actually left to pay the fee — the real test is ability to pay without choosing between the fee and necessities."
      },
      {
        "question": "Do you have savings, accounts, or property you could use?",
        "testing": "assets, not just income. A modest bank balance above the fee amount is the most common reason for denial or for a partial waiver/payment plan."
      },
      {
        "question": "Has a fee waiver been denied to you in this or another case recently?",
        "testing": "changed circumstances since any prior denial — if nothing changed, the answer usually won't either."
      },
      {
        "question": "What fee are you asking to waive, and what happens to your case if you must pay it?",
        "testing": "concreteness — the filing fee amount, and whether you would genuinely be kept from court (many courts will instead set a reduced fee or installments; expect that offer)."
      }
    ],
    "outline": [
      "File the court's own financial form completely and consistently: income, benefits, household size, expenses, assets — the judge's questions are the form's lines, and mismatches between the form and your answers are the main credibility risk.",
      "Bring proof for the two or three biggest lines: benefit award letter, pay stub or lack-of-income explanation, rent amount/lease, bank balance.",
      "If you receive a means-tested benefit, lead with it and hand up the award letter.",
      "State the fee and the consequence plainly: \"The filing fee is $[amount]. After rent and utilities, my household has $[amount] a month; paying it would leave us short on [necessity].\"",
      "If a full waiver is not granted, be ready to accept and propose the fallback: a reduced fee or installments with specific amounts and dates."
    ],
    "mistakes": [
      "Leaving fields blank or writing \"N/A\" across the financial statement — judges read gaps as concealment and may deny or continue the hearing.",
      "Numbers that contradict each other (income lower than rent with no explanation of the gap) without a one-sentence explanation ready (family help, savings being spent down — say it before being asked).",
      "Dressing or spending in ways that visibly undercut the claim during the hearing itself; judges notice, fairly or not. ---"
    ]
  }
];

export function simBank(motionId: string): SimBank | undefined {
  return SIM_BANKS.find((b) => b.motionId === motionId);
}
