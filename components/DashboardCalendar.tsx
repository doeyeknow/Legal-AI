'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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

/** The calendar card on the dashboard home: a compact month with
 *  colored dots on busy days, and the agenda for the chosen day (or
 *  what's coming up next), with a link to the full calendar. */
export default function DashboardCalendar() {
  const today = useMemo(() => new Date(), []);
  const todayKey = isoDay(today);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const { items } = useCalendarFeed();
  const byDay = useMemo(() => groupByDay(items || []), [items]);

  const upcoming = useMemo(
    () => (items || []).filter((it) => !it.done && itemDay(it) >= todayKey).slice(0, 5),
    [items, todayKey],
  );
  const dayItems = selected ? byDay.get(selected) || [] : [];
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <section className="dashsection dashcal" aria-labelledby="dashcal-title">
      <div className="dashcal-head">
        <h2 id="dashcal-title">Calendar</h2>
        <Link className="btn small ghost" href="/dashboard/calendar">
          <Icon name="calendar" size={15} /> Open full calendar
        </Link>
      </div>
      <div className="dashcal-body">
        <div className="dashcal-month">
          <div className="dashcal-monthhead">
            <button type="button" className="iconbtn" onClick={() => shift(-1)} aria-label="Previous month">
              <Icon name="chevronLeft" size={16} />
            </button>
            <strong>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</strong>
            <button type="button" className="iconbtn" onClick={() => shift(1)} aria-label="Next month">
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          <MonthGrid
            cursor={cursor}
            selected={selected || todayKey}
            byDay={byDay}
            onSelect={(d) => setSelected(d === selected ? null : d)}
            size="compact"
          />
        </div>
        <div className="dashcal-agenda">
          <div className="dashcal-agendahead">
            <h3>{selected ? longDay(selected, todayKey) : 'Coming up'}</h3>
            {selected && (
              <button type="button" className="linkbtn" onClick={() => setSelected(null)}>Show what’s next</button>
            )}
          </div>
          {!items && <p className="fineprint">Loading…</p>}
          {items && selected && dayItems.length === 0 && (
            <p className="fineprint">Nothing on the calendar this day.</p>
          )}
          {items && !selected && upcoming.length === 0 && (
            <p className="fineprint">
              Nothing coming up. Hearings, deadlines, and calls from your cases and court mail show
              up here.
            </p>
          )}
          <ul className="agendalist">
            {(selected ? dayItems : upcoming).map((it) => (
              <AgendaItem key={it.id} item={it} showDate={!selected} compact />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The sidebar's tiny month: tap a day to open it in the full
 *  calendar, or use the link beneath it. */
export function SidebarMiniCalendar({ onNavigate }: { onNavigate?: () => void }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const { items } = useCalendarFeed();
  const byDay = useMemo(() => groupByDay(items || []), [items]);
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  return (
    <div className="sidecal" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) onNavigate?.(); }}>
      <div className="sidecal-head">
        <button type="button" className="iconbtn" onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" size={14} />
        </button>
        <span>{MONTHS[cursor.getMonth()].slice(0, 3)} {cursor.getFullYear()}</span>
        <button type="button" className="iconbtn" onClick={() => shift(1)} aria-label="Next month">
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
      <MonthGrid
        cursor={cursor}
        selected={null}
        byDay={byDay}
        size="mini"
        hrefFor={(d) => `/dashboard/calendar?day=${d}`}
      />
      <Link className="sidecal-link" href="/dashboard/calendar">
        <Icon name="calendar" size={14} /> Full calendar view
      </Link>
    </div>
  );
}
