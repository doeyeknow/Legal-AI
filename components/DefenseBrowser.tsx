'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CHARGE_KINDS, DEFENSE_CATEGORIES, DEFENSES, type ChargeKind } from '@/lib/defenses';

/** Search and filter the defense guide by category and charge. */
export default function DefenseBrowser() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('');
  const [kind, setKind] = useState<ChargeKind | ''>('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return DEFENSES.filter((d) => {
      if (cat && d.category !== cat) return false;
      if (kind && d.charges !== 'all' && !d.charges.includes(kind)) return false;
      if (!t) return true;
      return [d.name, d.summary, d.outcome, ...d.whenItApplies].join(' ').toLowerCase().includes(t);
    });
  }, [q, cat, kind]);

  return (
    <div className="defbrowser">
      <div className="deffilters">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: search warrant, Miranda, speedy trial, diversion…"
          aria-label="Search defenses"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as ChargeKind | '')} aria-label="Charge">
          <option value="">Any charge</option>
          {CHARGE_KINDS.filter((k) => k.key !== 'other').map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </div>
      <div className="defchips" role="tablist">
        <button type="button" className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>All</button>
        {DEFENSE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <p className="fineprint">{list.length} of {DEFENSES.length} entries</p>
      {DEFENSE_CATEGORIES.filter((c) => list.some((d) => d.category === c)).map((c) => (
        <section key={c} className="defgroup">
          <h2>{c}</h2>
          <div className="defgrid">
            {list.filter((d) => d.category === c).map((d) => (
              <Link key={d.id} href={`/defenses/${d.id}`} className="deftile">
                <strong>{d.name}</strong>
                <span className="defoutcome">{d.outcome}</span>
                <span className="deftilesum">{d.summary.split('. ')[0]}.</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
