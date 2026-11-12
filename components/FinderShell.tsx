'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';

/** The dashboard as a Mac-Finder-style window: a slim chrome bar
 *  with traffic lights and the current view's name, a translucent
 *  sidebar of folders (favorites, then tools), and the selected
 *  view's content beside it. On phones the sidebar folds away and
 *  opens as an overlay from the toggle in the chrome bar. */
interface SideItem {
  href: string;
  icon: IconName;
  label: string;
  match: (p: string) => boolean;
}

const FAVORITES: SideItem[] = [
  {
    href: '/dashboard', icon: 'folder', label: 'Cases',
    match: (p) => p === '/dashboard' || p.startsWith('/dashboard/cases'),
  },
  {
    href: '/dashboard/inbox', icon: 'mail', label: 'Inbox',
    match: (p) => p.startsWith('/dashboard/inbox'),
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
  ['/account', 'Account'],
];

export default function FinderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/dashboard';
  const [navOpen, setNavOpen] = useState(false);

  const title = TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'Cases';

  const nav = (items: SideItem[], section: string) => (
    <>
      <p className="sidesection">{section}</p>
      {items.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`sideitem${active ? ' active' : ''}`}
            onClick={() => setNavOpen(false)}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
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
          aria-label={navOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <Icon name="list" size={16} />
        </button>
      </div>
      <div className="finderbody">
        <aside className={`finderside${navOpen ? ' open' : ''}`} aria-label="Views">
          {nav(FAVORITES, 'Favorites')}
          {nav(TOOLS, 'Tools')}
          <p className="sidefoot">Saved to your account, visible only to you.</p>
        </aside>
        {navOpen && <div className="finderscrim" onClick={() => setNavOpen(false)} />}
        <div className="findercontent">{children}</div>
      </div>
    </div>
  );
}
