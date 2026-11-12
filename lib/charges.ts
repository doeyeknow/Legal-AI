// Charge library — converted from research_notes/legal-charges-catalog.md.
// General legal information, NOT legal advice: names, classifications and
// penalties vary by state; the charging document in a real case controls.

export interface ChargeEntry {
  id: string;
  num: number;
  name: string;
  category: string;
  commonName: string;
  meaning: string;
  elements: string[];
  classification: string;
  penaltyRange: string;
  wantToKnow: string[];
}

export interface ChargeCategory {
  name: string;
  note: string;
}

export const CHARGE_CATEGORIES: ChargeCategory[] = [
  {
    "name": "Traffic and DUI",
    "note": ""
  },
  {
    "name": "Theft and Property",
    "note": ""
  },
  {
    "name": "Assault and Battery",
    "note": "Naming warning: States split these two ideas differently. Some states have only \"assault\" (which includes hitting). Some have only \"battery.\" New Mexico has both, with specific meanings — assault is the attempt or threat, battery is the actual unlawful touching."
  },
  {
    "name": "Drug Possession",
    "note": "Big picture warning: Drug law is the fastest-changing area in this library. Marijuana is the clearest example — recreationally legal in a growing list of states (including New Mexico, for adults 21+ within limits), a civil fine in others, and still a crime in some. Amount thresholds and felony lines also change often. Treat every drug entry as a starting point and check the current law of the state involved."
  },
  {
    "name": "Disorderly Conduct and Public Offenses",
    "note": ""
  },
  {
    "name": "Domestic-Related Offenses",
    "note": "Shared reality for this category: Domestic charges usually come with immediate extras — emergency protective orders, no-contact conditions, firearm restrictions while the case is open, and possible effects on custody cases running in family court at the same time. Those extras often matter more day-to-day than the charge level itself."
  },
  {
    "name": "Weapons",
    "note": ""
  },
  {
    "name": "Fraud and False Statements",
    "note": ""
  },
  {
    "name": "Failure to Appear and Court-Order Offenses",
    "note": ""
  }
];

export const CHARGES_FRAMING: string[] = [
  "Criminal law is state law. The same conduct can have a different name, a different classification, and a very different penalty in different states. \"Battery\" in one state is part of \"assault\" in another. A first offense in one state can be a felony in the next.",
  "The name on the citation or complaint is what counts. The entries below use the most common names. A real charge sheet may use a different label for the same behavior.",
  "Penalty ranges here are typical ranges, not promises. Actual exposure depends on the exact charge, the person's record, enhancements (weapons, injuries, prior convictions), and the judge and prosecutor in the case.",
  "Classification shorthand used below: Infraction = a minor violation, usually a fine only, no jail, often not a \"crime\" at all. Petty misdemeanor = the lowest crime level in many states (in New Mexico, up to 6 months in jail and/or a fine up to $500). Misdemeanor = a crime punishable by up to about a year in county jail. Felony = a crime punishable by more than a year, usually in state prison, with lasting effects on voting, firearms, housing, and employment.",
  "New Mexico examples are marked \"NM example.\" New Mexico's versions are included because they are well established; they do not control anywhere else. ---"
];

