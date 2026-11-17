'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { registerPushWorker } from '@/lib/pushClient';

// App-shell watcher: registers the push service worker once, and
// polls a lightweight endpoint for the newest inbound message so a
// toast can announce mail that arrives WHILE the app is open.
//
// The first successful poll only establishes the baseline —
// pre-existing unread mail never toasts. Only an arrival newer
// than the session's baseline shows the toast, and only outside
// the interview and the inbox page itself (no noise where the
// user is already looking). The toast names the sender only.

const POLL_MS = 30_000;
const TOAST_MS = 6_000;

interface LatestMail {
  id: string;
  receivedAt: string;
  fromName: string;
  fromEmail: string;
}

export default function MailWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [toast, setToast] = useState<LatestMail | null>(null);
  const baselineRef = useRef<string | null | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const showToast = useCallback((mail: LatestMail) => {
    const path = pathnameRef.current || '';
    if (path.startsWith('/interview') || path === '/dashboard/inbox') return;
    setToast(mail);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    let data: { latest?: LatestMail | null };
    try {
      const res = await fetch('/api/inbox/unread', { cache: 'no-store' });
      if (!res.ok) return;
      data = (await res.json().catch(() => ({}))) as typeof data;
    } catch {
      return;
    }
    const latest = data.latest || null;
    if (baselineRef.current === undefined) {
      // Baseline only — never toast mail that predates the session.
      baselineRef.current = latest ? latest.id : null;
      return;
    }
    if (latest && latest.id !== baselineRef.current) {
      baselineRef.current = latest.id;
      showToast(latest);
    }
  }, [showToast]);

  useEffect(() => {
    void registerPushWorker();
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  if (!toast) return null;
  const sender = (toast.fromName || toast.fromEmail || '').trim();
  return (
    <div
      className="mailtoast"
      role="button"
      tabIndex={0}
      aria-label={sender ? `New court mail from ${sender}. Open Court mail.` : 'New court mail. Open Court mail.'}
      onClick={() => {
        setToast(null);
        router.push('/dashboard/inbox');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setToast(null);
          router.push('/dashboard/inbox');
        }
      }}
    >
      <span className="mailtoast-dot" aria-hidden="true" />
      <span className="mailtoast-text">
        <strong>New court mail</strong>
        {sender ? <span> from {sender}</span> : null}
      </span>
      <button
        type="button"
        className="mailtoast-close"
        aria-label="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          setToast(null);
        }}
      >
        ×
      </button>
    </div>
  );
}
