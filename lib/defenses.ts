// Defense guide: the most common, legitimate ways criminal charges get
// dismissed, reduced, or weakened — with how to raise each one, the
// deadline that usually applies, and where the rule comes from.
//
// Client-safe static data (no server imports), like lib/motions.
// General legal information, NOT legal advice. U.S. constitutional
// protections apply in every state; deadlines, procedures, and many
// defenses vary by state, so state-specific items say to check the
// reader's own court rules. Every entry tells the reader to confirm
// with a lawyer or public defender.

export type ChargeKind =
  | 'dui' | 'traffic' | 'drugs' | 'theft' | 'assault' | 'dv' | 'weapons'
  | 'fraud' | 'public' | 'court' | 'other';

export const CHARGE_KINDS: { key: ChargeKind; label: string; hint: string }[] = [
  { key: 'dui', label: 'DUI / impaired driving', hint: 'DUI, extreme DUI, drugged driving' },
  { key: 'traffic', label: 'Other traffic crime', hint: 'Suspended license, reckless driving, leaving the scene' },
  { key: 'drugs', label: 'Drugs', hint: 'Possession, paraphernalia, sale or transport' },
  { key: 'theft', label: 'Theft or property', hint: 'Shoplifting, burglary, trespass, criminal damage' },
  { key: 'assault', label: 'Assault or fighting', hint: 'Assault, aggravated assault, threatening' },
  { key: 'dv', label: 'Domestic violence', hint: 'Any charge marked DV, or an order-of-protection violation' },
  { key: 'weapons', label: 'Weapons', hint: 'Prohibited possessor, misconduct with a weapon' },
  { key: 'fraud', label: 'Fraud or false statements', hint: 'Forgery, ID theft, false reporting' },
  { key: 'public', label: 'Disorderly or public order', hint: 'Disorderly conduct, resisting, obstructing' },
  { key: 'court', label: 'Failure to appear / court order', hint: 'FTA, violating release conditions' },
  { key: 'other', label: 'Something else', hint: 'Not sure, or not on this list' },
];

export type DefenseCategory =
  | 'Police stop and search'
  | 'Statements and questioning'
  | 'Evidence and disclosure'
  | 'Deadlines and delay'
  | 'Charging and court process'
  | 'The facts of the charge'
  | 'Justification defenses'
  | 'DUI-specific'
  | 'Ways out without a trial';

export const DEFENSE_CATEGORIES: DefenseCategory[] = [
  'Police stop and search',
  'Statements and questioning',
  'Evidence and disclosure',
  'Deadlines and delay',
  'Charging and court process',
  'The facts of the charge',
  'Justification defenses',
  'DUI-specific',
  'Ways out without a trial',
];

export interface DefenseSource { label: string; url: string }

export interface DefenseDef {
  id: string;
  name: string;
  category: DefenseCategory;
  /** What winning this usually gets you, in a few words. */
  outcome: string;
  /** One-paragraph plain-English explanation. */
  summary: string;
  /** Signs it might apply to your case. */
  whenItApplies: string[];
  /** Concrete steps to raise it. */
  howToRaise: string[];
  /** The deadline or timing rule that usually applies. */
  timing: string;
  /** What to collect now, before it disappears. */
  evidence: string[];
  /** Honest limits: when it will not work, or what it will not do. */
  limits: string[];
  /** Charge kinds it fits; 'all' for any criminal charge. */
  charges: ChargeKind[] | 'all';
  /** Motion templates in the library that raise it. */
  motionIds: string[];
  sources: DefenseSource[];
}

// ------------------------------------------------------------------
// Sources (official text wherever possible)
// ------------------------------------------------------------------
const S = {
  sixth: { label: 'U.S. Constitution, Sixth Amendment — speedy trial, notice, and counsel', url: 'https://constitution.congress.gov/constitution/amendment-6/' },
  fourth: { label: 'U.S. Constitution, Fourth Amendment — searches and seizures', url: 'https://constitution.congress.gov/constitution/amendment-4/' },
  fifth: { label: 'U.S. Constitution, Fifth Amendment — self-incrimination and grand jury', url: 'https://constitution.congress.gov/constitution/amendment-5/' },
  fourteenth: { label: 'U.S. Constitution, Fourteenth Amendment — due process', url: 'https://constitution.congress.gov/constitution/amendment-14/' },
  stateCourts: { label: 'State court websites directory — find your court, rules, and clerk', url: 'https://www.ncsc.org/information-and-resources/state-court-websites' },
  limitations: { label: 'Statutes of limitation — general background', url: 'https://www.law.cornell.edu/wex/statute_of_limitations' },
  selfdef: { label: 'Self-defense — general background', url: 'https://www.law.cornell.edu/wex/self-defense' },
  entrap: { label: 'Entrapment — general background', url: 'https://www.law.cornell.edu/wex/entrapment' },
  corpus: { label: 'Corpus delicti — general background', url: 'https://www.law.cornell.edu/wex/corpus_delicti' },
  barker: { label: 'Barker v. Wingo, 407 U.S. 514 (1972)', url: 'https://supreme.justia.com/cases/federal/us/407/514/' },
  trombetta: { label: 'California v. Trombetta, 467 U.S. 479 (1984)', url: 'https://supreme.justia.com/cases/federal/us/467/479/' },
  dusky: { label: 'Dusky v. United States, 362 U.S. 402 (1960)', url: 'https://supreme.justia.com/cases/federal/us/362/402/' },
  winship: { label: 'In re Winship, 397 U.S. 358 (1970)', url: 'https://supreme.justia.com/cases/federal/us/397/358/' },
  terry: { label: 'Terry v. Ohio, 392 U.S. 1 (1968)', url: 'https://supreme.justia.com/cases/federal/us/392/1/' },
  rodriguez: { label: 'Rodriguez v. United States, 575 U.S. 348 (2015)', url: 'https://supreme.justia.com/cases/federal/us/575/348/' },
  mapp: { label: 'Mapp v. Ohio, 367 U.S. 643 (1961)', url: 'https://supreme.justia.com/cases/federal/us/367/643/' },
  gant: { label: 'Gant, 556 U.S. 332 (2009) — vehicle searches after arrest', url: 'https://supreme.justia.com/cases/federal/us/556/332/' },
  riley: { label: 'Riley v. California, 573 U.S. 373 (2014)', url: 'https://supreme.justia.com/cases/federal/us/573/373/' },
  franks: { label: 'Franks v. Delaware, 438 U.S. 154 (1978)', url: 'https://supreme.justia.com/cases/federal/us/438/154/' },
  miranda: { label: 'Miranda warnings, 384 U.S. 436 (1966)', url: 'https://supreme.justia.com/cases/federal/us/384/436/' },
  edwards: { label: 'Edwards, 451 U.S. 477 (1981) — questioning after asking for counsel', url: 'https://supreme.justia.com/cases/federal/us/451/477/' },
  manson: { label: 'Manson v. Brathwaite, 432 U.S. 98 (1977)', url: 'https://supreme.justia.com/cases/federal/us/432/98/' },
  brady: { label: 'Brady v. Maryland, 373 U.S. 83 (1963)', url: 'https://supreme.justia.com/cases/federal/us/373/83/' },
  youngblood: { label: 'Youngblood, 488 U.S. 51 (1988) — lost evidence and bad faith', url: 'https://supreme.justia.com/cases/federal/us/488/51/' },
  mcneely: { label: 'Missouri v. McNeely, 569 U.S. 141 (2013)', url: 'https://supreme.justia.com/cases/federal/us/569/141/' },
  birchfield: { label: 'Birchfield v. North Dakota, 579 U.S. 438 (2016)', url: 'https://supreme.justia.com/cases/federal/us/579/438/' },
  gideon: { label: 'Gideon v. Wainwright, 372 U.S. 335 (1963)', url: 'https://supreme.justia.com/cases/federal/us/372/335/' },
  roviaro: { label: 'Roviaro v. United States, 353 U.S. 53 (1957)', url: 'https://supreme.justia.com/cases/federal/us/353/53/' },
  blockburger: { label: 'Blockburger v. United States, 284 U.S. 299 (1932)', url: 'https://supreme.justia.com/cases/federal/us/284/299/' },
};

