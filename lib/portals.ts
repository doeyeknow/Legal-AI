// Portal directory — converted from research_notes/legal-warrant-lookup.md.
// Only URLs that appear in the research are carried as links; routes
// without a verified URL ship as agency + search terms instead.
// Accuracy policy from the research: a missing URL is better than a
// guessed one. Official sources only — never data-broker sites.

export interface PortalEntry {
  key: string;
  state: string; // USPS code, or "US" for federal routes
  stateName: string;
  routeType: 'state_court_portal' | 'county_sheriff' | 'county_clerk' | 'state_repository' | 'federal';
  portalName: string;
  agency: string;
  url: string | null;
  searchTerms?: string;
  searches: string;
  searchesCases: boolean;
  /** 'yes' | 'indirect' (visible only inside a case record) | 'no' */
  searchesWarrants: string;
  cost: 'free' | 'fee' | 'mixed';
  costNote: string;
  coverage: string;
  notes: string;
  verifyWith: string;
}

export interface SheriffExample {
  agency: string;
  note: string;
}

export interface SafeStep {
  title: string;
  text: string;
}

export const PORTALS: PortalEntry[] = [
  {
    "key": "nm-case-lookup",
    "state": "NM",
    "stateName": "New Mexico",
    "routeType": "state_court_portal",
    "portalName": "New Mexico Courts Case Lookup",
    "agency": "New Mexico Judiciary",
    "url": "https://caselookup.nmcourts.gov",
    "searches": "Cases (name, case number, DWI search). Warrant events appear in case records; confirm the warrant itself with the issuing court",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free, no registration",
    "coverage": "",
    "notes": "Covers all NM courts — district, magistrate, Bernalillo County Metropolitan, appellate; municipal coverage is limited (historic DWI/domestic-violence data). Docket-level detail only; documents are in the separate registered re:SearchNM system",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "public-access-to-court-information",
    "state": "AZ",
    "stateName": "Arizona",
    "routeType": "state_court_portal",
    "portalName": "Public Access to Court Information (Arizona Judicial Branch)",
    "agency": "Arizona Judicial Branch",
    "url": "https://www.azcourts.gov",
    "searches": "Cases (name or case number) from most AZ courts; charges and dispositions shown (Public Access Case Lookup)",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Covers most of the state's ~180 courts (justice, municipal, superior) but not all — a court that doesn't participate must be checked with its own clerk. Superior Court documents since 2010 are in the companion eAccess system",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "colorado-judicial-branch-docket-search",
    "state": "CO",
    "stateName": "Colorado",
    "routeType": "state_court_portal",
    "portalName": "Colorado Judicial Branch Docket Search",
    "agency": "Colorado Judicial Branch",
    "url": "https://www.coloradojudicial.gov",
    "searches": "Cases/hearings (case number, party name, county/district, date)",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free for the docket (hearing) search",
    "coverage": "",
    "notes": "The free search is built around scheduled hearings statewide. Full historical registers of actions are sold by Judicial-Branch-approved vendors (e.g., CoCourts) for a per-search fee. Municipal courts and Denver County Court sit outside the state system",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "no-statewide-trial-court-search-exists-texas-jud",
    "state": "TX",
    "stateName": "Texas",
    "routeType": "state_court_portal",
    "portalName": "No statewide trial-court search exists. Texas Judicial Branch is the hub",
    "agency": "Texas Judicial Branch",
    "url": "https://www.txcourts.gov",
    "searches": "See notes",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "mixed",
    "costNote": "Mixed",
    "coverage": "",
    "notes": "re:SearchTX (free account) searches e-filed civil/family/probate records from many counties — it is not a criminal-case or warrant search. Appellate cases: TAMES Case Search. Trial-court criminal records live with the district clerk (felonies, family) and county clerk (misdemeanors, probate) of the county of filing — large counties (Harris, Dallas, Travis, Bexar, Tarrant…) run their own portals; small counties may require a phone call. Texas DPS sells a name-based conviction search (Computerized Criminal History) for a fee",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "no-statewide-case-search-exists-california-court",
    "state": "CA",
    "stateName": "California",
    "routeType": "state_court_portal",
    "portalName": "No statewide case search exists. California Courts is the hub",
    "agency": "California Courts (Judicial Branch)",
    "url": "https://www.courts.ca.gov",
    "searches": "See notes",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "mixed",
    "costNote": "Mixed",
    "coverage": "",
    "notes": "Each of the 58 counties' Superior Courts runs its own case portal (some free indexes, some paid document access). There is no state-run name search of criminal cases for the public; the California DOJ criminal-history record is fingerprint-based and available to the person themselves and authorized requesters, not as a public name search",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "florida-courts-is-the-hub-records-sit-with-count",
    "state": "FL",
    "stateName": "Florida",
    "routeType": "state_court_portal",
    "portalName": "Florida Courts is the hub; records sit with county Clerks of Court",
    "agency": "Florida Courts / county Clerks of Court",
    "url": "https://www.floridacourts.gov",
    "searches": "Cases, county by county",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "mixed",
    "costNote": "Mostly free indexes; document access varies",
    "coverage": "",
    "notes": "Each county Clerk of the Circuit Court runs the official case search for that county (many use the same statewide-style viewer, but you search one county at a time). The Florida Dept. of Law Enforcement (FDLE) sells a name-based statewide criminal-history check for a fee — convictions data, not live warrants",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "new-york-state-unified-court-system-ecourts",
    "state": "NY",
    "stateName": "New York",
    "routeType": "state_court_portal",
    "portalName": "New York State Unified Court System / eCourts",
    "agency": "New York State Unified Court System",
    "url": "https://www.nycourts.gov",
    "searches": "Cases (WebCivil, WebFamily, WebCriminal appearance info); eTrack sends case notifications",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "WebCriminal information is limited and oriented to parties/attorneys with case details — it is not a general public warrant search. Criminal-court details often require the court or the person's own records request. NYC and county courts differ in what is online",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "pennsylvania-unified-judicial-system-web-portal",
    "state": "PA",
    "stateName": "Pennsylvania",
    "routeType": "state_court_portal",
    "portalName": "Pennsylvania Unified Judicial System web portal",
    "agency": "Unified Judicial System of Pennsylvania",
    "url": "https://ujsportal.pacourts.us",
    "searches": "Cases — public docket sheets for appellate, Common Pleas, and Magisterial District courts",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "One of the more complete free statewide docket systems; docket sheets show charges, events, and warrant-related entries in the case",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "maryland-judiciary-case-search",
    "state": "MD",
    "stateName": "Maryland",
    "routeType": "state_court_portal",
    "portalName": "Maryland Judiciary Case Search",
    "agency": "Maryland Judiciary",
    "url": "https://casesearch.courts.state.md.us",
    "searches": "Cases (name, case number) statewide",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Broad statewide coverage of District and Circuit Court cases; some case types are restricted by rule",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "missouri-case-net",
    "state": "MO",
    "stateName": "Missouri",
    "routeType": "state_court_portal",
    "portalName": "Missouri Case.net (Missouri Courts)",
    "agency": "Missouri Courts (Office of State Courts Administrator)",
    "url": "https://www.courts.mo.gov",
    "searches": "Cases (name, case number, court)",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Statewide docket/case search; document images limited to registered Case.net users for participating courts",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "oklahoma-state-courts-network",
    "state": "OK",
    "stateName": "Oklahoma",
    "routeType": "state_court_portal",
    "portalName": "Oklahoma State Courts Network (OSCN)",
    "agency": "Oklahoma State Courts Network",
    "url": "https://www.oscn.net",
    "searches": "Cases (name, case number)",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free for dockets",
    "coverage": "",
    "notes": "Long-running statewide docket system for participating courts; some counties are on the separate OCIS system",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "wisconsin-circuit-court-access",
    "state": "WI",
    "stateName": "Wisconsin",
    "routeType": "state_court_portal",
    "portalName": "Wisconsin Circuit Court Access (CCAP)",
    "agency": "Wisconsin Court System",
    "url": "https://wcca.wicourts.gov",
    "searches": "Cases (name, case number) statewide",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Statewide circuit-court case search with charges and events",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "indiana-public-court-records",
    "state": "IN",
    "stateName": "Indiana",
    "routeType": "state_court_portal",
    "portalName": "Indiana Public Court Records (MyCase)",
    "agency": "Indiana Judicial Branch",
    "url": "https://public.courts.in.gov",
    "searches": "Cases (name, case number) for courts on the Odyssey system",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Coverage grows as counties migrate; older/non-participating courts are checked with the county clerk",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "virginia-courts-case-information",
    "state": "VA",
    "stateName": "Virginia",
    "routeType": "state_court_portal",
    "portalName": "Virginia Courts Case Information",
    "agency": "Virginia Judicial System",
    "url": "https://www.vacourts.gov",
    "searches": "Cases by circuit and general district court (search court by court)",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Statewide system but searched one court at a time; online coverage years vary by court",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "washington-courts",
    "state": "WA",
    "stateName": "Washington",
    "routeType": "state_court_portal",
    "portalName": "Washington Courts",
    "agency": "Washington State Administrative Office of the Courts",
    "url": "https://www.courts.wa.gov",
    "searches": "Cases via the Judicial Information System public search linked from the state site",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "State hub; superior/district coverage varies, and some counties run their own portals in parallel",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "masscourts",
    "state": "MA",
    "stateName": "Massachusetts",
    "routeType": "state_court_portal",
    "portalName": "MassCourts",
    "agency": "Massachusetts Trial Court",
    "url": "https://www.masscourts.org",
    "searches": "Cases (name, case number, court)",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "free",
    "costNote": "Free",
    "coverage": "",
    "notes": "Public case search for Massachusetts Trial Court departments",
    "verifyWith": "Clerk of the issuing court (phone) — the only definitive warrant confirmation"
  },
  {
    "key": "nm-dps-records",
    "state": "NM",
    "stateName": "New Mexico",
    "routeType": "state_repository",
    "portalName": "NM DPS Law Enforcement Records Bureau — your own criminal history",
    "agency": "New Mexico Department of Public Safety",
    "url": null,
    "searchTerms": "New Mexico DPS Law Enforcement Records Bureau criminal history request",
    "searches": "Your own New Mexico criminal-history record, by written request with notarized authorization (fee charged — $15 at last publication). Not a search of other people, and not a live warrant check.",
    "searchesCases": false,
    "searchesWarrants": "no",
    "cost": "fee",
    "costNote": "Fee charged ($15 at last publication)",
    "coverage": "New Mexico records reported to DPS",
    "notes": "For checking your own record only.",
    "verifyWith": "Clerk of the issuing court (phone)"
  },
  {
    "key": "us-fbi-history",
    "state": "US",
    "stateName": "Federal (all states)",
    "routeType": "federal",
    "portalName": "FBI Identity History Summary (your own federal record)",
    "agency": "Federal Bureau of Investigation",
    "url": null,
    "searchTerms": "FBI Identity History Summary request fbi.gov",
    "searches": "Your own federal criminal-history record, fingerprint-based, requested from the FBI or an FBI-approved channeler. Only covers what was reported to the FBI, and only for the person themselves.",
    "searchesCases": false,
    "searchesWarrants": "no",
    "cost": "fee",
    "costNote": "Fee charged by the FBI / channeler",
    "coverage": "Federal records reported to the FBI",
    "notes": "The closest thing to a national record — still self-only, and not a warrant search.",
    "verifyWith": "Clerk of the issuing court (phone)"
  },
  {
    "key": "us-pacer",
    "state": "US",
    "stateName": "Federal (all states)",
    "routeType": "federal",
    "portalName": "PACER — federal court cases",
    "agency": "United States Courts",
    "url": "https://pacer.uscourts.gov",
    "searches": "Federal court dockets and documents (district, bankruptcy, appellate). Federal cases only — nothing from state courts. $0.10 per page, $3.00 per-document cap; quarterly fees of $30 or less are waived.",
    "searchesCases": true,
    "searchesWarrants": "indirect",
    "cost": "fee",
    "costNote": "$0.10/page, capped $3.00/document; ≤$30/quarter waived",
    "coverage": "All U.S. federal courts",
    "notes": "Registration is free; the meter runs on pages viewed.",
    "verifyWith": "Clerk of the federal court where the case is filed"
  }
];

