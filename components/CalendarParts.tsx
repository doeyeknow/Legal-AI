'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { deadlineType } from '@/lib/comm-templates';
import { CASE_EVENT_KINDS, type CalendarItem } from '@/lib/dashboard-types';
import { refreshCalendar } from '@/lib/calendar-store';

// Shared pieces for every calendar surface: the month grid (full
// size on the calendar page, compact on the dashboard and in the
// sidebar) and the agenda row with its Join / Call buttons.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The item's day and time in the user's own time zone. Hearings
 *  carry an exact timestamp; everything else is a plain date. */
export function itemDay(it: CalendarItem): string {
  return it.at ? isoDay(new Date(it.at)) : it.date;
}
export function itemTime(it: CalendarItem): string | null {
  if (it.at) {
    const d = new Date(it.at);
    if (d.getHours() === 0 && d.getMinutes() === 0) return null;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (!it.time) return null;
  const [h, m] = it.time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function itemKindLabel(it: CalendarItem): string {
  if (it.source === 'hearing') return 'Hearing';
  if (it.source === 'deadline') return deadlineType(it.kind)?.label || 'Deadline';
  if (it.kind === 'call') return 'Call';
  return CASE_EVENT_KINDS.find((k) => k.key === it.kind)?.label || 'Event';
}

export function itemTone(it: CalendarItem): 'hearing' | 'deadline' | 'call' | 'event' {
  if (it.source === 'hearing' || it.kind === 'hearing_date' || it.kind === 'hearing') return 'hearing';
  if (it.source === 'deadline') return 'deadline';
  if (it.kind === 'call') return 'call';
  return 'event';
}

export function itemTitle(it: CalendarItem): string {
  if (it.source === 'deadline') return it.title || deadlineType(it.kind)?.label || 'Deadline';
  return it.title;
}

export function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const m = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const k = itemDay(it);
    const list = m.get(k) || [];
    list.push(it);
    m.set(k, list);
  }
  return m;
}