export const DEFENSE_DISCLAIMER =
  'General legal information, not legal advice. Constitutional protections apply nationwide, but deadlines, procedures, diversion, expungement, and many defenses vary by state. These are real, commonly used ways charges get dismissed or reduced, but whether one fits depends on facts a lawyer needs to see. If you cannot afford a lawyer, ask the court for a public defender at your first appearance — it is your right, and these are exactly the issues they look for.';

// ------------------------------------------------------------------
// The database
// ------------------------------------------------------------------
export const DEFENSES: DefenseDef[] = [
  // ---------------- Police stop and search ----------------
  {
    id: 'illegal-stop',
    name: 'The stop was illegal',
    category: 'Police stop and search',
    outcome: 'Everything found because of the stop can be thrown out — often the end of the case',
    summary:
      'Police need at least reasonable suspicion — specific facts, not a hunch — to stop you on the street or pull your car over. If the stop itself was not justified, the evidence that came from it (drugs, a breath test, statements, an ID check that revealed a warrant) can be suppressed. When the State has nothing left to prove the charge, it usually has to dismiss.',
    whenItApplies: [
      'The officer gave no reason, or a reason that does not match what happened (for example, “weaving” but the video shows you in your lane).',
      'You were stopped because of where you were, how you looked, or because you walked away from police.',
      'The stop was based on an anonymous tip with no details police confirmed themselves.',
    ],
    howToRaise: [
      'Request the dash-cam and body-cam video, the CAD/dispatch log, and the officer’s report right away (see the disclosure entry).',
      'Write down, today, exactly what happened before the lights came on — what you were doing, the road, the time, any witnesses.',
      'File a motion to suppress evidence that names what should be thrown out and why the stop was not justified.',
      'Ask for an evidentiary hearing so the officer has to testify about the reason for the stop.',
    ],
    timing: 'Your state’s motion deadline controls — many courts require pretrial motions weeks before trial, and late motions can be refused. Check your court’s rules or ask the clerk, and file as soon as you have the video and report.',
    evidence: ['Dash-cam and body-cam footage', 'CAD / dispatch logs and the 911 call if there was one', 'Photos of the location, signs, and lane markings', 'Names of passengers or witnesses'],
    limits: [
      'Any real traffic violation, even a minor one, is usually enough to justify a car stop.',
      'If you consented to what happened next, or police would have found the evidence anyway, suppression may not help.',
    ],
    charges: 'all',
    motionIds: ['suppress-evidence', 'dismiss-charges'],
    sources: [S.terry, S.mapp, S.fourth],
  },
  {
    id: 'prolonged-stop',
    name: 'The stop went on too long',
    category: 'Police stop and search',
    outcome: 'Evidence found during the extra time can be thrown out',
    summary:
      'A traffic stop can last only as long as it takes to handle the ticket. Police cannot hold you longer to wait for a drug dog or to fish for something else unless they develop new reasonable suspicion. The U.S. Supreme Court said so directly in Rodriguez v. United States.',
    whenItApplies: [
      'The ticket or warning was done (or should have been) but you were kept waiting.',
      'Police called for a K-9 unit or another officer and you sat there until it arrived.',
      'The officer asked a long list of unrelated questions about travel plans, drugs, or weapons before finishing the ticket.',
    ],
    howToRaise: [
      'Get the body-cam and dispatch log with timestamps — the times are your evidence.',
      'Build a short timeline: stop began, license run, ticket written, dog called, dog arrived, search.',
      'Raise it in a motion to suppress evidence, citing Rodriguez.',
    ],
    timing: 'Same as other suppression motions: your state’s pretrial-motion deadline controls, so check your court’s rules and file early.',
    evidence: ['Body-cam timestamps', 'Dispatch / CAD log with call times', 'The citation and its time stamp', 'K-9 unit log'],
    limits: ['If the officer saw or smelled something new early in the stop, extra time may be allowed.'],
    charges: 'all',
    motionIds: ['suppress-evidence'],
    sources: [S.rodriguez],
  },
  {
    id: 'illegal-search',
    name: 'Search without a valid warrant or consent',
    category: 'Police stop and search',
    outcome: 'Evidence from the search can be thrown out',
    summary:
      'Searches of your home, car, phone, bag, or body generally need a warrant, real consent, or a recognized exception. Phones need a warrant even after an arrest (Riley v. California). A car cannot be searched just because you were arrested unless you could reach it or evidence of that crime is likely inside (Gant). If police went outside those lines, what they found can be suppressed.',
    whenItApplies: [
      'You said no, or were never asked, and they searched anyway.',
      'Your “consent” came after threats, or while you were surrounded and told you had no choice.',
      'They went through your phone without a warrant.',
      'The warrant affidavit contains statements that are false or leaves out things that matter (a Franks challenge).',
      'The search went beyond what the warrant described.',
    ],
    howToRaise: [
      'Get the warrant and the affidavit behind it, if there was one, and compare them to what really happened.',
      'Write down exactly what you said when they asked to search.',
      'File a motion to suppress evidence identifying each item to exclude.',
      'If the affidavit has false statements made knowingly or recklessly, ask for a Franks hearing.',
    ],
    timing: 'Your state’s pretrial-motion deadline controls; check your court’s rules or ask the clerk. Earlier is better.',
    evidence: ['The search warrant and affidavit', 'Body-cam of the consent conversation', 'Property / evidence inventory', 'Who owns or uses the place searched'],
    limits: [
      'You can generally only challenge a search of a place or thing that was yours or where you had privacy (not a stranger’s car).',
      'Items in plain view, searches after a lawful arrest of your person, and inventory searches of impounded cars are common exceptions.',
    ],
    charges: 'all',
    motionIds: ['suppress-evidence'],
    sources: [S.mapp, S.riley, S.gant, S.franks],
  },

  // ---------------- Statements ----------------
  {
    id: 'miranda',
    name: 'Statements taken without Miranda warnings',
    category: 'Statements and questioning',
    outcome: 'Your statements are kept out of the State’s main case',
    summary:
      'If you were in custody (arrested or not free to leave) and police questioned you without first giving Miranda warnings, the State generally cannot use what you said to prove its case. If you asked for a lawyer and they kept questioning you, statements after that point are also excluded (Edwards).',
    whenItApplies: [
      'You were in handcuffs, a patrol car, or an interview room and were asked questions about the crime before hearing your rights.',
      'You said “I want a lawyer” and the questions kept coming.',
      'You said you did not want to talk and they kept pushing.',
    ],
    howToRaise: [
      'Ask for every recording of your questioning — body-cam, car camera, interview room video.',
      'Note when you were first restrained and when, if ever, warnings were read.',
      'File a motion to suppress statement / confession; ask for a voluntariness hearing.',
    ],
    timing: 'Your state’s pretrial-motion deadline controls; check your court’s rules or ask the clerk and file early.',
    evidence: ['Interview and body-cam recordings', 'Any signed rights-waiver form', 'Times of arrest and of questioning'],
    limits: [
      'Not reading you your rights does NOT get the whole case dismissed — it only removes the statements.',
      'Miranda does not apply to questions before you were in custody, routine booking questions, or things you volunteered without being asked.',
      'Excluded statements can sometimes still be used to challenge you if you testify differently at trial.',
    ],
    charges: 'all',
    motionIds: ['suppress-statement'],
    sources: [S.miranda, S.edwards, S.fifth],
  },
  {
    id: 'involuntary-statement',
    name: 'Confession was involuntary',
    category: 'Statements and questioning',
    outcome: 'The confession is thrown out entirely',
    summary:
      'A statement obtained by threats, promises of leniency, or pressure that overcame your will cannot be used at all — even with Miranda warnings. Courts generally require the prosecution to prove a statement was voluntary before it is admitted.',
    whenItApplies: [
      'You were told you would go home, avoid jail, or keep your kids if you confessed.',
      'You were threatened, denied food, sleep, or medication, or held for many hours.',
      'You were intoxicated, injured, in a mental health crisis, or did not understand English well.',
    ],
    howToRaise: [
      'Write down every promise or threat you remember, word for word if you can.',
      'Get the full recording; length and tone matter.',
      'File a motion to suppress statement / confession and request a voluntariness hearing.',
    ],
    timing: 'Your state’s pretrial-motion deadline controls; check your court’s rules or ask the clerk and file early.',
    evidence: ['Full interview recordings', 'Medical or jail records showing your condition', 'Interpreter records'],
    limits: ['Ordinary police pressure and lying about evidence are often allowed; courts look at the whole picture.'],
    charges: 'all',
    motionIds: ['suppress-statement'],
    sources: [S.miranda, S.fifth],
  },
  {
    id: 'corpus-delicti',
    name: 'The only real evidence is your own statement',
    category: 'Statements and questioning',
    outcome: 'Statement excluded and charge can fail for lack of proof',
    summary:
      'Many states follow a corpus delicti rule: you cannot be convicted on your own uncorroborated confession alone. The prosecution must first show independent evidence that the crime actually happened. The exact form varies by state, but when police have an admission and little else, this can knock out the statement and the charge with it.',
    whenItApplies: [
      'Nothing was found, no one saw it, and the case is built on what you told police.',
      'You admitted to a more serious version (for example, “for sale”) but the physical evidence only shows something smaller.',
    ],
    howToRaise: [
      'Ask what independent evidence the State has besides your statement (disclosure).',
      'Object to the statement before trial in a motion in limine; at trial, move for a judgment of acquittal if the corroboration is missing.',
    ],
    timing: 'Raise before trial in a motion; again at trial after the prosecution rests, under your state’s judgment-of-acquittal procedure.',
    evidence: ['The police report — list what is NOT in it', 'Lab results (or the lack of them)'],
    limits: ['Only a reasonable inference of the crime is needed; small corroborating facts are often enough. It does not apply to a guilty plea.'],
    charges: 'all',
    motionIds: ['in-limine', 'judgment-of-acquittal'],
    sources: [S.corpus, S.stateCourts],
  },

  // ---------------- Evidence and disclosure ----------------
  {
    id: 'suggestive-id',
    name: 'Unreliable or suggestive identification',
    category: 'Evidence and disclosure',
    outcome: 'The identification is thrown out — often the State’s main evidence',
    summary:
      'If police used a lineup, photo array, or one-person “show-up” that pushed the witness toward you, and the identification is unreliable, it can be excluded under Manson v. Brathwaite. In cases that depend on one eyewitness, that can end the case.',
    whenItApplies: [
      'The witness was shown only your photo, or you were the only one in handcuffs at a show-up.',
      'You were the only person in the lineup who matched the description.',
      'The officer hinted who to pick, or told the witness they “got the right guy” afterward.',
      'The witness saw the person briefly, at night, under stress, or across a distance.',
    ],
    howToRaise: [
      'Ask for the lineup or photo array itself, the instructions given, and any recording.',
      'Compare the witness’s first description with what you actually look like.',
      'File a motion to suppress identification and request a hearing.',
    ],
    timing: 'Your state’s pretrial-motion deadline controls; check your court’s rules or ask the clerk and file early.',
    evidence: ['Photo array and lineup instructions', 'The 911 call and first description', 'Lighting, distance, and time of the event'],
    limits: ['Courts often let even suggestive IDs in if other factors make them reliable; the fight then moves to cross-examination.'],
    charges: 'all',
    motionIds: ['suppress-identification'],
    sources: [S.manson],
  },
  {
    id: 'disclosure-violation',
    name: 'The prosecutor has not turned over the evidence',
    category: 'Evidence and disclosure',
    outcome: 'Evidence can be blocked; serious or repeated violations can lead to dismissal',
    summary:
      'The State must give you the police reports, recordings, witness lists, lab results, and anything that helps you (Brady material). Courts can sanction a violation by blocking the evidence, granting a continuance, or in serious cases dismissing the case; the available sanctions and dismissal rules vary by state.',
    whenItApplies: [
      'You have asked for body-cam, reports, or lab results and have not received them.',
      'Trial is approaching and the State keeps saying disclosure is “pending.”',
      'You learn that a witness changed their story, someone else confessed, or an officer has credibility problems — and the State did not tell you.',
    ],
    howToRaise: [
      'Send a written disclosure request listing exactly what you want; keep a copy and the date.',
      'If it is not provided, file a motion to compel discovery.',
      'For evidence that helps you, file a Brady motion.',
      'If the deadline passes and it still is not produced, ask for sanctions under your state’s discovery rules — such as blocking the late evidence or, in serious cases, dismissal.',
    ],
    timing: 'Ask in writing right after arraignment. A sanctions motion should be filed promptly once the violation is clear.',
    evidence: ['Copies of every request and every reply', 'A log of what has and has not been produced'],
    limits: ['Courts usually start with lesser sanctions; dismissal is reserved for serious, prejudicial, or bad-faith violations.'],
    charges: 'all',
    motionIds: ['criminal-discovery', 'brady-motion'],
    sources: [S.brady, S.fourteenth],
  },
  {
    id: 'lost-evidence',
    name: 'Evidence was lost or destroyed',
    category: 'Evidence and disclosure',
    outcome: 'Jury instruction against the State; dismissal if done in bad faith',
    summary:
      'If police or prosecutors lost or destroyed evidence that could have helped you — body-cam footage not saved, a 911 call overwritten, a blood sample discarded — you can ask for a missing-evidence instruction, which tells the jury it may assume the missing evidence would have hurt the prosecution. If it was destroyed in bad faith, or the loss makes a fair trial impossible, the charge can be dismissed.',
    whenItApplies: [
      'Store or body-cam video “was not retained.”',
      'A sample, photo, or object was never tested and is now gone.',
      'You asked for something and were told it no longer exists.',
    ],
    howToRaise: [
      'Send a preservation letter immediately for any video or recording you know about.',
      'Document when and how you learned it was lost.',
      'File a motion in limine asking for a missing-evidence instruction; if there is evidence of bad faith, a motion to dismiss.',
    ],
    timing: 'Preservation: today. Motion: before trial, as soon as the loss is known.',
    evidence: ['Your preservation request', 'Retention policies of the agency or store', 'Any reply saying the item is gone'],
    limits: ['Without bad faith, the usual remedy is an instruction or another lesser sanction, not dismissal; the exact remedy varies by state.'],
    charges: 'all',
    motionIds: ['in-limine', 'dismiss-charges'],
    sources: [S.trombetta, S.youngblood],
  },
  {
    id: 'informant',
    name: 'The case rests on a confidential informant',
    category: 'Evidence and disclosure',
    outcome: 'The State must reveal the informant or often dismiss',
    summary:
      'When an informant was an actual witness to or participant in the alleged crime, you may be entitled to know who they are so you can question them. Prosecutors sometimes dismiss rather than reveal an informant.',
    whenItApplies: ['A “CI” or “source” bought drugs from you, set up the deal, or was the only witness.', 'The report refers to information from an unnamed person you think is lying.'],
    howToRaise: ['File a motion to disclose identity of confidential informant explaining why their testimony matters to your defense.'],
    timing: 'Before trial; early enough to investigate the informant once identified.',
    evidence: ['Reports mentioning the informant', 'Any payments or deals the informant received'],
    limits: ['If the informant only gave a tip and did not witness the crime, disclosure is usually denied.'],
    charges: ['drugs', 'weapons', 'theft', 'fraud', 'other'],
    motionIds: ['disclose-informant'],
    sources: [S.roviaro],
  },

  // ---------------- Deadlines and delay ----------------
  {
    id: 'speedy-trial',
    name: 'Speedy trial deadline passed',
    category: 'Deadlines and delay',
    outcome: 'Dismissal — sometimes with prejudice, meaning the charge cannot be refiled',
    summary:
      'Every state must honor the constitutional right to a speedy trial, and many states also set specific day-count deadlines. Those clocks vary: they may run from arrest, charge, or arraignment, differ for people in custody, and exclude delays you requested or agreed to. If your state’s deadline runs out, dismissal may be required; whether it is with prejudice depends on state law and whether the delay hurt your defense. Separately, the U.S. Constitution forbids unreasonable delay (Barker v. Wingo).',
    whenItApplies: [
      'It has been many months since arraignment and trial keeps getting moved by the State or the court.',
      'You did not ask for, or did not agree to, the continuances.',
      'A witness has died, moved, or forgotten, or evidence has disappeared during the delay.',
    ],
    howToRaise: [
      'Add up the days since arraignment; subtract periods you caused or agreed to.',
      'Object on the record every time the State asks for a continuance.',
      'File a motion to dismiss citing your state’s speedy-trial rule and the Sixth Amendment; if the delay harmed your defense, ask for dismissal with prejudice and explain how.',
    ],
    timing: 'Raise it before trial begins and before the deadline is waived. Do not sign a time waiver without understanding it.',
    evidence: ['Every minute entry and continuance order', 'Who asked for each delay', 'Proof of harm: lost witnesses, faded memory, lost job or custody while held'],
    limits: [
      'Delays you request or agree to are excluded and usually restart or extend the clock.',
      'Some speedy-trial dismissals are without prejudice, so the prosecution may refile if state law allows; check whether dismissal with prejudice is available.',
    ],
    charges: 'all',
    motionIds: ['dismiss-charges'],
    sources: [S.barker, S.sixth, S.stateCourts],
  },
  {
    id: 'statute-of-limitations',
    name: 'Charged too late (statute of limitations)',
    category: 'Deadlines and delay',
    outcome: 'Dismissal with prejudice',
    summary:
      'Each state sets its own time limits for starting a prosecution, and they vary by offense level and type. Many states use shorter periods for misdemeanors and longer periods for felonies, and some serious crimes have no limit. The clock may run from the offense or from when it was discovered, depending on state law. If the prosecution filed after your state’s deadline, the case must be dismissed and generally cannot be refiled.',
    whenItApplies: [
      'The event happened long before you were charged.',
      'Police knew about it right away but waited to file.',
    ],
    howToRaise: [
      'Find the offense date on the complaint and the date the complaint was filed.',
      'Check when police first knew about it (the report date).',
      'File a motion to dismiss on statute-of-limitations grounds.',
    ],
    timing: 'File early. It can be raised by motion before trial.',
    evidence: ['The complaint or indictment with its filing date', 'The original police report date', 'Anything showing police knew earlier'],
    limits: ['Time spent outside the state, hiding your identity, or other tolling events may pause the clock under state law.', 'No limit applies to homicide, many sex offenses against children, and certain other crimes.'],
    charges: 'all',
    motionIds: ['dismiss-charges'],
    sources: [S.limitations, S.stateCourts],
  },

  // ---------------- Charging and court process ----------------
  {
    id: 'defective-complaint',
    name: 'The charging document is legally defective',
    category: 'Charging and court process',
    outcome: 'Dismissal (usually without prejudice)',
    summary:
      'In every state, the charging document must state a real offense and give you fair notice of what you are accused of. Courts can dismiss when the complaint, information, or indictment is legally insufficient — for example, the facts it alleges are not actually a crime, it cites a law that does not apply, or it fails to tell you what you did. The exact motion and standard are set by your state’s rules.',
    whenItApplies: [
      'The complaint cites the wrong statute, or a statute that was repealed.',
      'It leaves out a required element (for example, theft with no value alleged when value sets the level).',
      'Even if everything it says is true, it is not a crime.',
    ],
    howToRaise: [
      'Read the charge line by line next to the statute and the elements in the Charge Library.',
      'File a motion to dismiss for a legally defective charging document, explaining what is missing.',
    ],
    timing: 'Your state’s pretrial-motion deadline controls; check your court’s rules or ask the clerk and file early.',
    evidence: ['The complaint or indictment', 'The statute text'],
    limits: [
      'This is not a way to argue the State’s evidence is weak — a defective-charge motion does not let the judge weigh evidence before trial.',
      'The State can often fix the document by amending it or refiling.',
    ],
    charges: 'all',
    motionIds: ['dismiss-charges'],
    sources: [S.sixth, S.stateCourts],
  },
  {
    id: 'grand-jury',
    name: 'Grand jury was misled (felonies)',
    category: 'Charging and court process',
    outcome: 'Indictment sent back for a new probable-cause finding',
    summary:
      'If a felony indictment came from a grand jury that was given misleading or incomplete information — for example, it was not told about clearly exculpatory evidence, or was given wrong law — you can ask the court to challenge the indictment or send it back for a new probable-cause finding. The procedure and deadline are set by state law, and some states use preliminary hearings instead. Sometimes the prosecution does not re-indict.',
    whenItApplies: ['You were indicted by a grand jury (not a preliminary hearing).', 'The transcript shows the officer misstated facts or left out something important that helps you.'],
    howToRaise: [
      'Get the grand jury transcript (it is filed with the court).',
      'Compare the testimony with the police report and the video.',
      'File a motion for a new finding of probable cause.',
    ],
    timing: 'Strict in many states: challenge deadlines can be short and may run from arraignment or from when the transcript is filed. Check your state’s deadline immediately; late motions may be barred.',
    evidence: ['Grand jury transcript', 'Police report and recordings to compare'],
    limits: ['A remand is not a dismissal — the State can present the case again.', 'The deadline may be mandatory, so do not wait.'],
    charges: 'all',
    motionIds: ['dismiss-charges'],
    sources: [S.fifth, S.stateCourts],
  },
  {
    id: 'double-jeopardy',
    name: 'Charged twice for the same thing',
    category: 'Charging and court process',
    outcome: 'Duplicate charge dismissed',
    summary:
      'You cannot be prosecuted again for an offense after an acquittal or conviction, or punished twice for the same offense. Courts compare the elements of the two charges (the Blockburger test). Duplicate counts for one act are also challenged this way.',
    whenItApplies: ['A charge was already resolved and the State filed it again.', 'Two counts describe the exact same act with the same elements.'],
    howToRaise: ['Gather the records of the earlier case.', 'File a motion to dismiss on double-jeopardy grounds.'],
    timing: 'Before trial.',
    evidence: ['Earlier judgment or dismissal order', 'Both charging documents'],
    limits: ['A dismissal without prejudice before trial does not bar refiling. State and federal charges can both proceed.'],
    charges: 'all',
    motionIds: ['dismiss-charges'],
    sources: [S.blockburger],
  },

  // ---------------- The facts ----------------
  {
    id: 'mistaken-identity',
    name: 'Wrong person / alibi',
    category: 'The facts of the charge',
    outcome: 'Acquittal, or dismissal once the prosecutor sees the proof',
    summary:
      'If you were somewhere else, or the description fits someone else, proof of that is often the fastest way to a dismissal — prosecutors frequently drop cases when shown solid alibi evidence early. Many states require written notice of an alibi or mistaken-identity defense, so check your state’s notice rule.',
    whenItApplies: ['You were at work, home, or elsewhere and can prove it.', 'The suspect description does not match you.', 'Someone else had your car, phone, or ID.'],
    howToRaise: [
      'Collect proof now: time cards, receipts, phone location history, texts, video, witnesses.',
      'File your notice of defenses listing alibi or mistaken identity, with witnesses.',
      'Share the proof with the prosecutor and ask them to dismiss.',
    ],
    timing: 'Your state’s notice deadline controls. Alibi-notice deadlines are often short and may run from arraignment or from the prosecution’s disclosure; ask the clerk or check the court’s rules right away.',
    evidence: ['Time-stamped records (cards, receipts, GPS, phone data)', 'Witness names and contact info', 'Video that shows where you were'],
    limits: ['Missing the notice deadline can lead to witnesses being blocked.'],
    charges: 'all',
    motionIds: ['dismiss-charges'],
    sources: [S.stateCourts],
  },
  {
    id: 'missing-element',
    name: 'An element of the crime is missing',
    category: 'The facts of the charge',
    outcome: 'Reduced charge, dismissal by the prosecutor, or acquittal at trial',
    summary:
      'Every charge has elements the State must prove beyond a reasonable doubt — intent, knowledge, value, injury, possession. If one cannot be proven (you did not know the item was in the bag, the value was below the felony line, there was no injury), the charge fails or drops to a lesser one. Before trial this is mostly a negotiation point; at trial you can ask for a judgment of acquittal after the State rests.',
    whenItApplies: [
      'Drugs or a weapon were in a shared space and nothing ties them to you (no prints, no admission).',
      'You did not intend to take anything, or thought you had permission.',
      'The value or injury used to make it a felony is overstated.',
    ],
    howToRaise: [
      'Open the charge in the Charge Library and check each element against the police report.',
      'Write the prosecutor a short letter pointing out the missing element and asking for dismissal or reduction.',
      'At trial, move for judgment of acquittal when the prosecution rests, using your state’s procedure.',
    ],
    timing: 'Negotiation: any time before trial. Judgment of acquittal: at trial, after the prosecution rests.',
    evidence: ['Police report', 'Receipts, appraisals, medical records', 'Who else used the car, room, or bag'],
    limits: ['A judge will not dismiss before trial just because the evidence is weak (pretrial dismissal motions generally do not allow that).'],
    charges: 'all',
    motionIds: ['judgment-of-acquittal'],
    sources: [S.winship],
  },
  {
    id: 'marijuana-legal',
    name: 'Marijuana that was legal to have',
    category: 'The facts of the charge',
    outcome: 'Dismissal',
    summary:
      'Marijuana law varies sharply by state. In states where adult possession is legal, a charge for an amount within the legal limit should not stand; in states where it is not legal, this defense does not apply. Check your state’s current age, amount, concentrate, public-use, school-ground, and driving rules.',
    whenItApplies: ['Your state allows adult possession of the amount involved.', 'You met the state’s age and amount limits, including any separate concentrate limit.', 'You were not in a prohibited place or driving impaired.'],
    howToRaise: ['Check the weight in the lab report or property sheet.', 'Ask the prosecutor to dismiss; if they refuse, file a motion to dismiss citing your state’s marijuana law.'],
    timing: 'Before trial.',
    evidence: ['Lab report weight', 'Proof of age'],
    limits: ['Does not cover driving while impaired, possession below the legal age, amounts over the limit, or conduct your state still prohibits.'],
    charges: ['drugs'],
    motionIds: ['dismiss-charges'],
    sources: [S.stateCourts],
  },

  // ---------------- Justification ----------------
  {
    id: 'self-defense',
    name: 'Self-defense or defense of others',
    category: 'Justification defenses',
    outcome: 'Acquittal; often dismissal once the prosecutor sees the evidence',
    summary:
      'States generally allow physical force when a reasonable person would believe it was immediately necessary to protect against another person’s unlawful force. The exact rules and burden of proof vary: in some states, once there is some evidence of justification, the prosecution must prove beyond a reasonable doubt that you were not justified; in others, justification is treated as an affirmative defense. Check your state’s rule.',
    whenItApplies: ['The other person started it or threatened you first.', 'You were protecting someone else, your home, or your property.', 'You have injuries too.'],
    howToRaise: [
      'Photograph your injuries now and get medical records.',
      'Find witnesses and video (neighbors’ cameras, store cameras, phones).',
      'File any notice of defenses your state requires, listing self-defense.',
      'Show the evidence to the prosecutor and ask for dismissal.',
    ],
    timing: 'Your state’s notice-of-defenses deadline controls. These deadlines can be short and may run from arraignment or disclosure; check the court’s rules right away.',
    evidence: ['Photos of your injuries', 'Medical records', 'Videos and witnesses', 'Prior threats or texts from the other person'],
    limits: ['The force used must be proportional; deadly force has stricter rules.', 'Not available if you provoked the fight (with some exceptions).'],
    charges: ['assault', 'dv', 'weapons', 'public', 'other'],
    motionIds: ['in-limine'],
    sources: [S.selfdef, S.stateCourts],
  },
  {
    id: 'entrapment',
    name: 'Entrapment',
    category: 'Justification defenses',
    outcome: 'Acquittal',
    summary:
      'Entrapment applies when the idea came from police or their agents, they pushed you into it, and you were not already predisposed to commit the crime. States differ on the burden: some treat entrapment as an affirmative defense you must prove, and some focus on whether police induced a person who was not predisposed. Raising it can require admitting the act, so check your state’s rule with a lawyer first.',
    whenItApplies: ['An informant or undercover officer pressured you repeatedly.', 'You had never done anything like this before and only agreed after persistent asking.'],
    howToRaise: ['Collect the messages and call logs with the informant.', 'List entrapment in any notice of defenses your state requires.', 'Talk to a lawyer first — raising it means admitting the act.'],
    timing: 'Your state’s notice-of-defenses deadline; check it early.',
    evidence: ['Texts and recordings with the officer or informant', 'Evidence of no prior history'],
    limits: ['Merely giving you an opportunity is not entrapment. You may carry the burden, depending on state law.'],
    charges: ['drugs', 'weapons', 'fraud', 'other'],
    motionIds: [],
    sources: [S.entrap, S.stateCourts],
  },

  // ---------------- DUI ----------------
  {
    id: 'dui-counsel',
    name: 'DUI: denied a chance to call a lawyer',
    category: 'DUI-specific',
    outcome: 'Dismissal (sometimes with prejudice) or suppression',
    summary:
      'DUI counsel rights vary by state. Some states require police to allow a private call to a lawyer during a DUI investigation when it would not interfere with the investigation; others are narrower. If police refused a required call and that cost you a chance to gather evidence, such as an independent test, remedies can include suppression or, in serious cases, dismissal. Check your state’s DUI counsel rule.',
    whenItApplies: ['You asked for a lawyer and were told no, or “after the test.”', 'You were allowed to call but an officer stood and listened.'],
    howToRaise: ['Get the body-cam and the DUI processing video.', 'Note the exact time you asked.', 'File a motion to dismiss, or to suppress, citing your state’s DUI counsel rule.'],
    timing: 'Before trial, by your state’s pretrial-motion deadline; check the court’s rules and file early.',
    evidence: ['Body-cam and station video', 'DUI forms showing times', 'Your phone records'],
    limits: ['Police can refuse if the call would truly disrupt the investigation; you must have actually asked.'],
    charges: ['dui'],
    motionIds: ['dismiss-charges', 'suppress-evidence'],
    sources: [S.stateCourts],
  },
  {
    id: 'dui-independent-test',
    name: 'DUI: blocked from getting your own test',
    category: 'DUI-specific',
    outcome: 'Dismissal',
    summary:
      'Many states let a person arrested for DUI obtain an independent test. If police interfere — refusing a second sample, not letting you arrange a test, or releasing you too late for it to matter — the charge can be dismissed or evidence can be excluded because evidence that might have cleared you is gone. The right and remedy vary by state.',
    whenItApplies: ['You asked for your own blood test or second sample and were refused.', 'You were held for hours so any test would be useless.'],
    howToRaise: ['Document your request and the response.', 'File a motion to dismiss for denial of the right to gather exculpatory evidence.'],
    timing: 'Before trial.',
    evidence: ['Body-cam', 'Jail release time', 'Any lab you tried to contact'],
    limits: ['Police do not have to arrange or pay for the test, only not interfere.'],
    charges: ['dui'],
    motionIds: ['dismiss-charges'],
    sources: [S.stateCourts],
  },
  {
    id: 'dui-blood-draw',
    name: 'DUI: blood drawn without a warrant or real consent',
    category: 'DUI-specific',
    outcome: 'Blood result thrown out — often the end of an alcohol-level charge',
    summary:
      'A blood draw is a search. Police generally need a warrant or voluntary consent; the natural fading of alcohol alone is not an emergency that excuses a warrant (Missouri v. McNeely), and states cannot make it a crime to refuse a blood test (Birchfield v. North Dakota). Consent given after being told you had no choice may not be voluntary.',
    whenItApplies: ['No warrant was obtained for your blood.', 'You were told you “had to” give blood, or agreed only after being threatened.', 'The person drawing blood was not qualified, or the chain of custody has gaps.'],
    howToRaise: ['Get the implied-consent form, the warrant (if any), and the phlebotomist’s records.', 'File a motion to suppress the blood evidence.'],
    timing: 'By your state’s pretrial-motion deadline; check the court’s rules and file early.',
    evidence: ['Implied-consent / administrative license form', 'Warrant and affidavit', 'Lab chain-of-custody and retest sample'],
    limits: ['Breath tests after arrest do not need a warrant. Clear, voluntary consent defeats the claim.', 'A separate license hearing may have a very short deadline; check the notice you received and your state’s administrative-hearing rule.'],
    charges: ['dui'],
    motionIds: ['suppress-evidence'],
    sources: [S.mcneely, S.birchfield],
  },

  // ---------------- Ways out without a trial ----------------
  {
    id: 'diversion',
    name: 'Diversion: complete a program, case dismissed',
    category: 'Ways out without a trial',
    outcome: 'Charges dismissed after you finish the program',
    summary:
      'Many prosecutors run diversion (deferred prosecution) programs — classes, treatment, community service, or restitution — and when you finish, the charges are dismissed. Availability and eligibility vary by state and county, and some cities run their own misdemeanor programs. Admission is usually up to the prosecutor, so ask early and make your case.',
    whenItApplies: ['First offense or little record.', 'Drug possession, shoplifting, minor theft, or other lower-level charges.', 'Substance use, mental health, or veteran status played a part.'],
    howToRaise: [
      'Ask the prosecutor in writing whether you are eligible for diversion.',
      'Include a short mitigation packet: job, school, family, treatment already started, letters of support.',
      'Use the diversion request template to put it in front of the court.',
    ],
    timing: 'As early as possible — usually before a plea or trial setting. Some programs close once a case is set for trial.',
    evidence: ['Proof of employment or school', 'Treatment or counseling enrollment', 'Letters of support', 'Proof of restitution paid'],
    limits: ['Serious violent offenses, some DUIs, and certain prior convictions usually make you ineligible. Failing the program reinstates the case.'],
    charges: 'all',
    motionIds: ['diversion-request'],
    sources: [S.stateCourts],
  },
  {
    id: 'compromise',
    name: 'Misdemeanor compromise with the victim',
    category: 'Ways out without a trial',
    outcome: 'Dismissal of the misdemeanor',
    summary:
      'Some states allow certain misdemeanors with an identifiable victim to be dismissed if the victim acknowledges in writing that they have received satisfaction — usually repayment for the loss. Availability, eligible charges, and whether the prosecutor must recommend it vary by state.',
    whenItApplies: ['A misdemeanor with a person or business as the victim (criminal damage, minor theft).', 'You can repay the loss, and the victim is willing to sign.'],
    howToRaise: ['Ask the prosecutor or victim advocate about a misdemeanor compromise.', 'Pay the loss and get a signed acknowledgment.', 'File it with the court and ask for dismissal.'],
    timing: 'Before trial.',
    evidence: ['Proof of payment', 'The victim’s signed acknowledgment'],
    limits: ['Not available for felonies. For assault and DV, state law or the prosecutor may bar it or require a recommendation. Do not contact a protected person if a no-contact order exists — go through the prosecutor.'],
    charges: ['theft', 'assault', 'dv', 'public', 'traffic', 'other'],
    motionIds: ['dismiss-charges'],
    sources: [S.stateCourts],
  },
  {
    id: 'incompetency',
    name: 'Not able to understand the case (competency)',
    category: 'Ways out without a trial',
    outcome: 'Case paused; misdemeanors may be dismissed',
    summary:
      'A person who cannot understand the proceedings or help with their defense because of a mental illness, disability, or brain injury cannot be tried. If a person is found incompetent, the case is usually paused for evaluation or restoration; whether charges can be dismissed, and when, varies by state and charge level.',
    whenItApplies: ['Serious mental illness, intellectual disability, dementia, or brain injury.', 'Trouble understanding what the judge and lawyers are saying.'],
    howToRaise: ['Tell your lawyer or the court; any party can request a competency evaluation under your state’s competency procedure.', 'Gather medical and treatment records.'],
    timing: 'Any time; it pauses the case.',
    evidence: ['Medical and psychiatric records', 'Special education or disability records'],
    limits: ['Felony cases usually go to restoration treatment rather than dismissal.'],
    charges: 'all',
    motionIds: [],
    sources: [S.dusky, S.stateCourts],
  },
  {
    id: 'ask-prosecutor',
    name: 'Ask the prosecutor to dismiss or reduce',
    category: 'Ways out without a trial',
    outcome: 'Dismissal, or a reduced or non-criminal charge',
    summary:
      'Most dismissals are not won in a hearing — they happen because the prosecutor reviews the problems in the case and decides it is not worth trying. A short, respectful letter that lays out the legal problems (an illegal stop, missing evidence, a strong alibi) and your background can lead to a dismissal, a reduction to a lesser or civil offense, or diversion.',
    whenItApplies: ['Any case — especially one with any of the problems in this guide.'],
    howToRaise: [
      'Write one page: the problems with the case, the evidence you have, your background, and what you are asking for.',
      'Attach proof (photos, receipts, letters).',
      'Send it to the assigned prosecutor and keep a copy; follow up before the next court date.',
    ],
    timing: 'Early, before positions harden — ideally before the pretrial conference.',
    evidence: ['Everything you gathered for the defenses above', 'Letters of support', 'Proof of steps you have taken (classes, treatment, restitution)'],
    limits: ['Anything you write can be used against you — do not admit facts. Have a lawyer review it if you can.'],
    charges: 'all',
    motionIds: [],
    sources: [],
  },
  {
    id: 'right-to-counsel',
    name: 'Get a public defender',
    category: 'Ways out without a trial',
    outcome: 'A lawyer who knows how to spot and file all of the above',
    summary:
      'If you are charged with a crime that could mean jail and you cannot afford a lawyer, you have a constitutional right to one (Gideon v. Wainwright). Public defenders handle these exact issues daily and can get video and evidence you cannot. This is the single most effective step toward a dismissal.',
    whenItApplies: ['Any charge that could carry jail time.'],
    howToRaise: ['Ask for a lawyer at your first appearance.', 'If you missed it, file a motion for appointment of counsel with a financial affidavit.'],
    timing: 'Right away.',
    evidence: ['Proof of income and expenses'],
    limits: ['Some petty offenses with no possible jail time do not come with an appointed lawyer.'],
    charges: 'all',
    motionIds: ['appointment-of-counsel'],
    sources: [S.gideon],
  },
];