export const SHERIFF_EXAMPLES: SheriffExample[] = [
  {
    "agency": "Bernalillo County Sheriff's Office (NM)",
    "note": "and the Bernalillo County Metropolitan Court — Albuquerque-area warrants; NM's Case Lookup (A1) will also surface the underlying case."
  },
  {
    "agency": "Maricopa County Sheriff's Office (AZ)",
    "note": "warrant search for Maricopa County (Phoenix area)."
  },
  {
    "agency": "Harris County Sheriff's Office (TX)",
    "note": "and the Harris County District Clerk — Houston-area cases and warrants (county systems, not state)."
  },
  {
    "agency": "Los Angeles County Sheriff's Department (CA)",
    "note": "inmate information system shows custody status and holds for people booked in LA County."
  },
  {
    "agency": "County sheriffs generally:",
    "note": "search terms that reliably find the official page: [county name] sheriff warrant search, restricted to the county's official .gov site. If the result is a data-broker site, it is not the official list. Limits: sheriff lists usually cover only that county's warrants, update on a delay, and drop warrants once served — so a name can linger after a warrant is recalled, or be missing while paperwork moves. Only the issuing court can confirm a warrant is truly active or truly gone."
  }
];

export const WARRANT_SHOWS_NOT_PROVE: string[] = [
  "That the warrant is still active. It may have been recalled/quashed after the list or portal was last updated.",
  "That the person named is you (or the person you searched). Name matches are common; portals match on name spelling, and many people share names. Date of birth, case number, and physical identifiers are how courts sort out identity.",
  "Anything about guilt. A warrant says a court wants the person to appear — most often because of a missed date or an unfiled response — not that any charge has been proven.",
  "That the warrant can be enforced everywhere. Some warrants are entered into national systems and can trigger arrest in another state; others are geographically limited (in-state or surrounding-county pickup only). Only the issuing court and law enforcement can say which."
];

