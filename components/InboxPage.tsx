'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Modal from './Modal';
import DocPreview, { type PreviewTarget } from './DocPreview';
import { Icon, type IconName } from './icons';
import { setUnreadCount, refreshUnreadCount, badgeLabel } from '@/lib/unread-store';
import CommDraft from './CommDraft';
import InboxAddressCard from './InboxAddress';
import {
  DOC_TYPE_COMM_TEMPLATE,
  DOC_TYPE_RESPONSE_MOTIONS,
  OPPOSING_MOTION_RESPONSES,
  summonsMotionsForCaseType,
} from '@/lib/inbox-options';
import type {
  CaseDetail,
  CaseSummary,
  ExtractedFact,
  InboundMessage,
  InboundMessageDetail,
  InboxFolder,
} from '@/lib/dashboard-types';
import type { Answers } from '@/lib/motions/types';

const DOC_TYPE_LABELS: Record<string, string> = {
  hearing_notice: 'Hearing notice',
  scheduling_order: 'Scheduling order',
  order: 'Court order',
  continuance_ruling: 'Continuance ruling',
  efiling_confirmation: 'E-filing confirmation',
  summons_or_complaint: 'Summons / complaint',
  opposing_letter: 'Letter from the other side',
  judgment: 'Judgment',
  other: 'Court mail',
};

const FACT_LABELS: Record<string, string> = {
  hearing_date: 'Hearing date',
  hearing_time: 'Hearing time',
  trial_date: 'Trial date',
  deadline: 'Deadline',
  response_due: 'Response due',
  discovery_due: 'Discovery due',
  order_date: 'Order date',
  filed_date: 'Filed date',
  service_date: 'Service date',
  case_number: 'Case number',
  court_name: 'Court',
  judge_name: 'Judge',
  opposing_party: 'Other party',
  opposing_attorney: 'Opposing attorney',
  join_info: 'Join information',
  mentioned_date: 'Date mentioned',
};

const CONFIDENCE_WORDS: Record<string, string> = {
  high: 'Found in the email',
  medium: 'Found — please check',
  low: 'Possible — is this right?',
};

