import type { Metadata, Viewport } from 'next';
import './globals.css';
import AccountNav from '@/components/AccountNav';
import { Icon } from '@/components/icons';
import Fx from '@/components/Fx';
import TabBar from '@/components/TabBar';
import MailWatcher from '@/components/MailWatcher';
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}.org — Court motions, AI Legal, Court Helper`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  category: 'legal',
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: '/' },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    locale: 'en_US',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
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

export const viewport: Viewport = {
  themeColor: '#0B0E14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <MailWatcher />
      </body>
    </html>
  );
}

