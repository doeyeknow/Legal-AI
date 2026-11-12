import { NextRequest, NextResponse } from 'next/server';
import { dbConfigured } from '@/lib/db';
import { allWatches, recordWatchCheck } from '@/lib/cases';
import { portalByKey } from '@/lib/portals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Docket watch check — deliberately honest v1 (see
// research_notes/legal-docket-and-remote.md):
//
// * NM Case Lookup watches: ONE polite fetch of the portal per run.
//   NM's lookup is a search form with no API, so this fetch generally
//   cannot retrieve a case record; whatever happens, the watch's
//   last_note records exactly that. It NEVER claims a docket was
//   reviewed, and never claims "no changes" — an unparseable or
//   blocked response is recorded as exactly that.
// * Every other portal: no fetch at all. The note records that
//   automated checking is not available for that portal and that a
//   manual check is required, with the portal link. last_checked_at
//   is NOT stamped — nothing was checked.
//
// Guard: when CRON_SECRET is set, the caller must present it as a
// bearer token (the Vercel Cron convention). When it is unset the
// route still runs — it only writes notes, never docket claims.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }
  if (!dbConfigured()) {
    return NextResponse.json(
      { error: 'not_configured', message: 'No database — nothing to check.' },
      { status: 503 },
    );
  }

  let watches;
  try {
    watches = await allWatches();
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const results: { watchId: string; portalKey: string; outcome: string }[] = [];
  for (const w of watches) {
    if (w.portalKey === 'nm-case-lookup') {
      const note = await checkNmPortal(w.caseNumber);
      try {
        await recordWatchCheck(w.id, note, true);
      } catch { /* a failed write must not fail the whole run */ }
      results.push({ watchId: w.id, portalKey: w.portalKey, outcome: note });
    } else {
      const portal = portalByKey(w.portalKey);
      const name = portal ? portal.portalName : 'This court';
      const link = portal?.url ? ` Check it here: ${portal.url}` : '';
      const note =
        `Automated checking is not available for ${name}. A manual check is required — ` +
        `search the case number on the portal and confirm anything important with the clerk.${link}`;
      try {
        await recordWatchCheck(w.id, note, false);
      } catch { /* see above */ }
      results.push({ watchId: w.id, portalKey: w.portalKey, outcome: 'manual-check reminder recorded' });
    }
  }
  return NextResponse.json({ checked: results.length, results });
}

async function checkNmPortal(caseNumber: string): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch('https://caselookup.nmcourts.gov', {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'legal.eyeknow.app watch check (single user-initiated case check)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return `Checked ${stamp}: the NM Case Lookup portal answered with an error (HTTP ${res.status}), so no case data was retrieved on this check. Check the case on the portal directly and confirm with the clerk.`;
    }
    const html = await res.text();
    if (caseNumber && html.includes(caseNumber)) {
      return `Checked ${stamp}: the portal returned a page containing this case number. That alone does not show what changed — open the case on NM Case Lookup to review the record, and confirm anything important with the clerk.`;
    }
    return `Checked ${stamp}: the portal did not return case data on this check — NM Case Lookup is a search form with no automated access, so this check could not read the docket. Search the case number on the portal directly; only the court's record confirms the current state of the case.`;
  } catch {
    return `Checked ${stamp}: the NM Case Lookup portal could not be reached, so no case data was retrieved on this check. Check the case on the portal directly and confirm with the clerk.`;
  }
}
