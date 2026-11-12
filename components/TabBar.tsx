'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';

/** Native-app bottom tab bar: Home, Library, the interview
 *  (center, raised and gold — it is the point of the app), My
 *  Cases, Account. Hidden during the interview itself, where the
 *  step screens own the whole display. */
const TABS: { href: string; label: string; icon: IconName; center?: boolean; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Home', icon: 'house', match: (p: string) => p === '/' },
  { href: '/library', label: 'Library', icon: 'book', match: (p: string) => p.startsWith('/library') },
  { href: '/interview', label: 'Interview', icon: 'chat', center: true, match: (p: string) => p.startsWith('/interview') },
  { href: '/dashboard', label: 'My Cases', icon: 'folder', match: (p: string) => p.startsWith('/dashboard') },
  { href: '/account', label: 'Account', icon: 'person', match: (p: string) => p.startsWith('/account') },
];

export default function TabBar() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/interview')) return null;
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`tab${t.center ? ' center' : ''}${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tabicon" aria-hidden="true"><Icon name={t.icon} size={t.center ? 25 : 22} /></span>
            <span className="tablabel">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
