'use client';

import { useMemo, useState } from 'react';
import type { PortalEntry, SafeStep, SheriffExample } from '@/lib/portals';

const STATE_ORDER = [
  'NM', 'AZ', 'CO', 'TX', 'CA', 'FL', 'NY', 'PA', 'MD', 'MO', 'OK', 'WI', 'IN', 'VA', 'WA', 'MA', 'US',
];

export default function PortalsDirectory({
  portals,
  sheriffExamples,
  showsNotProve,
  nothingProves,
  safeSteps,
}: {
  portals: PortalEntry[];
  sheriffExamples: SheriffExample[];
  showsNotProve: string[];
  nothingProves: string[];
  safeSteps: SafeStep[];
}) {
  const states = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of portals) if (!seen.has(p.state)) seen.set(p.state, p.stateName);
    return STATE_ORDER.filter((s) => seen.has(s)).map((s) => ({ code: s, name: seen.get(s)! }));
  }, [portals]);
  const [state, setState] = useState('NM');
  const shown = portals.filter((p) => p.state === state || p.state === 'US');

  return (
    <div>
      <div className="warn">
        <strong>There is no single national warrant database the public can search.</strong>{' '}
        The FBI’s NCIC holds warrant data nationally, but by law it is open only to law
        enforcement. “Warrant check” websites sell scraped, patchy court data — a “no results”
        from them proves nothing. A warrant is issued by a specific court in a specific county,
        and that court — or its sheriff — is who can confirm it. This directory links official
        sources only.
      </div>

      <div className="field">
        <label htmlFor="w-state">Your state</label>
        <select id="w-state" value={state} onChange={(e) => setState(e.target.value)}>
          {states.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </div>

      <section className="dashsection">
        <h2>Official routes</h2>
        <div className="portallist">
          {shown.map((p) => (
            <div key={p.key} className="portalitem">
              <strong>{p.portalName}</strong>
              <span className="fineprint block">{p.agency} · {p.stateName} · Cost: {p.costNote}</span>
              <p>{p.searches}</p>
              {p.url ? (
                <p>
                  <a href={p.url} target="_blank" rel="noreferrer">Open the official portal ↗</a>
                </p>
              ) : (
                <p className="fineprint">
                  No verified public link — find it by searching: “{p.searchTerms}”
                </p>
              )}
              {p.coverage && <p className="fineprint"><strong>Covers:</strong> {p.coverage}</p>}
              {p.notes && <p className="fineprint">{p.notes}</p>}
              <p className="fineprint"><strong>To be sure:</strong> {p.verifyWith}</p>
            </div>
          ))}
        </div>
        <p className="fineprint">
          For fragmented states (TX, CA, FL, NY, VA), the next step is the county: the district
          or county clerk for the court of filing, and the county sheriff’s warrant list. Search
          “[county name] sheriff warrant search” and use only the county’s official .gov site.
        </p>
        <ul>
          {sheriffExamples.map((s, i) => (
            <li key={i} className="fineprint">
              <strong>{s.agency}:</strong> {s.note}
            </li>
          ))}
        </ul>
        <p className="fineprint">
          The ground truth, when it matters, is a phone call: the clerk of the court that would
          have issued the warrant can confirm — for their court — whether a warrant is active
          and what case it is attached to. One county being clear says nothing about others.
        </p>
      </section>

      <section className="dashsection">
        <h2>What a lookup does — and doesn’t — prove</h2>
        <p><strong>A result showing a warrant does NOT prove:</strong></p>
        <ul>
          {showsNotProve.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <p><strong>A search that finds nothing does NOT prove:</strong></p>
        <ul>
          {nothingProves.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <p>
          What a result does give you is a lead — usually a court, a case number, and a date.
          That is exactly what a clerk needs to give a definitive answer.
        </p>
      </section>

      <section className="dashsection">
        <h2>If a warrant does exist — the standard safe steps</h2>
        <ol>
          {safeSteps.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong> {s.text}
            </li>
          ))}
        </ol>
        <p className="fineprint">
          What not to do: don’t pay any site that claims it can “remove” a warrant — only the
          issuing court can — and don’t send money to anyone other than the court, a bondsman
          you chose, or the official payment portal the court names.
        </p>
      </section>
    </div>
  );
}
