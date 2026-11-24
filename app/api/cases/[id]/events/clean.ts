import { cleanDate, cleanStr } from '@/lib/api-guard';
import { CASE_EVENT_KINDS } from '@/lib/dashboard-types';
import type { CaseEventInput } from '@/lib/cases';

/** Validate an untrusted timeline-event body. */
export function cleanEventInput(
  body: Record<string, unknown> | null,
): { ok: true; input: CaseEventInput } | { ok: false; error: string } {
  const kind = cleanStr(body?.kind, 40) || 'note';
  if (!CASE_EVENT_KINDS.some((k) => k.key === kind)) return { ok: false, error: 'Unknown kind of event.' };
  const title = cleanStr(body?.title, 200);
  if (!title) return { ok: false, error: 'Give the event a short title.' };
  const occurredOn = cleanDate(body?.occurredOn);
  if (!occurredOn) return { ok: false, error: 'A valid date is required.' };
  const t = cleanStr(body?.occurredTime, 5);
  const occurredTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
  return {
    ok: true,
    input: {
      kind,
      title,
      details: cleanStr(body?.details, 8000),
      occurredOn,
      occurredTime,
      location: cleanStr(body?.location, 300),
      people: cleanStr(body?.people, 500),
    },
  };
}
