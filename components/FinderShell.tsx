'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';
import { useUnreadCount, badgeLabel } from '@/lib/unread-store';
import { SidebarMiniCalendar } from './DashboardCalendar';

/** The dashboard as a Mac-Finder-style window: a slim chrome bar
 *  with traffic lights and the current view's name, a translucent
 *  sidebar of folders (favorites, then tools), and the selected
 *  view's content beside it. On phones the sidebar folds away and
 *  opens as an overlay — from the toggle in the chrome bar, or by
 *  swiping in from the left edge of the screen (and swiping it
 *  back out to close). The Inbox folder carries a new-mail badge. */
interface SideItem {
  href: string;
  icon: IconName;
  label: string;
  match: (p: string) => boolean;
  badge?: 'unread';
}

const FAVORITES: SideItem[] = [
  {
    href: '/dashboard', icon: 'folder', label: 'Cases',
    match: (p) => p === '/dashboard' || p.startsWith('/dashboard/cases'),
  },
  {
    href: '/dashboard/inbox', icon: 'mail', label: 'Inbox',
    match: (p) => p.startsWith('/dashboard/inbox'),
    badge: 'unread',
  },
  {
    href: '/library', icon: 'book', label: 'Motion Library',
    match: (p) => p.startsWith('/library'),
  },
  {
    href: '/dashboard/calendar', icon: 'calendar', label: 'Calendar',
    match: (p) => p.startsWith('/dashboard/calendar'),
  },
  {
    href: '/dashboard/evidence', icon: 'shieldCheck', label: 'Evidence Locker',
    match: (p) => p.startsWith('/dashboard/evidence'),
  },
];

const TOOLS: SideItem[] = [
  { href: '/dashboard/practice', icon: 'target', label: 'Hearing Practice', match: (p) => p.startsWith('/dashboard/practice') },
  { href: '/dashboard/hearing-live', icon: 'headphones', label: 'Hearing Companion', match: (p) => p.startsWith('/dashboard/hearing-live') },
  { href: '/dashboard/warrants', icon: 'search', label: 'Warrants & Lookup', match: (p) => p.startsWith('/dashboard/warrants') },
  { href: '/dashboard/charges', icon: 'list', label: 'Charge Library', match: (p) => p.startsWith('/dashboard/charges') },
  { href: '/defenses', icon: 'shield', label: 'Defense Guide', match: (p) => p.startsWith('/defenses') },
  { href: '/account', icon: 'person', label: 'Account', match: (p) => p.startsWith('/account') },
];

const TITLES: [string, string][] = [
  ['/dashboard/cases', 'Case'],
  ['/dashboard/inbox', 'Inbox'],
  ['/dashboard/calendar', 'Calendar'],
  ['/dashboard/evidence', 'Evidence Locker'],
  ['/dashboard/practice', 'Hearing Practice'],
  ['/dashboard/hearing-live', 'Hearing Companion'],
  ['/dashboard/warrants', 'Warrants & Case Lookup'],
  ['/dashboard/charges', 'Charge Library'],
  ['/dashboard', 'Cases'],
  ['/library', 'Motion Library'],
  ['/defenses', 'Defense Guide'],
  ['/account', 'Account'],
];

/** How close to the left edge a touch must start to open the
 *  sidebar by swiping, and how the release is decided. */
const EDGE_PX = 28;
const AXIS_LOCK_PX = 8;
const FLICK_PX_PER_MS = 0.35;
const PHONE_QUERY = '(max-width: 760px)';

