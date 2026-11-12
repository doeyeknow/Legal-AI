'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import { Icon } from './icons';

/** The user's personal court-mail address, with copy + rename.
 *  Shown on the Account page and at the top of the inbox. The copy
 *  is honest about what court email is and is not (design §7):
 *  email is a convenience channel, never legal service. */
export default function InboxAddressCard({ compact }: { compact?: boolean }) {
  const [address, setAddress] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/address');
      if (!res.ok) return;
      const data = await res.json();
      setAddress(data.address || null);
      setSlug(data.slug || '');
    } catch {
      /* best effort — the card just stays hidden */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setNote('Copied.');
    } catch {
      setNote('Copy failed — long-press the address to copy it.');
    }
  }

  async function saveSlug() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/inbox/address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.address) {
        setAddress(data.address);
        setSlug(draft.toLowerCase().trim());
        setEditing(false);
        setNote('Your address name is updated. Mail to the old name will no longer reach you — tell anyone who has it.');
      } else {
        setNote(data.error || 'That name could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!address) return null;

  return (
    <div className="acctcard">
      <h3>
        <Icon name="mail" size={20} /> Your court-mail address
      </h3>
      <p className="fineprint">
        Give this address to the court clerk, the other party, or opposing counsel — or forward
        court email to it — and anything that arrives lands in your inbox here, scanned for the
        dates and facts your case file needs.
      </p>
      <p className="inboxaddr">{address}</p>
      <div className="choices">
        <button className="btn primary" onClick={copy}>Copy address</button>
        <button
          className="btn ghost"
          onClick={() => { setDraft(slug); setNote(null); setEditing(true); }}
        >
          Rename
        </button>
      </div>
      {note && <p className="fineprint">{note}</p>}
      {!compact && (
        <p className="fineprint">
          Honest limits: most courts still send their important papers by paper mail or through
          the state e-filing portal — very few will email you directly, and being given this
          address does not change that. Email is <strong>not</strong> legal service of process,
          and nothing sent here counts as served. Keep checking your paper mail and your portal
          account; this inbox reads what reaches it and never files, sends, or replies to
          anything on its own.
        </p>
      )}
      {editing && (
        <Modal title="Rename your court-mail address" onClose={() => setEditing(false)}>
          <div className="field full">
            <label htmlFor="inbox-slug">Name (the part before the code)</label>
            <input
              id="inbox-slug"
              value={draft}
              onChange={(e) => setDraft(e.target.value.toLowerCase())}
              placeholder="your-name"
              autoComplete="off"
            />
          </div>
          <p className="fineprint">
            3–20 characters: lowercase letters, numbers, hyphens. The short code after it never
            changes — it is what keeps your mail yours. Renaming means mail sent to the old name
            stops arriving.
          </p>
          {note && <p className="error">{note}</p>}
          <div className="choices">
            <button className="btn primary" disabled={busy} onClick={saveSlug}>Save name</button>
            <button className="btn ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
