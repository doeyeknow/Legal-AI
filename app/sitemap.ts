import type { MetadataRoute } from 'next';
import { ALL_MOTIONS } from '@/lib/motions/data';
import { SITE_URL } from '@/lib/site';

// Home, the library, the interview, and one landing URL per motion
// template (the interview deep link, which carries its own title).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/library`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/interview`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...ALL_MOTIONS.map((m) => ({
      url: `${SITE_URL}/interview?motion=${encodeURIComponent(m.id)}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
