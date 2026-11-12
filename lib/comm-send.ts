// Sending a drafted court communication by email, from the
// user's OWN court-mail address (<slug>-<token>@inbox domain),
// via Resend. Pure transport + formatting only — no database or
// node-only imports — so the compose UI can share the exact From
// formatting the server sends with.
//
// The From is always the user's own inbox address (minted
// server-side in lib/inbox.ts), never anything the client asks
// for, and reply_to is the same address, so a court's reply lands
// in the user's court-mail inbox and is scanned like all inbound
// mail. Sending is a single deliberate user action from the
// compose form — nothing in the app sends automatically.

/** The From header for an app-sent email: the user's profile
 *  name (when they have one) over their own court-mail address. */
export function formatFromHeader(fullName: string, address: string): string {
  const name = (fullName || '').replace(/["<>\\]/g, '').trim();
  return name ? `${name} <${address}>` : address;
}

export type CommSendResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'domain_not_verified' | 'provider'; message: string };

/** One send through Resend's API. A failure is reported in plain
 *  words and NOTHING is recorded anywhere — the caller logs only
 *  on success. A domain whose sending records are not verified in
 *  Resend is called out as exactly that (kind domain_not_verified)
 *  instead of a generic failure. */
export async function sendViaResend(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo: string;
}): Promise<CommSendResult> {
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
  } catch {
    return {
      ok: false,
      kind: 'provider',
      message:
        'The email could not be sent — the mail service could not be reached. Nothing was sent or logged.',
    };
  }
  const data = (await res.json().catch(() => null)) as {
    id?: string;
    name?: string;
    message?: string;
  } | null;
  if (res.ok && data?.id) return { ok: true, id: data.id };
  const detail = `${data?.name || ''} ${data?.message || ''}`.trim();
  if (
    (res.status === 403 || res.status === 422) &&
    /domain/i.test(detail) &&
    /verif/i.test(detail)
  ) {
    return {
      ok: false,
      kind: 'domain_not_verified',
      message:
        "Resend says this domain can't send yet — the sending records for the court-mail domain are not verified in Resend, so the email was not sent. Nothing was logged.",
    };
  }
  return {
    ok: false,
    kind: 'provider',
    message: detail
      ? `The email could not be sent (Resend: ${detail}). Nothing was sent or logged.`
      : `The email could not be sent (Resend answered ${res.status}). Nothing was sent or logged.`,
  };
}
