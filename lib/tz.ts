// Time-zone helpers. Court mail gives wall-clock times ("9:30 a.m.")
// with no zone; they are read in the user's own time zone, which the
// browser reports (see /api/calendar?tz=).

export const DEFAULT_TIME_ZONE = process.env.DEFAULT_TIME_ZONE || 'America/Phoenix';

export function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Offset (minutes east of UTC) of `tz` at the instant `utcMs`. */
function offsetAt(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** "2026-12-15T09:30" read as wall-clock time in `tz` → ISO (UTC). */
export function wallClockToIso(wall: string, tz: string): string | null {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let off = offsetAt(guess, tz);
  // A second pass settles DST boundaries.
  off = offsetAt(guess - off * 60000, tz);
  return new Date(guess - off * 60000).toISOString();
}
