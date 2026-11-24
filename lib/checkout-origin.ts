import type { NextRequest } from 'next/server';
import { SITE_URL } from './site';

/** Allow only deployment-owned origins, never an arbitrary client-supplied redirect URL. */
export function checkoutOrigin(req: NextRequest): string | null {
  const local = process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(req.nextUrl.hostname) ? req.nextUrl.origin : null;
  const allowed = [
    local,
    SITE_URL,
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
      .filter(Boolean).map((host) => `https://${host}`),
    ...(process.env.CHECKOUT_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  ];
  const origin = req.headers.get('origin') || req.nextUrl.origin;
  return allowed.includes(origin) ? origin : null;
}