/** Common beliefs that do NOT get charges dropped, and the truth. */
export const DEFENSE_MYTHS: { myth: string; truth: string }[] = [
  {
    myth: 'They did not read me my rights, so the case gets thrown out.',
    truth: 'Missing Miranda warnings only keeps out statements made during custodial questioning. Everything else stays in.',
  },
  {
    myth: 'The victim does not want to press charges, so it is over.',
    truth: 'The State, not the victim, decides. The victim’s wishes matter and can lead to a dismissal or compromise, but they are not the final word — especially in DV cases.',
  },
  {
    myth: 'If the officer does not show up, the case is dismissed.',
    truth: 'Sometimes, but the State often gets a continuance. Be ready to object and to point to speedy-trial time.',
  },
  {
    myth: 'Explaining my side to the police will clear things up.',
    truth: 'Statements are the most common evidence used against people. Politely say you want a lawyer and will not answer questions.',
  },
  {
    myth: 'I can ask the judge to dismiss because the evidence is weak.',
    truth: 'Usually not before trial — pretrial dismissal is generally for legal defects, not weighing evidence. Weak evidence is a reason for the prosecutor to dismiss, or for an acquittal at trial.',
  },
];

export function getDefense(id: string): DefenseDef | undefined {
  return DEFENSES.find((d) => d.id === id);
}

