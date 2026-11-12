'use client';

import { useMemo, useState } from 'react';
import type { ChargeCategory, ChargeEntry } from '@/lib/charges';

export default function ChargesSearch({
  charges,
  categories,
  framing,
}: {
  charges: ChargeEntry[];
  categories: ChargeCategory[];
  framing: string[];
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return charges.filter((c) => {
      if (cat !== 'All' && c.category !== cat) return false;
      if (!needle) return true;
      const hay = [
        c.name, c.commonName, c.meaning, c.classification, c.penaltyRange,
        ...c.elements, ...c.wantToKnow,
      ]
        .join(' ')
        .toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [charges, q, cat]);

  return (
    <div>
      <div className="warn">
        <strong>Read first — this information is general.</strong>
        <ul>
          {framing.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <p>
          Charges, classifications, and penalties vary by state — sometimes a lot. The citation
          or complaint in a real case is the document that counts.
        </p>
      </div>

      <div className="formgrid">
        <div className="field full">
          <label htmlFor="ch-q">Search the library</label>
          <input
            id="ch-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try “shoplifting”, “license suspended”, “no insurance”…"
          />
        </div>
        <div className="field full">
          <label htmlFor="ch-cat">Category</label>
          <select id="ch-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {categories
        .filter((c) => cat === 'All' || c.name === cat)
        .map((c) => {
          const inCat = results.filter((r) => r.category === c.name);
          if (!inCat.length) return null;
          return (
            <section key={c.name} className="dashsection">
              <h2>{c.name}</h2>
              {c.note && <p className="fineprint">{c.note}</p>}
              <div className="chargelist">
                {inCat.map((ch) => (
                  <div key={ch.id} className="chargeitem">
                    <button
                      className="chargetitle"
                      onClick={() => setOpenId(openId === ch.id ? null : ch.id)}
                    >
                      <strong>{ch.name}</strong>
                      <span className="fineprint">{ch.commonName}</span>
                    </button>
                    {openId === ch.id && (
                      <div className="chargebody">
                        <p><strong>What it means:</strong> {ch.meaning}</p>
                        <p><strong>What the prosecution must prove:</strong></p>
                        <ul>
                          {ch.elements.map((el, i) => (
                            <li key={i}>{el}</li>
                          ))}
                        </ul>
                        <p><strong>Typical classification:</strong> {ch.classification}</p>
                        <p><strong>Typical penalty range:</strong> {ch.penaltyRange}</p>
                        <p><strong>What people usually want to know:</strong></p>
                        <ul>
                          {ch.wantToKnow.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                        <p className="fineprint">
                          General information only — classifications and penalties vary by
                          state, and the exact charge in a real case is set by the charging
                          document.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      {results.length === 0 && (
        <p>No charge matches that search. Try the words on the citation itself, or browse by category.</p>
      )}
    </div>
  );
}
