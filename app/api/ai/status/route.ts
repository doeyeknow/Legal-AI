import { NextResponse } from 'next/server';
import { aiKey } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Open /api/ai/status on the live site to check the AI key is seen.
// Reports only which setting was found and whether the provider
// accepts it — never the key itself.
export async function GET() {
  const k = aiKey();
  if (!k) {
    return NextResponse.json(
      { configured: false, message: 'No OPENAI_API_KEY found. Add it to the site settings and redeploy.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  let working: boolean | null = null;
  let message = '';
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${k.key}` },
      signal: AbortSignal.timeout(8000),
    });
    working = res.ok;
    if (res.status === 401) message = 'The key was found but the provider rejected it. Check it was copied in full.';
    else if (!res.ok) message = `The provider answered with status ${res.status}.`;
  } catch {
    message = 'The provider could not be reached from the server.';
  }
  return NextResponse.json(
    { configured: true, setting: k.setting, working, model: process.env.AI_MODEL || 'gpt-4o-mini', ...(message ? { message } : {}) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
