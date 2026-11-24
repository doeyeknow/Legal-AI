// Stripe key lookup, shared by the checkout and PDF routes.
//
// Reads STRIPE_SECRET_KEY (the documented name) and, as a fallback,
// a few names people commonly use by mistake. The value is trimmed
// and stripped of wrapping quotes, since pasted keys often carry
// them. A publishable key (pk_...) is reported as a problem instead
// of being used, because only a secret or restricted key can create
// a Checkout session.

const NAMES = [
  'STRIPE_SECRET_KEY',
  'STRIPE_SECRET',
  'STRIPE_API_KEY',
  'STRIPE_KEY',
  'STRIPE_SK',
  'STRIPE_LIVE_SECRET_KEY',
  'STRIPE_TEST_SECRET_KEY',
] as const;

export type StripeKeyStatus =
  | { ok: true; key: string; mode: 'live' | 'test'; source: string }
  | { ok: false; problem: 'missing' | 'publishable' | 'malformed'; source: string | null };

function clean(v: string | undefined): string {
  return (v || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function stripeKeyStatus(): StripeKeyStatus {
  for (const name of NAMES) {
    const v = clean(process.env[name]);
    if (!v) continue;
    if (v.startsWith('pk_')) return { ok: false, problem: 'publishable', source: name };
    if (/^(sk|rk)_(live|test)_[A-Za-z0-9]+$/.test(v)) {
      return { ok: true, key: v, mode: v.includes('_live_') ? 'live' : 'test', source: name };
    }
    return { ok: false, problem: 'malformed', source: name };
  }
  return { ok: false, problem: 'missing', source: null };
}

/** Short, user-safe explanation for the owner when payments are off. */
export function stripeProblemMessage(s: Exclude<StripeKeyStatus, { ok: true }>): string {
  if (s.problem === 'publishable') {
    return 'Payments are not configured: the Stripe key on the server is a publishable key (pk_…). Use the Secret key (sk_…) instead.';
  }
  if (s.problem === 'malformed') {
    return 'Payments are not configured: the Stripe key on the server does not look like a Stripe secret key (sk_live_… or sk_test_…).';
  }
  return 'Payments are not configured yet, so we cannot generate paid documents right now. Please check back soon — the interview itself is always free.';
}
