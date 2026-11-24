'use client';

import { useEffect, useState } from 'react';
import type { CalendarItem } from './dashboard-types';

// One shared copy of the calendar feed for the dashboard calendar,
// the sidebar's mini month, and the full calendar page — fetched
// once, refreshed whenever something on the calendar changes.

type State = { items: CalendarItem[] | null; error: string | null };
let state: State = { items: null, error: null };
let inflight: Promise<void> | null = null;
let loadedAt = 0;
const listeners = new Set<(s: State) => void>();

function publish(next: State) {
  state = next;
  for (const l of listeners) l(state);
}

export async function refreshCalendar(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      let tz = '';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* unknown */ }
      const res = await fetch(`/api/calendar${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        publish({ items: state.items || [], error: res.status === 401 ? null : data.message || 'Your calendar could not be loaded.' });
        return;
      }
      loadedAt = Date.now();
      publish({ items: Array.isArray(data.items) ? data.items : [], error: null });
    } catch {
      publish({ items: state.items || [], error: 'Your calendar could not be loaded.' });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useCalendarFeed(): State & { refresh: () => Promise<void> } {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    if (!state.items || Date.now() - loadedAt > 60_000) void refreshCalendar();
    return () => { listeners.delete(setS); };
  }, []);
  return { ...s, refresh: refreshCalendar };
}
