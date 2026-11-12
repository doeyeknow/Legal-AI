// Who the "other side" is in a criminal / post-conviction matter:
// the STATE, never a person the user must name. Shared by the
// interview (question skipping + answer mirroring) and the PDF
// generator (caption fill for any generation path).
import type { MotionDef } from './motions/types';

export const CRIMINAL_CATEGORY = 'Criminal & Post-Conviction';

/** Criminal / post-conviction motions with an adversarial
 *  caption: the other side is the State. */
export function isCriminalAdversarial(m: MotionDef): boolean {
  return m.category === CRIMINAL_CATEGORY && m.captionStyle !== 'in-re';
}

export const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** How the prosecuting side is captioned for a state answer:
 *  "State of New Mexico"; "The People of the State of …" for CA/NY. */
export function statePartyName(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  const code = t.length === 2
    ? t.toUpperCase()
    : Object.keys(US_STATE_NAMES).find((k) => US_STATE_NAMES[k].toLowerCase() === t.toLowerCase());
  const name = code && US_STATE_NAMES[code] ? US_STATE_NAMES[code] : t;
  if (name === 'California') return 'The People of the State of California';
  if (name === 'New York') return 'The People of the State of New York';
  return `State of ${name}`;
}
