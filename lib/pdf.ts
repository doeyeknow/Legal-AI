import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import type { MotionDef, Answers } from './motions/types';
import { fill, DISCLAIMER } from './motions/types';
import { isCriminalAdversarial, statePartyName } from './state-party';

const INK = rgb(0.08, 0.08, 0.1);
const GRAY = rgb(0.35, 0.35, 0.38);
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const TEXT_W = PAGE_W - MARGIN * 2;

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  y = PAGE_H - MARGIN;
  regular!: PDFFont;
  bold!: PDFFont;
  italic!: PDFFont;

  async init(doc: PDFDocument) {
    this.doc = doc;
    this.regular = await doc.embedFont(StandardFonts.TimesRoman);
    this.bold = await doc.embedFont(StandardFonts.TimesRomanBold);
    this.italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
    this.page.drawText(DISCLAIMER, {
      x: MARGIN,
      y: 40,
      size: 8,
      font: this.italic,
      color: GRAY,
    });
  }

  ensure(space: number) {
    if (this.y - space < MARGIN + 30) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  para(text: string, opts?: { size?: number; bold?: boolean; italic?: boolean; indent?: number; spaceAfter?: number; align?: 'left' | 'center' }) {
    const size = opts?.size ?? 12;
    const font = opts?.bold ? this.bold : opts?.italic ? this.italic : this.regular;
    const indent = opts?.indent ?? 0;
    const lines = this.wrap(text, font, size, TEXT_W - indent);
    for (const ln of lines) {
      this.ensure(size + 5);
      let x = MARGIN + indent;
      if (opts?.align === 'center') {
        x = (PAGE_W - font.widthOfTextAtSize(ln, size)) / 2;
      }
      this.page.drawText(ln, { x, y: this.y - size, size, font, color: INK });
      this.y -= size + 5;
    }
    this.y -= opts?.spaceAfter ?? 8;
  }

  heading(text: string) {
    this.ensure(30);
    this.y -= 6;
    this.para(text.toUpperCase(), { bold: true, size: 12, spaceAfter: 4 });
  }

  line() {
    this.ensure(14);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.75,
      color: INK,
    });
    this.y -= 14;
  }

  gap(n = 10) {
    this.y -= n;
  }
}

function partyLine(a: Answers): {
  title: string; filer: string; opp: string;
  first: string; firstRole: string; second: string; secondRole: string;
} {
  const role = (a.filerRole || 'Plaintiff').toLowerCase();
  const isFam = role === 'petitioner' || role === 'respondent';
  const filerRoleLabel = a.filerRole || 'Plaintiff';
  const oppRoleLabel = isFam
    ? role === 'petitioner'
      ? 'Respondent'
      : 'Petitioner'
    : role === 'plaintiff'
      ? 'Defendant'
      : 'Plaintiff';
  const filerName = a.fullName || '__________';
  const oppName = a.opposingParty || '__________';
  // Captions are ordered by ROLE, not by who happens to be filing:
  // the plaintiff/petitioner side heads the caption. When the filer
  // is the defendant or respondent (a criminal defendant, a person
  // answering a case), the other side leads — e.g. "State of New
  // Mexico, Plaintiff, v. <filer>, Defendant."
  const filerLeads = role !== 'defendant' && role !== 'respondent';
  const first = filerLeads ? filerName : oppName;
  const firstRole = filerLeads ? filerRoleLabel : oppRoleLabel;
  const second = filerLeads ? oppName : filerName;
  const secondRole = filerLeads ? oppRoleLabel : filerRoleLabel;
  return {
    title: `${first}, ${firstRole}, v. ${second}, ${secondRole}`,
    filer: filerRoleLabel,
    opp: oppRoleLabel,
    first, firstRole, second, secondRole,
  };
}

/** The matter name for an in-re caption, sourced from what the
 *  filing is actually about (never a typed "other party"): the
 *  protected person (guardianships), dedicated name fields
 *  (adoption / minor name change), the decedent (estates), or the
 *  filer themselves (name change, emancipation, record relief). */
export function inReMatter(a: Answers): string {
  return (
    a.protectedPerson ||
    a.childCurrentName ||
    a.childName ||
    a.adopteeName ||
    (a.decedentName ? `Estate of ${a.decedentName}` : '') ||
    a.opposingParty ||
    a.fullName ||
    '__________'
  );
}

export interface PdfInput {
  motion: MotionDef;
  answers: Answers;
  signaturePngDataUrl?: string | null;
  feeWaiverAdded?: boolean;
  /** Confirmed court-mail facts for the case (lib/inbox.ts
   *  getCaseFacts — CONFIRMED facts only, ever). Rendered as an
   *  underlay beneath every fill() call: the filer's own answers
   *  always win, and anything unconfirmed is never in this bag. */
  caseFacts?: Answers;
}