export function defensesFor(kind: ChargeKind): DefenseDef[] {
  return DEFENSES.filter((d) => d.charges === 'all' || d.charges.includes(kind));
}

// ------------------------------------------------------------------
// Detecting a criminal-charge situation in free text
// ------------------------------------------------------------------
const CRIMINAL_WORDS =
  /\b(charged|being charged|criminal charges?|charges? (against|filed|were)|arrest(ed)?|cited|citation for|indict(ed|ment)?|arraign(ed|ment)?|dui|dwi|drunk driving|possession|misdemeanou?r|felony|police|cops?|officer|prosecutor|county attorney|public defender|assault|shoplift(ing)?|theft|stole|burglary|trespass(ing)?|disorderly|domestic violence|\bdv\b|warrant|booked|bail|bond|jail|criminal|resisting arrest|paraphernalia|weapons? charge)\b/i;
const POST_CONVICTION =
  /\b(convicted|sentenced|probation violation|on probation|expunge|expungement|set aside|seal(ed|ing)? my record|record sealed|parole|post[- ]conviction|appeal my conviction|restore (my )?rights)\b/i;
const NOT_CRIMINAL = /\b(evict(ed|ion)?|landlord|custody|divorce|child support|small claims|garnish|debt collector)\b/i;

/** True when the text sounds like someone facing a pending criminal
 *  charge (not a post-conviction or civil matter). */
