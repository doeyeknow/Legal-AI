// AI writing assist — the ONE place the app talks to a language
// model. It is used for exactly one job: rewording text the user
// already wrote so it reads more professionally. It never invents
// facts, never files or sends anything, and its output is always
// shown to the user as a suggestion they accept or reject.
//
// Provider: any OpenAI-compatible Chat Completions API.
//   AI_API_KEY (or OPENAI_API_KEY)   — required to enable the feature
//   AI_BASE_URL  default https://api.openai.com/v1
//   AI_MODEL     default gpt-4o-mini
// Without a key the feature reports itself as unavailable (503)
// and the interview simply skips the offer.

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
}

export interface RewriteItem { key: string; label: string; text: string }

const SYSTEM_STATEMENTS = `You are an editor helping a self-represented person (no lawyer) polish the written statements in a court document they are preparing.

Rewrite each statement so it is clear, concise, respectful, and professional in tone — the way a careful paralegal would phrase it for a judge.

Strict rules:
- Keep EVERY fact exactly: names, dates, times, amounts, addresses, case numbers, places, and the order of events. Never add, remove, guess, or change a fact.
- Do not add legal arguments, statutes, case citations, or claims the person did not make. Do not give legal advice.
- Keep the person's point of view (first person "I" stays "I"; third person stays third person).
- Remove slang, profanity, insults, emotional exaggeration, and repetition; keep the substance of what happened and what they are asking for.
- Use plain, formal English in complete sentences. No markdown, no bullet symbols unless the original was a list, no headings.
- If a statement is already professional, return it with only light edits.
- Keep each rewrite roughly the same length or shorter than the original.

Return JSON only: {"items":[{"key":"<same key>","text":"<rewritten statement>"}]} with one entry per input item, same keys.`;

const SYSTEM_EMAIL = `You are an editor helping a self-represented person write a short, professional email about their court case (to a court clerk, a judge's staff, or the other side).

Rewrite the email body to be clear, polite, concise, and professional.

Strict rules:
- Keep every fact exactly (names, dates, case numbers, amounts). Never add facts, promises, legal arguments, or citations.
- Keep the sender's intent and requests. Remove slang, insults, and emotional language.
- Plain text only, no markdown. Keep a simple greeting and sign-off if the original had one; do not invent a name for the signature.

Return JSON only: {"items":[{"key":"<same key>","text":"<rewritten email body>"}]}.`;

export async function rewriteProfessionally(
  items: RewriteItem[],
  opts: { purpose: 'statements' | 'email'; context?: string },
): Promise<{ ok: true; items: { key: string; text: string }[] } | { ok: false; status: number; message: string }> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 503, message: 'The AI rewrite isn’t set up on this site yet.' };
  }
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const user = JSON.stringify({
    context: opts.context || undefined,
    items: items.map((i) => ({ key: i.key, question: i.label, text: i.text })),
  });

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.purpose === 'email' ? SYSTEM_EMAIL : SYSTEM_STATEMENTS },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { ok: false, status: 502, message: 'The AI service could not be reached. Your original text is unchanged.' };
  }
  if (!res.ok) {
    return { ok: false, status: 502, message: 'The AI rewrite failed. Your original text is unchanged.' };
  }
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = data?.choices?.[0]?.message?.content || '';
  let parsed: { items?: { key?: unknown; text?: unknown }[] } | null = null;
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    parsed = null;
  }
  const wanted = new Set(items.map((i) => i.key));
  const out = (parsed?.items || [])
    .filter((i): i is { key: string; text: string } => typeof i?.key === 'string' && typeof i?.text === 'string')
    .filter((i) => wanted.has(i.key) && i.text.trim())
    .map((i) => ({ key: i.key, text: i.text.trim().slice(0, 8000) }));
  if (!out.length) {
    return { ok: false, status: 502, message: 'The AI rewrite came back empty. Your original text is unchanged.' };
  }
  return { ok: true, items: out };
}
