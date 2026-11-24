'use client';

// Case timeline: one chronological view of everything about a case.
// It merges the events the user records here (what happened, when,
// where, who was involved) with the dates the case already holds —
// when it was opened, documents prepared, deadlines, filings and
// letters in the communications log, court mail, and the hearing.
// Only the user's own events are editable here; the rest link back
// to the section that owns them.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Modal from './Modal';
import { Icon, type IconName } from './icons';
import type { CaseDetail as CaseDetailT, CaseEvent } from '@/lib/dashboard-types';
import { CASE_EVENT_KINDS } from '@/lib/dashboard-types';
import { deadlineType } from '@/lib/comm-templates';
import { localToday } from '@/lib/reply-state';

type Source = 'event' | 'case' | 'document' | 'deadline' | 'comm' | 'mail' | 'hearing';
type Filter = 'all' | 'mine' | 'court' | 'documents' | 'comms';

interface Entry {
  id: string;
  source: Source;
  kind: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, when known */
  time: string | null;
  title: string;
  details: string;
  meta: string[];
  tag: string;
  href?: string;
  done?: boolean;
  event?: CaseEvent;
}

const KIND_ICON: Record<string, IconName> = {
  incident: 'flag',
  hearing: 'gavel',
  filing: 'filePlus',
  service: 'files',
  order: 'scroll',
  communication: 'chat',
  payment: 'wallet',
  evidence: 'shield',
  note: 'pencil',
  case: 'folder',
  document: 'doc',
  deadline: 'calendar',
  comm_out: 'forward',
  comm_in: 'reply',
  mail: 'mail',
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'mine', label: 'My events' },
  { id: 'court', label: 'Hearings & deadlines' },
  { id: 'documents', label: 'Documents' },
  { id: 'comms', label: 'Letters & mail' },
];

function kindLabel(k: string): string {
  return CASE_EVENT_KINDS.find((x) => x.key === k)?.label || 'Note';
}

function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso.slice(0, 10), time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function fmtDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMonth(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 7)}-15T12:00:00`);
  return Number.isNaN(d.getTime()) ? ymd.slice(0, 7) : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function fmtTime(hhmm: string | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Every dated thing the case knows about, as timeline entries. */
function buildEntries(data: CaseDetailT): Entry[] {
  const out: Entry[] = [];
  const base = `/dashboard/cases/${data.id}`;
  const opened = localParts(data.createdAt);
  out.push({
    id: `case-${data.id}`, source: 'case', kind: 'case', date: opened.date, time: opened.time,
    title: data.status === 'Draft' ? 'Case started (interview in progress)' : 'Case opened on quikForm',
    details: '',
    meta: [data.courtName, data.caseNumber ? `Case No. ${data.caseNumber}` : ''].filter(Boolean),
    tag: 'Case',
  });
  for (const e of data.events || []) {
    out.push({
      id: `ev-${e.id}`, source: 'event', kind: e.kind, date: e.occurredOn, time: e.occurredTime,
      title: e.title, details: e.details,
      meta: [e.location && `At ${e.location}`, e.people && `With ${e.people}`].filter(Boolean) as string[],
      tag: kindLabel(e.kind), event: e,
    });
  }
  for (const d of data.documents) {
    const p = localParts(d.createdAt);
    out.push({
      id: `doc-${d.id}`, source: 'document', kind: 'document', date: p.date, time: p.time,
      title: `Prepared: ${d.label || d.motionName}`,
      details: '',
      meta: d.feeWaiver ? ['With a fee-waiver request'] : [],
      tag: 'Document', href: `${base}#documents`,
    });
  }
  for (const d of data.deadlines) {
    const t = deadlineType(d.type);
    out.push({
      id: `dl-${d.id}`, source: 'deadline', kind: 'deadline', date: d.dueAt, time: null,
      title: `Deadline: ${d.label || t?.label || d.type}`,
      details: '',
      meta: [d.label && t?.label ? t.label : '', d.done ? 'Done' : ''].filter(Boolean),
      tag: 'Deadline', done: d.done, href: `${base}#deadlines`,
    });
  }
  for (const c of data.comms) {
    const out_ = c.direction === 'to_court';
    out.push({
      id: `cm-${c.id}`, source: 'comm', kind: out_ ? 'comm_out' : 'comm_in', date: c.sentAt, time: null,
      title: `${out_ ? 'Sent' : 'Received'}: ${c.subject || c.method || 'Communication'}`,
      details: c.body,
      meta: [c.method, c.status].filter(Boolean),
      tag: out_ ? 'To the court' : 'From the court', href: `${base}#comms`,
    });
    if (c.responseDeadline) {
      out.push({
        id: `cmr-${c.id}`, source: 'deadline', kind: 'deadline', date: c.responseDeadline, time: null,
        title: `Reply expected: ${c.subject || c.method || 'Communication'}`,
        details: '', meta: [], tag: 'Deadline', href: `${base}#comms`,
      });
    }
  }
  for (const m of data.courtMail) {
    const p = localParts(m.receivedAt);
    out.push({
      id: `ml-${m.id}`, source: 'mail', kind: 'mail', date: p.date, time: p.time,
      title: `Court mail: ${m.subject || '(no subject)'}`,
      details: '',
      meta: [m.fromName || m.fromEmail, m.proposedCount ? `${m.proposedCount} facts to review` : ''].filter(Boolean),
      tag: 'Court mail', href: `/dashboard/inbox?case=${data.id}&message=${m.id}`,
    });
  }
  if (data.appearance?.hearingAt) {
    const p = localParts(data.appearance.hearingAt);
    const a = data.appearance;
    out.push({
      id: `hr-${a.id}`, source: 'hearing', kind: 'hearing', date: p.date, time: p.time,
      title: 'Hearing',
      details: '',
      meta: [a.platform && `On ${a.platform}`, a.phoneBackup && `Phone backup ${a.phoneBackup}`].filter(Boolean) as string[],
      tag: 'Hearing', href: `${base}#hearing`,
    });
  }
  return out;
}