export function looksCriminal(text: string): boolean {
  const t = text || '';
  if (!CRIMINAL_WORDS.test(t)) return false;
  if (POST_CONVICTION.test(t)) return false;
  if (NOT_CRIMINAL.test(t) && !/\b(charged|arrested|cited|dui)\b/i.test(t)) return false;
  return true;
}

/** Best guess at the kind of charge from free text. */
export function guessChargeKind(text: string): ChargeKind | null {
  const t = (text || '').toLowerCase();
  if (/\b(dui|dwi|drunk driving|impaired|extreme dui|blood alcohol|breathalyz|bac)\b/.test(t)) return 'dui';
  if (/\b(domestic|\bdv\b|order of protection|girlfriend|boyfriend|wife|husband|spouse)\b/.test(t)) return 'dv';
  if (/\b(drug|marijuana|weed|meth|cocaine|fentanyl|heroin|pills|paraphernalia|possession of a controlled)\b/.test(t)) return 'drugs';
  if (/\b(gun|firearm|weapon|knife|prohibited possessor)\b/.test(t)) return 'weapons';
  if (/\b(assault|fight|hit|punch|threaten(ed|ing)?)\b/.test(t)) return 'assault';
  if (/\b(shoplift|theft|stole|steal|burglary|trespass|criminal damage|vandal)\b/.test(t)) return 'theft';
  if (/\b(fraud|forgery|identity theft|false report|bad check)\b/.test(t)) return 'fraud';
  if (/\b(failure to appear|fta|missed court|release conditions)\b/.test(t)) return 'court';
  if (/\b(disorderly|resisting|obstruct|public intoxication|loud)\b/.test(t)) return 'public';
  if (/\b(suspended license|reckless driving|leaving the scene|hit and run|no license)\b/.test(t)) return 'traffic';
  return null;
}

