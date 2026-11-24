// Site identity for SEO metadata, the sitemap, and structured data.
// Set NEXT_PUBLIC_SITE_URL in production if the site is served from
// a different origin (no trailing slash).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://quikform.org').replace(/\/+$/, '');
export const SITE_NAME = 'quikForm';
export const SITE_TAGLINE = 'Court motions, prepared from your answers';
export const SITE_DESCRIPTION =
  'Answer plain-English questions and get a filing-ready court motion PDF for $3. Continuances, custody and support changes, contempt, fee waivers, eviction stays, and hundreds more court documents for people representing themselves. Document preparation, not a law firm.';
export const SITE_KEYWORDS = [
  'court motion',
  'self-represented litigant',
  'pro se',
  'legal forms',
  'motion for continuance',
  'motion for extension of time',
  'fee waiver',
  'in forma pauperis',
  'eviction',
  'custody modification',
  'child support modification',
  'small claims',
  'court documents',
  'legal document preparation',
];
