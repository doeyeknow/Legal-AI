'use client';

import { Icon } from './icons';

/** Digits-only phone formatting: (555) 014-2288 as it is typed. */
export function formatPhone(s: string): string {
  const d = s.replace(/\D/g, '').slice(0, 10);
  if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return d;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', 'back'];

/** A phone dial pad for `type: 'phone'` interview questions. The
 *  composer's input stays editable and shows the formatted number;
 *  the pad just types into it — the gold send button submits. */
export default function DialPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === '+') {
      if (!value.trim().startsWith('+')) onChange('+' + value);
      return;
    }
    if (value.replace(/\D/g, '').length >= 10) return; // US 10 digits
    onChange(formatPhone(value + k));
  };
  return (
    <div className="dialpad" role="group" aria-label="Phone dial pad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className="dialkey"
          onClick={() => press(k)}
          aria-label={k === 'back' ? 'Delete last digit' : k}
        >
          {k === 'back' ? <Icon name="backspace" size={22} /> : k}
        </button>
      ))}
    </div>
  );
}
