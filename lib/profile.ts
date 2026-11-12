// Shared account-profile shape: the basic info the court forms need.
// Client-safe (no server imports) — used by the account page, the
// interview prefill, and the auth API. Email lives on the account
// itself, not in this profile block.

export interface ProfileInfo {
  fullName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export const EMPTY_PROFILE: ProfileInfo = {
  fullName: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
};

export interface ProfileFieldDef {
  key: keyof ProfileInfo;
  label: string;
  autoComplete?: string;
  full?: boolean;
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'fullName', label: 'Full legal name', autoComplete: 'name', full: true },
  { key: 'street', label: 'Street address', autoComplete: 'street-address', full: true },
  { key: 'city', label: 'City', autoComplete: 'address-level2' },
  { key: 'state', label: 'State', autoComplete: 'address-level1' },
  { key: 'zip', label: 'ZIP code', autoComplete: 'postal-code' },
  { key: 'phone', label: 'Phone number', autoComplete: 'tel' },
];

/** One-line mailing address for the PDF signature block, composed
 *  from the discrete profile parts: "123 Main St, Taos, NM 87571". */
export function composeAddress(p: {
  street: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const stateZip = [p.state, p.zip]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ');
  return [p.street, p.city, stateZip]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ');
}