/** What confirming a fact will do — said plainly before it happens. */
function appliedSummary(fact: ExtractedFact): string {
  switch (fact.kind) {
    case 'hearing_date':
    case 'hearing_time':
      return 'Adds the hearing to the case (date under Deadlines, and the hearing on the case’s appearance card).';
    case 'response_due':
    case 'deadline':
    case 'discovery_due':
    case 'trial_date':
      return 'Adds this date to the case’s Deadlines.';
    case 'case_number':
      return 'Sets the case number on the case, if it doesn’t have one yet.';
    case 'court_name':
      return 'Sets the court on the case, if it isn’t set yet.';
    default:
      return 'Saves this to the case’s confirmed facts, so documents you generate for this case can use it.';
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const FOLDERS: { id: InboxFolder; label: string; icon: IconName }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  { id: 'unread', label: 'Unread', icon: 'mail' },
  { id: 'starred', label: 'Starred', icon: 'star' },
  { id: 'archived', label: 'Archived', icon: 'archive' },
  { id: 'trash', label: 'Trash', icon: 'trash' },
];

const EMPTY_COUNTS: InboxCounts = { unread: 0, inbox: 0, starred: 0, archived: 0, trash: 0 };

interface InboxCounts { unread: number; inbox: number; starred: number; archived: number; trash: number }
type Action = 'read' | 'unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'restore';

/** List dates: the time for today's mail, the weekday this week,
 *  otherwise the date. */
function fmtListDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function senderOf(m: { fromName: string; fromEmail: string }): string {
  return m.fromName || m.fromEmail || 'Unknown sender';
}

function escapeHtml(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Print one message: a clean letter-style page (headers, body,
 *  attachment names, and any replies sent from here) handed to the
 *  print dialog through a hidden frame. */
function printMessage(d: InboundMessageDetail) {
  const rows = [
    ['From', d.fromName ? `${d.fromName} <${d.fromEmail}>` : d.fromEmail],
    ['To', (d.toAddresses || []).join(', ')],
    ['Date', fmtDateTime(d.receivedAt)],
    ['Subject', d.subject || '(no subject)'],
  ].filter(([, v]) => v);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.subject || 'Court mail')}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 32px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  table { border-collapse: collapse; margin-bottom: 18px; font-size: 13.5px; }
  td { padding: 2px 14px 2px 0; vertical-align: top; }
  td:first-child { color: #555; font-weight: bold; }
  .body { white-space: pre-wrap; font-size: 14.5px; border-top: 1px solid #bbb; padding-top: 14px; }
  .att { margin-top: 18px; font-size: 13px; color: #333; }
  .reply { margin-top: 22px; border-top: 1px dashed #999; padding-top: 12px; }
  .reply h2 { font-size: 14px; margin: 0 0 6px; }
  .foot { margin-top: 28px; font-size: 11px; color: #777; }
</style></head><body>
<h1>${escapeHtml(d.subject || '(no subject)')}</h1>
<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
<div class="body">${escapeHtml(d.bodyText || '(no readable text in this message)')}</div>
${d.attachments.length ? `<div class="att"><strong>Attachments:</strong> ${d.attachments.map((a) => escapeHtml(a.filename)).join(', ')}</div>` : ''}
${(d.replies || []).map((r) => `<div class="reply"><h2>${r.kind === 'forward' ? 'Forwarded' : 'Replied'} to ${escapeHtml(r.toEmail)} — ${escapeHtml(fmtDateTime(r.sentAt))}</h2><div class="body">${escapeHtml(r.body)}</div></div>`).join('')}
<p class="foot">Printed from quikForm court mail.</p>
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
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch { /* print blocked */ }
    setTimeout(() => frame.remove(), 60_000);
  }, 150);
}

interface Undo { label: string; ids: string[]; undo: Action }

export default function InboxPage() {
  const [messages, setMessages] = useState<InboundMessage[] | null>(null);
  const [unreviewed, setUnreviewed] = useState(0);
  const [counts, setCounts] = useState<InboxCounts>(EMPTY_COUNTS);
  const [folder, setFolder] = useState<InboxFolder>('inbox');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<InboundMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [caseFacts, setCaseFacts] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [caseFilter, setCaseFilter] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeInit | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'forever'; ids: string[] } | { kind: 'empty' }>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async (f: InboxFolder, q: string, filter: string | null) => {
    try {
      const qs = new URLSearchParams({ folder: f });
      if (q) qs.set('q', q);
      if (filter) qs.set('caseId', filter);
      const res = await fetch(`/api/inbox?${qs}`, { cache: 'no-store' });
      if (res.status === 401 || res.status === 503) {
        setError('Sign in to see your court mail.');
        setMessages([]);
        return;
      }
      const data = await res.json();
      setError(null);
      setMessages(data.messages || []);
      setUnreviewed(data.unreviewed || 0);
      if (data.counts) {
        setCounts(data.counts);
        setUnreadCount(data.counts.unread);
      }
    } catch {
      setError('Your court mail could not be loaded.');
      setMessages([]);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/inbox/${id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const m: InboundMessageDetail | null = data.message || null;
      setDetail(m);
      // Opening a message marks it read.
      if (m && !m.read) {
        await fetch(`/api/inbox/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read' }),
        }).catch(() => undefined);
        setDetail({ ...m, read: true });
        setMessages((list) => list && list.map((x) => (x.id === id ? { ...x, read: true } : x)));
        setCounts((c) => ({ ...c, unread: Math.max(0, c.unread - 1) }));
        void refreshUnreadCount();
      }
    } catch {
      /* keep the list visible */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('case');
    setCaseFilter(filter);
    loadList('inbox', '', filter);
    fetch('/api/cases')
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((d) => setCases((d.cases || []).filter((c: CaseSummary) => c.status !== 'Draft')))
      .catch(() => undefined);
    const sel = params.get('message');
    if (sel) {
      setSelectedId(sel);
      loadDetail(sel);
    }
  }, [loadList, loadDetail]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setChecked(new Set());
    loadList(folder, query, caseFilter);
  }, [folder, query, caseFilter, loadList]);

  // Keep the list fresh while the page is open (new mail arrives).
  useEffect(() => {
    const iv = setInterval(() => {
      if (!document.hidden) loadList(folder, query, caseFilter);
    }, 45_000);
    return () => clearInterval(iv);
  }, [folder, query, caseFilter, loadList]);

  // When the open message is assigned to a case, load the case (for
  // the reply drafter) and its confirmed facts.
  useEffect(() => {
    if (!detail?.caseId) {
      setCaseDetail(null);
      setCaseFacts({});
      return;
    }
    fetch(`/api/cases/${detail.caseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCaseDetail(d?.case || null))
      .catch(() => setCaseDetail(null));
    fetch(`/api/cases/${detail.caseId}/facts`)
      .then((r) => (r.ok ? r.json() : { facts: {} }))
      .then((d) => setCaseFacts(d.facts || {}))
      .catch(() => setCaseFacts({}));
  }, [detail?.caseId, detail?.id]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const caseName = useCallback(
    (id: string | null) => {
      if (!id) return null;
      const c = cases.find((x) => x.id === id);
      return c ? c.title : 'a case';
    },
    [cases],
  );

  async function refresh(id?: string) {
    await loadList(folder, query, caseFilter);
    if (id || selectedId) await loadDetail(id || selectedId!);
  }

  function openMessage(id: string) {
    setSelectedId(id);
    setDetail(null);
    loadDetail(id);
    const url = new URL(window.location.href);
    url.searchParams.set('message', id);
    window.history.replaceState(null, '', url.toString());
  }

  function closeMessage() {
    setSelectedId(null);
    setDetail(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('message');
    window.history.replaceState(null, '', url.toString());
  }

  const list = messages || [];
  const idx = selectedId ? list.findIndex((m) => m.id === selectedId) : -1;
  const prevId = idx > 0 ? list[idx - 1].id : null;
  const nextId = idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null;

  /** Apply a mailbox action to some messages, optimistically. Moves
   *  that take mail out of the current folder offer an Undo. */
  async function act(ids: string[], action: Action, opts: { quiet?: boolean } = {}) {
    if (!ids.length) return;
    const leaves =
      (action === 'archive' && folder !== 'starred') ||
      action === 'trash' ||
      (action === 'unarchive' && folder === 'archived') ||
      (action === 'restore' && folder === 'trash') ||
      (action === 'read' && folder === 'unread') ||
      (action === 'unstar' && folder === 'starred');
    const patch = (m: InboundMessage): InboundMessage => {
      switch (action) {
        case 'read': return { ...m, read: true };
        case 'unread': return { ...m, read: false };
        case 'star': return { ...m, starred: true };
        case 'unstar': return { ...m, starred: false };
        case 'archive': return { ...m, archived: true, read: true };
        case 'unarchive': return { ...m, archived: false };
        case 'trash': return { ...m, deleted: true, read: true };
        case 'restore': return { ...m, deleted: false };
      }
    };
    const set = new Set(ids);
    // Where to go next when the open message leaves the folder.
    let after: string | null = null;
    if (selectedId && set.has(selectedId) && leaves) {
      const rest = list.filter((m) => !set.has(m.id));
      const pos = list.findIndex((m) => m.id === selectedId);
      after = rest.length ? (rest[Math.min(pos, rest.length - 1)]?.id ?? null) : null;
    }
    setMessages((l) => l && (leaves ? l.filter((m) => !set.has(m.id)) : l.map((m) => (set.has(m.id) ? patch(m) : m))));
    if (detail && set.has(detail.id)) {
      setDetail({ ...detail, ...patch(detail) } as InboundMessageDetail);
    }
    setChecked(new Set());
    if (selectedId && set.has(selectedId) && leaves) {
      const wide = window.matchMedia('(min-width: 761px)').matches;
      if (after && wide) openMessage(after);
      else closeMessage();
    }
    try {
      const res = await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json().catch(() => null);
      if (data?.counts) { setCounts(data.counts); setUnreadCount(data.counts.unread); }
    } catch {
      setNotice('That didn’t save — check your connection.');
      loadList(folder, query, caseFilter);
      return;
    }
    if (opts.quiet) return;
    const n = ids.length;
    const what = n === 1 ? 'Message' : `${n} messages`;
    const labels: Partial<Record<Action, [string, Action]>> = {
      archive: [`${what} archived.`, 'unarchive'],
      trash: [`${what} moved to the Trash.`, 'restore'],
      unarchive: [`${what} moved to the Inbox.`, 'archive'],
      restore: [`${what} restored.`, 'trash'],
    };
    const l = labels[action];
    if (l) setUndo({ label: l[0], ids, undo: l[1] });
  }

  async function runUndo() {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    await act(u.ids, u.undo, { quiet: true });
    await loadList(folder, query, caseFilter);
  }

  async function deleteForever(ids: string[]) {
    const res = await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action: 'delete_forever' }),
    }).catch(() => null);
    setConfirm(null);
    if (!res || !res.ok) { setNotice('Those messages could not be deleted.'); return; }
    if (selectedId && ids.includes(selectedId)) closeMessage();
    setChecked(new Set());
    setNotice(ids.length === 1 ? 'Message deleted forever.' : `${ids.length} messages deleted forever.`);
    await loadList(folder, query, caseFilter);
  }

  async function emptyTrashNow() {
    await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'empty_trash' }),
    }).catch(() => null);
    setConfirm(null);
    closeMessage();
    setNotice('Trash emptied.');
    await loadList(folder, query, caseFilter);
  }

  async function markStatus(status: 'filed' | 'dismissed') {
    if (!detail) return;
    await fetch(`/api/inbox/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
    await refresh(detail.id);
  }

  function startReply(d: InboundMessageDetail, kind: 'reply' | 'forward') {
    const quoted = (d.bodyText || '').split('\n').map((l) => `> ${l}`).join('\n');
    if (kind === 'reply') {
      setCompose({
        kind,
        messageId: d.id,
        to: d.fromEmail || '',
        subject: d.subject ? (/^re:/i.test(d.subject) ? d.subject : `Re: ${d.subject}`) : 'Re:',
        body: `\n\nOn ${fmtDateTime(d.receivedAt)}, ${senderOf(d)} wrote:\n${quoted}`,
      });
    } else {
      setCompose({
        kind,
        messageId: d.id,
        to: '',
        subject: d.subject ? (/^fwd?:/i.test(d.subject) ? d.subject : `Fwd: ${d.subject}`) : 'Fwd:',
        body:
          `\n\n---------- Forwarded message ----------\nFrom: ${d.fromName ? `${d.fromName} <${d.fromEmail}>` : d.fromEmail}\n` +
          `Date: ${fmtDateTime(d.receivedAt)}\nSubject: ${d.subject || '(no subject)'}\n\n${d.bodyText || ''}` +
          (d.attachments.length
            ? `\n\n(Attachments on the original: ${d.attachments.map((a) => a.filename).join(', ')} — attach them from your own mail if the recipient needs them.)`
            : ''),
      });
    }
  }

  // Keyboard shortcuts (desktop): j/k move, r reply, f forward,
  // e archive, # or Delete trash, u mark unread, s star, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (compose || preview || confirm) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || t.closest('.modalbackdrop'))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if ((k === 'j' || k === 'ArrowDown') && list.length) {
        e.preventDefault();
        openMessage(nextId || (idx < 0 ? list[0].id : list[idx].id));
      } else if ((k === 'k' || k === 'ArrowUp') && prevId) {
        e.preventDefault();
        openMessage(prevId);
      } else if (!detail) {
        return;
      } else if (k === 'r') { e.preventDefault(); startReply(detail, 'reply'); }
      else if (k === 'f') { e.preventDefault(); startReply(detail, 'forward'); }
      else if (k === 'e') { e.preventDefault(); act([detail.id], detail.archived ? 'unarchive' : 'archive'); }
      else if (k === '#' || k === 'Delete') { e.preventDefault(); if (!detail.deleted) act([detail.id], 'trash'); }
      else if (k === 'u') { e.preventDefault(); act([detail.id], 'unread', { quiet: true }); closeMessage(); }
      else if (k === 's') { e.preventDefault(); act([detail.id], detail.starred ? 'unstar' : 'star', { quiet: true }); }
      else if (k === 'p') { e.preventDefault(); printMessage(detail); }
      else if (k === 'Escape') { closeMessage(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const proposed = useMemo(
    () => (detail?.facts || []).filter((f) => f.status === 'proposed'),
    [detail],
  );
  const decided = useMemo(
    () => (detail?.facts || []).filter((f) => f.status !== 'proposed'),
    [detail],
  );

  const responseMotions = useMemo(() => {
    if (!detail) return [];
    if (detail.docType === 'summons_or_complaint') {
      // Cases don't carry a debt/foreclosure/eviction tag of their
      // own, so the general Answer is offered; the interview's own
      // guidance covers the specialized answers.
      return summonsMotionsForCaseType('');
    }
    if (
      detail.docType === 'opposing_letter' ||
      /^motion\s/i.test(detail.subject) ||
      /\bmotion\b/i.test(detail.subject)
    ) {
      return OPPOSING_MOTION_RESPONSES;
    }
    return DOC_TYPE_RESPONSE_MOTIONS[detail.docType] || [];
  }, [detail, caseDetail]);

  const checkedIds = Array.from(checked);
  const checkedMsgs = list.filter((m) => checked.has(m.id));
  const allChecked = list.length > 0 && checkedIds.length === list.length;
  const anyUnreadChecked = checkedMsgs.some((m) => !m.read);
  const toggleCheck = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const folderLabel = FOLDERS.find((f) => f.id === folder)?.label || 'Inbox';

  return (
    <div className={`dashpage inboxpage${selectedId ? ' reading' : ''}`}>
      <div className="inboxhead">
        <h1>
          <Icon name="mail" size={26} /> Court mail
          {counts.unread > 0 && <span className="newbadge big">{badgeLabel(counts.unread)} new</span>}
        </h1>
        <p className="lede">
          Mail sent to your court-mail address is read for the dates, deadlines, and case numbers
          your cases need. <strong>Nothing is added to a case until you confirm it</strong>, and
          nothing is ever filed, sent, or answered automatically.
        </p>
        <InboxAddressCard compact />
      </div>
      {error && <p className="error">{error}</p>}
      {caseFilter && (
        <p className="fineprint">
          Showing mail for {caseName(caseFilter) || 'this case'}.{' '}
          <Link href="/dashboard/inbox">Show all court mail</Link>
        </p>
      )}
      {unreviewed > 0 && (
        <p className="savednote">
          {unreviewed} message{unreviewed === 1 ? '' : 's'} with facts waiting for your review.
        </p>
      )}

      <div className="mailbar">
        <div className="mailfolders" role="tablist" aria-label="Folders" data-noswipe>
          {FOLDERS.map((f) => {
            const n = f.id === 'inbox' || f.id === 'unread' ? counts.unread : f.id === 'trash' ? counts.trash : f.id === 'archived' ? counts.archived : f.id === 'starred' ? counts.starred : 0;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={folder === f.id}
                className={`mailfolder${folder === f.id ? ' sel' : ''}`}
                onClick={() => { setFolder(f.id); closeMessage(); }}
              >
                <Icon name={f.icon} size={15} />
                {f.label}
                {n > 0 && (
                  <span className={`foldercount${(f.id === 'inbox' || f.id === 'unread') ? ' hot' : ''}`}>{badgeLabel(n)}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mailsearch">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${folderLabel.toLowerCase()}…`}
            aria-label="Search court mail"
          />
          <button type="button" className="iconbtn" aria-label="Refresh" title="Refresh" onClick={() => refresh()}>
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      <div className="inboxlayout">
        <div className="inboxlistpane">
          <div className="bulkbar">
            <label className="bulkall">
              <input
                type="checkbox"
                checked={allChecked}
                aria-label={allChecked ? 'Select none' : 'Select all'}
                onChange={() => setChecked(allChecked ? new Set() : new Set(list.map((m) => m.id)))}
              />
            </label>
            {checkedIds.length === 0 ? (
              <span className="fineprint">
                {messages === null ? 'Loading…' : `${list.length} message${list.length === 1 ? '' : 's'}`}
              </span>
            ) : (
              <span className="bulkactions">
                <span className="fineprint">{checkedIds.length} selected</span>
                {folder === 'trash' ? (
                  <>
                    <button type="button" className="iconbtn" title="Restore" aria-label="Restore" onClick={() => act(checkedIds, 'restore')}><Icon name="restore" size={17} /></button>
                    <button type="button" className="iconbtn danger" title="Delete forever" aria-label="Delete forever" onClick={() => setConfirm({ kind: 'forever', ids: checkedIds })}><Icon name="trash" size={17} /></button>
                  </>
                ) : (
                  <>
                    {folder === 'archived' ? (
                      <button type="button" className="iconbtn" title="Move to Inbox" aria-label="Move to Inbox" onClick={() => act(checkedIds, 'unarchive')}><Icon name="unarchive" size={17} /></button>
                    ) : (
                      <button type="button" className="iconbtn" title="Archive" aria-label="Archive" onClick={() => act(checkedIds, 'archive')}><Icon name="archive" size={17} /></button>
                    )}
                    <button type="button" className="iconbtn" title="Delete" aria-label="Delete" onClick={() => act(checkedIds, 'trash')}><Icon name="trash" size={17} /></button>
                    <button
                      type="button"
                      className="iconbtn"
                      title={anyUnreadChecked ? 'Mark as read' : 'Mark as unread'}
                      aria-label={anyUnreadChecked ? 'Mark as read' : 'Mark as unread'}
                      onClick={() => act(checkedIds, anyUnreadChecked ? 'read' : 'unread', { quiet: true })}
                    >
                      <Icon name={anyUnreadChecked ? 'mailOpen' : 'mail'} size={17} />
                    </button>
                    <button type="button" className="iconbtn" title="Star" aria-label="Star" onClick={() => act(checkedIds, 'star', { quiet: true })}><Icon name="star" size={17} /></button>
                  </>
                )}
              </span>
            )}
            {folder === 'trash' && counts.trash > 0 && checkedIds.length === 0 && (
              <button type="button" className="btn ghost small bulkempty" onClick={() => setConfirm({ kind: 'empty' })}>
                Empty trash
              </button>
            )}
          </div>
          <div className="inboxlist" role="list" ref={listRef}>
            {messages !== null && list.length === 0 && (
              <div className="mailempty">
                <Icon name={FOLDERS.find((f) => f.id === folder)?.icon || 'inbox'} size={34} />
                <p>
                  {query
                    ? `No mail matches “${query}”.`
                    : folder === 'inbox'
                      ? 'No court mail yet. Give your address to the court clerk or the other side, or forward court email to it, and it will appear here.'
                      : folder === 'unread'
                        ? 'You’re all caught up — no unread mail.'
                        : folder === 'starred'
                          ? 'Star important mail to find it here quickly.'
                          : folder === 'archived'
                            ? 'Archived mail is kept here, out of your inbox.'
                            : 'The Trash is empty.'}
                </p>
              </div>
            )}
            {list.map((m) => (
              <div
                key={m.id}
                role="listitem"
                className={`inboxitem${selectedId === m.id ? ' sel' : ''}${m.read ? '' : ' unread'}${checked.has(m.id) ? ' checked' : ''}`}
              >
                <input
                  type="checkbox"
                  className="inboxcheck"
                  checked={checked.has(m.id)}
                  onChange={() => toggleCheck(m.id)}
                  aria-label={`Select message from ${senderOf(m)}`}
                />
                <button type="button" className="inboxitem-main" onClick={() => openMessage(m.id)}>
                  <span className="inboxitem-top">
                    {!m.read && <span className="unreaddot" aria-label="New" />}
                    <strong className="inboxitem-from">{senderOf(m)}</strong>
                    <span className="inboxitem-date">{fmtListDate(m.receivedAt)}</span>
                  </span>
                  <span className="inboxitem-subj">
                    {m.subject || '(no subject)'}
                  </span>
                  {m.snippet && <span className="inboxitem-snip">{m.snippet}</span>}
                  <span className="inboxitem-chips">
                    {!m.read && <span className="statuspill new">New</span>}
                    <span className="dirbadge from_court">{DOC_TYPE_LABELS[m.docType] || 'Court mail'}</span>
                    {m.caseId && <span className="dirbadge">{caseName(m.caseId)}</span>}
                    {m.proposedCount > 0 && (
                      <span className="statuspill draft">{m.proposedCount} to review</span>
                    )}
                    {m.attachmentCount > 0 && (
                      <span className="chipicon" title={`${m.attachmentCount} attachment${m.attachmentCount === 1 ? '' : 's'}`}>
                        <Icon name="paperclip" size={13} />{m.attachmentCount}
                      </span>
                    )}
                    {m.replyCount > 0 && (
                      <span className="chipicon" title="You replied"><Icon name="reply" size={13} /></span>
                    )}
                    {m.status === 'failed' && <span className="statuspill">Couldn’t be read</span>}
                  </span>
                </button>
                <button
                  type="button"
                  className={`staricon${m.starred ? ' on' : ''}`}
                  aria-label={m.starred ? 'Unstar' : 'Star'}
                  aria-pressed={m.starred}
                  onClick={() => act([m.id], m.starred ? 'unstar' : 'star', { quiet: true })}
                >
                  <Icon name={m.starred ? 'starFill' : 'star'} size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="inboxdetail">
          {!selectedId && (
            <div className="mailempty desk">
              <Icon name="mailOpen" size={38} />
              <p>Pick a message to read it and review what was found in it.</p>
              <p className="fineprint">Shortcuts: j / k to move, r reply, f forward, e archive, # delete, p print.</p>
            </div>
          )}
          {selectedId && !detail && (
            <p className="fineprint">{detailLoading ? 'Opening…' : 'This message could not be opened.'}</p>
          )}
          {detail && (
            <>
              <div className="msgtoolbar" role="toolbar" aria-label="Message actions">
                <button type="button" className="iconbtn backonly" aria-label="Back to list" onClick={closeMessage}>
                  <Icon name="chevronLeft" size={20} />
                </button>
                {detail.deleted ? (
                  <>
                    <button type="button" className="toolbtn" onClick={() => act([detail.id], 'restore')}>
                      <Icon name="restore" size={17} /><span>Restore</span>
                    </button>
                    <button type="button" className="toolbtn danger" onClick={() => setConfirm({ kind: 'forever', ids: [detail.id] })}>
                      <Icon name="trash" size={17} /><span>Delete forever</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="toolbtn primary" onClick={() => startReply(detail, 'reply')} disabled={!detail.fromEmail}>
                      <Icon name="reply" size={17} /><span>Reply</span>
                    </button>
                    <button type="button" className="toolbtn" onClick={() => startReply(detail, 'forward')}>
                      <Icon name="forward" size={17} /><span>Forward</span>
                    </button>
                    <button type="button" className="toolbtn" onClick={() => act([detail.id], detail.archived ? 'unarchive' : 'archive')}>
                      <Icon name={detail.archived ? 'unarchive' : 'archive'} size={17} />
                      <span>{detail.archived ? 'Unarchive' : 'Archive'}</span>
                    </button>
                    <button type="button" className="toolbtn" onClick={() => act([detail.id], 'trash')}>
                      <Icon name="trash" size={17} /><span>Delete</span>
                    </button>
                  </>
                )}
                <button type="button" className="toolbtn" onClick={() => printMessage(detail)}>
                  <Icon name="printer" size={17} /><span>Print</span>
                </button>
                <span className="toolspacer" />
                <button
                  type="button"
                  className="iconbtn"
                  title="Mark as unread"
                  aria-label="Mark as unread"
                  onClick={() => { act([detail.id], 'unread', { quiet: true }); closeMessage(); }}
                >
                  <Icon name="mail" size={17} />
                </button>
                <button
                  type="button"
                  className={`iconbtn staricon${detail.starred ? ' on' : ''}`}
                  aria-label={detail.starred ? 'Unstar' : 'Star'}
                  aria-pressed={detail.starred}
                  onClick={() => act([detail.id], detail.starred ? 'unstar' : 'star', { quiet: true })}
                >
                  <Icon name={detail.starred ? 'starFill' : 'star'} size={17} />
                </button>
                <button type="button" className="iconbtn" aria-label="Previous message" disabled={!prevId} onClick={() => prevId && openMessage(prevId)}>‹</button>
                <button type="button" className="iconbtn" aria-label="Next message" disabled={!nextId} onClick={() => nextId && openMessage(nextId)}>›</button>
              </div>
              <MessageView
                detail={detail}
                cases={cases}
                caseDetail={caseDetail}
                caseFacts={caseFacts}
                proposed={proposed}
                decided={decided}
                responseMotions={responseMotions}
                onChanged={() => refresh(detail.id)}
                onAssigned={(caseId) => {
                  setDetail({ ...detail, caseId, caseMatch: caseId ? 'confirmed' : 'none' });
                  refresh(detail.id);
                }}
                onMark={markStatus}
                onReply={() => startReply(detail, 'reply')}
                onPreview={setPreview}
              />
            </>
          )}
        </div>
      </div>

      {compose && (
        <ComposeModal
          init={compose}
          onClose={() => setCompose(null)}
          onSent={async (msg) => {
            setCompose(null);
            setNotice(msg);
            await refresh(compose.messageId);
          }}
        />
      )}
      {preview && <DocPreview target={preview} onClose={() => setPreview(null)} />}
      {confirm && (
        <Modal
          title={confirm.kind === 'empty' ? 'Empty the Trash?' : 'Delete forever?'}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.kind === 'empty'
              ? `All ${counts.trash} message${counts.trash === 1 ? '' : 's'} in the Trash will be permanently deleted.`
              : `${confirm.ids.length === 1 ? 'This message' : `These ${confirm.ids.length} messages`} will be permanently deleted, with ${confirm.ids.length === 1 ? 'its' : 'their'} attachments.`}{' '}
            Facts you already confirmed into a case stay in the case. This cannot be undone.
          </p>
          <div className="choices">
            <button
              type="button"
              className="btn dangerbtn"
              onClick={() => (confirm.kind === 'empty' ? emptyTrashNow() : deleteForever(confirm.ids))}
            >
              <Icon name="trash" size={15} /> Delete forever
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {(undo || notice) && (
        <div className="snackbar" role="status">
          <span>{undo ? undo.label : notice}</span>
          {undo && <button type="button" className="snackbtn" onClick={runUndo}>Undo</button>}
        </div>
      )}
    </div>
  );
}

interface ComposeInit {
  kind: 'reply' | 'forward';
  messageId: string;
  to: string;
  subject: string;
  body: string;
}

/** Reply / forward sheet. Sending is one deliberate tap; nothing
 *  here sends on its own. "Polish with AI" rewrites only what the
 *  user typed above the quoted original, and shows it for approval. */
function ComposeModal({
  init,
  onClose,
  onSent,
}: {
  init: ComposeInit;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [to, setTo] = useState(init.to);
  const [subject, setSubject] = useState(init.subject);
  const [body, setBody] = useState(init.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch('/api/inbox/address')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFrom(d?.address || null))
      .catch(() => undefined);
    setTimeout(() => {
      const el = bodyRef.current;
      if (el) { el.focus(); el.setSelectionRange(0, 0); el.scrollTop = 0; }
    }, 80);
  }, []);

  // The user's own words: everything above the quoted original.
  const splitAt = (() => {
    const markers = ['\n\nOn ', '\n\n---------- Forwarded message'];
    let best = -1;
    for (const m of markers) {
      const i = body.indexOf(m);
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    return best;
  })();
  const own = splitAt >= 0 ? body.slice(0, splitAt) : body;
  const rest = splitAt >= 0 ? body.slice(splitAt) : '';

  async function polish() {
    if (!own.trim()) { setError('Write your message first, then polish it.'); return; }
    setPolishing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ key: 'email', label: `An email ${init.kind === 'reply' ? 'reply' : 'forward note'} about a court matter`, text: own.trim() }],
          purpose: 'email',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message || 'The AI rewrite isn’t available right now.'); return; }
      const t = data.items?.[0]?.text;
      if (t) setSuggestion(t);
    } catch {
      setError('The AI rewrite isn’t available right now.');
    } finally {
      setPolishing(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/${init.messageId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: init.kind, to, subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || 'The email could not be sent.');
        return;
      }
      onSent(init.kind === 'reply' ? `Reply sent to ${to}.` : `Forwarded to ${to}.`);
    } catch {
      setError('The email could not be sent — check your connection.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Copying isn’t allowed here — select the text and copy it yourself.');
    }
  }

  return (
    <Modal
      title={init.kind === 'reply' ? 'Reply' : 'Forward'}
      onClose={onClose}
      size="wide"
      footer={
        <div className="choices composefoot">
          <button type="button" className="btn primary" disabled={busy || !to.trim() || !subject.trim() || !body.trim()} onClick={send}>
            <Icon name={init.kind === 'reply' ? 'reply' : 'forward'} size={16} /> {busy ? 'Sending…' : 'Send'}
          </button>
          <button type="button" className="btn" disabled={polishing} onClick={polish}>
            <Icon name="sparkle" size={16} /> {polishing ? 'Polishing…' : 'Polish with AI'}
          </button>
          <button type="button" className="btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Discard</button>
        </div>
      }
    >
      {from && <p className="fineprint composefrom">From: {from}</p>}
      <div className="field full">
        <label htmlFor="cmp-to">To</label>
        <input id="cmp-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" autoComplete="email" />
      </div>
      <div className="field full">
        <label htmlFor="cmp-subj">Subject</label>
        <input id="cmp-subj" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field full">
        <label htmlFor="cmp-body">Message</label>
        <textarea id="cmp-body" ref={bodyRef} className="composebody" value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
      </div>
      {suggestion && (
        <div className="aisuggest">
          <p className="aisuggest-head"><Icon name="sparkle" size={15} /> Suggested rewrite — review it before using it</p>
          <div className="aisuggest-text">{suggestion}</div>
          <div className="choices">
            <button type="button" className="btn primary small" onClick={() => { setBody(suggestion + rest); setSuggestion(null); }}>Use this</button>
            <button type="button" className="btn ghost small" onClick={() => setSuggestion(null)}>Keep mine</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="fineprint">
        Sent from your court-mail address, so any answer comes back to this inbox. Read it over
        before sending — once sent, an email can’t be taken back.
      </p>
    </Modal>
  );
}

function MessageView({
  detail,
  cases,
  caseDetail,
  caseFacts,
  proposed,
  decided,
  responseMotions,
  onChanged,
  onAssigned,
  onMark,
  onReply,
  onPreview,
}: {
  detail: InboundMessageDetail;
  cases: CaseSummary[];
  caseDetail: CaseDetail | null;
  caseFacts: Answers;
  proposed: ExtractedFact[];
  decided: ExtractedFact[];
  responseMotions: { id: string; label: string }[];
  onChanged: () => void;
  onAssigned: (caseId: string | null) => void;
  onMark: (status: 'filed' | 'dismissed') => void;
  onReply: () => void;
  onPreview: (t: PreviewTarget) => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const needsAssign = !detail.caseId || detail.caseMatch === 'proposed';
  const numFact = detail.facts.find((f) => f.kind === 'case_number');
  const initial = (senderOf(detail).trim()[0] || '?').toUpperCase();

  return (
    <article className="inboxmsg">
      <h2>{detail.subject || '(no subject)'}</h2>
      <div className="msgfrom">
        <span className="avatar" aria-hidden="true">{initial}</span>
        <span className="msgfrom-texts">
          <strong>{senderOf(detail)}</strong>
          {detail.fromName && <span className="fineprint"> &lt;{detail.fromEmail}&gt;</span>}
          <span className="fineprint block">
            {fmtDateTime(detail.receivedAt)} · {DOC_TYPE_LABELS[detail.docType] || 'Court mail'}
            {detail.isForward ? ' · forwarded' : ''}
            {detail.archived ? ' · archived' : ''}
            {detail.deleted ? ' · in the Trash' : ''}
          </span>
        </span>
      </div>
      {detail.authWarning && (
        <p className="draftbanner">
          <strong>Check this sender carefully.</strong> This message failed its sender
          authentication checks (SPF/DKIM), so it may not really be from who it claims to be.
          Everything found in it is marked down a confidence level — verify dates with the
          clerk before relying on them.
        </p>
      )}
      {detail.status === 'failed' && (
        <p className="draftbanner">
          We couldn’t read this message. It is kept here as it arrived; try again later or open
          the original in your own mailbox.
        </p>
      )}

      <section className="dashsection msgbodysec">
        <div className="inboxbody">{detail.bodyText || '(no readable text in this message)'}</div>
        {detail.attachments.length > 0 && (
          <ul className="attlist">
            {detail.attachments.map((a) => {
              const url = `/api/inbox/${detail.id}/attachments/${a.id}`;
              return (
                <li key={a.id} className="attitem">
                  <span className="atticon" aria-hidden="true"><Icon name="doc" size={20} /></span>
                  <span className="atttexts">
                    <strong>{a.filename}</strong>
                    <span className="fineprint">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
                  </span>
                  {a.stored ? (
                    <span className="attbtns">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => onPreview({ title: a.filename, url, contentType: a.contentType })}
                      >
                        <Icon name="eye" size={15} /> Preview
                      </button>
                      <a className="btn small ghost" href={url}><Icon name="download" size={15} /></a>
                    </span>
                  ) : (
                    <span className="fineprint">Too large to store here — open the original email to get it.</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detail.replies.length > 0 && (
        <section className="dashsection">
          <h3>Sent from here</h3>
          <ul className="sentlist">
            {detail.replies.map((r) => (
              <li key={r.id} className="sentitem">
                <p className="fineprint">
                  <Icon name={r.kind === 'forward' ? 'forward' : 'reply'} size={13} />{' '}
                  {r.kind === 'forward' ? 'Forwarded' : 'Replied'} to {r.toEmail} · {fmtDateTime(r.sentAt)}
                </p>
                <details>
                  <summary>{r.subject}</summary>
                  <div className="inboxbody small">{r.body}</div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!detail.deleted && detail.fromEmail && (
        <button type="button" className="quickreply" onClick={onReply}>
          <Icon name="reply" size={16} /> Reply to {senderOf(detail)}…
        </button>
      )}

      {needsAssign && (
        <section className="savednote inboxassign">
          <p>
            {detail.caseId
              ? 'This looks like it belongs to one of your cases — confirm which one:'
              : numFact
                ? `This mail names case number ${numFact.valueText}, which isn’t on any of your cases yet. Which case does it belong to?`
                : 'Which case does this belong to?'}
          </p>
          <div className="choices">
            <button className="btn primary" onClick={() => setAssignOpen(true)}>
              Choose the case
            </button>
          </div>
        </section>
      )}

      {proposed.length > 0 && (
        <section className="dashsection">
          <h3>Found in this message — your call</h3>
          <p className="fineprint">
            These stay out of your case file and out of every document until you confirm them.
          </p>
          {proposed.map((f) => (
            <FactCard key={f.id} fact={f} messageId={detail.id} assigned={Boolean(detail.caseId)} onChanged={onChanged} />
          ))}
        </section>
      )}
      {decided.length > 0 && (
        <section className="dashsection">
          <h3>Already decided</h3>
          <ul className="commlist">
            {decided.map((f) => (
              <li key={f.id} className="commitem">
                <span className={`dirbadge ${f.status === 'confirmed' ? 'from_court' : ''}`}>
                  {f.status === 'confirmed' ? 'Added' : 'Dismissed'}
                </span>
                <span>
                  <strong>{FACT_LABELS[f.kind] || f.kind}:</strong> {f.valueText}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dashsection">
        <h3>Respond with a court document</h3>
        {!detail.caseId && (
          <p className="fineprint">
            Assign this message to a case above first — response documents and letters are built
            from the case’s confirmed facts. You can still reply by email any time.
          </p>
        )}
        {detail.caseId && (
          <>
            {responseMotions.length > 0 && (
              <div className="choices">
                {responseMotions.map((m) => (
                  <Link
                    key={m.id}
                    className="btn"
                    href={`/interview?motion=${m.id}&case=${detail.caseId}&fromInbox=${detail.id}`}
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
            )}
            {caseDetail && (
              <div className="inboxreply">
                {!letterOpen ? (
                  <button type="button" className="btn ghost" onClick={() => setLetterOpen(true)}>
                    Draft a formal letter from a template…
                  </button>
                ) : (
                  <>
                    <p className="fineprint">
                      A template is pre-picked for this kind of mail — change it freely. Send it
                      by email from your court-mail address, or copy it and send it through the
                      court’s own channels.
                    </p>
                    <CommDraft
                      caseData={caseDetail}
                      suggestedTemplateId={DOC_TYPE_COMM_TEMPLATE[detail.docType]}
                      facts={caseFacts}
                      initialTo={detail.fromEmail || undefined}
                      initialSubject={
                        detail.subject
                          ? /^re:/i.test(detail.subject)
                            ? detail.subject
                            : `Re: ${detail.subject}`
                          : undefined
                      }
                      onLogged={() => undefined}
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
        <div className="choices">
          {detail.status !== 'filed' && (
            <button className="btn ghost" onClick={() => onMark('filed')}>Mark reviewed</button>
          )}
          {detail.status !== 'dismissed' && (
            <button className="btn ghost" onClick={() => onMark('dismissed')}>Nothing to do here</button>
          )}
        </div>
      </section>

      {assignOpen && (
        <AssignModal
          detail={detail}
          cases={cases}
          onClose={() => setAssignOpen(false)}
          onDone={(caseId) => { setAssignOpen(false); onAssigned(caseId); }}
        />
      )}
    </article>
  );
}

function FactCard({
  fact,
  messageId,
  assigned,
  onChanged,
}: {
  fact: ExtractedFact;
  messageId: string;
  assigned: boolean;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dismissArmed, setDismissArmed] = useState(false);
  const appeal = fact.basis.startsWith('Appeal window');

  async function dismiss() {
    if (!dismissArmed) {
      setDismissArmed(true);
      return;
    }
    await fetch(`/api/inbox/${messageId}/facts/${fact.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    }).catch(() => undefined);
    onChanged();
  }

  return (
    <div className="factcard">
      <div className="factcard-head">
        <strong>{FACT_LABELS[fact.kind] || fact.kind}</strong>
        <span className={`statuspill ${fact.confidence === 'low' ? 'draft' : ''}`}>
          {CONFIDENCE_WORDS[fact.confidence]}
        </span>
      </div>
      <p className="factvalue">{fact.valueText}</p>
      {fact.span && <blockquote className="factspan">“{fact.span}”</blockquote>}
      {fact.basis && <p className="fineprint">How this was figured: {fact.basis}</p>}
      {appeal && (
        <p className="fineprint">
          <strong>Appeal windows are jurisdictional</strong> — the court usually cannot extend
          one. Verify this date with the clerk before relying on it.
        </p>
      )}
      <div className="choices">
        <button className="btn primary" onClick={() => setConfirmOpen(true)}>
          {assigned ? 'Confirm — add to my case' : 'Confirm'}
        </button>
        <button className="btn ghost" onClick={dismiss}>
          {dismissArmed ? 'Tap again to dismiss' : 'Dismiss'}
        </button>
      </div>
      {!assigned && (
        <p className="fineprint">
          Assign this message to a case (above) to file confirmed facts into it; confirming now
          saves the fact as confirmed on this message.
        </p>
      )}
      {confirmOpen && (
        <ConfirmFactModal
          fact={fact}
          messageId={messageId}
          onClose={() => setConfirmOpen(false)}
          onDone={() => { setConfirmOpen(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function ConfirmFactModal({
  fact,
  messageId,
  onClose,
  onDone,
}: {
  fact: ExtractedFact;
  messageId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const isDate = Boolean(fact.valueDate) || /date|due/i.test(fact.kind);
  const [valueText, setValueText] = useState(fact.valueText);
  const [valueDate, setValueDate] = useState(fact.valueDate || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/inbox/${messageId}/facts/${fact.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          valueText,
          valueDate: isDate && valueDate ? valueDate : undefined,
        }),
      });
      if (res.ok) onDone();
      else setError('That could not be saved — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Add to case file — ${FACT_LABELS[fact.kind] || fact.kind}`} onClose={onClose}>
      <div className="field full">
        <label htmlFor={`fact-value-${fact.id}`}>Value (edit it if the scan got it wrong)</label>
        <input
          id={`fact-value-${fact.id}`}
          value={valueText}
          onChange={(e) => setValueText(e.target.value)}
        />
      </div>
      {isDate && (
        <div className="field full">
          <label htmlFor={`fact-date-${fact.id}`}>Date</label>
          <input
            id={`fact-date-${fact.id}`}
            type="date"
            value={valueDate}
            onChange={(e) => setValueDate(e.target.value)}
          />
        </div>
      )}
      {fact.span && <blockquote className="factspan">“{fact.span}”</blockquote>}
      {fact.basis && <p className="fineprint">How this was figured: {fact.basis}</p>}
      <p className="fineprint">{appliedSummary(fact)}</p>
      <p className="fineprint">
        Once confirmed, this fact can also be used in documents you generate for this case. It
        is never used while it is only proposed.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="choices">
        <button className="btn primary" disabled={busy} onClick={confirm}>
          Add to my case file
        </button>
        <button className="btn ghost" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function AssignModal({
  detail,
  cases,
  onClose,
  onDone,
}: {
  detail: InboundMessageDetail;
  cases: CaseSummary[];
  onClose: () => void;
  onDone: (caseId: string | null) => void;
}) {
  const [picked, setPicked] = useState<string>(detail.caseId || '');
  const [setNumber, setSetNumber] = useState(true);
  const [busy, setBusy] = useState(false);
  const numFact = detail.facts.find((f) => f.kind === 'case_number');
  const pickedCase = cases.find((c) => c.id === picked);
  const numberDiffers = Boolean(
    numFact && pickedCase && (pickedCase.caseNumber || '') !== numFact.valueText,
  );

  async function save(newCase: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/inbox/${detail.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          newCase
            ? { newCase: true }
            : { caseId: picked || null, setCaseNumber: numberDiffers && setNumber },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onDone(data.caseId ?? (picked || null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Which case does this mail belong to?" onClose={onClose}>
      <div className="field full">
        <label htmlFor="assign-case">Your cases</label>
        <select id="assign-case" value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">— Not assigned —</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}{c.caseNumber ? ` (${c.caseNumber})` : ''}
            </option>
          ))}
        </select>
      </div>
      {numberDiffers && (
        <label className="checkline">
          <input
            type="checkbox"
            checked={setNumber}
            onChange={(e) => setSetNumber(e.target.checked)}
          />{' '}
          This mail names case number {numFact!.valueText} — set it on “{pickedCase!.title}”
          (it currently {pickedCase!.caseNumber ? `says ${pickedCase!.caseNumber}` : 'has none'}).
        </label>
      )}
      <div className="choices">
        <button className="btn primary" disabled={busy} onClick={() => save(false)}>
          Assign to this case
        </button>
        <button className="btn" disabled={busy} onClick={() => save(true)}>
          Start a new case from this mail
        </button>
        <button className="btn ghost" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
