'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from './Modal';
import InboxAddressCard from './InboxAddress';
import { EMPTY_PROFILE, PROFILE_FIELDS, type ProfileInfo } from '@/lib/profile';

interface MeUser extends ProfileInfo {
  id: string;
  email: string;
}

type Mode = 'loading' | 'off' | 'out' | 'in';

function profileOf(u: MeUser): ProfileInfo {
  return {
    fullName: u.fullName || '',
    street: u.street || '',
    city: u.city || '',
    state: u.state || '',
    zip: u.zip || '',
    phone: u.phone || '',
  };
}

function ProfileInputs({
  value,
  onChange,
  idPrefix,
}: {
  value: ProfileInfo;
  onChange: (p: ProfileInfo) => void;
  idPrefix: string;
}) {
  return (
    <div className="formgrid">
      {PROFILE_FIELDS.map((f) => (
        <div className={`field${f.full ? ' full' : ''}`} key={f.key}>
          <label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</label>
          <input
            id={`${idPrefix}-${f.key}`}
            value={value[f.key]}
            autoComplete={f.autoComplete}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

export default function AccountPanel() {
  const [mode, setMode] = useState<Mode>('loading');
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [user, setUser] = useState<MeUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState<ProfileInfo>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/me');
      if (res.status === 503) {
        setMode('off');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.user) {
        setUser(data.user);
        setForm(profileOf(data.user));
        setMode('in');
      } else {
        setMode('out');
      }
    } catch {
      setMode('off');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAuth(path: string, includeProfile: boolean) {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          includeProfile ? { email, password, ...form } : { email, password },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        setError(data.error || data.message || 'Something went wrong. Please try again.');
        return;
      }
      setUser(data.user);
      setForm(profileOf(data.user));
      setPassword('');
      setMode('in');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        setError(data.error || data.message || 'Your profile could not be saved.');
        return;
      }
      setUser(data.user);
      setForm(profileOf(data.user));
      setNote('Saved — this information will prefill your forms.');
      setEditing(false);
    } catch {
      setError('Your profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* the panel resets either way */
    }
    setUser(null);
    setForm(EMPTY_PROFILE);
    setPassword('');
    setNote(null);
    setError(null);
    setMode('out');
  }

  if (mode === 'loading') return <p className="fineprint">Loading…</p>;

  if (mode === 'off') {
    return (
      <div className="acctcard">
        <h3>Accounts are being set up</h3>
        <p>
          Accounts are not available just yet. Nothing is lost — the interview works without one:
          you describe your situation, answer the questions, and your document is prepared from
          the answers you give.
        </p>
        <Link className="btn primary" href="/interview">
          Start the free interview
        </Link>
      </div>
    );
  }

  if (mode === 'in' && user) {
    return (
      <>
      <div className="acctcard">
        <h3>Signed in as {user.email}</h3>
        <p className="fineprint">
          This is the information used to fill out your forms. Keep it current and every new
          document starts with it already filled in.
        </p>
        <div className="formgrid">
          {PROFILE_FIELDS.map((f) => (
            <div className={`field${f.full ? ' full' : ''}`} key={f.key}>
              <label>{f.label}</label>
              <p>{user[f.key] || '—'}</p>
            </div>
          ))}
        </div>
        {note && <p className="fineprint">{note}</p>}
        <div className="choices">
          <button className="btn primary" disabled={busy} onClick={() => { setError(null); setEditing(true); }}>
            Edit information
          </button>
          <Link className="btn" href="/interview">
            Start an interview
          </Link>
          <button className="btn ghost" disabled={busy} onClick={signOut}>
            Sign out
          </button>
        </div>
        {editing && (
          <Modal title="Edit your information" onClose={() => setEditing(false)}>
            <ProfileInputs value={form} onChange={setForm} idPrefix="profile" />
            {error && <p className="error">{error}</p>}
            <div className="choices">
              <button className="btn primary" disabled={busy} onClick={saveProfile}>
                Save profile
              </button>
              <button className="btn ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </Modal>
        )}
      </div>
      <InboxAddressCard />
      </>
    );
  }

  return (
    <div className="acctcard">
      <div className="accttabs">
        <button
          className={`btn ${tab === 'in' ? 'primary' : 'ghost'}`}
          onClick={() => {
            setTab('in');
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          className={`btn ${tab === 'up' ? 'primary' : 'ghost'}`}
          onClick={() => {
            setTab('up');
            setError(null);
          }}
        >
          Create account
        </button>
      </div>

      <div className="formgrid">
        <div className="field full">
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field full">
          <label htmlFor="auth-password">Password{tab === 'up' ? ' (at least 8 characters)' : ''}</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            autoComplete={tab === 'up' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitAuth(tab === 'up' ? '/api/auth/register' : '/api/auth/login', tab === 'up');
              }
            }}
          />
        </div>
      </div>

      {tab === 'up' && (
        <>
          <p className="fineprint">
            Your basic information — optional now, and you can add or change it any time. It is
            what fills out the caption and signature block of your documents.
          </p>
          <ProfileInputs value={form} onChange={setForm} idPrefix="signup" />
        </>
      )}

      {error && <p className="error">{error}</p>}
      <button
        className="btn primary big"
        disabled={busy || !email || !password}
        onClick={() =>
          submitAuth(tab === 'up' ? '/api/auth/register' : '/api/auth/login', tab === 'up')
        }
      >
        {tab === 'up' ? 'Create my account' : 'Sign in'}
      </button>
    </div>
  );
}
