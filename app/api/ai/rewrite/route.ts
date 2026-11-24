import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { aiConfigured, rewriteProfessionally, type RewriteItem } from '@/lib/ai';
import { requireUser } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET  /api/ai/rewrite — { available } so the interview knows
//      whether to offer the rewrite step at all.
// POST /api/ai/rewrite — { items: [{ key, label, text }], purpose, context? }
//      → { items: [{ key, text }] } suggested rewrites. Nothing is
//      stored; the caller shows them for the user to accept.
//
// Open to guests (the interview works without an account), so a
// best-effort in-memory limit per user / IP keeps costs bounded.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 15;
const MAX_ITEMS = 30;
const MAX_ITEM_CHARS = 6000;
const MAX_TOTAL_CHARS = 30000;

const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

export async function GET() {
  return NextResponse.json({ available: aiConfigured() });
}

export async function POST(req: NextRequest) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: 'ai_not_configured', message: 'The AI rewrite isn’t set up on this site yet.' },
      { status: 503 },
    );
  }
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try { user = await getSessionUser(req); } catch { user = null; }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  if (limited(user ? `u:${user.id}` : `ip:${ip}`)) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many rewrite requests — wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    items?: unknown; purpose?: unknown; context?: unknown;
  } | null;
  if (body?.purpose === 'email') {
    const member = await requireUser(req);
    if ('error' in member) return member.error;
  }
  const raw = Array.isArray(body?.items) ? body!.items : [];
  const items: RewriteItem[] = [];
  let total = 0;
  for (const it of raw.slice(0, MAX_ITEMS)) {
    const o = it as Record<string, unknown>;
    const key = typeof o?.key === 'string' ? o.key.slice(0, 80) : '';
    const text = typeof o?.text === 'string' ? o.text.trim().slice(0, MAX_ITEM_CHARS) : '';
    const label = typeof o?.label === 'string' ? o.label.slice(0, 300) : '';
    if (!key || !text) continue;
    total += text.length;
    if (total > MAX_TOTAL_CHARS) break;
    items.push({ key, label, text });
  }
  if (!items.length) {
    return NextResponse.json({ error: 'nothing_to_rewrite', message: 'There is no text to rewrite.' }, { status: 400 });
  }
  const purpose = body?.purpose === 'email' ? 'email' : 'statements';
  const context = typeof body?.context === 'string' ? body.context.slice(0, 300) : undefined;
  const r = await rewriteProfessionally(items, { purpose, context });
  if (!r.ok) return NextResponse.json({ error: 'rewrite_failed', message: r.message }, { status: r.status });
  return NextResponse.json({ items: r.items });
}
