'use client';

import { useEffect, useState } from 'react';

// One shared unread-mail count for the whole app shell. MailWatcher
// polls /api/inbox/unread and publishes here; the Finder sidebar,
// its phone toggle, and the bottom tab bar subscribe to show the
// new-mail badge. The inbox page publishes too, the moment a
// message is opened, archived, or deleted, so badges never lag a
// poll behind what the user just did.

type Listener = (n: number) => void;
let current = 0;
let known = false;
const listeners = new Set<Listener>();

export function setUnreadCount(n: number) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  known = true;
  if (v === current) return;
  current = v;
  for (const l of listeners) l(v);
  // App-icon badge on installed PWAs / supporting browsers.
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (v > 0) void nav.setAppBadge?.(v);
    else void nav.clearAppBadge?.();
  } catch { /* unsupported */ }
}

export function getUnreadCount(): number {
  return current;
}

/** Re-fetch the count right now (after a mailbox change). */
export async function refreshUnreadCount(): Promise<void> {
  try {
    const res = await fetch('/api/inbox/unread', { cache: 'no-store' });
    if (!res.ok) return;
    const d = await res.json().catch(() => null);
    if (d && typeof d.unread === 'number') setUnreadCount(d.unread);
  } catch { /* the next poll catches up */ }
}

export function useUnreadCount(): number {
  const [n, setN] = useState(current);
  useEffect(() => {
    listeners.add(setN);
    setN(current);
    if (!known) void refreshUnreadCount();
    return () => { listeners.delete(setN); };
  }, []);
  return n;
}

/** "9+" style label for small badges. */
export function badgeLabel(n: number): string {
  return n > 99 ? '99+' : String(n);
}
