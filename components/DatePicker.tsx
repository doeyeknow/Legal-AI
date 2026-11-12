'use client';

import { useState } from 'react';
import Modal from './Modal';

/**
 * A calendar date picker for the interview's date questions
 * (dates of death, citation dates, court dates, birthdays…).
 * Picks one day and hands back a plain-English date string
 * ("March 5, 1988") that reads naturally in the document's
 * statements — the same format a typed answer would use.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** "March 5, 1988" — matches how a person would type it. */
export function formatDate(y: number, m: number, d: number): string {
  return `${MONTHS[m]} ${d}, ${y}`;
}

export default function DatePicker({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sel, setSel] = useState<{ y: number; m: number; d: number } | null>(null);

  const firstDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };
  const pick = (d: number) => {
    setSel({ y: year, m: month, d });
    onPick(formatDate(year, month, d));
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="calwrap">
        <div className="calhead">
          <button type="button" className="calnav" aria-label="Previous month" onClick={prevMonth}>
            ‹
          </button>
          <div className="caltitle">
            <strong>{MONTHS[month]}</strong>
            <select
              className="calyear"
              aria-label="Year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: now.getFullYear() + 6 - 1899 }, (_, i) => now.getFullYear() + 5 - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button type="button" className="calnav next" aria-label="Next month" onClick={nextMonth}>
            ›
          </button>
        </div>
        <div className="caldow">
          {DOW.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="calgrid">
          {weeks.flat().map((d, i) => (
            d === null ? (
              <span key={i} className="calday empty" />
            ) : (
              <button
                key={i}
                type="button"
                className={`calday${sel && sel.y === year && sel.m === month && sel.d === d ? ' sel' : ''}${
                  now.getFullYear() === year && now.getMonth() === month && now.getDate() === d ? ' today' : ''
                }`}
                onClick={() => pick(d)}
              >
                {d}
              </button>
            )
          ))}
        </div>
      </div>
    </Modal>
  );
}