export default function FinderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/dashboard';
  const [navOpen, setNavOpen] = useState(false);
  const unread = useUnreadCount();
  const sideRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);
  openRef.current = navOpen;

  const title = TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'Cases';

  // Close the drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Edge-swipe gesture (phones only — on wider screens the sidebar
  // is always visible). The drawer follows the finger; on release
  // it settles open or closed by distance, or by a quick flick.
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    let track: null | {
      mode: 'open' | 'close';
      x0: number; y0: number; t0: number;
      lastX: number; lastT: number;
      locked: 'x' | 'y' | null;
      width: number;
    } = null;

    const paint = (offset: number, width: number) => {
      const side = sideRef.current;
      const scrim = scrimRef.current;
      if (side) {
        side.style.transition = 'none';
        side.style.transform = `translateX(${offset}px)`;
      }
      if (scrim) {
        scrim.style.transition = 'none';
        scrim.style.opacity = String(Math.max(0, Math.min(1, 1 + offset / width)));
        scrim.style.pointerEvents = 'none';
        scrim.style.visibility = 'visible';
      }
    };
    const unpaint = () => {
      const side = sideRef.current;
      const scrim = scrimRef.current;
      if (side) { side.style.transition = ''; side.style.transform = ''; }
      if (scrim) {
        scrim.style.transition = ''; scrim.style.opacity = '';
        scrim.style.pointerEvents = ''; scrim.style.visibility = '';
      }
    };

    const onStart = (e: TouchEvent) => {
      if (!mq.matches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const open = openRef.current;
      if (!open && t.clientX > EDGE_PX) return;
      // Don't hijack swipes that begin inside a modal or a sideways
      // scroller (badge rails, date pickers…).
      const target = e.target as HTMLElement | null;
      if (target?.closest('.modalbackdrop, .ctxbackdrop, .badgerail, [data-noswipe]')) return;
      track = {
        mode: open ? 'close' : 'open',
        x0: t.clientX, y0: t.clientY, t0: e.timeStamp,
        lastX: t.clientX, lastT: e.timeStamp,
        locked: null,
        width: sideRef.current?.offsetWidth || 260,
      };
    };

    const onMove = (e: TouchEvent) => {
      if (!track) return;
      const t = e.touches[0];
      const dx = t.clientX - track.x0;
      const dy = t.clientY - track.y0;
      if (!track.locked) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        track.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (track.locked === 'y') { track = null; return; }
      }
      if (e.cancelable) e.preventDefault();
      track.lastX = t.clientX;
      track.lastT = e.timeStamp;
      const w = track.width;
      const offset = track.mode === 'open'
        ? Math.min(0, Math.max(-w, -w + dx))
        : Math.min(0, Math.max(-w, dx));
      paint(offset, w);
    };

    const onEnd = (e: TouchEvent) => {
      const tr = track;
      track = null;
      if (!tr || tr.locked !== 'x') return;
      const dx = tr.lastX - tr.x0;
      const dt = Math.max(1, tr.lastT - tr.t0);
      const v = dx / dt;
      const w = tr.width;
      const pos = tr.mode === 'open' ? -w + dx : dx; // final offset, -w..0
      let open: boolean;
      if (v > FLICK_PX_PER_MS) open = true;
      else if (v < -FLICK_PX_PER_MS) open = false;
      else open = pos > -w / 2;
      unpaint();
      setNavOpen(open);
      if (e.cancelable) e.preventDefault();
    };

    const onCancel = () => { track = null; unpaint(); };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onCancel);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, []);

  // Escape closes the drawer.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const nav = (items: SideItem[], section: string) => (
    <>
      <p className="sidesection">{section}</p>
      {items.map((t) => {
        const active = t.match(pathname);
        const count = t.badge === 'unread' ? unread : 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`sideitem${active ? ' active' : ''}`}
            onClick={() => setNavOpen(false)}
            aria-label={count > 0 ? `${t.label}, ${count} new` : undefined}
          >
            <Icon name={t.icon} size={16} />
            <span className="sidelabel">{t.label}</span>
            {count > 0 && <span className="newbadge" aria-hidden="true">{badgeLabel(count)}</span>}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="finderwin">
      <div className="finderchrome">
        <span className="trafficlights" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="findertitle">{title}</span>
        <button
          type="button"
          className="findertoggle"
          aria-label={
            navOpen ? 'Close sidebar' : unread > 0 ? `Open sidebar, ${unread} new emails` : 'Open sidebar'
          }
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <Icon name="list" size={16} />
          {unread > 0 && !navOpen && <span className="newdot" aria-hidden="true" />}
        </button>
      </div>
      <div className="finderbody">
        <aside ref={sideRef} className={`finderside${navOpen ? ' open' : ''}`} aria-label="Views">
          {nav(FAVORITES, 'Favorites')}
          <p className="sidesection">Calendar</p>
          <SidebarMiniCalendar onNavigate={() => setNavOpen(false)} />
          {nav(TOOLS, 'Tools')}
          <p className="sidefoot">Saved to your account, visible only to you.</p>
        </aside>
        <div
          ref={scrimRef}
          className={`finderscrim${navOpen ? ' show' : ''}`}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <div className="findercontent">{children}</div>
      </div>
    </div>
  );
}
