import Link from 'next/link';
import type { Metadata } from 'next';
import FinderShell from '@/components/FinderShell';
import JsonLd from '@/components/JsonLd';
import DefenseBrowser from '@/components/DefenseBrowser';
import { DEFENSES, DEFENSE_DISCLAIMER, DEFENSE_MYTHS } from '@/lib/defenses';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Criminal defense guide — how charges get dismissed',
  description: `${DEFENSES.length} of the most effective ways criminal charges get dismissed or reduced — illegal stops and searches, Miranda, speedy trial, statute of limitations, missing evidence, DUI defenses, diversion — with how to raise each one, the deadline, and the rule behind it.`,
  alternates: { canonical: '/defenses' },
  openGraph: { url: '/defenses', title: 'Criminal defense guide | quikForm' },
};

const LD = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Criminal defense guide',
  url: `${SITE_URL}/defenses`,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: DEFENSES.length,
    itemListElement: DEFENSES.map((d, i) => ({
      '@type': 'ListItem', position: i + 1, name: d.name, url: `${SITE_URL}/defenses/${d.id}`,
    })),
  },
};

export default function DefensesPage() {
  return (
    <FinderShell>
      <div className="library defpage">
        <JsonLd data={LD} />
        <h1>Criminal defense guide</h1>
        <p>
          The real ways criminal charges get dismissed, thrown out, or reduced — each with how to
          raise it, the deadline, what to collect, and the rule or case behind it.
        </p>
        <div className="defcta">
          <Link className="btn primary big" href="/defenses/check">Check my case</Link>
          <span className="fineprint">Answer yes / no questions and get the defenses that fit your situation.</span>
        </div>
        <p className="fineprint">{DEFENSE_DISCLAIMER}</p>
        <DefenseBrowser />
        <section className="libhonest">
          <h2>Common beliefs that do not get charges dropped</h2>
          <ul>
            {DEFENSE_MYTHS.map((m) => <li key={m.myth}><strong>{m.myth}</strong> {m.truth}</li>)}
          </ul>
        </section>
      </div>
    </FinderShell>
  );
}
