'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProfileInfo } from '@/lib/profile';

export interface DashUser extends ProfileInfo {
  id: string;
  email: string;
}

type Mode = 'loading' | 'off' | 'out' | 'in';

/** Probes /api/me once. */
export function useMe(): { mode: Mode; user: DashUser | null } {
  const [mode, setMode] = useState<Mode>('loading');
  const [user, setUser] = useState<DashUser | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/me')
      .then(async (res) => {
        if (!live) return;
        if (res.status === 503) {
          setMode('off');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data.user) {
          setUser(data.user);
          setMode('in');
        } else {
          setMode('out');
        }
      })
      .catch(() => {
        if (live) setMode('off');
      });
    return () => {
      live = false;
    };
  }, []);
  return { mode, user };
}

/** The dashboard's account gate, matching /account's behavior:
 *  unconfigured → the "being set up" card; signed out → a sign-in
 *  prompt; signed in → the children render with the user. */
export default function DashGate({
  children,
}: {
  children: (user: DashUser) => React.ReactNode;
}) {
  const { mode, user } = useMe();
  if (mode === 'loading') return <p className="fineprint">Loading…</p>;
  if (mode === 'off') {
    return (
      <div className="acctcard">
        <h3>Accounts are being set up</h3>
        <p>
          The dashboard needs accounts, and accounts are not available just yet. Nothing is
          lost — the interview works without one, and the charge library, warrant directory,
          and hearing practice below are open to everyone.
        </p>
        <div className="choices">
          <Link className="btn primary" href="/interview">Start the free interview</Link>
          <Link className="btn" href="/dashboard/practice">Practice a hearing</Link>
        </div>
      </div>
    );
  }
  if (mode === 'out' || !user) {
    return (
      <div className="acctcard">
        <h3>Sign in to see your dashboard</h3>
        <p>
          Your cases, deadlines, documents, and court communications live behind your account,
          so only you can see them.
        </p>
        <Link className="btn primary" href="/account">Sign in / Create account</Link>
      </div>
    );
  }
  return <>{children(user)}</>;
}
