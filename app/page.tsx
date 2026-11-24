import Link from 'next/link';
import { DISCLAIMER } from '@/lib/motions/types';
import { Icon, type IconName } from '@/components/icons';
import HelpTip from '@/components/HelpTip';
import JsonLd from '@/components/JsonLd';
import HomeWalkthrough from '@/components/HomeWalkthrough';
import MembershipPlans from '@/components/MembershipPlans';
import { ALL_MOTIONS } from '@/lib/motions/data';
import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}.org — Court motion PDFs for $5, with filing instructions` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

const HOME_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#org` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'WebApplication',
      name: `${SITE_NAME} — ${SITE_TAGLINE}`,
      url: SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Any (web browser)',
      description: SITE_DESCRIPTION,
      offers: {
        '@type': 'Offer',
        price: '5.00',
        priceCurrency: 'USD',
        description: 'One motion PDF with filing instructions. The interview is free.',
      },
      publisher: { '@id': `${SITE_URL}/#org` },
    },
  ],
};

// Homepage: the hero with the one primary action and quick entries
// (still an app home on a phone's first screen), then a scrolling
// showcase: an interactive walkthrough, the feature set, pricing,
// and the honest fine print.
const QUICK: { href: string; icon: IconName; label: string; sub: string }[] = [
  { href: '/library', icon: 'book', label: 'Motion library', sub: 'Browse all motions' },
  { href: '/dashboard', icon: 'folder', label: 'My cases', sub: 'Member dashboard' },
  { href: '/dashboard/practice', icon: 'target', label: 'Hearing practice', sub: 'Member tool' },
  { href: '/account', icon: 'person', label: 'Account', sub: 'Saved information' },
];

interface Feature { icon: IconName; title: string; body: string; href?: string }

const GROUPS: { kicker: string; title: string; features: Feature[] }[] = [
  {
    kicker: 'Prepare',
    title: 'Get the right document, written well',
    features: [
      { icon: 'book', title: `${ALL_MOTIONS.length} motion templates`, body: 'Continuances, extensions, custody and support changes, contempt, eviction stays, appeals, and more, sorted by category.', href: '/library' },
      { icon: 'chat', title: 'A plain-English interview', body: 'Describe your situation and get matched to the right motion. Then answer one question per page, by typing or by voice.' },
      { icon: 'sparkle', title: 'AI polish, your choice', body: 'Have your statements rewritten to sound professional. Compare each one with yours and keep what you like.' },
      { icon: 'wallet', title: 'Free fee waiver form', body: 'Can\u2019t afford court fees? The interview can add a fee waiver request to your filing at no charge.' },
      { icon: 'pencil', title: 'Review and e-sign', body: 'Edit any answer from the review page, sign with your finger or mouse, and download a filing-ready PDF.' },
      { icon: 'person', title: 'Your details, saved', body: 'Save your name, address, and contact details once, and every new document starts already filled in.', href: '/account' },
    ],
  },
  {
    kicker: 'Organize',
    title: 'Your whole case, in one place',
    features: [
      { icon: 'folder', title: 'Case dashboard', body: 'Every case gets its own page with documents, deadlines, letters, and the hearing date. Swipe in from the left to open the menu.', href: '/dashboard' },
      { icon: 'list', title: 'Case timeline', body: 'Filings, court mail, deadlines, and hearings appear in date order automatically. Add your own events, filter, search, and print.' },
      { icon: 'eye', title: 'Instant document preview', body: 'Open any document in a popup to read it, page through it, print it, or download it, without leaving the case.' },
      { icon: 'mail', title: 'Court mail inbox', body: 'A private address for court email, with an unread badge, reply, archive, star, print, and search. Dates are pulled out for your case.', href: '/dashboard/inbox' },
      { icon: 'calendar', title: 'Deadlines & calendar', body: 'Response deadlines and hearings on a month calendar, with optional notifications when new court mail arrives.', href: '/dashboard/calendar' },
      { icon: 'files', title: 'Evidence locker', body: 'All of your generated documents across every case, ready to preview, print, share, or download.', href: '/dashboard/evidence' },
    ],
  },
  {
    kicker: 'Get ready',
    title: 'Walk into court prepared',
    features: [
      { icon: 'target', title: 'Hearing practice', body: 'Rehearse the questions a judge is likely to ask about your motion, with coaching after each answer and optional voice.', href: '/dashboard/practice' },
      { icon: 'headphones', title: 'Hearing companion', body: 'A live transcript with quiet suggestion cards during a hearing, only where the court allows it.', href: '/dashboard/hearing-live' },
      { icon: 'search', title: 'Warrant & case lookup', body: 'The official way to check for a warrant or find a court case, state by state, with what each result actually means.', href: '/dashboard/warrants' },
      { icon: 'gavel', title: 'Charge library', body: 'Forty common charges in plain English: what each means, what has to be proven, and the typical range.', href: '/dashboard/charges' },
    ],
  },
];

