import type { MotionDef } from './types';
import { ALL_MOTIONS } from './data';

const STOP = new Set(
  'the a an and or of to in on for my i me we they them he she it is was are be been have has had can cant cannot want need get got judge court case filed filing motion order please help'.split(' ')
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export interface MatchResult {
  motion: MotionDef;
  score: number;
}

/**
 * v1 matching: keyword/situation overlap scoring over the catalog's own
 * situation descriptions. No external AI API — deterministic and offline.
 */
export function matchSituation(text: string, limit = 3): MatchResult[] {
  const q = new Set(tokens(text));
  const qRaw = text.toLowerCase();
  const scored = ALL_MOTIONS.map((m) => {
    let score = 0;
    for (const kw of m.keywords) {
      const k = kw.toLowerCase();
      if (k.includes(' ')) {
        if (qRaw.includes(k)) score += 6;
      } else if (q.has(k)) {
        score += 3;
      }
    }
    for (const sit of m.situations) {
      for (const t of tokens(sit)) if (q.has(t)) score += 1;
    }
    for (const t of tokens(m.name)) if (q.has(t)) score += 2;
    return { motion: m, score };
  }).filter((r) => r.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export function getMotion(id: string): MotionDef | undefined {
  return ALL_MOTIONS.find((m) => m.id === id);
}
