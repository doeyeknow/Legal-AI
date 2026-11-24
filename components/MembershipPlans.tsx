import Link from 'next/link';
import { MEMBERSHIP_PLANS, type MembershipPlan } from '@/lib/plans';

export default function MembershipPlans({
  choose, busy, signedIn, returnTo,
}: {
  choose?: (plan: MembershipPlan) => void;
  busy?: string | null;
  signedIn?: boolean;
  returnTo?: 'interview';
}) {
  return (
    <div className="pricegrid">
      {(Object.entries(MEMBERSHIP_PLANS) as [MembershipPlan, (typeof MEMBERSHIP_PLANS)[MembershipPlan]][]).map(([id, plan]) => (
        <article className={`pricecard${id === 'yearly' ? ' main' : ''}`} key={id}>
          <h3 className="pricename">{plan.name}</h3>
          <p className="priceamt">{plan.price}<span className="priceterm">{id === 'weekly' ? ' / week' : id === 'yearly' ? ' / year' : ' once'}</span></p>
          <p className="featbody">{plan.terms}.</p>
          {!choose ? (
            <Link className="btn" href={`/membership?plan=${id}`}>Choose {plan.name.toLowerCase()}</Link>
          ) : signedIn ? (
            <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => choose(id)}>
              {busy === id ? 'Opening checkout…' : `Choose ${plan.name.toLowerCase()}`}
            </button>
          ) : (
            <Link className="btn" href={`/account?membership=${id}${returnTo ? '&return=interview' : ''}`}>Sign in for {plan.name.toLowerCase()}</Link>
          )}
        </article>
      ))}
    </div>
  );
}
