import { pageAccount } from '@/lib/membership-page';
import { activeMembership, recurringCustomer } from '@/lib/membership';
import { isMembershipPlan } from '@/lib/plans';
import { stripeKeyStatus } from '@/lib/stripe-config';
import MembershipPanel from '@/components/MembershipPanel';

export const metadata = {
  title: 'Membership plans',
  description: 'Compare weekly, yearly, and lifetime quikForm membership plans. All include the dashboard and motion downloads.',
  alternates: { canonical: '/membership' },
};

export default async function MembershipPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await pageAccount();
  const [membership, customer] = user
    ? await Promise.all([activeMembership(user.id).catch(() => null), recurringCustomer(user.id).catch(() => null)])
    : [null, null];
  const sessionId = typeof searchParams.session_id === 'string' ? searchParams.session_id : undefined;
  const billingAvailable = stripeKeyStatus().ok && Boolean(process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET?.trim());
  return (
    <section className="homepage accountpage membershippage">
      <p className="eyebrow">Membership</p>
      <h1>Unlock the dashboard and all tools</h1>
      <p className="lede">Every plan includes case management, hearing and call companions, and unlimited motion PDF downloads with filing instructions at no extra charge.</p>
      <MembershipPanel signedIn={Boolean(user)} initialPlan={membership?.plan || null}
        canManage={Boolean(customer)} sessionId={sessionId} returnTo={searchParams.return === 'interview' ? 'interview' : undefined}
        cancelled={searchParams.cancelled === '1'} selected={isMembershipPlan(searchParams.plan) ? searchParams.plan : undefined}
        billingAvailable={billingAvailable} />
    </section>
  );
}
