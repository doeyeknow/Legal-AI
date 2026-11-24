import { ImageResponse } from 'next/og';

// Social share card (Open Graph / Twitter) for every page that
// doesn't set its own: dark field, gold scales, the promise.
export const runtime = 'edge';
export const alt = 'quikForm — court motion PDFs with filing instructions for $5';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '72px 84px',
          background: 'linear-gradient(150deg, #0B0E14 0%, #161A24 60%, #2C2716 100%)',
          color: '#ECECF1', fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 700 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#D9A62E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 006 0L5 7zM19 7l-3 6a3 3 0 006 0l-3-6z" />
          </svg>
          <span>quik</span><span style={{ color: '#D9A62E', marginLeft: -18 }}>Form</span>
        </div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.12, marginTop: 34, maxWidth: 980 }}>
          Your court motion, prepared from your answers.
        </div>
        <div style={{ fontSize: 32, color: '#A7ABB5', marginTop: 26 }}>
          Free interview · $5 PDF with filing instructions · Membership plans
        </div>
        <div style={{ fontSize: 22, color: '#848B99', marginTop: 'auto' }}>
          Document preparation for people representing themselves — not a law firm.
        </div>
      </div>
    ),
    size,
  );
}