export default function Home() {
  return (
    <div className="homepage">
      <JsonLd data={HOME_LD} />
      <section className="hero-card homehero">
        <p className="eyebrow">Court document preparation</p>
        <h1>Prepare your court motion. Download it for $5.</h1>
        <p className="lede">
          Answer plain-English questions, one at a time, and get a filing-ready court document.
          Filing instructions are included. Membership adds the case dashboard, all tools, and unlimited motion downloads.
        </p>
        <div className="herobtns">
          <Link className="btn primary big" href="/interview">Get Started</Link>
          <a className="btn ghost big" href="#pricing">See pricing and plans</a>
        </div>
        <p className="price">
          Free interview · <s className="price-reference">$10</s> <strong>$5</strong> per PDF · included with membership
        </p>
        <p className="homerow">
          <HelpTip title="How this works">
            Describe your situation in plain words. We match it to the right motion, ask its
            questions one at a time, and prepare your filing-ready PDF — no retainer, no
            hourly bill. The interview is free. When you’re ready, pay $5 for the PDF and filing instructions or download them with your membership.
          </HelpTip>
          <HelpTip title="The fine print">{DISCLAIMER}</HelpTip>
        </p>
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

      <ul className="statstrip" aria-label="At a glance">
        <li><strong>{ALL_MOTIONS.length}</strong><span>court motion templates</span></li>
        <li><strong>$5</strong><span>per finished document</span></li>
        <li><strong>Free</strong><span>motion interview</span></li>
        <li><strong>Any device</strong><span>phone, tablet, or computer</span></li>
      </ul>

      <section className="homesec" id="how" aria-labelledby="how-h">
        <p className="eyebrow">How it works</p>
        <h2 id="how-h">From “what do I do?” to a filed motion in five steps</h2>
        <p className="seclede">No legal jargon, no blank forms. Tap a step to see what it looks like.</p>
        <HomeWalkthrough />
      </section>

      {GROUPS.map((g) => (
        <section className="homesec" key={g.kicker} aria-label={g.title}>
          <p className="eyebrow">{g.kicker}</p>
          <h2>{g.title}</h2>
          <div className={`featgrid n${g.features.length}`}>
            {g.features.map((f) => {
              const inner = (
                <>
                  <span className="featicon" aria-hidden="true"><Icon name={f.icon} size={20} /></span>
                  <span className="feattitle">{f.title}</span>
                  <span className="featbody">{f.body}</span>
                  {f.href && <span className="featmore">Open <Icon name="chevronRight" size={13} /></span>}
                </>
              );
              return f.href ? (
                <Link key={f.title} href={f.href} className="featcard link" data-ripple>{inner}</Link>
              ) : (
                <div key={f.title} className="featcard">{inner}</div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="homesec" id="pricing" aria-labelledby="price-h">
        <p className="eyebrow">Pricing</p>
        <h2 id="price-h">Buy one motion or get all the tools</h2>
        <article className="pricecard single-motion">
          <div>
            <h3 className="pricename">One motion, no subscription</h3>
            <p className="featbody">Start the interview for free. Pay once for the PDF and filing instructions.</p>
          </div>
          <p className="priceamt"><s className="price-reference">$10</s> $5</p>
          <Link className="btn primary" href="/interview">Start my motion</Link>
        </article>
        <h3 className="membership-label">Membership plans</h3>
        <p className="featbody">Every plan includes the dashboard, all tools, and unlimited motion PDFs with filing instructions at no extra charge.</p>
        <MembershipPlans />
      </section>

      <section className="homesec honest" aria-labelledby="honest-h">
        <h2 id="honest-h">What we are, honestly</h2>
        <p className="featbody">
          quikForm prepares documents from your answers. We are not a law firm and we don’t give
          legal advice. If your situation is complicated or a lot is at stake, talk to a lawyer or
          your local legal aid office.
        </p>
        <p className="fineprint">{DISCLAIMER}</p>
      </section>

      <section className="homecta">
        <h2>Ready when you are</h2>
        <p className="seclede">Start for free, then buy a PDF for $5 or download it at no extra charge with membership.</p>
        <Link className="btn primary big" href="/interview">Start my motion</Link>
        <Link className="btn ghost big" href="/library">Browse the library</Link>
      </section>
    </div>
  );
}