export function longDay(day: string, today: string): string {
  if (day === today) return 'Today';
  const d = new Date(`${day}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A six-week month grid. `size` picks the full page cells, the
 *  dashboard card, or the tiny sidebar month. */
export function MonthGrid({
  cursor,
  selected,
  byDay,
  onSelect,
  size = 'full',
  hrefFor,
}: {
  cursor: Date;
  selected: string | null;
  byDay: Map<string, CalendarItem[]>;
  onSelect?: (day: string) => void;
  size?: 'full' | 'compact' | 'mini';
  hrefFor?: (day: string) => string;
}) {
  const today = isoDay(new Date());
  const days = useMemo(() => {
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
  const cls = size === 'full' ? 'calview' : size === 'compact' ? 'calcompact' : 'calmini';
  return (
    <div className={`${cls}-month`}>
      <div className={`${cls}-dow`} aria-hidden="true">
        {(size === 'full' ? DOW : DOW_SHORT).map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className={`${cls}-grid`}>
        {days.map((d) => {
          const key = isoDay(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const open = (byDay.get(key) || []).filter((x) => !x.done);
          const tones = Array.from(new Set(open.map(itemTone))).slice(0, 3);
          const className = `${cls}-day${inMonth ? '' : ' dim'}${key === selected ? ' sel' : ''}${key === today ? ' today' : ''}${open.length ? ' has' : ''}`;
          const label = `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${open.length ? `, ${open.length} item${open.length === 1 ? '' : 's'}` : ''}`;
          const inner = (
            <>
              <span className={`${cls}-num`}>{d.getDate()}</span>
              {size === 'full' ? (
                <span className="calview-chips">
                  {open.slice(0, 2).map((x) => (
                    <span key={x.id} className={`calchip tone-${itemTone(x)}`}>{itemTitle(x)}</span>
                  ))}
                  {open.length > 2 && <span className="calchip more">+{open.length - 2} more</span>}
                </span>
              ) : (
                <span className="caldots">
                  {tones.map((t) => <span key={t} className={`caldot tone-${t}`} />)}
                </span>
              )}
            </>
          );
          if (hrefFor) {
            return (
              <Link key={key} href={hrefFor(key)} className={className} aria-label={label}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={key} type="button" className={className} aria-label={label} onClick={() => onSelect?.(key)}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One agenda row: what it is, the case, and the right buttons —
 *  Join for remote hearings, Call / Call with the hearing companion
 *  for calls to make, and a done tick for calls and events. */
export function AgendaItem({
  item,
  showDate = false,
  compact = false,
}: {
  item: CalendarItem;
  showDate?: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const tone = itemTone(item);
  const time = itemTime(item);
  const tel = item.phone ? item.phone.replace(/[^\d+]/g, '') : '';
  const hasRemote = Boolean(item.joinUrl || item.meetingId || item.passcode || item.dialIn || item.details);

  async function toggleDone() {
    if (!item.eventId) return;
    setBusy(true);
    try {
      await fetch(`/api/events/${item.eventId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ done: !item.done }),
      });
      await refreshCalendar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`agendaitem tone-${tone}${item.done ? ' done' : ''}${compact ? ' compact' : ''}`}>
      <span className={`agendabar tone-${tone}`} aria-hidden="true" />
      <div className="agendamain">
        <div className="agendameta">
          <span className="agendakind">{itemKindLabel(item)}</span>
          {showDate && <span>{shortDay(itemDay(item))}</span>}
          {time && <span>{time}</span>}
          {item.platform && item.joinUrl && <span>{item.platform}</span>}
        </div>
        <strong className="agendatitle">{itemTitle(item)}</strong>
        <Link className="agendacase" href={`/dashboard/cases/${item.caseId}`}>{item.caseTitle}</Link>

        {(item.joinUrl || tel) && !item.done && (
          <div className="agendaactions">
            {item.joinUrl && (
              <a className="btn small primary" href={item.joinUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="video" size={15} /> Join{item.platform ? ` ${item.platform}` : ''}
              </a>
            )}
            {tel && (
              <a className="btn small primary" href={`tel:${tel}`}>
                <Icon name="phone" size={15} /> Call {item.phone}
              </a>
            )}
            {item.kind === 'call' && item.eventId && (
              <Link
                className="btn small ghost"
                href={`/dashboard/hearing-live?case=${item.caseId}&call=${item.eventId}`}
              >
                <Icon name="headphones" size={15} /> Call with hearing companion
              </Link>
            )}
            {item.source === 'hearing' || item.kind === 'hearing_date' ? (
              <Link className="btn small ghost" href={`/dashboard/hearing-live?case=${item.caseId}`}>
                <Icon name="headphones" size={15} /> Hearing companion
              </Link>
            ) : null}
          </div>
        )}

        {!compact && hasRemote && (item.meetingId || item.passcode || item.dialIn || item.details) && (
          <button type="button" className="linkbtn agendamore" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Hide details' : item.source === 'event' ? 'Details' : 'How to join'}
          </button>
        )}
        {open && (
          <dl className="agendadetails">
            {item.meetingId && (<><dt>Meeting number</dt><dd>{item.meetingId}</dd></>)}
            {item.passcode && (<><dt>Passcode</dt><dd>{item.passcode}</dd></>)}
            {item.dialIn && (<><dt>Join by phone</dt><dd><a href={`tel:${item.dialIn.replace(/[^\d+]/g, '')}`}>{item.dialIn}</a></dd></>)}
            {item.details && (<><dt>{item.source === 'event' ? 'Notes' : 'Instructions'}</dt><dd className="prewrap">{item.details}</dd></>)}
          </dl>
        )}
      </div>
      {item.eventId && (
        <button
          type="button"
          className={`agendadone${item.done ? ' on' : ''}`}
          onClick={toggleDone}
          disabled={busy}
          aria-label={item.done ? 'Mark not done' : 'Mark done'}
          title={item.done ? 'Done — tap to undo' : 'Mark done'}
        >
          <Icon name="check" size={15} />
        </button>
      )}
    </li>
  );
}
