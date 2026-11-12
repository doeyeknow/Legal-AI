'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Modal from './Modal';
import { Icon } from './icons';
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

export default function InboxPage() {
  const [messages, setMessages] = useState<InboundMessage[] | null>(null);
  const [unreviewed, setUnreviewed] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboundMessageDetail | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [caseFacts, setCaseFacts] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [caseFilter, setCaseFilter] = useState<string | null>(null);

  const loadList = useCallback(async (filter: string | null) => {
    try {
      const qs = filter ? `?caseId=${encodeURIComponent(filter)}` : '';
      const res = await fetch(`/api/inbox${qs}`);
      if (res.status === 401 || res.status === 503) {
        setError('Sign in to see your court mail.');
        setMessages([]);
        return;
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setUnreviewed(data.unreviewed || 0);
    } catch {
      setError('Your court mail could not be loaded.');
      setMessages([]);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/inbox/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setDetail(data.message || null);
    } catch {
      /* keep the list visible */
    }
  }, []);

  useEffect(() => {
    const filter = new URLSearchParams(window.location.search).get('case');
    setCaseFilter(filter);
    loadList(filter);
    fetch('/api/cases')
      .then((r) => (r.ok ? r.json() : { cases: [] }))
      .then((d) => setCases((d.cases || []).filter((c: CaseSummary) => c.status !== 'Draft')))
      .catch(() => undefined);
    const sel = new URLSearchParams(window.location.search).get('message');
    if (sel) {
      setSelectedId(sel);
      loadDetail(sel);
    }
  }, [loadList, loadDetail]);

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

  const caseName = useCallback(
    (id: string | null) => {
      if (!id) return null;
      const c = cases.find((x) => x.id === id);
      return c ? c.title : 'a case';
    },
    [cases],
  );

  async function refresh(id?: string) {
    await loadList(caseFilter);
    if (id || selectedId) await loadDetail(id || selectedId!);
  }

  const proposed = useMemo(
    () => (detail?.facts || []).filter((f) => f.status === 'proposed'),
    [detail],
  );
  const decided = useMemo(
    () => (detail?.facts || []).filter((f) => f.status !== 'proposed'),
    [detail],
  );

  async function markStatus(status: 'filed' | 'dismissed') {
    if (!detail) return;
    await fetch(`/api/inbox/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
    await refresh(detail.id);
  }

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

  return (
    <div className="dashpage">
      <h1>
        <Icon name="mail" size={26} /> Court mail
      </h1>
      <p className="lede">
        Mail sent to your court-mail address is read for the facts your cases need — dates,
        deadlines, case numbers. <strong>Nothing is added to a case until you confirm it</strong>,
        and nothing here is ever filed, sent, or answered automatically.
      </p>
      <InboxAddressCard compact />
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
      <div className="inboxlayout">
        <div className="inboxlist" role="list">
          {messages === null && <p className="fineprint">Loading…</p>}
          {messages !== null && messages.length === 0 && (
            <p className="fineprint">
              No court mail yet. Give your address to the court clerk or the other side, or
              forward court email to it, and it will appear here.
            </p>
          )}
          {(messages || []).map((m) => (
            <button
              key={m.id}
              type="button"
              className={`inboxitem${selectedId === m.id ? ' sel' : ''}`}
              onClick={() => { setSelectedId(m.id); loadDetail(m.id); }}
            >
              <span className="inboxitem-top">
                <strong>{m.fromName || m.fromEmail || 'Unknown sender'}</strong>
                <span className="fineprint">{fmtDate(m.receivedAt)}</span>
              </span>
              <span className="inboxitem-subj">{m.subject || '(no subject)'}</span>
              <span className="inboxitem-chips">
                <span className="dirbadge from_court">{DOC_TYPE_LABELS[m.docType] || 'Court mail'}</span>
                {m.caseId && <span className="dirbadge">{caseName(m.caseId)}</span>}
                {m.proposedCount > 0 && (
                  <span className="statuspill draft">{m.proposedCount} to review</span>
                )}
                {m.status === 'failed' && <span className="statuspill">Couldn’t be read</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="inboxdetail">
          {!detail && (
            <p className="fineprint">Pick a message to read it and review what was found in it.</p>
          )}
          {detail && (
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
            />
          )}
        </div>
      </div>
    </div>
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
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const needsAssign = !detail.caseId || detail.caseMatch === 'proposed';
  const numFact = detail.facts.find((f) => f.kind === 'case_number');

  return (
    <article className="inboxmsg">
      <h2>{detail.subject || '(no subject)'}</h2>
      <p className="fineprint">
        From {detail.fromName ? `${detail.fromName} <${detail.fromEmail}>` : detail.fromEmail} ·{' '}
        {fmtDate(detail.receivedAt)} · {DOC_TYPE_LABELS[detail.docType] || 'Court mail'}
        {detail.isForward ? ' · forwarded' : ''}
      </p>
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
        <h3>The message</h3>
        <div className="inboxbody">{detail.bodyText || '(no readable text in this message)'}</div>
        {detail.attachments.length > 0 && (
          <ul className="doclist">
            {detail.attachments.map((a) => (
              <li key={a.id} className="docitem">
                <span>
                  <Icon name="doc" size={18} /> {a.filename}
                  <span className="fineprint"> · {Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
                </span>
                {a.stored ? (
                  <a className="btn" href={`/api/inbox/${detail.id}/attachments/${a.id}`}>Download</a>
                ) : (
                  <span className="fineprint">Too large to store here — open the original email to get it.</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashsection">
        <h3>Respond to this mail</h3>
        {!detail.caseId && (
          <p className="fineprint">
            Assign this message to a case above first — replies and response documents are built
            from the case’s confirmed facts.
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
                <p className="fineprint">
                  Or draft a letter back. A template is pre-picked for this kind of mail — change
                  it freely. The To is prefilled with the sender: you can send the finished letter
                  by email from your own court-mail address right here, or copy it and send it
                  through the court’s own channels.
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
              </div>
            )}
          </>
        )}
        <div className="choices">
          {detail.status !== 'filed' && (
            <button className="btn ghost" onClick={() => onMark('filed')}>Mark reviewed</button>
          )}
          {detail.status !== 'dismissed' && (
            <button className="btn ghost" onClick={() => onMark('dismissed')}>Dismiss this mail</button>
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