export const CHARGES: ChargeEntry[] = [
  {
    "id": "driving-under-the-influence",
    "num": 1,
    "name": "Driving under the influence (DUI / DWI)",
    "category": "Traffic and DUI",
    "commonName": "DUI (called DWI in some states, including in New Mexico's older usage; the charge is the same idea)",
    "meaning": "Driving — or being in actual physical control of — a vehicle while alcohol or drugs impair your ability to drive safely, or with a blood/breath alcohol concentration (BAC) at or above the legal limit (0.08 for most adult drivers in every state).",
    "elements": [
      "You were driving or in actual physical control of a vehicle",
      "At the time, you were under the influence of alcohol and/or drugs to the point of impairment, or your BAC was at or above the legal limit",
      "The driving happened in a place covered by the law (public roads and, in many states, anywhere the public can access)"
    ],
    "classification": "Misdemeanor for a first or second offense in most states; becomes a felony with repeat offenses (in New Mexico, the fourth offense is a felony) or when someone is seriously hurt or killed.",
    "penaltyRange": "First offense commonly includes fines of a few hundred to about $1,000, possible jail from 0 up to 6–12 months depending on the state, license suspension or revocation, alcohol education/treatment, and community service. Repeat and aggravated offenses raise every part of that, up to years in prison for felony DUI.",
    "wantToKnow": [
      "A DUI is usually two cases at once: a criminal case in court and a separate license case with the motor vehicle division. Winning one does not automatically win the other.",
      "NM example: A first (non-aggravated) DUI in New Mexico is a misdemeanor carrying up to 90 days in jail and up to a $500 fine, plus license revocation. \"Aggravated\" DUI — commonly a BAC of 0.16 or higher, refusing the breath/blood test, or causing an injury — carries mandatory jail time even on a first offense. New Mexico requires an ignition interlock device after any DUI conviction.",
      "Refusing a chemical test usually has its own penalties (often a longer license revocation) separate from the DUI itself, under \"implied consent\" laws."
    ]
  },
  {
    "id": "driving-while-license-suspended-or-revoked",
    "num": 2,
    "name": "Driving while license suspended or revoked",
    "category": "Traffic and DUI",
    "commonName": "Driving on a suspended license",
    "meaning": "Driving after the state has taken your driving privilege away — because of a DUI, unpaid tickets, too many points, no insurance, or another reason — before it is officially reinstated.",
    "elements": [
      "You were driving a vehicle on a covered roadway",
      "Your license or privilege was suspended or revoked at that time",
      "In most states, that you knew (or had been notified) about the suspension"
    ],
    "classification": "Misdemeanor (a petty misdemeanor or low-level misdemeanor for a first offense in many states; higher when the suspension was DUI-related).",
    "penaltyRange": "Fines commonly in the low hundreds, possible jail from a few days up to 6 months, and an extension of the suspension period.",
    "wantToKnow": [
      "\"I didn't know it was suspended\" is the most common defense issue — states handle the notice requirement differently, and mail to an old address is a frequent real-world problem (keeping your address current with the MVD matters).",
      "Getting reinstated before the court date — paying what is owed and restoring the license — often improves the outcome more than anything said in court.",
      "Driving while revoked for DUI is treated much more seriously than driving while suspended for unpaid tickets in most states."
    ]
  },
  {
    "id": "reckless-driving",
    "num": 3,
    "name": "Reckless driving",
    "category": "Traffic and DUI",
    "commonName": "Reckless driving",
    "meaning": "Driving with a willful or wanton disregard for the safety of people or property — much more than a simple mistake or ordinary carelessness. Examples: extreme speeding, racing, weaving through traffic, passing on a blind curve.",
    "elements": [
      "You were driving a vehicle",
      "You drove carelessly and in a manner showing disregard for safety (the exact wording varies by state)"
    ],
    "classification": "Misdemeanor in most states (a traffic infraction in a few).",
    "penaltyRange": "Fines commonly up to about $1,000 and jail up to 90 days–6 months in many states, plus license points; some states suspend the license.",
    "wantToKnow": [
      "Unlike a speeding ticket, reckless driving is usually a criminal charge, so it can leave a criminal record.",
      "It is a common negotiated reduction from DUI in some places — but not available everywhere, and it still carries points and record consequences.",
      "Very high speed alone (for example, 25+ mph over the limit) can be charged as reckless in some states even without other bad driving."
    ]
  },
  {
    "id": "speeding",
    "num": 4,
    "name": "Speeding",
    "category": "Traffic and DUI",
    "commonName": "Speeding ticket",
    "meaning": "Driving faster than the posted limit, or faster than is reasonable for conditions (rain, ice, traffic) even below the posted limit.",
    "elements": [
      "You were driving",
      "Your speed exceeded the legal limit or was unreasonable for the conditions (usually shown by radar, laser, pacing, or an officer's observation)"
    ],
    "classification": "Infraction / civil traffic violation in most states — not a crime. At extreme speeds it can be charged as reckless driving instead (see above).",
    "penaltyRange": "A fine that rises with speed (often roughly $25–$500), plus court costs and license points. No jail for a plain speeding ticket in most states.",
    "wantToKnow": [
      "Points add up: too many in a set period can suspend your license even though each ticket was \"just a fine.\"",
      "Many states allow traffic school or a defensive-driving course to keep a ticket off your record or reduce points — usually only once in a set period, and usually you must ask before paying.",
      "Simply paying the ticket is normally the same as admitting it — the points and record consequences follow automatically."
    ]
  },
  {
    "id": "driving-without-insurance",
    "num": 5,
    "name": "Driving without insurance",
    "category": "Traffic and DUI",
    "commonName": "No insurance / no proof of insurance",
    "meaning": "Driving (or owning and operating) a vehicle without the state-required minimum liability insurance — or failing to show proof of it when stopped.",
    "elements": [
      "You were operating the vehicle",
      "The vehicle was not covered by the required insurance at that time (for the \"no proof\" version: that you did not provide valid proof on demand)"
    ],
    "classification": "Infraction or petty misdemeanor in most states.",
    "penaltyRange": "Fines commonly a few hundred dollars (higher for repeat offenses), and in many states suspension of the license and/or registration until proof of insurance is filed.",
    "wantToKnow": [
      "There is a big practical difference between having insurance but not having the card with you (often dismissed or reduced when you show proof covering the stop date) and not having insurance at all.",
      "Many states require an SR-22 or similar proof-of-financial-responsibility filing afterward, which can raise insurance costs for years.",
      "Letting a policy lapse for non-payment is the most common cause — the insurer usually notifies the state."
    ]
  },
  {
    "id": "leaving-the-scene-of-an-accident",
    "num": 6,
    "name": "Leaving the scene of an accident (hit and run)",
    "category": "Traffic and DUI",
    "commonName": "Hit and run",
    "meaning": "Being in a crash and leaving without stopping, identifying yourself, and — where someone is hurt — helping arrange aid, as the law requires.",
    "elements": [
      "You were driving a vehicle involved in a collision",
      "You knew (or reasonably should have known) a collision occurred",
      "You left without stopping and providing required information/aid and without following the reporting rules"
    ],
    "classification": "Misdemeanor when only property is damaged; a felony in every state when someone is injured or killed.",
    "penaltyRange": "Property-damage cases: fines up to roughly $1,000 and up to 6–12 months jail in many states, plus license consequences. Injury/death cases: felony exposure measured in years of prison.",
    "wantToKnow": [
      "The duty applies even if the other vehicle was empty or the damage looked minor — for unattended property, most states require leaving a note and/or reporting to police.",
      "\"I panicked and went home\" does not erase the duty, but turning yourself in promptly is very different from being found later.",
      "Insurance and civil liability for the damage exist in addition to the criminal charge. ---"
    ]
  },
  {
    "id": "shoplifting",
    "num": 7,
    "name": "Shoplifting",
    "category": "Theft and Property",
    "commonName": "Shoplifting (in many states, formally charged as a form of theft)",
    "meaning": "Taking merchandise from a store without paying, hiding it, switching price tags, or otherwise trying to leave with it — with the intent to keep it without paying. In most states you do not have to make it out the door; concealing items inside the store can be enough.",
    "elements": [
      "You took, concealed, or altered the price of merchandise",
      "The merchandise belonged to the store",
      "You intended to deprive the store of it without paying"
    ],
    "classification": "Graded by value in almost every state — petty misdemeanor at low values, rising through misdemeanor to felony at higher values.",
    "penaltyRange": "NM example: under $250 is a petty misdemeanor (up to 6 months and/or up to $500); $250–$500 a misdemeanor; $500–$2,500 a fourth-degree felony (up to 18 months prison). Stores may also send a separate civil demand letter for damages, which is allowed in many states on top of the criminal case.",
    "wantToKnow": [
      "First-offense, low-value cases are the ones most often resolved with diversion, community service, or a deferred sentence where those programs exist.",
      "The store's civil demand letter and the criminal case are two different things — paying one does not automatically end the other.",
      "A theft conviction is treated as a \"crime of dishonesty\" and tends to hurt job applications more than many other misdemeanors."
    ]
  },
  {
    "id": "theft-larceny",
    "num": 8,
    "name": "Theft / larceny",
    "category": "Theft and Property",
    "commonName": "Theft (called larceny in some states)",
    "meaning": "Taking or keeping someone else's property — money, goods, services — without permission and with the intent to deprive the owner of it, permanently or for so long it loses its value.",
    "elements": [
      "You took or exercised control over property",
      "The property belonged to someone else",
      "You did not have the owner's consent",
      "You intended to deprive the owner of it"
    ],
    "classification": "Graded by value nearly everywhere: petty misdemeanor/misdemeanor at low value bands, felony above thresholds that commonly start somewhere between $500 and $2,500 depending on the state.",
    "penaltyRange": "From fines and up to 6–12 months (low-value misdemeanor) up to multiple years in prison for high-value felony theft; restitution to the victim is routinely ordered at every level.",
    "wantToKnow": [
      "\"I meant to bring it back\" can matter — theft requires intent to deprive — but keeping property for a long time or treating it as your own undercuts that claim.",
      "Borrowing disputes and unpaid debts are usually civil matters, not theft, unless deception was used from the start.",
      "Theft from an employer, theft of a firearm, and theft from an elderly person are commonly charged or punished more harshly."
    ]
  },
  {
    "id": "burglary",
    "num": 9,
    "name": "Burglary",
    "category": "Theft and Property",
    "commonName": "Burglary (\"breaking and entering\" is the older phrase)",
    "meaning": "Entering a building, home, or (in many states) a vehicle without permission with the intent to commit a crime inside — usually theft or an assault. Nothing actually has to be stolen, and no actual \"breaking\" is required: walking through an unlocked door can qualify.",
    "elements": [
      "You entered (or remained in) a structure/property",
      "Without authority or permission",
      "With the intent to commit a crime inside"
    ],
    "classification": "Felony in nearly every state. Burglary of a home (dwelling) is graded highest; entering while armed or hurting someone raises it further.",
    "penaltyRange": "Commonly from about 1 year up to 10+ years in prison depending on the grade, the type of structure, and whether anyone was inside or a weapon was involved.",
    "wantToKnow": [
      "The intent is judged at the moment of entry — entering to steal is burglary even if you leave empty-handed.",
      "Entering your own home or a place you have a legal right to be is generally not burglary, which is why these cases often turn on permission (and, in domestic situations, on whose name is on the lease and any court orders).",
      "In New Mexico, burglary is a felony (fourth degree for most structures; third degree for a dwelling), and burglary of a vehicle is also a felony — a point that surprises many people."
    ]
  },
  {
    "id": "criminal-trespass",
    "num": 10,
    "name": "Criminal trespass",
    "category": "Theft and Property",
    "commonName": "Trespassing",
    "meaning": "Entering or staying on someone else's property after being told not to — by signs, fencing, or a direct warning — or refusing to leave when asked by the owner or police.",
    "elements": [
      "You entered or remained on property",
      "Without permission, or after notice (posted signs, a verbal warning, or a prior notice) that entry was forbidden",
      "In most states, that you knew you were not allowed"
    ],
    "classification": "Petty misdemeanor or misdemeanor in most states; higher for homes, schools, or repeat offenses.",
    "penaltyRange": "Fines commonly up to about $500–$1,000 and jail up to 6 months for a standard misdemeanor version; often resolved with a fine and a stay-away condition.",
    "wantToKnow": [
      "Returning to a store or property after a formal \"trespass warning\" or \"no-trespass notice\" is the most common way this gets charged.",
      "A genuine claim of right — honestly believing you had permission or a legal right to be there (for example, retrieving your own property) — is a frequent issue in these cases.",
      "In housing situations, tenants and people who actually live at an address are often not \"trespassers\" there even if their name is not on the lease; police and courts look at who resides there."
    ]
  },
  {
    "id": "criminal-damage-to-property",
    "num": 11,
    "name": "Criminal damage to property (vandalism / criminal mischief)",
    "category": "Theft and Property",
    "commonName": "Vandalism; criminal mischief; criminal damage to property (names vary by state)",
    "meaning": "Intentionally damaging, destroying, or defacing property that belongs to someone else — breaking windows, keying a car, graffiti, slashing tires.",
    "elements": [
      "You damaged or destroyed property",
      "The property belonged to someone else",
      "You acted intentionally or knowingly (an accident is not enough)",
      "The amount of damage (which usually sets the charge level)"
    ],
    "classification": "Graded by repair cost — misdemeanor at low amounts, felony above thresholds commonly around $1,000 in many states.",
    "penaltyRange": "Misdemeanor versions commonly carry fines up to about $1,000 and up to 6–12 months; felony versions run from about a year upward. Restitution for the repair is routine.",
    "wantToKnow": [
      "The damage amount matters a lot and is often estimated aggressively — repair quotes can decide misdemeanor vs. felony.",
      "Graffiti tools/possession and gang-related enhancements exist in some states.",
      "When the property belongs to a spouse, partner, or household member, this is often charged alongside domestic offenses and can carry extra conditions (see the domestic category)."
    ]
  },
  {
    "id": "receiving-or-concealing-stolen-property",
    "num": 12,
    "name": "Receiving or concealing stolen property",
    "category": "Theft and Property",
    "commonName": "Receiving stolen property",
    "meaning": "Buying, keeping, hiding, or selling property that was stolen, when you knew — or had reason to know — it was stolen.",
    "elements": [
      "The property was in fact stolen",
      "You received, possessed, concealed, or disposed of it",
      "You knew or should have known it was stolen"
    ],
    "classification": "Graded by value like theft in most states — misdemeanor at low values, felony at higher ones.",
    "penaltyRange": "Tracks theft penalties for the same value band; restitution is common.",
    "wantToKnow": [
      "\"I didn't steal it, I just bought it cheap\" is exactly the situation this charge covers — a price far below value is often used as evidence you knew.",
      "Pawn shops and resale platforms create paper trails that are commonly used in these cases.",
      "Returning the property helps practically but does not by itself erase a charge that was already filed. ---"
    ]
  },
  {
    "id": "assault",
    "num": 13,
    "name": "Assault (simple)",
    "category": "Assault and Battery",
    "commonName": "Simple assault",
    "meaning": "Trying to hit or hurt someone, or acting in a way that makes someone reasonably fear they are about to be hit or hurt — swinging and missing, lunging, threatening with raised fists. In states without a separate battery charge, \"assault\" also covers actual hitting.",
    "elements": [
      "You attempted to commit a battery/touching, or did an act (or made a threat, in states that include words alone) meant to put the person in fear of an immediate unlawful touching",
      "The other person was actually placed in reasonable fear (in threat-based versions)",
      "You had the apparent ability to carry it out"
    ],
    "classification": "Petty misdemeanor or misdemeanor in most states. NM example: simple assault is a petty misdemeanor in New Mexico (up to 6 months and/or up to $500).",
    "penaltyRange": "Fines up to about $500–$1,000 and jail up to 6–12 months depending on the state and level.",
    "wantToKnow": [
      "In most states, words alone — insults, even ugly ones — are not assault unless they come with an act showing the threat is immediate.",
      "Pointing a weapon, even unloaded, usually moves the case into aggravated assault (felony) territory.",
      "Mutual fights are messy: both people are often charged, and \"he started it\" is handled at trial or negotiation, not at the roadside."
    ]
  },
  {
    "id": "battery",
    "num": 14,
    "name": "Battery (simple)",
    "category": "Assault and Battery",
    "commonName": "Simple battery",
    "meaning": "Actually touching or striking another person in an unlawful, rude, or angry way — a punch, slap, shove, spitting, throwing something that hits them. No injury is required in most states.",
    "elements": [
      "You touched or struck another person (directly or with an object)",
      "The touching was unlawful — not consented to, not legally justified (not self-defense, not a lawful arrest, etc.)",
      "You acted intentionally"
    ],
    "classification": "Misdemeanor (petty misdemeanor in New Mexico). NM example: simple battery is a petty misdemeanor (up to 6 months and/or up to $500).",
    "penaltyRange": "Fines up to about $500–$1,000 and jail up to 6–12 months; probation with anger-management or similar classes is common for first offenses.",
    "wantToKnow": [
      "Battery does not require bruises or injury — the unlawful touching is the crime; injuries raise it to aggravated battery.",
      "Spitting on someone is charged as battery in many states.",
      "When the other person is a household member, most states charge a separate, more serious domestic version (see entry 27)."
    ]
  },
  {
    "id": "aggravated-assault",
    "num": 15,
    "name": "Aggravated assault",
    "category": "Assault and Battery",
    "commonName": "Aggravated assault (assault with a deadly weapon is a common version)",
    "meaning": "Assault committed with a deadly weapon, or with intent to commit a serious felony, or against a protected victim (police officer, teacher, healthcare worker) in states with those enhancements.",
    "elements": [
      "All the elements of assault, plus",
      "Use or threatened use of a deadly weapon, or intent to commit a serious crime, or a protected-victim circumstance (depending on the state's version)"
    ],
    "classification": "Felony in nearly every state. NM example: aggravated assault is a fourth-degree felony in New Mexico (up to 18 months), higher with certain victims or circumstances.",
    "penaltyRange": "Commonly about 1–5 years in prison for the base felony version, more with firearm enhancements or protected victims.",
    "wantToKnow": [
      "\"Deadly weapon\" can include everyday objects used in a threatening way — a vehicle, a bottle, a tool — depending on how they were used.",
      "A firearm can add a mandatory enhancement in many states (in New Mexico, a firearm enhancement can add mandatory prison time to a felony sentence).",
      "Brandishing/displaying a weapon during an argument is the classic fact pattern."
    ]
  },
  {
    "id": "aggravated-battery",
    "num": 16,
    "name": "Aggravated battery",
    "category": "Assault and Battery",
    "commonName": "Aggravated battery",
    "meaning": "Battery that causes serious injury (\"great bodily harm\" — injuries creating a high risk of death, serious disfigurement, or loss/impairment of a body part), or battery committed with a deadly weapon, or battery against a protected victim.",
    "elements": [
      "All the elements of battery, plus",
      "Great bodily harm, or use of a deadly weapon, or a protected-victim circumstance (depending on the state's version)"
    ],
    "classification": "Felony everywhere. NM example: third-degree felony when great bodily harm or a deadly weapon is involved (up to 3 years); fourth-degree for lesser aggravated versions in New Mexico.",
    "penaltyRange": "Commonly about 1–6 years in prison for mid-level versions, more for the most serious injuries or firearm use.",
    "wantToKnow": [
      "The medical evidence (records, photos, doctor opinions about the injury) usually decides which level gets charged.",
      "Broken bones, stitches, and loss of consciousness are commonly treated as great bodily harm; a black eye or bruising usually is not, though it varies.",
      "Self-defense claims come up constantly in these cases; who was the aggressor matters."
    ]
  },
  {
    "id": "resisting-evading-or-obstructing-an-officer",
    "num": 17,
    "name": "Resisting, evading, or obstructing an officer",
    "category": "Assault and Battery",
    "commonName": "Resisting arrest",
    "meaning": "Physically resisting an arrest, running or hiding from police who are lawfully trying to stop or arrest you, or interfering with an officer doing their job.",
    "elements": [
      "A law enforcement officer was performing an authorized duty (stop, arrest, service)",
      "You resisted, evaded, fled, or obstructed",
      "You knew (or reasonably should have known) the person was an officer"
    ],
    "classification": "Misdemeanor in most states (a felony when it involves a vehicle flight at dangerous speeds, or injuries to the officer).",
    "penaltyRange": "Fines up to about $1,000 and up to 6–12 months for the misdemeanor version; felony flight versions carry prison exposure.",
    "wantToKnow": [
      "In many states you can be charged with resisting even if the underlying arrest is later found unlawful — the charge is about the resistance, though states differ.",
      "Simply arguing, asking questions, or recording police is generally not resisting; physical interference or flight is.",
      "This charge very often appears added onto other charges from the same encounter. ---"
    ]
  },
  {
    "id": "possession-of-a-controlled-substance",
    "num": 18,
    "name": "Possession of a controlled substance",
    "category": "Drug Possession",
    "commonName": "Drug possession (possession of methamphetamine, cocaine, heroin, fentanyl, pills without a prescription, and similar)",
    "meaning": "Knowingly having a controlled substance on your person, in your car, or in a place you control, without a valid prescription or other legal authorization.",
    "elements": [
      "The substance is a controlled substance (usually confirmed by a lab test)",
      "You possessed it — actual (on you) or constructive (in a place under your control)",
      "You knew you possessed it (most states also require knowledge of what it was, though the details vary)"
    ],
    "classification": "Varies more than almost any other charge. Small amounts for personal use are a misdemeanor in some states and a felony in others; some states have moved toward citation/deflection models for tiny amounts. Larger amounts, or certain drugs, are felonies nearly everywhere.",
    "penaltyRange": "From fines and probation (low-level, first offense, in many places) to multiple years in prison for felony-level amounts and repeat records.",
    "wantToKnow": [
      "\"It wasn't mine, it was in my friend's car/seat/pocket\" is the central fight in constructive-possession cases — proximity alone is usually not supposed to be enough, but other facts (statements, fingerprints, whose belongings were around it) get used.",
      "Prescription pills outside their bottle, or someone else's prescription, are a frequent trap — a valid prescription is a defense, but you may have to prove it.",
      "First-offense possession cases are the ones most often routed to drug court, diversion, or treatment-based resolutions where those exist."
    ]
  },
  {
    "id": "possession-of-marijuana",
    "num": 19,
    "name": "Possession of marijuana",
    "category": "Drug Possession",
    "commonName": "Marijuana possession",
    "meaning": "Having marijuana (cannabis) in an amount or situation the state still prohibits.",
    "elements": [
      "You possessed marijuana",
      "The amount or circumstances exceeded what the state allows (where any amount is allowed)",
      "You knew you possessed it"
    ],
    "classification": "State-dependent to the extreme. NM example: adults 21+ may legally possess up to 2 ounces of cannabis flower (with set limits for extracts and edibles) in New Mexico; possession above the legal limits, possession by someone under 21, and unlicensed selling are still offenses — smaller violations are petty misdemeanors with small fines, and large amounts are felonies. In states without legalization, small amounts commonly range from a civil infraction/fine to a misdemeanor; in some states any amount remains criminal.",
    "penaltyRange": "From a small civil fine (about $25–$100 in decriminalized places) to misdemeanor fines/jail where still criminal, to felony exposure for amounts suggesting distribution.",
    "wantToKnow": [
      "Legal in your state does not mean legal federally — federal property, federal jobs, and some housing and immigration situations follow federal law, where marijuana remains a controlled substance.",
      "Legal purchase does not legalize public use, driving after use (DUI laws still apply), or taking it across state lines.",
      "Old marijuana convictions: several legalization states created record-clearing (expungement/sealing) processes for them — worth checking rather than assuming nothing can be done."
    ]
  },
  {
    "id": "possession-of-drug-paraphernalia",
    "num": 20,
    "name": "Possession of drug paraphernalia",
    "category": "Drug Possession",
    "commonName": "Paraphernalia possession",
    "meaning": "Having items used to consume, prepare, or package illegal drugs — pipes, syringes, scales, baggies with residue — when the circumstances tie them to drug use.",
    "elements": [
      "You possessed the item",
      "The item is paraphernalia under the state's definition (often shown by residue, proximity to drugs, or statements)",
      "You intended it for drug use/preparation (in most states)"
    ],
    "classification": "Petty misdemeanor or misdemeanor in most states that criminalize it; some states have removed penalties, especially for harm-reduction supplies like syringes and testing strips.",
    "penaltyRange": "Fines commonly up to about $100–$500 and up to 6 months for the misdemeanor version; frequently resolved with a fine.",
    "wantToKnow": [
      "This charge almost always rides along with a possession charge from the same stop or search.",
      "Ordinary household items (spoons, baggies, scales) become \"paraphernalia\" legally through context — residue and nearby drugs are the usual proof.",
      "Several states have carved out fentanyl test strips and sterile syringes from the definition; the law in this corner changes often."
    ]
  },
  {
    "id": "possession-with-intent-to-distribute-deliver",
    "num": 21,
    "name": "Possession with intent to distribute / deliver",
    "category": "Drug Possession",
    "commonName": "Possession with intent (PWID)",
    "meaning": "Having a controlled substance and intending to sell or give it to someone else. No actual sale has to happen — the intent is inferred from the amount, packaging, scales, cash, messages, and similar evidence.",
    "elements": [
      "You possessed a controlled substance",
      "You intended to distribute/deliver it (inferred from quantity and circumstances)",
      "Knowledge of the substance"
    ],
    "classification": "Felony in essentially every state, graded by drug type and amount.",
    "penaltyRange": "From about a year to well over a decade in prison depending on the drug, the amount, and prior record; the most serious drug quantities and fentanyl cases sit at the top of the scale in most states.",
    "wantToKnow": [
      "There is usually no magic weight where \"personal use\" becomes \"intent\" — a moderate amount split into many small baggies can be charged as intent, and a large amount in one container can still be argued as personal.",
      "Sharing drugs with a friend can legally count as \"distribution\" in many states even with no money involved.",
      "Texts and messages are the most common modern evidence of intent. ---"
    ]
  },
  {
    "id": "disorderly-conduct",
    "num": 22,
    "name": "Disorderly conduct",
    "category": "Disorderly Conduct and Public Offenses",
    "commonName": "Disorderly conduct (sometimes \"disturbing the peace\")",
    "meaning": "Behaving in a disruptive way in public that alarms, angers, or disturbs others — fighting, making unreasonable noise, using abusive language likely to provoke a violent response, refusing a lawful order to disperse, or similar conduct. It is the classic \"catch-all\" charge.",
    "elements": [
      "You engaged in the specific conduct the statute covers (fighting, noise, gestures, refusing to disperse, etc.)",
      "In a public place (or place visible/audible to the public, depending on the state)",
      "With intent to disturb, or recklessness about disturbing, the peace"
    ],
    "classification": "Petty misdemeanor or misdemeanor in most states.",
    "penaltyRange": "Fines commonly up to about $250–$1,000 and jail from 0 up to 6 months; very often resolved with a fine, community service, or a dismissal after a clean period.",
    "wantToKnow": [
      "Because the definitions are broad, free-speech limits matter: courts have repeatedly struck down applications based on profanity or insults alone directed at no one in particular — but speech likely to provoke immediate violence (\"fighting words\") is treated differently.",
      "This is one of the most frequently reduced or dismissed charges in plea negotiations, especially for first offenses.",
      "Being loud or rude to police is often charged as disorderly conduct; whether the facts fit the statute is a separate question a court decides later."
    ]
  },
  {
    "id": "public-intoxication",
    "num": 23,
    "name": "Public intoxication",
    "category": "Disorderly Conduct and Public Offenses",
    "commonName": "Public intoxication / drunk in public",
    "meaning": "Being visibly intoxicated by alcohol or drugs in a public place to the point of endangering yourself or others, or causing a disturbance.",
    "elements": [
      "You were in a public place",
      "You were under the influence",
      "In most versions, you endangered yourself/others or disturbed others (simple influence alone is not enough in some states)"
    ],
    "classification": "Misdemeanor where it is a crime at all — an important caveat: a number of states do not criminalize public intoxication and instead allow protective custody (being held until sober) without a charge.",
    "penaltyRange": "Where criminal: fines commonly up to about $250–$1,000 and jail up to 30–90 days; in practice often time-served or a fine.",
    "wantToKnow": [
      "Simply being drunk is treated differently across states — some require dangerous or disruptive behavior on top of intoxication.",
      "A \"protective custody\" hold is not supposed to be an arrest or create a criminal record, but paperwork from the night is worth checking afterward.",
      "Repeat public-intoxication arrests sometimes trigger court-ordered treatment rather than more jail."
    ]
  },
  {
    "id": "open-container-in-a-vehicle",
    "num": 24,
    "name": "Open container in a vehicle",
    "category": "Disorderly Conduct and Public Offenses",
    "commonName": "Open container",
    "meaning": "Having an open alcoholic beverage container — or drinking — in the passenger area of a vehicle on a public road. Nearly every state has this law because federal highway funding encourages it.",
    "elements": [
      "An alcoholic beverage container was open (or had been opened, or was partly empty) in the passenger area",
      "The vehicle was on a public highway/road (in many states, including parked)",
      "You were a person the statute covers (driver and/or passengers, depending on the state)"
    ],
    "classification": "Infraction or petty misdemeanor in most states.",
    "penaltyRange": "Fines most commonly in the $100–$500 range; usually no jail for the basic version.",
    "wantToKnow": [
      "Locked storage matters: in most states, an open container in a locked trunk or locked glove box is legal — the law targets the passenger area.",
      "Resealed wine bottles from a restaurant are specifically allowed in many states if stored out of reach.",
      "An open-container stop often leads to a DUI investigation — the two charges are different and can be filed independently."
    ]
  },
  {
    "id": "indecent-exposure",
    "num": 25,
    "name": "Indecent exposure",
    "category": "Disorderly Conduct and Public Offenses",
    "commonName": "Indecent exposure (public lewdness in some states)",
    "meaning": "Intentionally exposing your genitals in a public place (or where others can see) in a way likely to offend or alarm — in most states, the exposure must be deliberate and lewd, not accidental.",
    "elements": [
      "You exposed yourself (the specific body parts are defined by statute)",
      "In public or in view of others",
      "Intentionally/lewdly, or recklessly as to whether others would see and be offended (version varies by state)"
    ],
    "classification": "Misdemeanor for a first offense in most states; felony with repeat offenses, child victims, or in states that grade by victim age.",
    "penaltyRange": "Misdemeanor versions commonly carry fines up to about $1,000 and up to 6–12 months; repeat or aggravated versions carry felony exposure.",
    "wantToKnow": [
      "Accidents are not supposed to be crimes — breastfeeding, changing clothes, dress malfunctions, and in many places urinating outdoors are legally distinct fights (public urination is more often charged as disorderly conduct or a local ordinance violation, though exposure charges do get filed).",
      "Sex-offender registration is the biggest long-term issue: some states require it for this charge (sometimes only for repeat offenses or child victims), others do not. This varies enormously and is worth checking first.",
      "\"Mooning\" and streaking do get charged, despite the joke framing."
    ]
  },
  {
    "id": "disturbing-the-peace",
    "num": 26,
    "name": "Disturbing the peace",
    "category": "Disorderly Conduct and Public Offenses",
    "commonName": "Disturbing the peace (in many states this is the same charge family as disorderly conduct)",
    "meaning": "Disturbing others' peace and quiet by loud or unreasonable noise, fighting in public, or (in states with a verbal version) using offensive words in public likely to provoke a violent reaction.",
    "elements": [
      "You did one of the covered acts (noise, fighting, provoking words)",
      "The conduct disturbed the peace of another person or the public",
      "You acted maliciously/willfully (in versions with that element)"
    ],
    "classification": "Infraction or misdemeanor depending on the state; in some states it exists only as a lesser included offense of disorderly conduct.",
    "penaltyRange": "Infraction versions: a fine only (commonly up to about $250). Misdemeanor versions: fines up to about $1,000 and up to 90 days–6 months.",
    "wantToKnow": [
      "Noise cases often turn on local ordinances and measurable facts (time of night, decibel rules, prior warnings).",
      "It is one of the most common reduced charges — prosecutors frequently offer it to settle assault, battery, or resisting cases with no admission to the original charge.",
      "Where it is an infraction, there is usually no right to a jury trial and no criminal record of the usual kind — but the ticket still must be answered. ---"
    ]
  },
  {
    "id": "battery-against-a-household-member",
    "num": 27,
    "name": "Battery against a household member (domestic battery)",
    "category": "Domestic-Related Offenses",
    "commonName": "Domestic battery / domestic violence battery",
    "meaning": "The same unlawful touching as simple battery, but committed against a \"household member\" — which in most states includes a spouse or former spouse, dating or intimate partner, co-parent, family member, or someone who lives (or lived) with you.",
    "elements": [
      "All the elements of battery (entry 14)",
      "The victim was a household member as the statute defines it"
    ],
    "classification": "Misdemeanor for a first offense in most states, rising to a felony on repeat offenses — NM example: in New Mexico, a first offense is a misdemeanor and a second or later offense is a fourth-degree felony. Assault (threat/attempt) against a household member is graded higher than ordinary assault as well.",
    "penaltyRange": "First offense commonly up to 6–12 months with fines up to about $1,000, plus mandatory counseling in many states; repeat/felony versions carry prison exposure of a year or more.",
    "wantToKnow": [
      "A conviction usually triggers a federal firearm ban for the person convicted (misdemeanor crimes of domestic violence are covered), plus lasting effects on custody, immigration, and some jobs.",
      "The victim asking to drop the charges does not end the case — the prosecutor, not the victim, decides whether to proceed, and cases often continue with 911 recordings and officer testimony instead.",
      "No-contact orders can make the person leave their own home and can be violated accidentally (replying to a text can count) — the conditions deserve a careful read."
    ]
  },
  {
    "id": "violation-of-an-order-of-protection",
    "num": 28,
    "name": "Violation of an order of protection",
    "category": "Domestic-Related Offenses",
    "commonName": "Restraining order violation / violating a protective order",
    "meaning": "Doing something a court order of protection forbids — contacting, approaching, or coming within a set distance of the protected person — after being served with or otherwise legally notified of the order.",
    "elements": [
      "A valid order of protection existed",
      "You knew about the order (usually by being served, or being present when it was issued)",
      "You did an act the order prohibited"
    ],
    "classification": "Misdemeanor in most states for a first offense; felony for repeat violations or violations involving violence, in many states. A judge can also punish the same conduct as contempt of court.",
    "penaltyRange": "Misdemeanor versions commonly up to 6–12 months and fines up to about $1,000; felony versions run to years. Judges treat these violations seriously because they test the court's authority directly.",
    "wantToKnow": [
      "Invitation by the protected person is not a defense in most states — only the court can modify its own order. If the other side starts contact, the safe move is to go back to court, not to respond.",
      "Incidental contact (same grocery store) vs. deliberate contact is a central fight — leaving immediately when you notice the person is the standard protective behavior.",
      "Violations can also be charged in the family case as contempt, affecting custody and visitation."
    ]
  },
  {
    "id": "stalking",
    "num": 29,
    "name": "Stalking",
    "category": "Domestic-Related Offenses",
    "commonName": "Stalking (aggravated stalking when threats or order violations are added)",
    "meaning": "A pattern of conduct — following, showing up, repeated messages, monitoring — directed at a specific person that would make a reasonable person fear for their safety or suffer substantial emotional distress.",
    "elements": [
      "A course of conduct (more than one act) directed at a specific person",
      "You acted knowingly/intentionally (or, in some states, should have known)",
      "The conduct caused, or would cause a reasonable person to feel, fear or substantial distress — and in most states, that the actual person felt it too"
    ],
    "classification": "Ranges from a misdemeanor to a felony for a first offense depending on the state; aggravated versions (credible threat of harm, violating a court order, prior stalking conviction, child victim) are felonies nearly everywhere.",
    "penaltyRange": "Misdemeanor versions up to about a year; felony versions commonly 1–5+ years.",
    "wantToKnow": [
      "One unwanted message is rarely stalking; dozens after being told to stop is the classic pattern — keeping records cuts both ways, and screenshots/messages are the usual evidence.",
      "Legitimate purposes (serving papers, lawful debt collection, picketing) are written into many statutes as exclusions, but the line is fact-specific.",
      "Stalking charges and orders of protection usually travel together — a violation of the order during alleged stalking is the aggravated fact pattern."
    ]
  },
  {
    "id": "child-abuse-and-endangerment",
    "num": 30,
    "name": "Child abuse and endangerment",
    "category": "Domestic-Related Offenses",
    "commonName": "Child endangerment (in New Mexico, \"abandonment or abuse of a child\")",
    "meaning": "Placing a child in a situation that endangers their life or health — leaving a young child alone, driving impaired with a child in the car, exposing a child to drugs or violence, or failing to protect a child from known abuse. Intentionally causing injury to a child is charged as child abuse, which is far more serious.",
    "elements": [
      "You had care, custody, or responsibility for the child (in most versions)",
      "You acted (or failed to act) in a way that endangered the child — many states require the danger to be real and substantial, not theoretical",
      "The mental state the statute requires (negligence-based in many endangerment laws; knowing/intentional for abuse)"
    ],
    "classification": "Misdemeanor for low-level endangerment with no injury in some states; felony in most states when the child is injured, and among the most serious felonies when a child dies. NM example: New Mexico grades abuse of a child by result — negligent abuse not causing great bodily harm sits lower, while intentional abuse resulting in death is a first-degree felony.",
    "penaltyRange": "From fines/probation at the lowest end to decades in prison (up to life in some states) for child death cases. This category has the widest spread in the entire library.",
    "wantToKnow": [
      "A criminal case here almost always comes with a parallel children-services / child-welfare case about custody — the two systems have different rules and deadlines, and the family-court side moves fast.",
      "DUI with a child passenger is separately chargeable or an enhancement in many states, on top of the DUI itself.",
      "Household conditions (drugs within reach, no food, unsafe sleeping) found during unrelated police visits are a common origin of these charges. ---"
    ]
  },
  {
    "id": "carrying-a-concealed-weapon-without-a-license",
    "num": 31,
    "name": "Carrying a concealed weapon without a license",
    "category": "Weapons",
    "commonName": "Unlawful concealed carry / carrying a concealed handgun without a permit",
    "meaning": "Carrying a concealed firearm (in some states, other weapons too) on your person or in your vehicle without the permit the state requires — where the state still requires one.",
    "elements": [
      "You carried a weapon covered by the statute",
      "It was concealed (hidden from ordinary view, in whole or in relevant part)",
      "You lacked the required license/permit or another legal authorization"
    ],
    "classification": "Changed landscape: more than half the states now allow permitless (\"constitutional\") carry for eligible adults, so in those states this charge applies only to people who are disqualified (age, record) or to places where carry is banned. Where permits are required: commonly a misdemeanor for a first offense, sometimes a felony. NM example: New Mexico is a permit state for concealed handguns; carrying a concealed handgun without a license is a petty misdemeanor for a first offense.",
    "penaltyRange": "Petty misdemeanor/misdemeanor versions: fines up to about $500–$1,000 and up to 6–12 months; felony versions exist for repeat or aggravated circumstances.",
    "wantToKnow": [
      "Open carry and concealed carry are regulated separately in many states — one can be legal while the other is not.",
      "A permit from another state may or may not be honored (reciprocity) — and never authorizes carrying in banned places like schools or courthouses.",
      "People legally barred from possessing firearms at all (felony record, certain domestic convictions) face the much more serious charge in entry 32 instead."
    ]
  },
  {
    "id": "felon-in-possession-of-a-firearm",
    "num": 32,
    "name": "Felon in possession of a firearm",
    "category": "Weapons",
    "commonName": "Felon in possession (FIP)",
    "meaning": "A person who has been convicted of a felony (and in some categories, certain other people — see below) possessing, owning, or having access to a firearm or ammunition.",
    "elements": [
      "You have a prior conviction (or status) that disqualifies you",
      "You knowingly possessed a firearm (actual or constructive — including one stored where you control it)",
      "Firearm function/definition elements under the applicable law"
    ],
    "classification": "Felony at both the state and federal level. Federal law separately prohibits possession by several categories: convicted felons, people under felony indictment, fugitives, unlawful drug users, people with qualifying domestic-violence convictions or protective orders, and others.",
    "penaltyRange": "State versions commonly carry several years (in New Mexico, a second-degree felony range for a felon in possession — roughly up to 9 years); federal law allows up to 15 years for the basic offense, with much higher mandatory minimums for people with multiple violent/drug felonies. [Penalty figures given at the level of confidence appropriate for general information — exact ranges depend on the charging jurisdiction.]",
    "wantToKnow": [
      "\"It's my spouse's/roommate's gun\" is not an automatic shield — shared access to a home or car where a gun is kept is the standard constructive-possession fight.",
      "Rights restoration is real but specific: some states restore firearm rights after time or by pardon; a state restoration does not always remove the federal bar.",
      "Ammunition alone counts under the federal law, and a single traffic stop with a borrowed gun is the classic fact pattern."
    ]
  },
  {
    "id": "negligent-use-of-a-deadly-weapon-unlawful-discha",
    "num": 33,
    "name": "Negligent use of a deadly weapon / unlawful discharge",
    "category": "Weapons",
    "commonName": "Negligent use of a firearm; illegal discharge (names vary)",
    "meaning": "Firing a gun carelessly or in a prohibited place — shooting within city limits, shooting across a road, firing into the air or at a building — or handling a weapon in a dangerous way while intoxicated.",
    "elements": [
      "You discharged or handled a deadly weapon",
      "In a manner or place the statute forbids (within set distances of buildings/roads, within a municipality, while intoxicated, endangering another)",
      "With the carelessness or knowledge the statute requires"
    ],
    "classification": "Petty misdemeanor or misdemeanor for the basic versions; a felony when someone is endangered seriously or injured (then aggravated charges usually apply instead).",
    "penaltyRange": "Basic versions commonly carry fines up to about $500–$1,000 and up to 6–12 months; shooting into an occupied building or vehicle is a serious felony in most states.",
    "wantToKnow": [
      "\"Celebratory\" gunfire into the air is prosecuted under these laws, and bullets coming down injuring someone upgrades the case dramatically.",
      "Self-defense and lawful hunting/target shooting are the standard lawful-use exclusions — location and circumstances decide.",
      "Many city ordinances ban discharge inside city limits separately from state law, so two tickets can come from one shot. ---"
    ]
  },
  {
    "id": "forgery",
    "num": 34,
    "name": "Forgery",
    "category": "Fraud and False Statements",
    "commonName": "Forgery",
    "meaning": "Making, signing, altering, or using a false writing — a check, signature, ID, deed, prescription, or document — with the intent to defraud someone.",
    "elements": [
      "You made, altered, signed, or passed/used a writing",
      "The writing was false (or falsely presented as genuine)",
      "You intended to defraud or deceive"
    ],
    "classification": "Felony in most states, graded by the type of document and the loss involved; some states keep low-value forgery as a high misdemeanor.",
    "penaltyRange": "Commonly about 1–5 years for mid-level versions, more for government documents, deeds, or large losses; restitution routine.",
    "wantToKnow": [
      "Signing someone else's name with genuine permission (for example, an authorized signer on an account) is not forgery — the fraud intent and lack of authority are the heart of the charge.",
      "Merely possessing or passing a forged check you did not make can still be charged (as forgery or a related \"uttering\" offense) if you knew it was false.",
      "Signing for a spouse or parent \"because they would have said yes\" is a common and risky fact pattern."
    ]
  },
  {
    "id": "identity-theft",
    "num": 35,
    "name": "Identity theft",
    "category": "Fraud and False Statements",
    "commonName": "Identity theft (criminal impersonation / fraudulent use of identifying information in some states)",
    "meaning": "Using someone else's personal identifying information — name, Social Security number, bank or card numbers, login credentials — without permission, to get money, goods, services, credit, or to avoid arrest or other obligations.",
    "elements": [
      "You used or possessed another person's identifying information",
      "Without their consent",
      "With intent to defraud, obtain something of value, or cause loss (depending on the state's version)"
    ],
    "classification": "Felony in most states, graded by loss amount and number of victims; small-loss versions are high misdemeanors in some states. Federal identity-theft charges also exist.",
    "penaltyRange": "Commonly about 1–7 years for mid-range versions, rising steeply with loss amounts and victim counts; restitution is central.",
    "wantToKnow": [
      "Using a relative's information \"with informal permission\" is a recurring dispute — consent is the line, and it is judged by what was actually agreed.",
      "Giving a false name or someone else's ID to police during a stop or arrest is usually charged as identity theft or a related false-identity offense — the most common everyday version of this charge.",
      "Victims have a separate paper trail to fix (credit freezes, FTC and police reports) that runs alongside any criminal case."
    ]
  },
  {
    "id": "issuing-a-worthless-check",
    "num": 36,
    "name": "Issuing a worthless check",
    "category": "Fraud and False Statements",
    "commonName": "Bad check / bounced check charge",
    "meaning": "Writing or passing a check you know will not be paid — because the account is closed, empty, or nonexistent — to obtain goods, services, or money. A check that bounces because of an honest banking mistake is not supposed to be this crime.",
    "elements": [
      "You issued/passed the check",
      "You knew at the time that funds were insufficient or the account did not exist",
      "In many states, that the check went unpaid after formal notice and a grace period (commonly about 10 days after a mailed demand)"
    ],
    "classification": "Graded by amount — petty misdemeanor/misdemeanor at low amounts, felony at higher thresholds.",
    "penaltyRange": "Low-level versions commonly carry fines and up to 6–12 months; making full restitution (check amount plus bank and court fees) before or at court is often central to the outcome.",
    "wantToKnow": [
      "Most states build in a notice-and-cure window: the prosecutor or merchant must usually send a written demand first, and paying within the window stops the charge.",
      "Post-dated checks and \"hold this check until Friday\" arrangements are generally not covered, because the receiver knew the money was not there yet.",
      "A civil lawsuit for the amount (often with statutory penalties) can proceed regardless of the criminal case."
    ]
  },
  {
    "id": "false-reporting-false-information-to-law-enforce",
    "num": 37,
    "name": "False reporting / false information to law enforcement",
    "category": "Fraud and False Statements",
    "commonName": "False report; filing a false police report; false informing",
    "meaning": "Knowingly giving police (or another covered official) false information — reporting a crime that did not happen, lying about who committed an offense, giving a false name, or (in the most serious versions) making a fake emergency call that sends a SWAT or emergency response (\"swatting\").",
    "elements": [
      "You made a report or statement to law enforcement (or called in a false emergency)",
      "It was false in a material way",
      "You knew it was false (being mistaken is not enough)"
    ],
    "classification": "Misdemeanor for the basic versions; felony where a false emergency response causes injury or death, or where the false report accuses someone of a serious crime in states that grade it that way.",
    "penaltyRange": "Misdemeanor versions commonly carry fines up to about $1,000 and up to 6–12 months; false-emergency versions with injuries carry prison exposure.",
    "wantToKnow": [
      "Being wrong is not being false — honest mistakes and good-faith reports are protected; the prosecution must prove you knew.",
      "Giving a false name at a traffic stop is the everyday version and often adds this charge (or identity theft) to the stop.",
      "Retracting quickly does not erase a report already acted on, but it frequently matters to charging decisions. ---"
    ]
  },
  {
    "id": "failure-to-appear",
    "num": 38,
    "name": "Failure to appear (FTA)",
    "category": "Failure to Appear and Court-Order Offenses",
    "commonName": "FTA; failure to appear in court; bail jumping (the more serious cousin, when a person flees)",
    "meaning": "Not showing up for a court date you were ordered or promised to attend — an arraignment, a hearing, or a trial — and not having an approved excuse.",
    "elements": [
      "You were legally required to appear (by citation, summons, bond conditions, or court order)",
      "You had notice of the date",
      "You did not appear (most states allow a short window to appear voluntarily before the separate charge sticks)"
    ],
    "classification": "Ranges from a petty misdemeanor/misdemeanor (common when the underlying case is a misdemeanor) up to a felony when the underlying case is a felony. In many places the first consequence is not a new charge at all but a bench warrant plus license suspension.",
    "penaltyRange": "Misdemeanor versions commonly carry fines up to about $1,000 and up to 6–12 months; felony bail-jumping versions carry 1+ years. Courts also commonly impose warrant/late fees.",
    "wantToKnow": [
      "Missing court almost always produces a bench warrant — which means arrest at any later police contact, often at the worst time (a traffic stop in another state).",
      "Appearing voluntarily and quickly to ask for the warrant to be quashed/recalled is treated very differently from being arrested on it months later; courts usually care about the explanation (hospital, no notice, wrong date) and how fast you came in.",
      "A missed date in a traffic case commonly suspends the driver's license too — so one missed date can quietly create a second charge (driving on a suspended license) at the next stop."
    ]
  },
  {
    "id": "contempt-of-court",
    "num": 39,
    "name": "Contempt of court",
    "category": "Failure to Appear and Court-Order Offenses",
    "commonName": "Contempt (civil contempt and criminal contempt are different tools)",
    "meaning": "Deliberately disobeying a court order or disrupting/disrespecting the court. Criminal contempt punishes past disobedience with a fixed penalty. Civil contempt is coercive: you can be jailed or fined until you comply (pay the support, produce the document, appear) — lawyers say the person \"holds the keys to their own cell.\"",
    "elements": [
      "A valid, clear court order existed",
      "You knew about it",
      "You were able to comply (for civil contempt, inability to comply is a complete defense)",
      "You willfully disobeyed"
    ],
    "classification": "Not classified like ordinary crimes in many states; punishable under the court's contempt power. Common statutory caps for criminal contempt are around 6 months and/or a fine; civil contempt lasts until compliance, with review.",
    "penaltyRange": "From a verbal reprimand or small fine to months in jail for serious or repeated disobedience; in family cases (support, custody orders) it is the standard enforcement tool and commonly comes with the other side's attorney fees attached.",
    "wantToKnow": [
      "\"I couldn't, not I wouldn't\" is the key distinction — documented inability (job loss, medical, no assets) defeats contempt; judges look for paper proof, not explanations alone.",
      "Contempt is usually where missed child-support and custody-order violations land, and the remedy ordered is almost always do the thing you were ordered to do.",
      "You are entitled to notice of the contempt hearing and a chance to be heard; in criminal contempt with real jail exposure, rights look more like a criminal trial."
    ]
  },
  {
    "id": "probation-violation",
    "num": 40,
    "name": "Probation violation",
    "category": "Failure to Appear and Court-Order Offenses",
    "commonName": "Probation violation (PV) — technically, an allegation that a court order was broken, not a brand-new charge",
    "meaning": "After a conviction, a court often suspends some or all of the sentence on conditions — report to probation, no new arrests, drug tests, classes, stay-away orders, fees. A violation alleges one or more conditions were broken (a \"technical\" violation like missed appointments or failed tests, or a new-law violation).",
    "elements": [
      "You were on probation under a court order with stated conditions",
      "You violated a condition (the state must prove this by a preponderance of the evidence — a lower standard than proof beyond a reasonable doubt — in most states)"
    ],
    "classification": "Not a new crime by itself; the exposure is the original sentence that was suspended, up to the full amount the judge could have imposed at sentencing.",
    "penaltyRange": "Anything from a warning or added conditions, to more supervision/treatment, to revoking probation and imposing part or all of the suspended sentence.",
    "wantToKnow": [
      "You are usually entitled to a hearing and notice of the alleged violations, but not to a jury, and the burden of proof is lower — many people are surprised by both points.",
      "A new arrest commonly triggers a PV hold with no bond while the court sorts it out, even if the new charge is later dismissed.",
      "\"Absconding\" (stopping reporting entirely) is treated far more harshly than a single missed appointment or failed test; staying in contact with the probation officer matters. --- End of library. Fields per entry: common name / also-known-as naming notes, plain-English meaning, elements, typical classification, typical penalty range, \"what people usually want to know.\" Review for currency before publishing penalty figures — ranges in this area change with legislation, especially entries 18–21 (drugs) and 31 (firearms carry)."
    ]
  }
];
