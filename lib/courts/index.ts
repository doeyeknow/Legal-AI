// Courts database — real court records by county, used by the
// interview's court-name step (options instead of free text) and
// the done screen's court contact card. Records come ONLY from the
// per-state data modules here, compiled from official sources.
// A county with no records yields NO options — the interview falls
// back to its typed question. Nothing is pattern-generated or
// invented: any field may be null (missing is recorded as missing).
import { NM_COURT_RECORDS } from './nm';

export type CourtKind =
  | 'district'
  | 'magistrate'
  | 'probate'
  | 'metropolitan'
  | 'municipal';

export interface CourtRecord {
  state: string; // USPS code, e.g. 'NM'
  county: string; // county name without the word "County"
  name: string;
  kind: CourtKind;
  city: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  hours: string | null;
  email: string | null;
  website: string | null;
  efilingUrl: string | null;
  sourceUrl: string | null;
}

const ALL_RECORDS: CourtRecord[] = [...NM_COURT_RECORDS];

const STATE_NAME_TO_CODE: Record<string, string> = {
  'new mexico': 'NM',
  'texas': 'TX',
  'arizona': 'AZ',
  'colorado': 'CO',
  'oklahoma': 'OK',
};

export function normalizeState(raw: string | null | undefined): string {
  const t = (raw || '').trim();
  if (!t) return '';
  if (t.length === 2) return t.toUpperCase();
  return STATE_NAME_TO_CODE[t.toLowerCase()] || t.toUpperCase();
}

export function normalizeCounty(raw: string | null | undefined): string {
  return (raw || '').trim().replace(/\s+county$/i, '').trim();
}

/** All real courts on record for a state+county (possibly none). */
export function courtsFor(
  stateRaw: string | null | undefined,
  countyRaw: string | null | undefined,
): CourtRecord[] {
  const state = normalizeState(stateRaw);
  const county = normalizeCounty(countyRaw).toLowerCase();
  if (!state || !county) return [];
  return ALL_RECORDS.filter(
    (r) => r.state === state && r.county.toLowerCase() === county,
  );
}

/** The single record matching a chosen court name, or null. */
export function findCourt(
  stateRaw: string | null | undefined,
  countyRaw: string | null | undefined,
  name: string | null | undefined,
): CourtRecord | null {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  return courtsFor(stateRaw, countyRaw).find((r) => r.name.toLowerCase() === n) || null;
}

export function courtDbStats(): { records: number; counties: number } {
  const counties = new Set(ALL_RECORDS.map((r) => `${r.state}|${r.county}`));
  return { records: ALL_RECORDS.length, counties: counties.size };
}
