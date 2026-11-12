'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashGate from './DashGate';
import Modal from './Modal';
import ReplyBadge from './ReplyBadge';
import { Icon } from './icons';
import { localToday } from '@/lib/reply-state';
import type { CaseSummary, Deadline } from '@/lib/dashboard-types';
import { deadlineType } from '@/lib/comm-templates';
import { getMotion } from '@/lib/motions/match';

type Upcoming = Deadline & { caseTitle: string };

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function CaseCards() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [mailCount, setMailCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cases');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Your cases could not be loaded.');
        return;
      }
      setCases(data.cases || []);
      setUpcoming(data.upcoming || []);
    } catch {
      setError('Your cases could not be loaded.');
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/inbox')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMailCount(d.unreviewed || 0); })
      .catch(() => undefined);
  }, [load]);

  async function createCase() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), caseNumber: caseNumber.trim() }),
      });
      if (res.ok) {
        setTitle('');
        setCaseNumber('');
        setShowForm(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!cases) return <p className="fineprint">Loading your cases…</p>;

  return (
    <div>
      <section className="dashsection">
        <Link className="card block" href="/dashboard/inbox">
          <strong>
            <Icon name="mail" size={20} /> Court mail
            {mailCount > 0 && (
              <span className="statuspill draft"> {mailCount} to review</span>
            )}
          </strong>
          <span>
            Mail from the court, read for the dates and facts your cases need — nothing is
            added to a case until you confirm it.
          </span>
        </Link>
      </section>
      {upcoming.length > 0 && (
        <section className="dashsection">
          <h2>Coming up</h2>
          <ul className="deadlinelist">
            {upcoming.map((d) => (
              <li key={d.id} className="deadlineitem">
                <span className="duedate">{fmtDate(d.dueAt)}</span>
                <span>
                  <strong>{d.label || deadlineType(d.type)?.label || d.type}</strong>
                  {' — '}
                  <Link href={`/dashboard/cases/${d.caseId}`}>{d.caseTitle}</Link>
                  {deadlineType(d.type)?.ifMissed && (
                    <span className="fineprint block">If missed: {deadlineType(d.type)?.ifMissed}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dashsection">
        <h2>Your cases</h2>
        {cases.length === 0 && (
          <p>
            No cases yet. When you finish an interview while signed in, the document and its
            case appear here automatically. You can also track a case by hand:
          </p>
        )}
        <div className="grid">
          {cases.map((c) => (
            <Link key={c.id} className="card" href={`/dashboard/cases/${c.id}`}>
              <strong>{c.title}</strong>
              <span>
                {[c.courtName, c.county ? `${c.county} County` : '', c.state]
                  .filter(Boolean)
                  .join(' · ') || 'Court not recorded'}
              </span>
              <span>
                {c.caseNumber ? `Case No. ${c.caseNumber} · ` : ''}
                {c.documentCount} document{c.documentCount === 1 ? '' : 's'}
              </span>
              {c.status === 'Draft' ? (
                <>
                  <span className="statuspill draft">Draft — interview in progress</span>
                  <span className="fineprint">
                    {c.draftMotionId
                      ? `${getMotion(c.draftMotionId)?.name || 'Interview'} · `
                      : ''}
                    Last updated {fmtDateTime(c.updatedAt)}
                  </span>
                </>
              ) : (
                <span className="statuspill">{c.status}</span>
              )}
              {c.awaitingReply && (
                <ReplyBadge
                  overdue={
                    c.awaitingDeadline
                      ? c.awaitingDeadline < localToday()
                      : c.replyOverdue
                  }
                />
              )}
              {c.nextDeadline && (
                <span className="fineprint">
                  Next: {c.nextDeadline.label || deadlineType(c.nextDeadline.type)?.label} —{' '}
                  {fmtDate(c.nextDeadline.dueAt)}
                </span>
              )}
            </Link>
          ))}
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>+ Track a case by hand</button>
        {showForm && (
          <Modal title="Track a case by hand" onClose={() => setShowForm(false)}>
            <div className="formgrid">
              <div className="field full">
                <label htmlFor="nc-title">Case title (for example: “Jane Doe v. John Roe”)</label>
                <input id="nc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field full">
                <label htmlFor="nc-num">Case number (optional — you can add details inside)</label>
                <input id="nc-num" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
              </div>
            </div>
            <div className="choices">
              <button className="btn primary" disabled={busy || !title.trim()} onClick={createCase}>
                Add case
              </button>
              <button className="btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </Modal>
        )}
        <p>
          <Link className="btn primary" href="/interview">Start a new interview</Link>
        </p>
      </section>
    </div>
  );
}

export default function DashboardHome() {
  return (
    <div>
      <h1>Your dashboard</h1>
      <p className="fineprint">
        Cases, deadlines, documents, and court communications — saved to your account, visible
        only to you.
      </p>
      <DashGate>{() => <CaseCards />}</DashGate>
    </div>
  );
}
