import type { MetadataRoute } from 'next';

// Installable PWA manifest: standalone launch, dark chrome to
// match the app field, gold-on-dark icons in public/icons/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'quikForm — Court motions, prepared from your answers',
    short_name: 'quikForm',
    description:
      'Answer plain-English questions and get a filing-ready court motion PDF for $3. Document preparation, not a law firm.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0E14',
    theme_color: '#0B0E14',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
