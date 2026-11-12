// Minimal plain-text PDF (for court-communication drafts the user
// sends themselves). Serif body, wrapped lines, disclaimer footer —
// the same look as the motion PDFs, without the motion machinery.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DISCLAIMER } from './motions/types';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const TEXT_W = PAGE_W - MARGIN * 2;

export async function generateTextPdf(title: string, body: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const ink = rgb(0.08, 0.08, 0.1);
  const gray = rgb(0.35, 0.35, 0.38);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const footer = () => {
    page.drawText(DISCLAIMER, { x: MARGIN, y: 40, size: 8, font: italic, color: gray });
  };
  footer();
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    footer();
  };
  const drawLine = (text: string, font = regular, size = 12) => {
    if (y - size < MARGIN + 30) newPage();
    page.drawText(text, { x: MARGIN, y: y - size, size, font, color: ink });
    y -= size + 5;
  };
  const wrap = (text: string, size: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (regular.widthOfTextAtSize(test, size) > TEXT_W && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  };

  if (title.trim()) {
    for (const ln of wrap(title.trim(), 13)) drawLine(ln, bold, 13);
    y -= 8;
  }
  for (const para of body.split(/\n\s*\n/)) {
    const flat = para.replace(/\s*\n\s*/g, ' ').trim();
    if (!flat) continue;
    for (const ln of wrap(flat, 12)) drawLine(ln);
    y -= 8;
  }
  doc.setTitle(title || 'Court communication draft');
  doc.setAuthor('legal.eyeknow.app (document preparation)');
  return doc.save();
}
