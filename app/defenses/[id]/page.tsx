import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import FinderShell from '@/components/FinderShell';
import JsonLd from '@/components/JsonLd';
import { DEFENSES, DEFENSE_DISCLAIMER, CHARGE_KINDS, getDefense } from '@/lib/defenses';
import { getMotion } from '@/lib/motions/match';
import { SITE_URL } from '@/lib/site';

export function generateStaticParams() {
  return DEFENSES.map((d) => ({ id: d.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const d = getDefense(params.id);
  if (!d) return {};
  const desc = `${d.outcome}. ${d.summary}`.slice(0, 300);
  return {
    title: `${d.name} — criminal defense guide`,
    description: desc,
    alternates: { canonical: `/defenses/${d.id}` },
    openGraph: { url: `/defenses/${d.id}`, title: `${d.name} | quikForm`, description: desc, type: 'article' },
  };
}

export default function DefenseDetail({ params }: { params: { id: string } }) {
  const d = getDefense(params.id);
  if (!d) notFound();
  const motions = d.motionIds.map((id) => getMotion(id)).filter(Boolean);
  const related = DEFENSES.filter((x) => x.category === d.category && x.id !== d.id);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to raise: ${d.name}`,
    description: d.summary,
    url: `${SITE_URL}/defenses/${d.id}`,
    step: d.howToRaise.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  };
  const fits = d.charges === 'all' ? 'Any criminal charge' : d.charges.map((k) => CHARGE_KINDS.find((c) => c.key === k)?.label).join(', ');
  return (
    <FinderShell>
      <article className="library defpage defdetail">
        <JsonLd data={ld} />
        <p className="fineprint"><Link href="/defenses">Defense guide</Link> · {d.category}</p>
        <h1>{d.name}</h1>
        <p className="defoutcome big">{d.outcome}</p>
        <p>{d.summary}</p>
        <p className="fineprint">Fits: {fits}</p>
        <h2>Signs it may apply</h2>
        <ul>{d.whenItApplies.map((s) => <li key={s}>{s}</li>)}</ul>
        <h2>How to raise it</h2>
        <ol>{d.howToRaise.map((s) => <li key={s}>{s}</li>)}</ol>
        <h2>Deadline</h2>
        <p>{d.timing}</p>
        <h2>Collect now</h2>
        <ul>{d.evidence.map((s) => <li key={s}>{s}</li>)}</ul>
        <h2>Honest limits</h2>
        <ul>{d.limits.map((s) => <li key={s}>{s}</li>)}</ul>
        <div className="defnav">
          {motions.map((m) => (
            <Link key={m!.id} className="btn primary" href={`/interview?motion=${encodeURIComponent(m!.id)}`}>Start: {m!.name}</Link>
          ))}
          <Link className="btn ghost" href="/defenses/check">Check my case</Link>
        </div>
        {d.sources.length > 0 && (
          <>
            <h2>Sources</h2>
            <ul className="defsrclist">
              {d.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}
            </ul>
          </>
        )}
        <p className="fineprint">{DEFENSE_DISCLAIMER}</p>
        {related.length > 0 && (
          <>
            <h2>Related</h2>
            <ul>{related.map((r) => <li key={r.id}><Link href={`/defenses/${r.id}`}>{r.name}</Link> — {r.outcome}</li>)}</ul>
          </>
        )}
      </article>
    </FinderShell>
  );
}