export async function generateMotionPdf(input: PdfInput): Promise<Uint8Array> {
  const { motion } = input;
  // Criminal matters: the other side is the State, derived from
  // the state answer here in the generator itself, so EVERY
  // generation path (interview, checkout return, dashboard
  // re-download) captions it correctly even when the stored
  // answers never carried an opposingParty (the interview never
  // asks for one in a criminal case).
  const a: Answers =
    isCriminalAdversarial(motion) && !(input.answers.opposingParty || '').trim() && input.answers.state
      ? { ...input.answers, opposingParty: statePartyName(input.answers.state) }
      : input.answers;
  const facts = input.caseFacts || {};
  const doc = await PDFDocument.create();
  const w = new Writer();
  await w.init(doc);
  const roles = partyLine(a);
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ---------- Caption ----------
  w.para(`IN THE ${a.courtName && a.courtName.toLowerCase() !== 'not sure' ? a.courtName.toUpperCase() : `DISTRICT COURT OF ${(a.county || '__________').toUpperCase()} COUNTY`}`, { bold: true, align: 'center', spaceAfter: 2 });
  w.para(`${(a.state || '').toUpperCase()}`, { bold: true, align: 'center', spaceAfter: 10 });
  w.gap(4);
  if (motion.captionStyle === 'in-re') {
    // Non-adversarial matters (probate, guardianship, name change):
    // the caption names the matter itself, sourced from the
    // motion's own answers — see inReMatter.
    w.para(`IN RE: ${inReMatter(a).toUpperCase()}`, { bold: true, align: 'center', spaceAfter: 6 });
  } else {
    w.para(`${roles.first},`, { spaceAfter: 0 });
    w.para(`${roles.firstRole},`, { indent: 36, spaceAfter: 6 });
    w.para('v.', { indent: 36, spaceAfter: 6 });
    w.para(`${roles.second},`, { spaceAfter: 0 });
    w.para(`${roles.secondRole}.`, { indent: 36, spaceAfter: 4 });
  }
  w.para(`Case No.: ${a.caseNumber && a.caseNumber.toLowerCase() !== 'none' ? a.caseNumber : '__________________'}`, { align: 'center', spaceAfter: 2 });
  w.line();

  // ---------- Title ----------
  w.para(motion.name.toUpperCase(), { bold: true, align: 'center', size: 13, spaceAfter: 4 });
  if (input.feeWaiverAdded) {
    w.para('(with Request to Waive Filing Fees attached)', { italic: true, align: 'center', size: 11 });
  }
  w.gap(4);

  // ---------- Introduction ----------
  w.heading('Introduction');
  w.para(
    `${a.fullName || 'The undersigned'}, appearing pro se (self-represented), respectfully submits this ${motion.name}. ${motion.purpose}`
  );

  // ---------- Statement of facts / body ----------
  w.heading(motion.bodyHeading || 'Statement of Facts and Grounds');
  if (motion.bodyTemplate && motion.bodyTemplate.length) {
    for (const p of motion.bodyTemplate) w.para(fill(p, { ...facts, ...a }));
  } else {
    // No prose template: the grounds are composed from each field's
    // declarative `statement` template (or, failing that, the answer
    // standing alone as the assertion). The interview question
    // (f.label) is NEVER printed — the document states facts; it
    // does not show the questions that gathered them.
    let n = 1;
    for (const f of motion.fields) {
      const v = a[f.key];
      if (!v || !v.trim()) continue;
      const text = f.statement
        ? fill(f.statement, { ...facts, ...a, value: v.trim() })
        : v.trim();
      w.para(`${n}. ${text}`);
      n++;
    }
    w.para(
      'The grounds for this motion are as stated above. The undersigned asks the Court to consider the facts stated here together with any supporting documents attached to this filing.'
    );
  }
  if (motion.warning) {
    w.para(`Note acknowledged by the filer at the time of preparation: ${motion.warning}`, { italic: true, size: 11 });
  }

  // ---------- Prayer ----------
  w.heading(motion.prayerHeading || 'Prayer for Relief');
  w.para(fill(motion.prayer, { ...facts, ...a }));

  w.gap(6);
  w.para('Respectfully submitted,', { spaceAfter: 14 });

  // ---------- Signature block ----------
  if (input.signaturePngDataUrl) {
    try {
      const b64 = input.signaturePngDataUrl.split(',')[1];
      const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
      const img = await doc.embedPng(bytes);
      const dims = img.scaleToFit(220, 55);
      w.ensure(dims.height + 10);
      w.page.drawImage(img, { x: MARGIN, y: w.y - dims.height, width: dims.width, height: dims.height });
      w.y -= dims.height + 2;
    } catch {
      w.para('/s/ ' + (a.fullName || ''), { spaceAfter: 2 });
    }
  } else {
    w.para('___________________________________', { spaceAfter: 2 });
  }
  w.para(a.fullName || '', { spaceAfter: 0 });
  w.para('Appearing pro se', { italic: true, size: 11, spaceAfter: 0 });
  w.para(a.address || '', { spaceAfter: 0 });
  w.para(`${a.phone || ''}${a.email ? ' · ' + a.email : ''}`, { spaceAfter: 0 });
  w.para(`Date signed: ${today}`, { spaceAfter: 10 });

  // ---------- Verification (affidavit-bearing motions + fee waiver) ----------
  if (motion.needsAffidavit || input.feeWaiverAdded) {
    w.heading('Verification');
    w.para(
      `I, ${a.fullName || 'the undersigned'}, declare under penalty of perjury under the laws of the State of ${a.state || '__________'} that the facts stated in this document are true and correct to the best of my knowledge and belief.`
    );
    w.para(`Signed on ${today}.`, { spaceAfter: 12 });
    w.para('___________________________________', { spaceAfter: 2 });
    w.para(`${a.fullName || ''}, appearing pro se`, { spaceAfter: 10 });
  }

  // ---------- Certificate of conference ----------
  if (motion.needsConferenceCert) {
    w.heading('Certificate of Conference');
    w.para(
      `I certify that before filing this motion I conferred, or made good-faith attempts to confer, with ${a.opposingParty || 'the opposing party'}${a.opposingAttorney && a.opposingAttorney.toLowerCase() !== 'none' ? ` through counsel, ${a.opposingAttorney}` : ''} in an effort to resolve the matters raised in this motion without court action, as described in the motion.`
    );
    w.para(`Signed on ${today} by ${a.fullName || 'the undersigned'}.`, { spaceAfter: 10 });
  }

  // ---------- Certificate of service ----------
  w.heading('Certificate of Service');
  w.para(
    `I certify that on ${today} I served a true copy of this ${motion.name} on ${a.opposingAttorney && a.opposingAttorney.toLowerCase() !== 'none' ? a.opposingAttorney + ', attorney for ' : ''}${a.opposingParty || 'the opposing party'} by mail, email/e-service, or hand delivery, as permitted by the rules of this Court.`
  );
  w.para('___________________________________', { spaceAfter: 2 });
  w.para(`${a.fullName || ''}, appearing pro se`, { spaceAfter: 10 });

  // ---------- Proposed order ----------
  if (motion.needsProposedOrder) {
    w.newPage();
    w.para('PROPOSED ORDER', { bold: true, align: 'center', size: 13, spaceAfter: 4 });
    w.para(
      motion.captionStyle === 'in-re' ? `In re: ${inReMatter(a)}` : roles.title,
      { align: 'center', size: 11, spaceAfter: 2 }
    );
    w.para(`Case No.: ${a.caseNumber && a.caseNumber.toLowerCase() !== 'none' ? a.caseNumber : '__________________'}`, { align: 'center', size: 11 });
    w.gap(8);
    w.para(
      `On this day the Court considered the ${motion.name} filed by ${a.fullName || 'the movant'}. Having considered the motion and any response, the Court finds that the motion should be:`
    );
    w.gap(8);
    w.para('[ ]  GRANTED     [ ]  DENIED     [ ]  GRANTED IN PART as follows:', { spaceAfter: 16 });
    for (let i = 0; i < 5; i++) w.para('____________________________________________________________________', { spaceAfter: 12 });
    w.para('IT IS HEREBY ORDERED accordingly.', { spaceAfter: 24 });
    w.para('___________________________________', { spaceAfter: 2 });
    w.para('Judge', { spaceAfter: 0 });
    w.para(`Date: __________________`, { spaceAfter: 10 });
    if (motion.id === 'fee-waiver') {
      w.para('(Self-help fee-waiver packets instruct filers to leave this order blank for the judge. It is intentionally unfilled.)', { italic: true, size: 11 });
    }
  }

  // ---------- IFP add-on ----------
  if (input.feeWaiverAdded) {
    w.newPage();
    w.para('REQUEST TO WAIVE FILING FEES (IN FORMA PAUPERIS)', { bold: true, align: 'center', size: 12 });
    w.gap(4);
    w.para(
      `${a.fullName || 'The undersigned'} asks the Court to waive the filing fees and costs in this case because I cannot afford them. Household: ${a.ifpHousehold || '__________'}. Monthly income: ${a.ifpIncome || '__________'}. Means-tested benefits received: ${a.ifpBenefits || '__________'}. Essential monthly expenses: ${a.ifpExpenses || '__________'}. Cash and bank balances: ${a.ifpAssets || '__________'}. I declare under penalty of perjury that the foregoing is true and correct.`
    );
    w.gap(10);
    w.para(`Signed on ${today}.`, { spaceAfter: 12 });
    w.para('___________________________________', { spaceAfter: 2 });
    w.para(`${a.fullName || ''}, appearing pro se`, { spaceAfter: 10 });
  }

  doc.setTitle(`${motion.name} — ${a.fullName || 'pro se'}`);
  doc.setAuthor('legal.eyeknow.app (document preparation)');
  return doc.save();
}
