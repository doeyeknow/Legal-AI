'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

export interface BasicDraft {
  id: string;
  title: string;
  motionName: string;
  updatedAt: string;
}

export interface BasicDocument {
  id: string;
  caseId: string;
  caseTitle: string;
  motionId: string;
  motionName: string;
  feeWaiver: boolean;
  label: string | null;
  createdAt: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The basic dashboard: drafts to resume and edit, and paid
 *  documents to re-download. No membership needed — everything
 *  here is the signed-in user's own work. */
export default function BasicDash({
  drafts: initialDrafts,
  documents,
  isMember,
}: {
  drafts: BasicDraft[];
  documents: BasicDocument[];
  isMember: boolean;
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');

  async function deleteDraft(id: string) {
    // Two-step delete in place — no window.confirm, which some
    // mobile browsers swallow silently so the tap does nothing.
    if (armedId !== id) {
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      setArmedId(id);
      armTimerRef.current = setTimeout(() => setArmedId(null), 6000);
      return;
    }
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    setArmedId(null);
    setDeleting(id);
    setError('');
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setDrafts((list) => list.filter((d) => d.id !== id));
    } catch {
      setError('That draft could not be deleted. Try again shortly.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}

      <h2>Drafts</h2>
      {drafts.length === 0 ? (
        <p className="fineprint">
          No drafts yet. Start the free interview and your answers save here as you go.
        </p>
      ) : (
        drafts.map((d) => (
          <div className="acctcard" key={d.id}>
            <h3>{d.title || d.motionName}</h3>
            <p className="fineprint">{d.motionName}{fmtDate(d.updatedAt) ? ` · Last edited ${fmtDate(d.updatedAt)}` : ''}</p>
            <div className="choices">
              <Link className="btn primary" href={`/interview?draft=${encodeURIComponent(d.id)}`}>Continue &amp; edit</Link>
              <button className="btn" disabled={deleting === d.id} onClick={() => void deleteDraft(d.id)}>
                {deleting === d.id ? 'Deleting…' : armedId === d.id ? 'Tap again to delete' : 'Delete draft'}
              </button>
            </div>
          </div>
        ))
      )}

      <h2>Documents you paid for</h2>
      {documents.length === 0 ? (
        <p className="fineprint">
          No documents yet. When you pay for a motion, the finished PDF appears here and
          you can download it again any time.
        </p>
      ) : (
        <>
          <p className="fineprint">
            Re-downloads are regenerated from your saved answers. The drawn signature is
            never stored, so a re-downloaded copy has a blank signature line to sign on paper.
          </p>
          {documents.map((doc) => (
            <div className="acctcard" key={doc.id}>
              <h3>{doc.label || doc.motionName}</h3>
              <p className="fineprint">
                {doc.caseTitle}{fmtDate(doc.createdAt) ? ` · ${fmtDate(doc.createdAt)}` : ''}
                {doc.feeWaiver ? ' · Fee waiver included' : ''}
              </p>
              <div className="choices">
                <a className="btn primary" href={`/api/cases/${encodeURIComponent(doc.caseId)}/documents/${encodeURIComponent(doc.id)}/pdf`}>Download PDF</a>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="choices">
        <Link className="btn primary" href="/interview">Start a new motion</Link>
        {isMember ? (
          <Link className="btn" href="/dashboard">Open full dashboard</Link>
        ) : (
          <Link className="btn" href="/membership">See membership plans</Link>
        )}
      </div>
      {!isMember && (
        <p className="fineprint">
          Membership adds the full dashboard — case management, hearing and call companions,
          and unlimited motion downloads at no extra charge.
        </p>
      )}
    </>
  );
}