export const WARRANT_NOTHING_PROVES: string[] = [
  "That no warrant exists. The county searched may not publish online, the case may be in a court that doesn't feed the portal (municipal courts are the classic gap), the warrant may be very new or very old, the name may be spelled differently in the system, or the case may be sealed (juvenile and some family matters never appear publicly).",
  "That there is no case. Cases and warrants are different objects — a case can be open for years with no warrant attached."
];

export const WARRANT_SAFE_STEPS: SafeStep[] = [
  {
    "title": "Don't ignore it.",
    "text": "Warrants do not expire on their own in most places, and the practical risks grow: arrest at a traffic stop or workplace, driver's-license holds, and worse negotiating position the longer it sits."
  },
  {
    "title": "Identify the issuing court and case number",
    "text": "(from the portal/sheriff result, or by calling the clerk — route A4). Almost everything starts with those two facts."
  },
  {
    "title": "Contact the court before law enforcement contacts you.",
    "text": "Common routes courts offer: - A motion to quash/recall the warrant and set a new court date — sometimes handled on paper, sometimes at a short hearing. - Walk-in / warrant-clearance court sessions that many courts run specifically so people can appear voluntarily, get the warrant recalled, and address the underlying case. - For warrants over unpaid fines: a payment plan, community-service conversion, or ability-to-pay hearing — courts commonly prefer compliance over custody. - If a bond amount is set, posting bond (directly or through a licensed bondsman) to clear the warrant and get a new date."
  },
  {
    "title": "If arrest is a real possibility, plan the surrender.",
    "text": "Voluntary surrender at the court (rather than at a traffic stop) is the version judges see most favorably: business hours, bring government photo ID, bring any paperwork about the case, arrange childcare and work coverage, and do not bring anything you could not take into a courthouse or jail."
  },
  {
    "title": "Bring ID and documentation",
    "text": "to any appearance: photo ID, the case number, proof of any payments made, proof of completed conditions (classes, community service), and documentation of any emergency that caused a missed date (hospital records, etc.)."
  },
  {
    "title": "Address the underlying case, not just the warrant.",
    "text": "Recalling the warrant restores the case to active status; the original charge, fine, or missed deadline is still waiting and needs its own resolution."
  },
  {
    "title": "Then verify.",
    "text": "A few days after resolution, re-check the portal and, if it matters, confirm with the clerk that the warrant shows as recalled in the system — paperwork lags are common."
  }
];

export function portalByKey(key: string): PortalEntry | undefined {
  return PORTALS.find((p) => p.key === key);
}

export function portalsForState(state: string): PortalEntry[] {
  return PORTALS.filter((p) => p.state === state || p.state === 'US');
}
