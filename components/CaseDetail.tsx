'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashGate from './DashGate';
import Modal from './Modal';
import ReplyBadge from './ReplyBadge';
import { caseReplyState, localToday, replyMarks } from '@/lib/reply-state';
import CommDraft from './CommDraft';
import type {
  Appearance,
  CaseDetail as CaseDetailT,
  CommEntry,
  Deadline,
  RemoteStatus,
} from '@/lib/dashboard-types';
import { APPEARANCE_PLATFORMS, CASE_STATUSES, COMM_METHODS } from '@/lib/dashboard-types';
import { DEADLINE_TYPES, deadlineType } from '@/lib/comm-templates';
import { PORTALS, portalByKey } from '@/lib/portals';
import { getMotion } from '@/lib/motions/match';
import ContextMenu, { type CtxAction } from './ContextMenu';
import { Icon } from './icons';
import { documentPdfUrl, downloadPdf, printPdf, shareDocument } from './finderActions';

function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
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

function CaseView({ caseId }: { caseId: string }) {
  const [data, setData] = useState<CaseDetailT | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error === 'Not found.' ? 'That case is not on your account.' : body.message || 'This case could not be loaded.');
        return;
      }
      setData(body.case);
    } catch {
      setError('This case could not be loaded.');
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="fineprint">Loading the case…</p>;
  return <CaseSections data={data} setData={setData} reload={load} />;
}

