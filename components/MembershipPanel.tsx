'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MembershipPlans from './MembershipPlans';
import { MEMBERSHIP_PLANS, type MembershipPlan } from '@/lib/plans';

export default function MembershipPanel({
  signedIn, initialPlan, canManage, sessionId, returnTo, cancelled, selected, billingAvailable,
}: {
  signedIn: boolean;
  initialPlan: MembershipPlan | null;
  canManage: boolean;
  sessionId?: string;
  returnTo?: 'interview';
  cancelled: boolean;
  selected?: MembershipPlan;
  billingAvailable: boolean;
}) {
  const [active, setActive] = useState(initialPlan);
  const [busy, setBusy] = useState<string | null>(sessionId && signedIn && !initialPlan ? 'confirm' : null);
  const [error, setError] = useState('');

  async function billing(action: 'checkout' | 'confirm' | 'portal', plan?: MembershipPlan) {
    setBusy(plan || action);
    setError('');
    try {
      const response = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, plan, sessionId, returnTo }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.message || 'Billing is temporarily unavailable.'); return; }
      if (data.plan) setActive(data.plan);
      if (data.url) window.location.assign(data.url);
    } catch { setError('Billing is temporarily unavailable. Try again shortly.'); }
    finally { setBusy(null); }
  }

  useEffect(() => {
    if (signedIn && sessionId && !initialPlan) void billing('confirm');
    // Check the returned session once, and provide a manual retry if Stripe is delayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, sessionId, initialPlan]);

  return (
    <>
      {cancelled && !active && <p className="fineprint" role="status">You returned without completing membership checkout.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {busy === 'confirm' && <p role="status">Verifying your payment…</p>}
      {active ? (
        <section className="acctcard">
          <h2>{MEMBERSHIP_PLANS[active].name} membership is active</h2>
          <p>Your dashboard, member tools, and motion downloads are included.</p>
          <div className="choices">
            <Link className="btn primary" href={returnTo ? '/interview?payment=membership' : '/dashboard'}>
              {returnTo ? 'Return to my motion' : 'Open dashboard'}
            </Link>
            {(canManage || active !== 'lifetime') && <button className="btn" disabled={Boolean(busy)} onClick={() => billing('portal')}>Manage recurring billing</button>}
          </div>
        </section>
      ) : signedIn && sessionId ? (
        !busy && <button className="btn" onClick={() => billing('confirm')}>Check payment again</button>
      ) : (
        <>
          {!signedIn && <p className="fineprint">Sign in or create a free account before paying for a membership.</p>}
          {!billingAvailable && <p className="warn">Membership checkout is not available on this site right now. Individual motion purchases are separate.</p>}
          {selected && signedIn && billingAvailable && <p className="fineprint">Selected: {MEMBERSHIP_PLANS[selected].name}. Confirm your choice below.</p>}
          <MembershipPlans choose={(plan) => billing('checkout', plan)} busy={busy || (billingAvailable ? null : 'unavailable')} signedIn={signedIn} returnTo={returnTo} />
          {signedIn && canManage && <button className="btn" disabled={Boolean(busy)} onClick={() => billing('portal')}>Manage recurring billing</button>}
        </>
      )}
      {!active && <p><Link href={returnTo ? '/interview?payment=membership-return' : '/interview'}>
        {returnTo ? 'Return to my motion without subscribing' : 'Just need one motion? Start the free interview.'}
      </Link></p>}
    </>
  );
}
