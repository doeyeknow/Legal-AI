import Link from 'next/link';
import { ALL_MOTIONS, CATEGORIES } from '@/lib/motions/data';
import { DISCLAIMER } from '@/lib/motions/types';
import LibraryBrowser from '@/components/LibraryBrowser';
import FinderShell from '@/components/FinderShell';
import JsonLd from '@/components/JsonLd';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Motion library — court motion templates for self-represented people',
  description: `Browse ${ALL_MOTIONS.length} court motion templates by category — continuances, extensions of time, fee waivers, custody and support changes, eviction, protection orders, appeals, and more. Start any one and answer its questions to get a filing-ready PDF.`,
  alternates: { canonical: '/library' },
  openGraph: { url: '/library', title: 'Motion library | quikForm' },
};

const LIBRARY_LD = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Motion library',
  url: `${SITE_URL}/library`,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: ALL_MOTIONS.length,
    itemListElement: ALL_MOTIONS.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.name,
      description: m.purpose,
      url: `${SITE_URL}/interview?motion=${encodeURIComponent(m.id)}`,
    })),
  },
};

export default function LibraryPage() {
  return (
    <FinderShell>
    <div className="library">
      <JsonLd data={LIBRARY_LD} />
      <h1>Motion library</h1>
      <p>
        Every template in the library — search it, open a category, and start the motion you
        need. Or <Link href="/interview">describe your situation</Link> and let the interview
        match it for you.
      </p>
      <p className="fineprint">{DISCLAIMER}</p>
      <LibraryBrowser motions={ALL_MOTIONS} categories={[...CATEGORIES]} />
      <section className="libhonest">
        <h2>Honest about what this is</h2>
        <p>
          Some motions are routine paperwork courts expect people to file themselves — continuances,
          fee waivers, support changes. Some are not: a motion to suppress evidence or for summary
          judgment is real legal argument, and this service says so on those flows and points you to
          a lawyer or legal aid. Every criminal flow starts with a reminder: if you cannot afford a
          lawyer, you have the right to a court-appointed one. Ask for it.
        </p>
      </section>
      <section className="libfine">
        <p className="fineprint">{DISCLAIMER}</p>
        <p className="fineprint">
          This service prepares documents from the answers you give. It does not review your case,
          and it cannot tell you whether a motion is right for you. Court rules, fees, and deadlines
          vary by court and change over time — confirm them with the clerk of your court. If your
          situation involves a child in danger, a criminal charge, or a deadline measured in days,
          contact a lawyer or your local legal aid office as well.
        </p>
      </section>
    </div>
    </FinderShell>
  );
}
