/**
 * County resolution for the interview's county question.
 *
 * Two sources, both fail-soft (null on anything unexpected):
 *  1. Coordinates → the US Census Bureau Geocoding Services API —
 *     free, keyless, official county boundaries. Coordinates are
 *     used for this one lookup only: never stored, never logged.
 *  2. ZIP → the app's existing ZIP→county data (lib/courts
 *     resolveZip), the same resolution the filing steps use. ZIPs
 *     do not follow county lines exactly, so this is always
 *     reported as approximate.
 *
 * County names come back bare ("Taos", not "Taos County") — the
 * same shape a typed answer has, since the filing steps render
 * `${county} County` themselves.
 */
import { resolveZip, STATE_FALLBACKS } from './courts';

export interface CountyResolution {
  county: string;
  state: string;
}

const COUNTY_SUFFIXES = [
  ' County',
  ' Parish',
  ' Borough',
  ' Census Area',
  ' Municipality',
  ' Municipio',
];

/** "Taos County" → "Taos"; leaves independent-city names alone. */
export function bareCountyName(name: string): string {
  let n = String(name || '').trim();
  for (const s of COUNTY_SUFFIXES) {
    if (n.endsWith(s)) {
      n = n.slice(0, -s.length);
      break;
    }
  }
  return n.trim();
}

/** Parse a Census geocoder geographies response. Split out so a
 *  test can assert the parsing against the real API payload. */
export function parseCensusGeographies(json: unknown): CountyResolution | null {
  try {
    const geos = (json as any)?.result?.geographies;
    const county = geos?.Counties?.[0]?.NAME;
    const state = geos?.States?.[0]?.NAME;
    if (!county || !state) return null;
    return { county: bareCountyName(String(county)), state: String(state).trim() };
  } catch {
    return null;
  }
}

/** ZIP → county via the app's existing data. Always approximate. */
export function countyFromZip(zip: string): (CountyResolution & { approximate: true }) | null {
  const res = resolveZip(zip);
  if (!res.county || !res.state) return null;
  const stateName = STATE_FALLBACKS[res.state]?.name || res.state;
  return { county: res.county.county, state: stateName, approximate: true };
}

/**
 * Coordinates → county via the Census geocoder, with a ~4s
 * timeout. fetchImpl is injectable for tests.
 */
export async function fetchCountyByCoords(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<CountyResolution | null> {
  const url =
    'https://geocoding.geo.census.gov/geocoder/geographies/coordinates' +
    `?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}` +
    // The API pairs benchmark Public_AR_Current with the vintage
    // id "Current_Current" — a bare vintage=Current is rejected
    // with a 400 (verified against the live API).
    '&benchmark=Public_AR_Current&vintage=Current_Current&format=json';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: ctl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return parseCensusGeographies(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
