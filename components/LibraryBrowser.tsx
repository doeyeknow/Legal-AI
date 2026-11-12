'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { MotionDef } from '@/lib/motions/types';
import { Icon, CATEGORY_ICONS } from './icons';

/** Searchable, categorized, collapsible motion library.
 *  Categories fold open/shut (accordion); each motion expands in
 *  place to show what it does and a Start button that deep-links
 *  into the interview with that motion preselected. While a search
 *  is typed, categories with matches stay open and show only the
 *  matches. */
export default function LibraryBrowser({
  motions,
  categories,
}: {
  motions: MotionDef[];
  categories: string[];
}) {
  const [query, setQuery] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set([categories[0]]));
  const [openMotions, setOpenMotions] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const grouped = useMemo(() => {
    const matches = (m: MotionDef) =>
      !searching ||
      m.name.toLowerCase().includes(q) ||
      m.purpose.toLowerCase().includes(q) ||
      m.keywords.some((k) => k.toLowerCase().includes(q)) ||
      m.situations.some((s) => s.toLowerCase().includes(q));
    return categories
      .map((cat) => ({ cat, list: motions.filter((m) => m.category === cat && matches(m)) }))
      .filter((g) => g.list.length > 0);
  }, [motions, categories, q, searching]);

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  };

  const catLabel = (cat: string) =>
    cat === 'Forms & Companions'
      ? 'Forms & Companions — add-ons and standalone forms for any case type'
      : cat;

  return (
    <div className="libbrowser">
      <div className="field libsearch">
        <label htmlFor="lib-q">Search the library</label>
        <input
          id="lib-q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “eviction”, “custody”, “continuance”…"
          autoComplete="off"
        />
      </div>

      {searching && grouped.length === 0 && (
        <p className="fineprint">
          Nothing matches “{query}”. Try a plainer word — or{' '}
          <Link href="/interview">describe your situation</Link> and let the interview match it.
        </p>
      )}

      {grouped.map(({ cat, list }) => {
        const open = searching || openCats.has(cat);
        return (
          <section key={cat} className="libcat">
            <button
              type="button"
              className="libcat-head"
              aria-expanded={open}
              onClick={() => toggle(openCats, cat, setOpenCats)}
              data-ripple
            >
              <span><Icon name={CATEGORY_ICONS[cat] || 'doc'} size={17} /> {catLabel(cat)}</span>
              <span className="libcat-meta">
                {list.length} document{list.length === 1 ? '' : 's'}
                <span className={`chev${open ? ' open' : ''}`} aria-hidden="true">▾</span>
              </span>
            </button>
            {open && (
              <div className="libmotions">
                {list.map((m) => {
                  const mOpen = openMotions.has(m.id);
                  return (
                    <div key={m.id} className="libmotion">
                      <button
                        type="button"
                        className="libmotion-head"
                        aria-expanded={mOpen}
                        onClick={() => toggle(openMotions, m.id, setOpenMotions)}
                      >
                        <span>{m.name}</span>
                        <span className={`chev${mOpen ? ' open' : ''}`} aria-hidden="true">▾</span>
                      </button>
                      {mOpen && (
                        <div className="libmotion-body">
                          <p>{m.purpose}</p>
                          <p className="prose-note">{m.proSe}</p>
                          <Link className="btn primary" href={`/interview?motion=${m.id}`}>
                            Start this document — free interview
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
