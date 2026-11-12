// Simple line illustrations for the whole app — one consistent
// stroke weight, rounded caps, currentColor so each surface's
// theme color (gold on dark) carries through. No emoji, no
// clipart: these are drawn for this app as inline SVG.
import type { ReactNode } from 'react';

export type IconName =
  | 'scales' | 'house' | 'book' | 'chat' | 'folder' | 'person'
  | 'target' | 'mic' | 'stop' | 'phone' | 'pin' | 'speaker'
  | 'install' | 'courthouse' | 'filePlus' | 'people' | 'shield'
  | 'shieldCheck' | 'key' | 'gavel' | 'scroll' | 'wallet' | 'car'
  | 'arrowUpCircle' | 'flag' | 'files' | 'calendar' | 'search'
  | 'list' | 'headphones' | 'doc' | 'check' | 'close' | 'mail'
  | 'help' | 'dots' | 'download' | 'printer' | 'share' | 'trash'
  | 'pencil' | 'info' | 'backspace';

const P: Record<IconName, ReactNode> = {
  backspace: (
    <>
      <path d="M8.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11L3 12Z" />
      <path d="M11.5 9.5l5 5M16.5 9.5l-5 5" />
    </>
  ),
  scales: (
    <>
      <circle cx="12" cy="3.6" r="1" />
      <path d="M12 4.6v12.4M8 20.5h8M12 17v3.5" />
      <path d="M4.5 6.5h15" />
      <path d="M4.5 6.5L2 12M4.5 6.5L7 12M2 12h5a2.5 2.5 0 0 1-5 0Z" />
      <path d="M19.5 6.5L17 12M19.5 6.5L22 12M17 12h5a2.5 2.5 0 0 1-5 0Z" />
    </>
  ),
  house: (
    <>
      <path d="M4 11.2L12 4l8 7.2" />
      <path d="M6 9.3V20h12V9.3" />
      <path d="M10 20v-4.8h4V20" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.2C10.4 5 8.4 4.3 5.5 4.3v13c2.9 0 4.9.7 6.5 1.9 1.6-1.2 3.6-1.9 6.5-1.9v-13c-2.9 0-4.9.7-6.5 1.9Z" />
      <path d="M12 6.2v13" />
    </>
  ),
  chat: (
    <>
      <rect x="3.5" y="4" width="17" height="12" rx="2" />
      <path d="M8.5 16L7 20.2 12.6 16" />
      <path d="M7.5 8.5h9M7.5 11.8h5.5" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6.5A1.8 1.8 0 0 1 4.8 4.7h4.4l2 2.3h8A1.8 1.8 0 0 1 21 8.8V18a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18Z" />
      <path d="M3 10h18" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7.8" r="3.4" />
      <path d="M4.8 20c1.4-3.6 4-5.3 7.2-5.3s5.8 1.7 7.2 5.3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.8" width="6" height="11" rx="3" />
      <path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0" />
      <path d="M12 17.6V21M8.6 21h6.8" />
    </>
  ),
  stop: <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="1.6" />,
  phone: (
    <path d="M5.2 3.8h3.6l1.4 4.2-2.3 1.7a13.5 13.5 0 0 0 6.4 6.4l1.7-2.3 4.2 1.4v3.6a1.9 1.9 0 0 1-2 1.9C9.9 20.2 3.8 14.1 3.3 5.8a1.9 1.9 0 0 1 1.9-2Z" />
  ),
  pin: (
    <>
      <path d="M12 21.2S5.6 15.4 5.6 10.4a6.4 6.4 0 0 1 12.8 0c0 5-6.4 10.8-6.4 10.8Z" />
      <circle cx="12" cy="10.4" r="2.3" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.8v4.4h3.2L12 18.4V5.6L7.2 9.8H4Z" />
      <path d="M15.6 9.6a3.8 3.8 0 0 1 0 4.8M18.2 7a7.6 7.6 0 0 1 0 10" />
    </>
  ),
  install: (
    <>
      <rect x="7.5" y="2.8" width="9" height="18.4" rx="2" />
      <path d="M12 7v5.4M9.8 10.4L12 12.6l2.2-2.2M9.6 16.8h4.8" />
    </>
  ),
  courthouse: (
    <>
      <path d="M4 8.2L12 3.8l8 4.4" />
      <path d="M3.6 8.2h16.8" />
      <path d="M6.2 8.2v8M10 8.2v8M14 8.2v8M17.8 8.2v8" />
      <path d="M3.6 19.6h16.8M5 16.2h14" />
    </>
  ),
  filePlus: (
    <>
      <path d="M6 2.8h7.5L18.5 7.5V21H6Z" />
      <path d="M13.5 2.8v4.7h5" />
      <path d="M12.2 11.4v5.4M9.5 14.1h5.4" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.3" r="3.1" />
      <path d="M3.2 19.6c1-3.3 3.1-5 5.8-5 2 0 3.7.9 4.9 2.7" />
      <circle cx="17.2" cy="9.4" r="2.5" />
      <path d="M15.9 14.8c2.2.3 3.9 1.8 4.7 4.2" />
    </>
  ),
  shield: (
    <path d="M12 3l7 2.4v5.7c0 4.6-2.9 7.9-7 9.4-4.1-1.5-7-4.8-7-9.4V5.4Z" />
  ),
  shieldCheck: (
    <>
      <path d="M12 3l7 2.4v5.7c0 4.6-2.9 7.9-7 9.4-4.1-1.5-7-4.8-7-9.4V5.4Z" />
      <path d="M8.8 11.6l2.3 2.3 4.2-4.4" />
    </>
  ),
  key: (
    <>
      <circle cx="8.3" cy="15.7" r="4.6" />
      <path d="M11.6 12.4L20.2 3.8M17 7l3 3M14.4 9.6l2.6 2.6" />
    </>
  ),
  gavel: (
    <>
      <rect x="10.6" y="2.4" width="8.4" height="4.6" rx="1.1" transform="rotate(45 14.8 4.7)" />
      <path d="M12.4 12.4L19.6 19.6" />
      <path d="M3.4 20.6h7.2" />
    </>
  ),
  scroll: (
    <>
      <path d="M8.5 3.5H19a.8.8 0 0 1 .8.8V20" />
      <path d="M8.5 3.5A2.3 2.3 0 0 0 6.2 5.8V18a2.3 2.3 0 1 0 2.3 2.3" />
      <path d="M11 8h5.5M11 12h5.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5.8" width="18" height="13" rx="2" />
      <path d="M3 9.6h18" />
      <circle cx="16.6" cy="14.4" r="1.2" />
    </>
  ),
  car: (
    <>
      <path d="M4.6 15.4L6.2 9.7A2 2 0 0 1 8.1 8.3h7.8a2 2 0 0 1 1.9 1.4l1.6 5.7" />
      <path d="M3.4 15.4h17.2" />
      <circle cx="7.4" cy="17.6" r="1.9" />
      <circle cx="16.6" cy="17.6" r="1.9" />
      <path d="M3.4 17.6h2.1M9.3 17.6h5.4M18.5 17.6h2.1" />
    </>
  ),
  arrowUpCircle: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 16V8.4M8.4 11.6L12 8l3.6 3.6" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21.2V3.6" />
      <path d="M6 4.6h10.8L14.4 8l2.4 3.4H6" />
    </>
  ),
  files: (
    <>
      <path d="M9 7.5V4.8A1.6 1.6 0 0 1 10.6 3.2h6.8A1.6 1.6 0 0 1 19 4.8V15" />
      <path d="M5 9.8A1.6 1.6 0 0 1 6.6 8.2h8.8A1.6 1.6 0 0 1 17 9.8v9.4a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 19.2Z" />
      <path d="M8.2 12.6h5.6M8.2 16h5.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.8" y="5.6" width="16.4" height="14.6" rx="2" />
      <path d="M3.8 10h16.4M8 3.4v4M16 3.4v4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M15.8 15.8L20.6 20.6" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.2h11M9 12h11M9 17.8h11" />
      <circle cx="4.6" cy="6.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="17.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15.2v-2A8 8 0 0 1 20 13.2v2" />
      <rect x="3.4" y="13" width="4" height="6.4" rx="1.4" />
      <rect x="16.6" y="13" width="4" height="6.4" rx="1.4" />
    </>
  ),
  doc: (
    <>
      <path d="M6 2.8h7.5L18.5 7.5V21H6Z" />
      <path d="M13.5 2.8v4.7h5" />
      <path d="M9.2 12.4h5.6M9.2 15.8h5.6" />
    </>
  ),
  check: <path d="M4.8 12.6l4.6 4.6L19.2 7.4" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  mail: (
    <>
      <rect x="3" y="5.4" width="18" height="13.2" rx="1.8" />
      <path d="M4 7.2l8 6.2 8-6.2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6" />
      <path d="M12 16.5v.4" />
    </>
  ),
  dots: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.6} />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 11.5L12 16l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <path d="M7 17H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
      <rect x="7" y="14" width="10" height="6" rx="1" />
    </>
  ),
  share: (
    <>
      <path d="M12 14.5V4" />
      <path d="M8 7.5L12 3.5l4 4" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M10 4h4" />
      <path d="M8.5 7l.6 12.1a1.5 1.5 0 0 0 1.5 1.4h2.8a1.5 1.5 0 0 0 1.5-1.4L15.5 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 11v5" />
      <path d="M12 7.8v.4" />
    </>
  ),
};

/** One simple line illustration. Inherits the surrounding text
 *  color; sized to the slot the old emoji occupied. */
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', verticalAlign: '-0.18em' }}
    >
      {P[name]}
    </svg>
  );
}

/** The mark each library category carries — distinct where a
 *  natural one exists, the courthouse/files as the shared motif
 *  for the rest. */
export const CATEGORY_ICONS: Record<string, IconName> = {
  'General Civil': 'courthouse',
  'Initiating & Small Claims': 'filePlus',
  'Family': 'people',
  'Criminal & Post-Conviction': 'shield',
  'Landlord–Tenant': 'key',
  'Post-Judgment & Enforcement': 'gavel',
  'Probate, Guardianship & Estates': 'scroll',
  'Debt, Consumer & Foreclosure': 'wallet',
  'Traffic & Municipal': 'car',
  'Appeals': 'arrowUpCircle',
  'Protection Orders': 'shieldCheck',
  'Administrative Review': 'flag',
  'Forms & Companions': 'files',
};
