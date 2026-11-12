import Link from 'next/link';
import { DISCLAIMER } from '@/lib/motions/types';
import { Icon, type IconName } from '@/components/icons';

// App home screen: sized to fit one phone screen whole — the hero
// with the one primary action, then a grid of quick entries. The
// how-it-works detail lives one tap away in the library; nothing
// here needs a scroll.
const QUICK: { href: string; icon: IconName; label: string; sub: string }[] = [
  { href: '/library', icon: 'book', label: 'Motion library', sub: 'Browse all motions' },
  { href: '/dashboard', icon: 'folder', label: 'My cases', sub: 'Filings & deadlines' },
  { href: '/dashboard/practice', icon: 'target', label: 'Hearing practice', sub: 'Rehearse with a judge' },
  { href: '/account', icon: 'person', label: 'Account', sub: 'Saved information' },
];

export default function Home() {
  return (
    <div className="apphome">
      <section className="hero-card" data-px="0.05">
        <p className="eyebrow">Why pay lawyer prices?</p>
        <h1>Lawyers charge hundreds an hour. Your court motion costs $3.</h1>
        <p className="lede">
          Describe your situation in plain words. We match it to the right motion, ask its
          questions one at a time, and prepare your filing-ready PDF — no retainer, no
          hourly bill.
        </p>
        <Link className="btn primary big" href="/interview">Start the free interview</Link>
        <p className="price">The interview is free. A prepared document is <strong>$3</strong> — paid only when your PDF is generated.</p>
        <p className="fineprint">{DISCLAIMER}</p>
      </section>

      <nav className="quickgrid" aria-label="Quick entries">
        {QUICK.map((q) => (
          <Link key={q.href} className="quicktile" href={q.href} data-ripple>
            <span className="quickicon" aria-hidden="true"><Icon name={q.icon} size={20} /></span>
            <span className="quicktexts">
              <span className="quicklabel">{q.label}</span>
              <span className="quicksub">{q.sub}</span>
            </span>
          </Link>
        ))}
      </nav>

    </div>
  );
}