function matches(e: Entry, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'mine') return e.source === 'event';
  if (f === 'court') return e.source === 'deadline' || e.source === 'hearing' || (e.source === 'event' && (e.kind === 'hearing' || e.kind === 'order' || e.kind === 'filing'));
  if (f === 'documents') return e.source === 'document' || (e.source === 'event' && (e.kind === 'filing' || e.kind === 'evidence'));
  return e.source === 'comm' || e.source === 'mail' || (e.source === 'event' && (e.kind === 'communication' || e.kind === 'service'));
}

const EMPTY_FORM = {
  kind: 'incident', title: '', details: '', occurredOn: '', occurredTime: '', location: '', people: '',
};

export default function CaseTimeline({
  data,
  setData,
}: {
  data: CaseDetailT;
  setData: (d: CaseDetailT) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [newestFirst, setNewestFirst] = useState(false);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<CaseEvent | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<CaseEvent | null>(null);

  const today = localToday();
  const all = useMemo(() => buildEntries(data), [data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all
      .filter((e) => matches(e, filter))
      .filter((e) => !needle || [e.title, e.details, e.tag, ...e.meta].join(' ').toLowerCase().includes(needle));
    list.sort((a, b) => {
      const ka = `${a.date} ${a.time || '00:00'}`;
      const kb = `${b.date} ${b.time || '00:00'}`;
      return newestFirst ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
    return list;
  }, [all, filter, q, newestFirst]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, mine: 0, court: 0, documents: 0, comms: 0 };
    for (const e of all) for (const f of FILTERS) if (matches(e, f.id)) c[f.id]++;
    return c;
  }, [all]);
  const upcoming = all.filter((e) => e.date >= today && (e.source === 'deadline' || e.source === 'hearing' || e.kind === 'hearing') && !e.done)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  function openNew(prefill?: Partial<typeof EMPTY_FORM>) {
    setForm({ ...EMPTY_FORM, occurredOn: today, ...prefill });
    setErr(null);
    setEditing('new');
  }
  function openEdit(e: CaseEvent) {
    setForm({
      kind: e.kind, title: e.title, details: e.details, occurredOn: e.occurredOn,
      occurredTime: e.occurredTime || '', location: e.location, people: e.people,
    });
    setErr(null);
    setEditing(e);
  }

  async function save() {
    if (!editing) return;
    if (!form.title.trim()) { setErr('Give the event a short title.'); return; }
    if (!form.occurredOn) { setErr('Pick the date it happened.'); return; }
    setBusy(true);
    setErr(null);
    try {
      const isNew = editing === 'new';
      const res = await fetch(
        isNew ? `/api/cases/${data.id}/events` : `/api/cases/${data.id}/events/${editing.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.event) {
        setErr(body.error || body.message || 'The event could not be saved.');
        return;
      }
      const ev: CaseEvent = body.event;
      const events = isNew
        ? [...(data.events || []), ev]
        : (data.events || []).map((x) => (x.id === ev.id ? ev : x));
      setData({ ...data, events });
      setEditing(null);
    } catch {
      setErr('The event could not be saved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: CaseEvent) {
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${data.id}/events/${e.id}`, { method: 'DELETE' });
      if (res.ok) setData({ ...data, events: (data.events || []).filter((x) => x.id !== e.id) });
    } finally {
      setBusy(false);
      setConfirmDel(null);
      setEditing(null);
    }
  }

  function printTimeline() {
    const head = [
      data.courtName, data.county ? `${data.county} County` : '', data.state,
      data.caseNumber ? `Case No. ${data.caseNumber}` : '',
    ].filter(Boolean).join(' · ');
    const rows = shown.map((e) => `
      <tr>
        <td class="d">${escapeHtml(fmtDay(e.date))}${e.time ? `<br><span>${escapeHtml(fmtTime(e.time))}</span>` : ''}</td>
        <td><strong>${escapeHtml(e.title)}</strong> <em>${escapeHtml(e.tag)}</em>
          ${e.meta.length ? `<div class="m">${escapeHtml(e.meta.join(' · '))}</div>` : ''}
          ${e.details ? `<div class="x">${escapeHtml(e.details)}</div>` : ''}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.title)} — timeline</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 32px; line-height: 1.45; }
  h1 { font-size: 20px; margin: 0 0 4px; } p.h { margin: 0 0 18px; color: #444; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  td { border-top: 1px solid #ccc; padding: 8px 10px 8px 0; vertical-align: top; }
  td.d { width: 150px; white-space: nowrap; color: #333; } td.d span { color: #666; font-size: 12px; }
  em { color: #666; font-size: 11.5px; font-style: normal; text-transform: uppercase; letter-spacing: .04em; margin-left: 6px; }
  .m { color: #555; font-size: 12.5px; } .x { white-space: pre-wrap; margin-top: 4px; }
  .foot { margin-top: 24px; font-size: 11px; color: #777; }
</style></head><body>
<h1>${escapeHtml(data.title)} — case timeline</h1>
<p class="h">${escapeHtml(head)}${data.subjectName ? ` · ${escapeHtml(data.subjectName)}` : ''}</p>
<table>${rows}</table>
<p class="foot">Printed from quikForm on ${escapeHtml(fmtDay(today))}. Personal record kept by the party — not a court document.</p>
</body></html>`;
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) { frame.remove(); return; }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* blocked */ }
      setTimeout(() => frame.remove(), 60_000);
    }, 250);
  }

  // Group by month, with a "Today" marker between past and future.
  let lastMonth = '';
  let todayPlaced = false;
  const items: React.ReactNode[] = [];
  shown.forEach((e) => {
    const isFuture = e.date > today;
    const crossesToday = !todayPlaced && (newestFirst ? !isFuture : isFuture);
    if (crossesToday && shown.length > 1 && filter === 'all' && !q) {
      // Only show the marker if there are entries on both sides.
      const hasOther = shown.some((x) => (newestFirst ? x.date > today : x.date <= today));
      if (hasOther) {
        todayPlaced = true;
        items.push(
          <li key="today" className="tl-today" aria-label="Today">
            <span>Today · {fmtDay(today)}</span>
          </li>,
        );
      }
    }
    const month = e.date.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      items.push(<li key={`m-${month}-${e.id}`} className="tl-month">{fmtMonth(e.date)}</li>);
    }
    const open = !!expanded[e.id];
    const long = e.details.length > 180;
    items.push(
      <li key={e.id} className={`tl-item src-${e.source} kind-${e.kind}${e.date > today ? ' future' : ''}${e.done ? ' done' : ''}`}>
        <span className="tl-dot" aria-hidden="true"><Icon name={KIND_ICON[e.kind] || 'info'} size={15} /></span>
        <div className="tl-card">
          <div className="tl-top">
            <span className="tl-date">{fmtDay(e.date)}{e.time ? ` · ${fmtTime(e.time)}` : ''}</span>
            <span className="tl-tag">{e.tag}</span>
          </div>
          <p className="tl-title">{e.title}</p>
          {e.meta.length > 0 && <p className="tl-meta">{e.meta.join(' · ')}</p>}
          {e.details && (
            <p className={`tl-details${long && !open ? ' clamp' : ''}`}>{e.details}</p>
          )}
          <div className="tl-actions">
            {long && (
              <button type="button" className="linkbtn" onClick={() => setExpanded((x) => ({ ...x, [e.id]: !open }))}>
                {open ? 'Show less' : 'Show more'}
              </button>
            )}
            {e.event && (
              <button type="button" className="linkbtn" onClick={() => openEdit(e.event!)}>Edit</button>
            )}
            {e.href && !e.event && (
              <Link className="linkbtn" href={e.href}>Open</Link>
            )}
          </div>
        </div>
      </li>,
    );
  });

  return (
    <section className="dashsection timeline" id="timeline">
      <div className="tl-head">
        <h2>Case timeline</h2>
        <div className="tl-headbtns">
          <button type="button" className="btn small ghost" onClick={printTimeline} disabled={shown.length === 0}>
            <Icon name="printer" size={15} /> Print
          </button>
          <button type="button" className="btn small primary" onClick={() => openNew()}>
            + Add event
          </button>
        </div>
      </div>
      <p className="fineprint">
        Everything about this case in date order — the events you record here, plus the documents,
        deadlines, letters, court mail, and hearing already on the case.
      </p>

      {upcoming && (
        <p className="tl-next">
          <Icon name="calendar" size={16} /> Next up: <strong>{upcoming.title}</strong> — {fmtDay(upcoming.date)}
          {upcoming.time ? ` at ${fmtTime(upcoming.time)}` : ''}
        </p>
      )}

      <div className="tl-controls">
        <div className="mailfolders" role="tablist" aria-label="Show" data-noswipe>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`mailfolder${filter === f.id ? ' sel' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="foldercount">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="tl-tools">
          <div className="mailsearch">
            <Icon name="search" size={16} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the timeline…"
              aria-label="Search the timeline"
            />
          </div>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => setNewestFirst((v) => !v)}
            aria-label={newestFirst ? 'Showing newest first — switch to oldest first' : 'Showing oldest first — switch to newest first'}
          >
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mailempty">
          <Icon name="calendar" size={30} />
          <p>{q || filter !== 'all' ? 'Nothing matches.' : 'Nothing on the timeline yet.'}</p>
          {filter === 'mine' && !q && (
            <button type="button" className="btn primary" onClick={() => openNew()}>Add your first event</button>
          )}
        </div>
      ) : (
        <ol className="tl-list">{items}</ol>
      )}

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add to the timeline' : 'Edit event'}
          onClose={() => !busy && setEditing(null)}
        >
          <div className="formgrid">
            <div className="field full">
              <label htmlFor="ev-kind">What kind of event?</label>
              <select id="ev-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {CASE_EVENT_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="ev-title">Title</label>
              <input
                id="ev-title"
                value={form.title}
                maxLength={200}
                placeholder="For example: Landlord changed the locks"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-date">Date</label>
              <input id="ev-date" type="date" value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ev-time">Time (optional)</label>
              <input id="ev-time" type="time" value={form.occurredTime} onChange={(e) => setForm({ ...form, occurredTime: e.target.value })} />
            </div>
            <div className="field full">
              <label htmlFor="ev-details">Details</label>
              <textarea
                id="ev-details"
                rows={5}
                value={form.details}
                maxLength={8000}
                placeholder="What happened, in your own words. Include anything you may need to remember later."
                onChange={(e) => setForm({ ...form, details: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-loc">Where (optional)</label>
              <input id="ev-loc" value={form.location} maxLength={300} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ev-people">Who was involved (optional)</label>
              <input id="ev-people" value={form.people} maxLength={500} onChange={(e) => setForm({ ...form, people: e.target.value })} />
            </div>
          </div>
          {err && <p className="error">{err}</p>}
          <div className="choices">
            <button type="button" className="btn primary" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : editing === 'new' ? 'Add to timeline' : 'Save changes'}
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
            {editing !== 'new' && (
              <button type="button" className="btn ghost tl-del" disabled={busy} onClick={() => setConfirmDel(editing)}>
                Delete
              </button>
            )}
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Delete this event?" onClose={() => !busy && setConfirmDel(null)}>
          <p>“{confirmDel.title}” will be removed from the timeline. This can’t be undone.</p>
          <div className="choices">
            <button type="button" className="btn dangerbtn" disabled={busy} onClick={() => remove(confirmDel)}>Delete</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => setConfirmDel(null)}>Keep it</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