// ------------------------------------------------------------------
// Screening questions
// ------------------------------------------------------------------
export type ScreenAnswer = 'yes' | 'no' | 'unsure';

export interface ScreenFlag {
  defenseId: string;
  weight: number; // 1 = worth a look, 2 = likely, 3 = strong
  why: string;
}

export interface ScreenQuestion {
  id: string;
  text: string;
  help?: string;
  /** Only ask for these charge kinds (omit = all). */
  kinds?: ChargeKind[];
  /** Only ask when an earlier question was answered 'yes'. */
  ifYes?: string;
  /** Only ask when an earlier question was answered 'no'. */
  ifNo?: string;
  onYes?: ScreenFlag[];
  onNo?: ScreenFlag[];
  onUnsure?: ScreenFlag[];
}

export const SCREEN_QUESTIONS: ScreenQuestion[] = [
  {
    id: 'stopped',
    text: 'Did this start with police stopping you — pulling your car over or stopping you on foot?',
  },
  {
    id: 'stopReason',
    ifYes: 'stopped',
    text: 'Do you believe the reason they gave for stopping you was wrong, made up, or no reason at all?',
    help: 'For example: they said you were weaving and you were not, or they never said why.',
    onYes: [{ defenseId: 'illegal-stop', weight: 3, why: 'You believe the stop had no valid reason.' }],
    onUnsure: [{ defenseId: 'illegal-stop', weight: 1, why: 'The reason for the stop is unclear — worth checking the video.' }],
  },
  {
    id: 'stopLong',
    ifYes: 'stopped',
    text: 'Were you kept at the stop a long time — for example, waiting for a drug dog or more officers — after the ticket part was done?',
    onYes: [{ defenseId: 'prolonged-stop', weight: 3, why: 'You were held past the time the stop needed.' }],
    onUnsure: [{ defenseId: 'prolonged-stop', weight: 1, why: 'The length of the stop is worth checking against the timestamps.' }],
  },
  {
    id: 'searched',
    text: 'Did police search you, your car, your home, your bag, or your phone?',
  },
  {
    id: 'searchPermission',
    ifYes: 'searched',
    text: 'Did they search without showing a warrant and without you clearly agreeing?',
    help: 'Answer yes if you said no, were never asked, or only “agreed” after being told you had no choice.',
    onYes: [{ defenseId: 'illegal-search', weight: 3, why: 'Searched without a warrant or real consent.' }],
    onUnsure: [{ defenseId: 'illegal-search', weight: 1, why: 'It is unclear whether the search had a legal basis.' }],
  },
  {
    id: 'phoneSearched',
    ifYes: 'searched',
    text: 'Did they look through your phone?',
    onYes: [{ defenseId: 'illegal-search', weight: 2, why: 'Phones need a warrant even after an arrest.' }],
  },
  {
    id: 'questioned',
    text: 'After you were arrested or not free to leave, did police ask you questions about what happened?',
  },
  {
    id: 'miranda',
    ifYes: 'questioned',
    text: 'Were the questions asked before anyone read you your rights?',
    onYes: [{ defenseId: 'miranda', weight: 3, why: 'Questioned in custody before Miranda warnings.' }],
    onUnsure: [{ defenseId: 'miranda', weight: 1, why: 'Not sure when rights were read — the recording will show it.' }],
  },
  {
    id: 'askedLawyer',
    ifYes: 'questioned',
    text: 'Did you ask for a lawyer, or say you did not want to talk, and they kept going?',
    onYes: [
      { defenseId: 'miranda', weight: 3, why: 'Questioning continued after you asked for a lawyer or to stop.' },
      { defenseId: 'dui-counsel', weight: 3, why: 'You asked for a lawyer during a DUI investigation.' },
    ],
  },
  {
    id: 'pressured',
    ifYes: 'questioned',
    text: 'Did they promise you anything (going home, less jail) or threaten you to get you to talk?',
    onYes: [{ defenseId: 'involuntary-statement', weight: 3, why: 'Promises or threats were used to get a statement.' }],
  },
  {
    id: 'onlyStatement',
    ifYes: 'questioned',
    text: 'Is what you told police most of the evidence — nothing was found and no one else saw it?',
    onYes: [{ defenseId: 'corpus-delicti', weight: 2, why: 'The case may rest on your statement alone.' }],
  },
  {
    id: 'duiLawyer',
    kinds: ['dui'],
    text: 'During the DUI stop or at the station, did you ask to call a lawyer and get refused or delayed?',
    onYes: [{ defenseId: 'dui-counsel', weight: 3, why: 'Refused a call to a lawyer during the DUI investigation.' }],
  },
  {
    id: 'duiOwnTest',
    kinds: ['dui'],
    text: 'Did you ask for your own blood test or a second sample and get refused, or held so long it was pointless?',
    onYes: [{ defenseId: 'dui-independent-test', weight: 3, why: 'Blocked from getting an independent test.' }],
  },
  {
    id: 'duiBlood',
    kinds: ['dui'],
    text: 'Was your blood drawn without a warrant, or after you were told you had no choice?',
    onYes: [{ defenseId: 'dui-blood-draw', weight: 3, why: 'Blood drawn without a warrant or voluntary consent.' }],
    onUnsure: [{ defenseId: 'dui-blood-draw', weight: 1, why: 'Check whether a warrant was obtained for the blood draw.' }],
  },
  {
    id: 'identified',
    text: 'Did a witness pick you out — from a photo, a lineup, or while you were standing with police?',
  },
  {
    id: 'idSuggestive',
    ifYes: 'identified',
    text: 'Were you the only one shown, the only one who matched, or did police hint who to pick?',
    onYes: [{ defenseId: 'suggestive-id', weight: 3, why: 'The identification procedure was suggestive.' }],
    onUnsure: [{ defenseId: 'suggestive-id', weight: 1, why: 'Ask for the lineup or photo array to check it.' }],
  },
  {
    id: 'notMe',
    text: 'Were you somewhere else, or do you think they have the wrong person?',
    onYes: [{ defenseId: 'mistaken-identity', weight: 3, why: 'You say you were elsewhere or it was someone else.' }],
  },
  {
    id: 'selfDefense',
    kinds: ['assault', 'dv', 'weapons', 'public', 'other'],
    text: 'Were you protecting yourself, someone else, or your home?',
    onYes: [{ defenseId: 'self-defense', weight: 3, why: 'You acted to protect yourself or someone else.' }],
  },
  {
    id: 'shared',
    kinds: ['drugs', 'weapons', 'theft'],
    text: 'Was the item found in a place other people also used — a shared car, room, or bag — and was it not yours?',
    onYes: [{ defenseId: 'missing-element', weight: 2, why: 'Possession may be hard to prove in a shared space.' }],
  },
  {
    id: 'marijuana',
    kinds: ['drugs'],
    text: 'Was it marijuana, were you 21 or older, and was it one ounce or less?',
    onYes: [{ defenseId: 'marijuana-legal', weight: 3, why: 'Adult possession within the legal limit.' }],
  },
  {
    id: 'informant',
    kinds: ['drugs', 'weapons', 'theft', 'fraud', 'other'],
    text: 'Did an informant or undercover person set this up or act as the main witness?',
    onYes: [{ defenseId: 'informant', weight: 2, why: 'An informant is central to the case.' }],
  },
  {
    id: 'pushed',
    ifYes: 'informant',
    text: 'Did they keep pressuring you until you agreed, when you would not have done it otherwise?',
    onYes: [{ defenseId: 'entrapment', weight: 2, why: 'Repeated pressure from police or their agent.' }],
  },
  {
    id: 'intent',
    kinds: ['theft', 'fraud', 'assault', 'other'],
    text: 'Was it an accident, a misunderstanding, or something you thought you had permission to do?',
    onYes: [{ defenseId: 'missing-element', weight: 2, why: 'Intent or knowledge may be missing.' }],
  },
  {
    id: 'disclosure',
    text: 'Have you asked for the police report, videos, or test results and not received them?',
    onYes: [{ defenseId: 'disclosure-violation', weight: 2, why: 'Requested evidence has not been produced.' }],
    onUnsure: [{ defenseId: 'disclosure-violation', weight: 1, why: 'Ask for disclosure in writing now.' }],
  },
  {
    id: 'lost',
    text: 'Have you been told any video, recording, or evidence was lost, deleted, or not saved?',
    onYes: [{ defenseId: 'lost-evidence', weight: 3, why: 'Evidence was lost or destroyed.' }],
  },
  {
    id: 'helpful',
    text: 'Do you know of anything that would help you — a witness who changed their story, someone else admitting it — that the prosecutor may be holding back?',
    onYes: [{ defenseId: 'disclosure-violation', weight: 2, why: 'Possible Brady (helpful) evidence not disclosed.' }],
  },
  {
    id: 'oldOffense',
    text: 'Did the event happen a long time before you were charged — long enough that your state’s deadline to file charges may have passed?',
    onYes: [{ defenseId: 'statute-of-limitations', weight: 3, why: 'The charge may have been filed too late.' }],
    onUnsure: [{ defenseId: 'statute-of-limitations', weight: 1, why: 'Compare the offense date with the filing date.' }],
  },
  {
    id: 'longDelay',
    text: 'Has a long time passed since your arraignment without a trial, and you did not ask for the delays?',
    help: 'Speedy-trial clocks vary by state and custody status; count the days and check your court’s rule.',
    onYes: [{ defenseId: 'speedy-trial', weight: 3, why: 'The speedy-trial clock may have run.' }],
    onUnsure: [{ defenseId: 'speedy-trial', weight: 1, why: 'Count the days since arraignment.' }],
  },
  {
    id: 'badCharge',
    text: 'Looking at the complaint, does it cite the wrong law, the wrong date, or describe something that is not actually a crime?',
    onYes: [{ defenseId: 'defective-complaint', weight: 2, why: 'The charging document may be legally defective.' }],
  },
  {
    id: 'grandJury',
    text: 'Is it a felony where you were indicted by a grand jury (rather than having a preliminary hearing)?',
    onYes: [{ defenseId: 'grand-jury', weight: 1, why: 'Grand jury indictments can be challenged — on a short state deadline.' }],
  },
  {
    id: 'twice',
    text: 'Was this same charge already dismissed, decided, or are you charged twice for the same act?',
    onYes: [
      { defenseId: 'double-jeopardy', weight: 2, why: 'Possible duplicate prosecution.' },
      { defenseId: 'speedy-trial', weight: 1, why: 'Dismissing and refiling may not restart speedy-trial time.' },
    ],
  },
  {
    id: 'victimOk',
    kinds: ['theft', 'assault', 'dv', 'public', 'traffic', 'other'],
    text: 'Is it a misdemeanor where the person or business involved would accept repayment and agree to drop it?',
    onYes: [{ defenseId: 'compromise', weight: 3, why: 'A misdemeanor compromise may be possible.' }],
  },
  {
    id: 'firstOffense',
    text: 'Is this your first offense, or do you have little or no record?',
    onYes: [{ defenseId: 'diversion', weight: 3, why: 'First-time and low-record defendants are the main diversion candidates.' }],
  },
  {
    id: 'treatment',
    text: 'Did substance use, mental health, or military service play a part?',
    onYes: [{ defenseId: 'diversion', weight: 2, why: 'Treatment, mental health, and veterans programs often lead to dismissal.' }],
  },
  {
    id: 'competency',
    text: 'Do you (or the person charged) have a serious mental illness, disability, or brain injury that makes the court process hard to understand?',
    onYes: [{ defenseId: 'incompetency', weight: 2, why: 'Competency may be an issue.' }],
  },
  {
    id: 'lawyer',
    text: 'Do you already have a lawyer or public defender?',
    onNo: [{ defenseId: 'right-to-counsel', weight: 3, why: 'You do not have a lawyer yet — you may qualify for a free one.' }],
    onUnsure: [{ defenseId: 'right-to-counsel', weight: 3, why: 'Make sure a lawyer is appointed.' }],
  },
];

