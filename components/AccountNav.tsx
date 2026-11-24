'use client';

import { useEffect, useState } from 'react';

// Header account link that reflects session state. When accounts
// are not configured yet (/api/me answers 503) it renders nothing,
// so the live site never advertises a feature that is not set up.
export default function AccountNav() {
  const [state, setState] = useState<'loading' | 'off' | 'out' | 'in' | 'member'>('loading');

  useEffect(() => {
    let live = true;
    fetch('/api/me')
      .then(async (res) => {
        if (!live) return;
        if (res.status === 503) {
          setState('off');
          return;
        }
        const data = await res.json().catch(() => ({}));
        setState(data.user ? data.membership ? 'member' : 'in' : 'out');
      })
      .catch(() => {
        if (live) setState('off');
      });
    return () => {
      live = false;
    };
  }, []);

  if (state === 'loading' || state === 'off') return null;
  if (state === 'in' || state === 'member') {
    return (
      <>
        {state === 'member' ? <a href="/dashboard">Dashboard</a> : <a href="/membership">Membership</a>}
        <a href="/account">My account</a>
      </>
    );
  }
  return <a href="/account">Sign in</a>;
}
