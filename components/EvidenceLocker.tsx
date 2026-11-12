'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashGate from './DashGate';
import Modal from './Modal';
import ContextMenu, { type CtxAction } from './ContextMenu';
import { Icon } from './icons';
import {
  documentPdfUrl, downloadPdf, printPdf, shareDocument,
} from './finderActions';

export interface EvidenceDoc {
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
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function LockerBody() {
  const router = useRouter();
  const [docs, setDocs] = useState<EvidenceDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<EvidenceDoc | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [trashing, setTrashing] = useState<EvidenceDoc | null>(null);
  const [props, setProps] = useState<EvidenceDoc | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Your documents could not be loaded.');
        return;
      }
      setDocs(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      setError('Your documents could not be loaded.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  async function renameDoc() {
    if (!renaming || !renameTo.trim()) return;
    setBusy(true);
    try {
      await fetch(
        `/api/cases/${encodeURIComponent(renaming.caseId)}/documents/${encodeURIComponent(renaming.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: renameTo.trim() }),
        },
      );
      setRenaming(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function trashDoc() {
    if (!trashing) return;
    const victim = trashing;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cases/${encodeURIComponent(victim.caseId)}/documents/${encodeURIComponent(victim.id)}`,
        { method: 'DELETE' },
      );
      setTrashing(null);
      if (res.ok) {
        setNotice(`“${victim.label || victim.motionName}” moved to the trash.`);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  function docActions(d: EvidenceDoc): CtxAction[] {
    const url = documentPdfUrl(d.caseId, d.id);
    return [
      {
        label: 'Filing Instructions', icon: 'doc',
        onSelect: () => router.push(`/dashboard/cases/${d.caseId}`),
      },
      { label: 'Download', icon: 'download', onSelect: () => downloadPdf(url) },
      { label: 'Print', icon: 'printer', onSelect: () => { void printPdf(url); } },
      {
        label: 'Share', icon: 'share',
        onSelect: () => {
          void shareDocument(d.label || d.motionName, url).then((r) => {
            setNotice(r === 'copied' ? 'Link copied.' : r === 'failed' ? 'Sharing is not available here.' : null);
          });
        },
      },
      { label: 'Rename', icon: 'pencil', onSelect: () => { setRenaming(d); setRenameTo(d.label || d.motionName); } },
      { label: 'Properties', icon: 'info', onSelect: () => setProps(d) },
      { label: 'Trash', icon: 'trash', danger: true, onSelect: () => setTrashing(d) },
    ];
  }

  if (error) return <p className="error">{error}</p>;
  if (!docs) return <p className="fineprint">Loading your documents…</p>;

  return (
    <div>
      {notice && <p className="finder-notice" role="status">{notice}</p>}
      {docs.length === 0 && (
        <p className="fineprint">
          No documents yet. Documents you prepare in the{' '}
          <Link href="/interview">interview</Link> while signed in are filed here
          automatically — every version stays in its case folder.
        </p>
      )}
      <ul className="evidencelist">
        {docs.map((d) => (
          <li key={d.id}>
            <ContextMenu actions={docActions(d)} menuLabel={`Menu for ${d.label || d.motionName}`} className="filerow">
              <span className="fileicon" aria-hidden="true">
                <Icon name="doc" size={26} />
              </span>
              <span className="filetexts">
                <strong>{d.label || d.motionName}</strong>
                <span className="fineprint">
                  {d.caseTitle} · prepared {fmtDate(d.createdAt)}
                  {d.feeWaiver ? ' · with fee waiver' : ''}
                </span>
              </span>
            </ContextMenu>
          </li>
        ))}
      </ul>

      {renaming && (
        <Modal title="Rename document" onClose={() => setRenaming(null)}>
          <div className="field">
            <label htmlFor="ev-name">Document name</label>
            <input id="ev-name" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
          </div>
          <div className="choices">
            <button className="btn primary" disabled={busy || !renameTo.trim()} onClick={renameDoc}>
              Rename
            </button>
            <button className="btn ghost" onClick={() => setRenaming(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {trashing && (
        <Modal title="Move to trash" onClose={() => setTrashing(null)}>
          <p>
            Move “{trashing.label || trashing.motionName}” to the trash? The case it belongs
            to is kept — only this document is removed. This cannot be undone.
          </p>
          <div className="choices">
            <button className="btn" style={{ background: '#b3261e', borderColor: '#b3261e', color: '#fff' }} disabled={busy} onClick={trashDoc}>
              <Icon name="trash" size={15} /> Move to trash
            </button>
            <button className="btn ghost" onClick={() => setTrashing(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {props && (
        <Modal title="Document properties" onClose={() => setProps(null)}>
          <dl className="proprows">
            <dt>Name</dt><dd>{props.label || props.motionName}</dd>
            <dt>Motion</dt><dd>{props.motionName}</dd>
            <dt>Case</dt><dd><Link href={`/dashboard/cases/${props.caseId}`}>{props.caseTitle}</Link></dd>
            <dt>Prepared</dt><dd>{fmtDate(props.createdAt)}</dd>
            <dt>Fee waiver</dt><dd>{props.feeWaiver ? 'Included' : 'No'}</dd>
          </dl>
        </Modal>
      )}
    </div>
  );
}

export default function EvidenceLocker() {
  return (
    <DashGate>
      {() => <LockerBody />}
    </DashGate>
  );
}
