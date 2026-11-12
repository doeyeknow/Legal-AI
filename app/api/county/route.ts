import { NextRequest, NextResponse } from 'next/server';
import { countyFromZip, fetchCountyByCoords } from '@/lib/county';

export const runtime = 'nodejs';

// County resolution for the interview's county question.
//   GET /api/county?lat=<lat>&lng=<lng>  → Census Bureau geocoder
//        (official boundaries) → { county, state, source: 'location' }
//   GET /api/county?zip=<5-digit ZIP>    → the app's existing
//        ZIP→county data → { county, state, source: 'zip', approximate: true }
// Coordinates are used for this one lookup only — never stored,
// never logged. Fail-soft: anything unresolved answers 404 and the
// interview simply keeps asking the question in text, as before.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const latRaw = sp.get('lat');
  const lngRaw = sp.get('lng');
  if (latRaw !== null && lngRaw !== null) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
      !(lat === 0 && lng === 0)
    ) {
      const r = await fetchCountyByCoords(lat, lng);
      if (r) {
        return NextResponse.json({ county: r.county, state: r.state, source: 'location' });
      }
    }
    return NextResponse.json({ error: 'county_not_found' }, { status: 404 });
  }

  const zip = (sp.get('zip') || '').trim();
  if (/^\d{5}$/.test(zip)) {
    const r = countyFromZip(zip);
    if (r) {
      return NextResponse.json({
        county: r.county,
        state: r.state,
        source: 'zip',
        approximate: true,
      });
    }
    return NextResponse.json({ error: 'county_not_found' }, { status: 404 });
  }

  return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}
