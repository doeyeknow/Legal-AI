'use client';

import { useEffect, useMemo, useState } from 'react';
import { COMM_TEMPLATES, COMM_TONE_RULES, type CommTemplate } from '@/lib/comm-templates';
import { formatFromHeader } from '@/lib/comm-send';
import type { CaseDetail, CommEntry } from '@/lib/dashboard-types';
import { COMM_METHODS } from '@/lib/dashboard-types';
import type { Answers } from '@/lib/motions/types';
import Modal from './Modal';

/** Prefill the [bracketed] blanks a template shares with the case.
 *  Anything unknown stays bracketed for the user to fill by hand.
 *  `facts`, when given, is the case's CONFIRMED court-mail facts
 *  bag — it fills the hearing date/time blanks in the inability-
 *  to-appear letter. Proposed facts are never passed here. */
export function fillTemplate(tpl: CommTemplate, c: CaseDetail, facts?: Answers): string {
  const newest = c.documents[0]?.answers || {};
  const subject = c.subjectName || newest.fullName || '';
  const opposing = newest.opposingParty || '';
  const caption =
    subject && opposing
      ? `${subject} v. ${opposing}`
      : subject || c.title;
  const map: Record<string, string> = {
    '[Your name]': subject,
    '[Printed name]': subject,
    '[Case caption]': caption,
    '[______]': c.caseNumber || '[______]',
    '[Court name]': c.courtName || newest.courtName || '',
    '[Phone]': newest.phone || '',
    '[Email]': newest.email || '',
    '[name]': opposing,
    '[other party/attorney name]': opposing,
    '[other party/attorney]': opposing,
  };
  let out = tpl.skeleton;
  for (const [token, value] of Object.entries(map)) {
    if (value) out = out.split(token).join(value);
  }
  if (facts?.hearingDate) {
    out = out.replace('appear on [date]', `appear on ${facts.hearingDate}`);
  }
  if (facts?.hearingTime) {
    out = out.replace(' at [time] ', ` at ${facts.hearingTime} `);
  }
  return out;
}