function CaseSections({
  data,
  setData,
  reload,
}: {
  data: CaseDetailT;
  setData: (d: CaseDetailT) => void;
  reload: () => void;
}) {
  const [statusBusy, setStatusBusy] = useState(false);

  async function changeStatus(status: string) {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/cases/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.case) setData({ ...data, status: body.case.status });
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div>
      <p><Link href="/dashboard">← All cases</Link></p>
      <h1>{data.title}</h1>
      <p className="fineprint">
        {[data.courtName, data.county ? `${data.county} County` : '', data.state]
          .filter(Boolean)
          .join(' · ')}
        {data.caseNumber ? ` · Case No. ${data.caseNumber}` : ' · No case number recorded'}
        {data.relation === 'other'
          ? ` · Prepared for ${data.subjectName || 'someone else'} — you are the preparer`
          : ''}
      </p>
      {(() => {
        const rs = caseReplyState(data.comms, localToday());
        return rs.awaitingReply ? (
          <p>
            <ReplyBadge overdue={rs.replyOverdue} />
          </p>
        ) : null;
      })()}
      {data.status === 'Draft' ? (
        <div className="draftbanner">
          <p>
            <strong>Draft — interview in progress.</strong>{' '}
            {data.draftMotionId
              ? `This is a ${getMotion(data.draftMotionId)?.name || 'motion'} interview that hasn't been finished yet, so there is no document. `
              : 'This interview hasn\'t been finished yet, so there is no document. '}
            Last updated {fmtDateTime(data.updatedAt)}. Pick it up where you left off:
          </p>
          <p>
            <Link className="btn primary" href={`/interview?draft=${data.id}`}>
              Resume the interview
            </Link>
          </p>
        </div>
      ) : (
        <div className="field inlinefield">
          <label htmlFor="case-status">Case status</label>
          <select
            id="case-status"
            value={data.status}
            disabled={statusBusy}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <DocumentsSection data={data} reload={reload} />
      <DeadlinesSection data={data} setData={setData} />
      <AppearanceSection data={data} setData={setData} />
      <CommsSection data={data} setData={setData} />
      <CourtMailSection data={data} />
      <WatchSection data={data} setData={setData} reload={reload} />
    </div>
  );
}

function DocumentsSection({ data, reload }: { data: CaseDetailT; reload: () => void }) {
  const [renaming, setRenaming] = useState<CaseDetailT['documents'][number] | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [trashing, setTrashing] = useState<CaseDetailT['documents'][number] | null>(null);
  const [props, setProps] = useState<CaseDetailT['documents'][number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        `/api/cases/${encodeURIComponent(data.id)}/documents/${encodeURIComponent(renaming.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: renameTo.trim() }),
        },
      );
      setRenaming(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function trashDoc() {
    if (!trashing) return;
    setBusy(true);
    try {
      await fetch(
        `/api/cases/${encodeURIComponent(data.id)}/documents/${encodeURIComponent(trashing.id)}`,
        { method: 'DELETE' },
      );
      setTrashing(null);
      setNotice('Document moved to the trash.');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function docActions(d: CaseDetailT['documents'][number]): CtxAction[] {
    const url = documentPdfUrl(data.id, d.id);
    return [
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

  return (
    <section className="dashsection">
      <h2>Documents</h2>
      {notice && <p className="finder-notice" role="status">{notice}</p>}
      {data.documents.length === 0 && (
        <p>
          No documents yet. Documents you prepare in the{' '}
          <Link href="/interview">interview</Link> while signed in are filed here automatically.
        </p>
      )}
      {data.documents.length > 0 && (
        <ul className="doclist">
          {data.documents.map((d) => (
            <li key={d.id}>
              <ContextMenu actions={docActions(d)} menuLabel={`Menu for ${d.label || d.motionName}`} className="filerow">
                <span className="fileicon" aria-hidden="true"><Icon name="doc" size={24} /></span>
                <span className="filetexts">
                  <strong>{d.label || d.motionName}</strong>
                  <span className="fineprint">
                    {d.motionName}{d.feeWaiver ? ' · with fee waiver' : ''} — prepared {fmtDate(d.createdAt)}
                  </span>
                </span>
              </ContextMenu>
            </li>
          ))}
        </ul>
      )}
      {data.documents.length > 0 && (
        <p className="fineprint">
          Re-downloads are regenerated from your saved answers. Your drawn signature is not
          stored, so a regenerated copy has a blank signature line — sign the printed copy the
          way you signed the original.
        </p>
      )}
      {renaming && (
        <Modal title="Rename document" onClose={() => setRenaming(null)}>
          <div className="field">
            <label htmlFor="cd-name">Document name</label>
            <input id="cd-name" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
          </div>
          <div className="choices">
            <button className="btn primary" disabled={busy || !renameTo.trim()} onClick={renameDoc}>Rename</button>
            <button className="btn ghost" onClick={() => setRenaming(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {trashing && (
        <Modal title="Move to trash" onClose={() => setTrashing(null)}>
          <p>
            Move “{trashing.label || trashing.motionName}” to the trash? The case is kept —
            only this document is removed. This cannot be undone.
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
            <dt>Prepared</dt><dd>{fmtDateTime(props.createdAt)}</dd>
            <dt>Fee waiver</dt><dd>{props.feeWaiver ? 'Included' : 'No'}</dd>
          </dl>
        </Modal>
      )}
    </section>
  );
}

function DeadlinesSection({
  data,
  setData,
}: {
  data: CaseDetailT;
  setData: (d: CaseDetailT) => void;
}) {
  const [type, setType] = useState(DEADLINE_TYPES[0].key);
  const [label, setLabel] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const selected = deadlineType(type);

  async function add() {
    if (!dueAt) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${data.id}/deadlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, label, dueAt }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.deadline) {
        const dl: Deadline = body.deadline;
        setData({
          ...data,
          deadlines: [...data.deadlines, dl].sort(
            (a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt),
          ),
        });
        setLabel('');
        setDueAt('');
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(d: Deadline) {
    const res = await fetch(`/api/cases/${data.id}/deadlines/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !d.done }),
    });
    if (res.ok) {
      setData({
        ...data,
        deadlines: data.deadlines.map((x) => (x.id === d.id ? { ...x, done: !x.done } : x)),
      });
    }
  }

  async function remove(d: Deadline) {
    const res = await fetch(`/api/cases/${data.id}/deadlines/${d.id}`, { method: 'DELETE' });
    if (res.ok) {
      setData({ ...data, deadlines: data.deadlines.filter((x) => x.id !== d.id) });
    }
  }

  return (
    <section className="dashsection">
      <h2>Deadlines</h2>
      {data.deadlines.length === 0 && <p>No deadlines tracked yet.</p>}
      <ul className="deadlinelist">
        {data.deadlines.map((d) => (
          <li key={d.id} className={`deadlineitem${d.done ? ' done' : ''}`}>
            <input
              type="checkbox"
              checked={d.done}
              onChange={() => toggle(d)}
              aria-label="Mark done"
            />
            <span className="duedate">{fmtDate(d.dueAt)}</span>
            <span>
              <strong>{d.label || deadlineType(d.type)?.label || d.type}</strong>
              <span className="fineprint block">{deadlineType(d.type)?.label}</span>
            </span>
            <button className="btn small ghost" onClick={() => remove(d)}>Delete</button>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={() => setOpen(true)}>+ Add a deadline</button>
      {open && (
        <Modal title="Add a deadline" onClose={() => setOpen(false)}>
          <div className="formgrid">
            <div className="field">
              <label htmlFor="dl-type">Kind of deadline</label>
              <select id="dl-type" value={type} onChange={(e) => setType(e.target.value)}>
                {DEADLINE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dl-date">Due date</label>
              <input id="dl-date" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="dl-label">Label (for example: “Response to their motion”)</label>
              <input id="dl-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          {selected && (
            <p className="fineprint">
              {selected.what}
              {selected.source ? <> Where it comes from: {selected.source}</> : null}
              {selected.ifMissed ? <> <strong>If missed:</strong> {selected.ifMissed}</> : null}
            </p>
          )}
          <div className="choices">
            <button className="btn primary" disabled={busy || !dueAt} onClick={add}>Add deadline</button>
            <button className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AppearanceSection({
  data,
  setData,
}: {
  data: CaseDetailT;
  setData: (d: CaseDetailT) => void;
}) {
  const a = data.appearance;
  const [hearingAt, setHearingAt] = useState(
    a?.hearingAt ? a.hearingAt.slice(0, 16) : '',
  );
  const [platform, setPlatform] = useState(a?.platform || 'Webex');
  const [joinUrl, setJoinUrl] = useState(a?.joinUrl || '');
  const [phoneBackup, setPhoneBackup] = useState(a?.phoneBackup || '');
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>(a?.remoteStatus || 'not_requested');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/cases/${data.id}/appearance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hearingAt: hearingAt ? new Date(hearingAt).toISOString() : null,
          platform,
          joinUrl,
          phoneBackup,
          remoteStatus,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.appearance) {
        const saved: Appearance = body.appearance;
        setData({ ...data, appearance: saved });
        setNote('Saved.');
        setOpen(false);
      } else {
        setNote(body.error || 'The appearance could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashsection">
      <h2>Hearing &amp; remote appearance</h2>
      {remoteStatus !== 'granted' && (
        <p className="warn">
          Until the court grants a remote-appearance request, attending in person remains the
          obligation — a request that has only been filed, or not yet answered, is not
          permission, and a published hearing link by itself is not an invitation.
        </p>
      )}
      {remoteStatus === 'granted' && (
        <p className="fineprint">
          The court has granted remote appearance for this hearing. Join from a quiet, private
          place, dress as for court, join 10–15 minutes early, and keep the courtroom phone
          number handy in case the connection drops.
        </p>
      )}
      {a?.hearingAt ? (
        <p>
          <strong>Hearing:</strong> {fmtDateTime(a.hearingAt)} · {a.platform}
          {a.remoteStatus === 'granted'
            ? ' · Remote appearance granted'
            : a.remoteStatus === 'requested'
              ? ' · Remote appearance requested — waiting for the court'
              : a.remoteStatus === 'denied'
                ? ' · Remote appearance denied — appear in person'
                : ''}
          {a.phoneBackup ? <span className="fineprint block">Court phone: {a.phoneBackup}</span> : null}
        </p>
      ) : (
        <p className="fineprint">No hearing details saved yet.</p>
      )}
      <div className="choices">
        <button className="btn" onClick={() => setOpen(true)}>
          {a?.hearingAt ? 'Edit hearing details' : 'Add hearing details'}
        </button>
        {a?.joinUrl && a.remoteStatus === 'granted' && (
          <a className="btn" href={a.joinUrl} target="_blank" rel="noreferrer">Join the hearing ↗</a>
        )}
        <Link className="btn ghost" href="/interview">
          Prepare a Motion for Remote Appearance
        </Link>
      </div>
      {note && <p className="fineprint">{note}</p>}
      <p className="fineprint">
        The Motion for Remote Appearance is in the interview’s motion library — it asks for
        the hearing details and your grounds and prepares the filing, with a proposed order
        for the judge. Need to practice first?{' '}
        <Link href="/dashboard/practice">Run the simulated hearing</Link>.
      </p>
      {open && (
        <Modal title="Hearing & remote appearance" onClose={() => setOpen(false)}>
          <div className="formgrid">
            <div className="field">
              <label htmlFor="ap-when">Hearing date &amp; time</label>
              <input
                id="ap-when"
                type="datetime-local"
                value={hearingAt}
                onChange={(e) => setHearingAt(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ap-platform">Platform</label>
              <select id="ap-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {APPEARANCE_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="ap-join">Join link (from the court’s notice or published page)</label>
              <input id="ap-join" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="field">
              <label htmlFor="ap-phone">Courtroom / clerk phone (backup if the connection drops)</label>
              <input id="ap-phone" value={phoneBackup} onChange={(e) => setPhoneBackup(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ap-status">Remote appearance status</label>
              <select
                id="ap-status"
                value={remoteStatus}
                onChange={(e) => setRemoteStatus(e.target.value as RemoteStatus)}
              >
                <option value="not_requested">Not requested</option>
                <option value="requested">Requested — waiting for the court</option>
                <option value="granted">Granted by the court</option>
                <option value="denied">Denied — appear in person</option>
              </select>
            </div>
          </div>
          {note && <p className="fineprint">{note}</p>}
          <div className="choices">
            <button className="btn primary" disabled={busy} onClick={save}>Save appearance</button>
            <button className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function CommsSection({
  data,
  setData,
}: {
  data: CaseDetailT;
  setData: (d: CaseDetailT) => void;
}) {
  const [direction, setDirection] = useState<'to_court' | 'from_court'>('to_court');
  const [method, setMethod] = useState<string>(COMM_METHODS[2]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sentAt, setSentAt] = useState(new Date().toISOString().slice(0, 10));
  const [responseDeadline, setResponseDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  function prepend(c: CommEntry) {
    setData({ ...data, comms: [c, ...data.comms] });
  }

  // Per-entry unanswered-reply marks (amber awaiting / red overdue),
  // computed from the log itself — see lib/reply-state.
  const marks = replyMarks(data.comms, localToday());

  async function add() {
    if (!subject.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${data.id}/comms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          method,
          subject: subject.trim(),
          body,
          sentAt,
          responseDeadline: responseDeadline || null,
          status: '',
        }),
      });
      const resBody = await res.json().catch(() => ({}));
      if (res.ok && resBody.comm) {
        prepend(resBody.comm);
        setSubject('');
        setBody('');
        setResponseDeadline('');
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashsection">
      <h2>Communication with the court</h2>
      <p className="fineprint">
        A log of everything sent and received — the originals move through the court’s own
        channels (clerk, mail, e-filing); this log is how you prove what happened and spot
        what is owed a response.
      </p>
      <CommDraft caseData={data} onLogged={prepend} />
      {data.comms.length === 0 ? (
        <p>No communications logged yet.</p>
      ) : (
        <ul className="commlist">
          {data.comms.map((c) => (
            <li key={c.id} className="commitem">
              <span className={`dirbadge ${c.direction}`}>
                {c.direction === 'to_court' ? 'To court' : 'From court'}
              </span>
              <span>
                <strong>{c.subject}</strong> — {c.method}, {fmtDate(c.sentAt)}
                {c.responseDeadline && (
                  <span className="fineprint block">
                    Response deadline: {fmtDate(c.responseDeadline)}
                  </span>
                )}
                {marks.get(c.id) && (
                  <span className="block">
                    <ReplyBadge overdue={marks.get(c.id) === 'overdue'} />
                  </span>
                )}
                {c.status && <span className="fineprint block">{c.status}</span>}
                {c.body && <span className="commbody">{c.body}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn" onClick={() => setOpen(true)}>+ Log a communication</button>
      {open && (
        <Modal title="Log a communication" onClose={() => setOpen(false)}>
          <div className="formgrid">
            <div className="field">
              <label htmlFor="cm-dir">Direction</label>
              <select
                id="cm-dir"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'to_court' | 'from_court')}
              >
                <option value="to_court">I sent it to the court</option>
                <option value="from_court">The court sent it to me</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cm-method">Method</label>
              <select id="cm-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {COMM_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cm-date">Date</label>
              <input id="cm-date" type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cm-resp">Response deadline (if any)</label>
              <input
                id="cm-resp"
                type="date"
                value={responseDeadline}
                onChange={(e) => setResponseDeadline(e.target.value)}
              />
            </div>
            <div className="field full">
              <label htmlFor="cm-subject">Subject</label>
              <input id="cm-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="cm-body">What it said (summary or the full text)</label>
              <textarea id="cm-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </div>
          <div className="choices">
            <button className="btn primary" disabled={busy || !subject.trim()} onClick={add}>
              Add to log
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function CourtMailSection({ data }: { data: CaseDetailT }) {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/inbox/address')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.address) setAddress(d.address); })
      .catch(() => undefined);
  }, []);
  const unreviewed = data.courtMail.reduce((n, m) => n + m.proposedCount, 0);
  return (
    <section className="dashsection">
      <h2>Court mail for this case</h2>
      {address && (
        <p className="fineprint">
          Have this case’s mail sent to <strong>{address}</strong>
          {data.caseNumber && (
            <> and put case number <strong>{data.caseNumber}</strong> in the subject line</>
          )}{' '}
          — it lands in your inbox, scanned for dates and facts. Nothing is added to this case
          until you confirm it.
        </p>
      )}
      {data.courtMail.length === 0 ? (
        <p>No court mail has been assigned to this case yet.</p>
      ) : (
        <ul className="commlist">
          {data.courtMail.map((m) => (
            <li key={m.id} className="commitem">
              <span className="dirbadge from_court">Email</span>
              <span>
                <Link href={`/dashboard/inbox?case=${data.id}&message=${m.id}`}>
                  <strong>{m.subject || '(no subject)'}</strong>
                </Link>{' '}
                — {m.fromName || m.fromEmail}, {fmtDate(m.receivedAt)}
                {m.proposedCount > 0 && (
                  <span className="statuspill draft block">{m.proposedCount} fact{m.proposedCount === 1 ? '' : 's'} to review</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link className="btn" href={`/dashboard/inbox?case=${data.id}`}>
        Open this case’s mail{unreviewed > 0 ? ` (${unreviewed} to review)` : ''}
      </Link>
    </section>
  );
}

function WatchSection({
  data,
  setData,
  reload,
}: {
  data: CaseDetailT;
  setData: (d: CaseDetailT) => void;
  reload: () => void;
}) {
  const statePortals = PORTALS.filter((p) => p.state === data.state || p.state === 'US');
  const [portalKey, setPortalKey] = useState(
    data.state === 'NM' ? 'nm-case-lookup' : 'manual-other',
  );
  const [caseNumber, setCaseNumber] = useState(data.caseNumber || '');
  const [partyName, setPartyName] = useState(data.subjectName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${data.id}/watches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalKey, caseNumber: caseNumber.trim(), partyName: partyName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setOpen(false);
        reload();
      } else setError(body.error || 'The watch could not be added.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(wid: string) {
    const res = await fetch(`/api/cases/${data.id}/watches/${wid}`, { method: 'DELETE' });
    if (res.ok) setData({ ...data, watches: data.watches.filter((w) => w.id !== wid) });
  }

  return (
    <section className="dashsection">
      <h2>Docket watch</h2>
      <p className="fineprint">
        A watch ties this case’s number to a court portal. What checking can do depends on the
        court: NM Case Lookup is a search form with no automated access, so checks there are
        best-effort and say exactly what they established; most other courts are manual-check
        only, and the dashboard will never pretend a court is being watched when it is not.
        Always confirm anything important with the clerk — the court’s record controls.
      </p>
      {data.watches.length === 0 ? (
        <p>No watches yet.</p>
      ) : (
        <ul className="watchlist">
          {data.watches.map((w) => {
            const portal = portalByKey(w.portalKey);
            const monitored = w.portalKey === 'nm-case-lookup';
            return (
              <li key={w.id} className="watchitem">
                <span className={`dirbadge ${monitored ? 'to_court' : 'from_court'}`}>
                  {monitored ? 'Monitored — best effort' : 'Manual check'}
                </span>
                <span>
                  <strong>{portal ? portal.portalName : 'Another court / manual check'}</strong>
                  {' — '}Case No. {w.caseNumber}
                  {w.partyName ? ` · ${w.partyName}` : ''}
                  <span className="fineprint block">
                    {w.lastCheckedAt
                      ? `Last checked ${fmtDateTime(w.lastCheckedAt)}`
                      : 'Not automatically checked yet'}
                  </span>
                  {w.lastNote && <span className="commbody">{w.lastNote}</span>}
                  {portal?.url && (
                    <span className="block">
                      <a href={portal.url} target="_blank" rel="noreferrer">Open the portal ↗</a>
                    </span>
                  )}
                </span>
                <button className="btn small ghost" onClick={() => remove(w.id)}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}
      <button className="btn" onClick={() => setOpen(true)}>+ Add a docket watch</button>
      {open && (
        <Modal title="Watch this case’s docket" onClose={() => setOpen(false)}>
          <div className="formgrid">
            <div className="field full">
              <label htmlFor="w-portal">Court portal</label>
              <select id="w-portal" value={portalKey} onChange={(e) => setPortalKey(e.target.value)}>
                {statePortals.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.portalName} ({p.stateName})
                  </option>
                ))}
                <option value="manual-other">Another court — manual check only</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="w-num">Case number (required — a name-only watch matches strangers)</label>
              <input id="w-num" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="w-party">Party name as it appears in the caption</label>
              <input id="w-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="choices">
            <button className="btn primary" disabled={busy || !caseNumber.trim()} onClick={add}>
              Add watch
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function CaseDetail({ caseId }: { caseId: string }) {
  return (
    <DashGate>
      {() => <CaseView caseId={caseId} />}
    </DashGate>
  );
}
