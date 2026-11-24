// Site identity for SEO metadata, the sitemap, and structured data.
// Set NEXT_PUBLIC_SITE_URL in production if the site is served from
// a different origin (no trailing slash).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://quikform.org').replace(/\/+$/, '');
export const SITE_NAME = 'quikForm';
export const SITE_TAGLINE = 'Court motions, prepared from your answers';
export const SITE_DESCRIPTION =
  'Prepare a court motion with a free interview. Download the PDF and filing instructions for $5, or join to use the dashboard, all tools, and unlimited motion downloads. Document preparation, not a law firm.';
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