export default function CommDraft({
  caseData,
  onLogged,
  suggestedTemplateId,
  facts,
  initialTo,
  initialSubject,
}: {
  caseData: CaseDetail;
  onLogged: (c: CommEntry) => void;
  /** Court-mail deep links pre-pick the template the design maps
   *  from the message's document type. A suggestion only — the
   *  picker stays fully usable. */
  suggestedTemplateId?: string;
  /** Confirmed court-mail facts for fillTemplate (never proposed). */
  facts?: Answers;
  /** Reply prefill: the inbox review queue passes the sender's
   *  address and a Re: subject when the draft answers a message. */
  initialTo?: string;
  initialSubject?: string;
}) {
  const [tplId, setTplId] = useState<string>(suggestedTemplateId || '');
  const [text, setText] = useState('');
  const [method, setMethod] = useState<string>(COMM_METHODS[2]); // Mail
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Email compose state: recipient + subject ride alongside the
  // draft body; the From is always the user's own court-mail
  // address, fetched once and shown before anything is sent.
  const [to, setTo] = useState(
    initialTo || caseData.courtMail?.[0]?.fromEmail || '',
  );
  const [subject, setSubject] = useState(initialSubject || '');
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [myFromName, setMyFromName] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/inbox/address')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.address) {
          setMyAddress(d.address);
          setMyFromName(d.fromName || '');
        }
      })
      .catch(() => undefined);
  }, []);

  const tpl = useMemo(() => COMM_TEMPLATES.find((t) => t.id === tplId) || null, [tplId]);

  function pick(id: string) {
    setTplId(id);
    setNote(null);
    const t = COMM_TEMPLATES.find((x) => x.id === id);
    setText(t ? fillTemplate(t, caseData, facts) : '');
    if (t && !initialSubject) setSubject(t.name);
  }

  // Pre-pick the suggested template once, on mount.
  useEffect(() => {
    if (suggestedTemplateId) {
      const t = COMM_TEMPLATES.find((x) => x.id === suggestedTemplateId);
      if (t) {
        setText(fillTemplate(t, caseData, facts));
        if (!initialSubject) setSubject(t.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadPdf() {
    const res = await fetch('/api/text-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: tpl?.name || 'Court communication', text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'communication-draft.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadText() {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'communication-draft.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function logIt() {
    if (!tpl) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/comms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'to_court',
          method,
          subject: subject.trim() || tpl.name,
          body: text,
          sentAt: new Date().toISOString().slice(0, 10),
          status: 'Drafted here — not sent yet',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.comm) {
        onLogged(data.comm);
        setNote('Saved to the log below as a draft — it has not been sent. Send it from here with “Send by email”, or copy it and send it through the court’s own channels — and send a copy to the other party.');
      } else {
        setNote(data.error || 'The entry could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  // The one deliberate send action: the confirm modal shows the
  // exact From / To / Subject and the full body first; this runs
  // only from its "Send email" button. The server sends from the
  // user's own court-mail address — the client never names a From.
  async function sendNow() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/comms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseData.id,
          to: to.trim(),
          subject: subject.trim(),
          body: text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.comm) {
        onLogged(data.comm);
        setConfirmOpen(false);
        setNote(`Sent from ${data.from} to ${data.to} — it is in the log below, and any reply lands in your court-mail inbox.`);
      } else {
        setSendError(data.message || data.error || 'The email could not be sent.');
      }
    } catch {
      setSendError('The email could not be sent — the connection failed. Nothing was sent or logged.');
    } finally {
      setSending(false);
    }
  }

  const canSend =
    Boolean(to.trim()) && Boolean(subject.trim()) && Boolean(text.trim());
  const fromDisplay = myAddress ? formatFromHeader(myFromName, myAddress) : '';

  return (
    <div className="acctcard">
      <h3>Draft a communication</h3>
      <p className="fineprint">
        Pick a template; your case details fill the blanks we know, and the rest stays in
        [brackets] for you. Edit it until it says exactly what happened — then either send
        it by email from your own court-mail address right here, or copy it / download it
        and send it yourself through the court’s own channels.{' '}
        <strong>Nothing is ever sent until you review it and confirm.</strong>
      </p>
      <div className="choices wrap">
        {COMM_TEMPLATES.map((t) => (
          <button
            key={t.id}
            className={`btn ${t.id === tplId ? 'primary' : ''}`}
            onClick={() => pick(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      {tpl && (
        <div>
          <p><strong>Used when:</strong> {tpl.usedWhen}</p>
          <p className="fineprint"><strong>Must include:</strong> {tpl.requiredElements}</p>
          {tpl.toneRules && <p className="fineprint"><strong>Tone:</strong> {tpl.toneRules}</p>}
          <textarea
            className="draftarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
          />
          <div className="field">
            <label htmlFor="draft-to">Send to (one email address)</label>
            <input
              id="draft-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="clerk@the-courts-email.example"
            />
          </div>
          <div className="field">
            <label htmlFor="draft-subject">Subject</label>
            <input
              id="draft-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <p className="fineprint">
            {myAddress ? (
              <>
                “Send by email” sends from your own court-mail address,{' '}
                <strong>{myAddress}</strong> — a reply to it lands in your court-mail
                inbox, scanned like the rest of your court mail.
              </>
            ) : (
              <>“Send by email” sends from your own court-mail address — a reply to it lands in your court-mail inbox.</>
            )}
          </p>
          <div className="field">
            <label htmlFor="draft-method">How you will send it (for the log, if you log the draft)</label>
            <select id="draft-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {COMM_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="choices">
            <button
              className="btn primary"
              disabled={!canSend}
              onClick={() => { setSendError(null); setConfirmOpen(true); }}
            >
              Send by email…
            </button>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(text)}>Copy text</button>
            <button className="btn" onClick={downloadText}>Download .txt</button>
            <button className="btn" onClick={downloadPdf}>Download PDF</button>
            <button className="btn" disabled={busy} onClick={logIt}>Save draft to this case’s log</button>
          </div>
          {note && <p className="fineprint">{note}</p>}
          <details>
            <summary className="fineprint">The standing tone rules for anything sent to a court</summary>
            <ul>
              {COMM_TONE_RULES.map((r, i) => (
                <li key={i} className="fineprint">{r}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {confirmOpen && (
        <Modal title="Send this email" onClose={() => { if (!sending) setConfirmOpen(false); }}>
          <p><strong>From:</strong> {fromDisplay || 'your court-mail address'}</p>
          <p><strong>To:</strong> {to.trim()}</p>
          <p><strong>Subject:</strong> {subject.trim()}</p>
          <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
          <p className="fineprint">
            Email doesn’t replace formal service where the court requires it.
          </p>
          {sendError && <p className="fineprint">{sendError}</p>}
          <div className="choices">
            <button className="btn primary" disabled={sending} onClick={sendNow}>
              {sending ? 'Sending…' : 'Send email'}
            </button>
            <button className="btn ghost" disabled={sending} onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
