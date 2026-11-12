import type { Metadata, Viewport } from 'next';
import './globals.css';
import AccountNav from '@/components/AccountNav';
import { Icon } from '@/components/icons';
import Fx from '@/components/Fx';
import TabBar from '@/components/TabBar';

export const metadata: Metadata = {
  title: 'quikForm.org — Court motions, AI Legal, Court Helper',
  description:
    'Answer plain-English questions and get a filing-ready court motion PDF for $3. Continuances, custody and support changes, contempt, fee waivers, eviction stays, and hundreds more court documents. Document preparation, not a law firm.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'quikForm',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};


};

export const viewport: Viewport = {
  themeColor: '#0B0E14',
  width: 'device-width',
  initialScale: 0.7,
  viewportFit: 'cover',
};

// App shell: a fixed 100dvh column — slim top bar, one content
// region (each route manages its own overflow inside it; the body
// itself never scrolls), and the bottom tab bar. The interview
// hides the tab bar and locks its region completely.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
       <body>
        <Fx />
        <header className="sitehead">
          <a className="brand" href="/"><Icon name="scales" size={20} /> quik<span>Form</span></a>
          <nav>
            <AccountNav />
          </nav>
        </header>
        <main>{children}</main>
        <TabBar />
      </body>
    </html>
  );
}

