'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

/** A one-time, dismissible "install this app" line — Account page
 *  only, nowhere else, and never again after dismissal. Uses the
 *  browser's own install prompt where the platform offers one
 *  (beforeinstallprompt); on iOS, where no prompt exists, it gives
 *  the Share-sheet instruction instead. Renders nothing when the
 *  app is already running installed (standalone display mode). */
export default function InstallHint() {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden');
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((navigator as any).standalone) return; // iOS home-screen launch
    try {
      if (localStorage.getItem('legal-install-dismissed')) return;
    } catch { /* private mode: still fine to show once per visit */ }
    const ua = navigator.userAgent || '';
    if (/iphone|ipad|ipod/i.test(ua)) {
      setMode('ios');
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (mode === 'hidden') return null;

  const dismiss = () => {
    try {
      localStorage.setItem('legal-install-dismissed', '1');
    } catch { /* ignore */ }
    setMode('hidden');
  };

  return (
    <div className="acctcard installhint">
      {mode === 'prompt' ? (
        <p>
          <Icon name="install" size={17} /> <strong>Install this app</strong> — put legal.eyeknow.app on your home screen and it
          opens like any other app.{' '}
          <button
            type="button"
            className="btn small primary"
            onClick={async () => {
              if (!deferred) return;
              await deferred.prompt();
              dismiss();
            }}
          >
            Install
          </button>{' '}
          <button type="button" className="btn small ghost" onClick={dismiss}>
            Not now
          </button>
        </p>
      ) : (
        <p>
          <Icon name="install" size={17} /> <strong>Install this app</strong> — tap the Share button in your browser, then
          “Add to Home Screen”, and it opens like any other app.{' '}
          <button type="button" className="btn small ghost" onClick={dismiss}>
            Got it
          </button>
        </p>
      )}
    </div>
  );
}
