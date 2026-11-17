'use client';

import { useEffect, useState } from 'react';
import {
  disableEmailPush,
  enableEmailPush,
  getBrowserSubscription,
  pushSupported,
  syncSubscriptionToServer,
} from '@/lib/pushClient';

type ToggleState =
  | 'checking'
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'off'
  | 'on';

// Opt-in push notifications for new court mail, per device. Defaults
// OFF: nothing prompts on first load and nothing nags. The switch
// reflects THIS browser's subscription — turning it on here does
// not affect other devices, and each device opts in on its own.
export default function EmailPushToggle() {
  const [state, setState] = useState<ToggleState>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setState('unsupported');
        return;
      }
      // A subscription this browser already holds means ON — and
      // re-posting it heals the server row if pruning removed it.
      const existing = await getBrowserSubscription();
      if (cancelled) return;
      if (existing) {
        void syncSubscriptionToServer(existing);
        setState('on');
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      // No subscription yet: can this device subscribe at all?
      // The public-key endpoint answers whether the server is set up.
      try {
        const res = await fetch('/api/push/public-key');
        const data = (await res.json().catch(() => ({}))) as { configured?: boolean };
        if (!cancelled) setState(data.configured ? 'off' : 'unconfigured');
      } catch {
        if (!cancelled) setState('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (busy || state === 'checking') return;
    setError(null);
    setBusy(true);
    try {
      if (state === 'on') {
        await disableEmailPush();
        setState('off');
      } else {
        const result = await enableEmailPush();
        if (result === 'subscribed') setState('on');
        else if (result === 'denied') setState('denied');
        else if (result === 'unsupported') setState('unsupported');
        else if (result === 'unconfigured') setState('unconfigured');
        else setError('Notifications could not be turned on. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const switchable = state === 'on' || state === 'off';
  return (
    <div className="acctcard">
      <h3>Email notifications</h3>
      <p className="fineprint">
        Get a notification on this device when new court mail arrives — even when the app is
        closed. Notifications name only who sent it, never what it says.
      </p>
      <div className="pushrow">
        <button
          type="button"
          role="switch"
          aria-checked={state === 'on'}
          aria-label="Email notifications"
          className={`pushswitch${state === 'on' ? ' on' : ''}`}
          disabled={!switchable || busy}
          onClick={toggle}
        >
          <span className="pushknob" />
        </button>
        <span className="pushstate">
          {state === 'checking' && 'Checking…'}
          {state === 'on' && 'On — this device will be notified.'}
          {state === 'off' && 'Off'}
          {state === 'denied' && 'Blocked'}
          {state === 'unsupported' && 'Not supported'}
          {state === 'unconfigured' && 'Not set up yet'}
        </span>
      </div>
      {state === 'denied' && (
        <p className="fineprint">
          Notifications are blocked for this site in your browser settings. Re-enable them
          there, then turn this on here.
        </p>
      )}
      {state === 'unsupported' && (
        <p className="fineprint">
          This browser doesn&apos;t support push notifications. New mail still appears in
          Court mail when you open the app.
        </p>
      )}
      {state === 'unconfigured' && (
        <p className="fineprint">
          Notifications aren&apos;t set up on the server yet. This will light up once they are
          — nothing for you to do.
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
