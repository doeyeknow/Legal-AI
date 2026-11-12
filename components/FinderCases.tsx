'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashGate from './DashGate';
import Modal from './Modal';
import ContextMenu, { type CtxAction } from './ContextMenu';
import ReplyBadge from './ReplyBadge';
import { Icon } from './icons';
import { localToday } from '@/lib/reply-state';
import type { CaseSummary, Deadline } from '@/lib/dashboard-types';
import { deadlineType } from '@/lib/comm-templates';
import { getMotion } from '@/lib/motions/match';
import {
  newestDocumentId, documentPdfUrl, downloadPdf, printPdf, shareDocument,
} from './finderActions';

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

/** A macOS folder glyph — the Finder's case icon. */
function FolderGlyph({ open }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 64 52" className={`macfolder${open ? ' open' : ''}`} aria-hidden="true">
      <path
        d={open
          ? 'M4 12c0-2.2 1.8-4 4-4h16l5 5h27c2.2 0 4 1.8 4 4v6H4z'
          : 'M4 10c0-2.2 1.8-4 4-4h16l5 5h27c2.2 0 4 1.8 4 4v27c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4z'}
        className="folderback"
      />
      <path d="M4 19h56v23c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4z" className="folderfront" />
    </svg>
  );
}

function CaseFolders({ onRenamed }: { onRenamed: () => void }) {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [mailCount, setMailCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [busy, setBusy] = useState(false);
  // Context-menu modals
  const [renaming, setRenaming] = useState<CaseSummary | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [trashing, setTrashing] = useState<CaseSummary | null>(null);
  const [props, setProps] = useState<CaseSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(t);
  }, [notice]);

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

  async function renameCase() {
    if (!renaming || !renameTo.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/cases/${encodeURIComponent(renaming.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTo.trim() }),
      });
      setRenaming(null);
      await load();
      onRenamed();
    } finally {
      setBusy(false);
    }
  }

  async function trashCase() {
    if (!trashing) return;
    const victim = trashing;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${encodeURIComponent(victim.id)}`, { method: 'DELETE' });
      setTrashing(null);
      if (res.ok) {
        setNotice(`“${victim.title}” moved to the trash.`);
        await load();
        onRenamed();
      }
    } finally {
      setBusy(false);
    }
  }

  /** The newest document's PDF — fetched on demand; a case with no
   *  documents yet simply skips the document actions. */
  async function withNewestPdf(c: CaseSummary, use: (url: string) => void) {
    const docId = await newestDocumentId(c.id);
    if (!docId) {
      setNotice('This case has no documents yet.');
      return;
    }
    use(documentPdfUrl(c.id, docId));
  }

  function caseActions(c: CaseSummary): CtxAction[] {
    const acts: CtxAction[] = [
      {
        label: 'Filing Instructions', icon: 'doc',
        onSelect: () => router.push(`/dashboard/cases/${c.id}`),
      },
      {
        label: 'Download', icon: 'download',
        onSelect: () => { void withNewestPdf(c, downloadPdf); },
      },
      {
        label: 'Print', icon: 'printer',
        onSelect: () => { void withNewestPdf(c, (u) => { void printPdf(u); }); },
      },
      {
        label: 'Share', icon: 'share',
        onSelect: () => {
          void withNewestPdf(c, (u) => {
            void shareDocument(c.title, u).then((r) => {
              setNotice(r === 'copied' ? 'Link copied.' : r === 'failed' ? 'Sharing is not available here.' : null);
            });
          });
        },
      },
    ];
    if (c.status === 'Draft') {
      acts.push({
        label: 'Edit Document', icon: 'pencil',
        onSelect: () => router.push(`/interview?draft=${encodeURIComponent(c.id)}`),
      });
    }
    acts.push(
      {
        label: 'Rename', icon: 'pencil',
        onSelect: () => { setRenaming(c); setRenameTo(c.title); },
      },
      {
        label: 'Properties', icon: 'info',
        onSelect: () => setProps(c),
      },
      {
        label: 'Trash', icon: 'trash', danger: true,
        onSelect: () => setTrashing(c),
      },
    );
    return acts;
  }

  if (error) return <p className="error">{error}</p>;
  if (!cases) return <p className="fineprint">Loading your cases…</p>;

  return (
    <div>
      {notice && <p className="finder-notice" role="status">{notice}</p>}

      <section className="dashsection">
        <Link className="mailbanner" href="/dashboard/inbox">
          <span className="mailicon"><Icon name="mail" size={20} /></span>
          <span className="mailtexts">
            <strong>Court mail</strong>
            <span>
              Mail from the court, read for the dates and facts your cases need — nothing is
              added to a case until you confirm it.
            </span>
          </span>
          {mailCount > 0 && <span className="statuspill draft">{mailCount} to review</span>}
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
          <p className="fineprint">
            No cases yet. When you finish an interview while signed in, the document and its
            case appear here automatically. You can also track a case by hand.
          </p>
        )}
        <div className="foldergrid">
          {cases.map((c) => (
            <ContextMenu key={c.id} actions={caseActions(c)} menuLabel={`Menu for ${c.title}`} className="foldertile">
              <Link className="folderlink" href={`/dashboard/cases/${c.id}`}>
                <FolderGlyph open={c.status === 'Draft'} />
                <span className="foldername">{c.title}</span>
                <span className="foldersub">
                  {c.documentCount} document{c.documentCount === 1 ? '' : 's'}
                  {c.status === 'Draft' ? ' · draft' : ''}
                </span>
                {c.nextDeadline && (
                  <span className="foldersub due">
                    {fmtDate(c.nextDeadline.dueAt)}
                  </span>
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
              </Link>
            </ContextMenu>
          ))}
        </div>
        <div className="choices">
          <button className="btn" onClick={() => setShowForm(true)}>+ Track a case by hand</button>
          <Link className="btn primary" href="/interview">Start a new interview</Link>
        </div>
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
        {renaming && (
          <Modal title="Rename case" onClose={() => setRenaming(null)}>
            <div className="field">
              <label htmlFor="rn-title">Case title</label>
              <input id="rn-title" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
            </div>
            <div className="choices">
              <button className="btn primary" disabled={busy || !renameTo.trim()} onClick={renameCase}>
                Rename
              </button>
              <button className="btn ghost" onClick={() => setRenaming(null)}>Cancel</button>
            </div>
          </Modal>
        )}
        {trashing && (
          <Modal title="Move to trash" onClose={() => setTrashing(null)}>
            <p>
              Move “{trashing.title}” to the trash? Its documents, deadlines, and
              communications go with it. This cannot be undone.
            </p>
            <div className="choices">
              <button className="btn" style={{ background: '#b3261e', borderColor: '#b3261e', color: '#fff' }} disabled={busy} onClick={trashCase}>
                <Icon name="trash" size={15} /> Move to trash
              </button>
              <button className="btn ghost" onClick={() => setTrashing(null)}>Cancel</button>
            </div>
          </Modal>
        )}
        {props && (
          <Modal title="Case properties" onClose={() => setProps(null)}>
            <dl className="proprows">
              <dt>Title</dt><dd>{props.title}</dd>
              <dt>Status</dt><dd>{props.status}</dd>
              <dt>Subject</dt>
              <dd>{props.subjectName || '—'} ({props.relation === 'other' ? 'for someone else' : 'for you'})</dd>
              <dt>Court</dt>
              <dd>{[props.courtName, props.county ? `${props.county} County` : '', props.state].filter(Boolean).join(' · ') || 'Court not recorded'}</dd>
              <dt>Case number</dt><dd>{props.caseNumber || '—'}</dd>
              <dt>Documents</dt><dd>{props.documentCount}</dd>
              {props.draftMotionId && (
                <>
                  <dt>Draft</dt>
                  <dd>{getMotion(props.draftMotionId)?.name || 'Interview in progress'}</dd>
                </>
              )}
              {props.nextDeadline && (
                <>
                  <dt>Next deadline</dt>
                  <dd>{props.nextDeadline.label || deadlineType(props.nextDeadline.type)?.label} — {fmtDate(props.nextDeadline.dueAt)}</dd>
                </>
              )}
              <dt>Created</dt><dd>{fmtDateTime(props.createdAt)}</dd>
              <dt>Updated</dt><dd>{fmtDateTime(props.updatedAt)}</dd>
            </dl>
          </Modal>
        )}
      </section>
    </div>
  );
}

export default function FinderCases({ onRenamed }: { onRenamed?: () => void }) {
  return (
    <DashGate>
      {() => <CaseFolders onRenamed={onRenamed ?? (() => {})} />}
    </DashGate>
  );
}
