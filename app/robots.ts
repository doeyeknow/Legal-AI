import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Public pages are crawlable; the signed-in dashboard, the account
// page, and every API route are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/account', '/defenses'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
