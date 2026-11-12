'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashGate from './DashGate';
import { Icon } from './icons';
import type { Deadline } from '@/lib/dashboard-types';
import { deadlineType } from '@/lib/comm-templates';

type CalDeadline = Deadline & { caseTitle: string };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CalendarBody() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(iso(today));
  const [items, setItems] = useState<CalDeadline[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/deadlines')
      .then(async (res) => {
        if (!live) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || 'Your calendar could not be loaded.');
          return;
        }
        setItems(Array.isArray(data.deadlines) ? data.deadlines : []);
      })
      .catch(() => { if (live) setError('Your calendar could not be loaded.'); });
    return () => { live = false; };
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, CalDeadline[]>();
    for (const d of items || []) {
      const list = m.get(d.dueAt) || [];
      list.push(d);
      m.set(d.dueAt, list);
    }
    return m;
  }, [items]);

  // A six-week grid covering the month (like Finder's month view).
  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const shown = (d: Date) => (byDay.get(iso(d)) || []).filter((x) => !x.done);
  const monthItems = useMemo(() => {
    if (!items) return [];
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    return items.filter((d) => {
      const dt = new Date(`${d.dueAt}T12:00:00`);
      return dt.getFullYear() === y && dt.getMonth() === m && !d.done;
    });
  }, [items, cursor]);

  const shift = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  if (error) return <p className="error">{error}</p>;
  if (!items) return <p className="fineprint">Loading your calendar…</p>;

  return (
    <div className="calview">
      <div className="calview-head">
        <button type="button" className="btn ghost small" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <h2 className="calview-title">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
        <button type="button" className="btn ghost small" onClick={() => shift(1)} aria-label="Next month">›</button>
        <button
          type="button" className="btn ghost small"
          onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(iso(today)); }}
        >Today</button>
      </div>
      <div className="calview-dow">
        {DOW.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="calview-grid">
        {weeks.map((d) => {
          const key = iso(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === iso(today);
          const isSel = key === selected;
          const dayItems = shown(d);
          return (
            <button
              key={key}
              type="button"
              className={`calview-day${inMonth ? '' : ' dim'}${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`}
              onClick={() => setSelected(key)}
            >
              <span className="calview-num">{d.getDate()}</span>
              {dayItems.slice(0, 3).map((x, i) => (
                <span key={x.id} className="calview-dot" style={{ top: `${4 + i * 5}px` }} title={`${x.label || deadlineType(x.type)?.label} — ${x.caseTitle}`} />
              ))}
            </button>
          );
        })}
      </div>
      <section className="dashsection">
        <h2>
          {selected === iso(today) ? 'Today' : new Date(`${selected}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </h2>
        {(byDay.get(selected) || []).length === 0 && (
          <p className="fineprint">Nothing due this day.</p>
        )}
        <ul className="deadlinelist">
          {(byDay.get(selected) || []).map((d) => (
            <li key={d.id} className={`deadlineitem${d.done ? ' done' : ''}`}>
              {d.done ? <Icon name="check" size={16} /> : <span className="duedate">{d.type ? deadlineType(d.type)?.label || d.type : ''}</span>}
              <span>
                <strong>{d.label || deadlineType(d.type)?.label || d.type}</strong>
                {' — '}
                <Link href={`/dashboard/cases/${d.caseId}`}>{d.caseTitle}</Link>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {monthItems.length > 0 && (
        <section className="dashsection">
          <h2>This month</h2>
          <ul className="deadlinelist">
            {monthItems.map((d) => (
              <li key={d.id} className="deadlineitem">
                <span className="duedate">
                  {new Date(`${d.dueAt}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span>
                  <strong>{d.label || deadlineType(d.type)?.label || d.type}</strong>
                  {' — '}
                  <Link href={`/dashboard/cases/${d.caseId}`}>{d.caseTitle}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function CalendarView() {
  return (
    <DashGate>
      {() => <CalendarBody />}
    </DashGate>
  );
}