/** Questions that apply given the charge kind and the answers so far. */
export function activeQuestions(kind: ChargeKind | null, answers: Record<string, ScreenAnswer>): ScreenQuestion[] {
  return SCREEN_QUESTIONS.filter((q) => {
    if (q.kinds && kind && !q.kinds.includes(kind)) return false;
    if (q.ifYes && answers[q.ifYes] !== 'yes') return false;
    if (q.ifNo && answers[q.ifNo] !== 'no') return false;
    // DUI-only follow-ups to the lawyer question make no sense otherwise.
    return true;
  });
}

export interface DefenseMatch {
  defense: DefenseDef;
  score: number;
  reasons: string[];
}

/** Rank defenses from the answers. Always ends with the steps worth
 *  taking in every case (ask the prosecutor, get a lawyer). */
export function scoreDefenses(kind: ChargeKind | null, answers: Record<string, ScreenAnswer>): DefenseMatch[] {
  const map = new Map<string, DefenseMatch>();
  for (const q of activeQuestions(kind, answers)) {
    const a = answers[q.id];
    const flags = a === 'yes' ? q.onYes : a === 'no' ? q.onNo : a === 'unsure' ? q.onUnsure : undefined;
    for (const f of flags || []) {
      const d = getDefense(f.defenseId);
      if (!d) continue;
      if (kind && d.charges !== 'all' && !d.charges.includes(kind)) continue;
      const m = map.get(d.id) || { defense: d, score: 0, reasons: [] };
      m.score += f.weight;
      if (!m.reasons.includes(f.why)) m.reasons.push(f.why);
      map.set(d.id, m);
    }
  }
  const ranked = [...map.values()].sort((a, b) => b.score - a.score);
  // Everyone benefits from asking the prosecutor directly.
  if (!map.has('ask-prosecutor')) {
    ranked.push({
      defense: getDefense('ask-prosecutor')!,
      score: 0,
      reasons: ['Worth doing in every case — most dismissals happen this way.'],
    });
  }
  return ranked;
}

export function strengthLabel(score: number): string {
  if (score >= 3) return 'Strong lead';
  if (score === 2) return 'Likely worth raising';
  if (score === 1) return 'Worth checking';
  return 'Do this in every case';
}
