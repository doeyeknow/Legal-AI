'use client';

import { useEffect } from 'react';

/**
 * Site-wide presentation effects, mounted once in the root layout:
 *  - the simple animated background (slow drifting soft shapes,
 *    rendered behind everything),
 *  - the material-style ripple on buttons/badges (delegated
 *    pointerdown listener; purely decorative, never intercepts),
 *  - scroll parallax for elements carrying data-px="0.05" etc.
 *    (transform-only, rAF-throttled, clamped).
 * Everything is enhancement-only: with prefers-reduced-motion the
 * listener/handler are never installed and CSS freezes the
 * background; with no JS, content is simply all there.
 */
export default function Fx() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    // --- Ripple -------------------------------------------------
    const onDown = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest?.(
        '.btn, .badge, .pickitem, [data-ripple]',
      ) as HTMLElement | null;
      if (!t || t.hasAttribute('disabled')) return;
      const r = t.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'ripple-ink';
      s.style.width = `${d}px`;
      s.style.height = `${d}px`;
      s.style.left = `${e.clientX - r.left - d / 2}px`;
      s.style.top = `${e.clientY - r.top - d / 2}px`;
      t.appendChild(s);
      window.setTimeout(() => s.remove(), 700);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });

    // --- Parallax ----------------------------------------------
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const els = document.querySelectorAll<HTMLElement>('[data-px]');
      els.forEach((el) => {
        const speed = parseFloat(el.dataset.px || '0');
        if (!speed) return;
        const r = el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        const off = (r.top + r.height / 2 - vh / 2) * -speed;
        const clamped = Math.max(-44, Math.min(44, off));
        el.style.transform = `translate3d(0, ${clamped.toFixed(1)}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // In the app shell the window never scrolls — content regions
    // do. Scroll events do not bubble, but a capture-phase listener
    // on the document still hears every region's scroll.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    update();

    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="bgfx" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
    </div>
  );
}
