'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashGate from './DashGate';
import { Icon } from './icons';
import { useCalendarFeed } from '@/lib/calendar-store';
import {
  AgendaItem,
  MONTHS,
  MonthGrid,
  groupByDay,
  isoDay,
  itemDay,
  longDay,
} from './CalendarParts';

function CalendarBody() {
  const today = useMemo(() => new Date(), []);
  const todayKey = isoDay(today);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(todayKey);
  const { items, error } = useCalendarFeed();

  // Deep links from the dashboard and sidebar: ?day=YYYY-MM-DD.
  const params = useSearchParams();
  const dayParam = params?.get('day') || '';
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      const d = new Date(`${dayParam}T12:00:00`);
      setSelected(dayParam);
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [dayParam]);

  const byDay = useMemo(() => groupByDay(items || []), [items]);
  const monthItems = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    return (items || []).filter((it) => {
      const d = new Date(`${itemDay(it)}T12:00:00`);
      return d.getFullYear() === y && d.getMonth() === m && !it.done;
    });
  }, [items, cursor]);

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const select = (day: string) => {
    setSelected(day);
    const d = new Date(`${day}T12:00:00`);
    if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  if (error && !items?.length) return <p className="error">{error}</p>;
  if (!items) return <p className="fineprint">Loading your calendar…</p>;

  const dayItems = byDay.get(selected) || [];

  return (
    <div className="calview">
      <div className="calview-head">
        <button type="button" className="btn ghost small" onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" size={16} />
        </button>
        <h2 className="calview-title">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
        <button type="button" className="btn ghost small" onClick={() => shift(1)} aria-label="Next month">
          <Icon name="chevronRight" size={16} />
        </button>
        <button
          type="button" className="btn ghost small"
          onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(todayKey); }}
        >Today</button>
      </div>
      <CalLegend />
      <MonthGrid cursor={cursor} selected={selected} byDay={byDay} onSelect={select} size="full" />

      <section className="dashsection">
        <h2>{longDay(selected, todayKey)}</h2>
        {dayItems.length === 0 && <p className="fineprint">Nothing on the calendar this day.</p>}
        <ul className="agendalist">
          {dayItems.map((it) => <AgendaItem key={it.id} item={it} />)}
        </ul>
      </section>
      {monthItems.length > 0 && (
        <section className="dashsection">
          <h2>All of {MONTHS[cursor.getMonth()]}</h2>
          <ul className="agendalist">
            {monthItems.map((it) => <AgendaItem key={it.id} item={it} showDate />)}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CalLegend() {
  return (
    <div className="callegend" aria-label="Color key">
      <span><i className="caldot tone-hearing" /> Hearings</span>
      <span><i className="caldot tone-deadline" /> Deadlines</span>
      <span><i className="caldot tone-call" /> Calls</span>
      <span><i className="caldot tone-event" /> Other events</span>
    </div>
  );
}

export default function CalendarView() {
  return (
    <DashGate>
      {() => (
        <Suspense fallback={<p className="fineprint">Loading your calendar…</p>}>
          <CalendarBody />
        </Suspense>
      )}
    </DashGate>
  );
}
