import type { MotionDef } from './motions/types';
import { resolveZip, STATE_FALLBACKS } from './courts';

export interface FilingStep {
  text: string;
  links?: { label: string; url: string }[];
}

export interface FilingInfo {
  zip: string;
  heading: string;
  countyName: string | null;
  approximate: boolean;
  steps: FilingStep[];
}

/** Build the numbered filing steps shown after PDF generation. */
export function buildFilingInfo(
  zip: string,
  stateAnswer: string,
  countyAnswer: string,
  motion: MotionDef
): FilingInfo {
  const res = resolveZip(zip);
  const steps: FilingStep[] = [];

  steps.push({
    text: 'Print two copies of everything in your packet: one for the court, one for the other party. Keep a third copy for yourself.',
  });

  if (res.isNM && res.county) {
    const c = res.county;
    steps.push({
      text: `File at the ${c.districtCourt} (county seat: ${c.countySeat}). Many smaller cases — small claims and many evictions — file instead at the ${c.lowerCourt}. When in doubt, call the clerk and ask which court takes your case type.`,
      links: [
        { label: `${c.county} County court information (NM Courts)`, url: c.filingUrl },
        { label: 'New Mexico Courts self-help', url: c.selfHelpUrl },
      ],
    });
    steps.push({
      text: 'You can look up your case and deadlines afterward on the New Mexico case lookup.',
      links: [{ label: 'NM Case Lookup', url: 'https://caselookup.nmcourts.gov' }],
    });
  } else if (res.isNM) {
    steps.push({
      text: `Your ZIP is in New Mexico but we could not pin down the county from the ZIP alone. Your case belongs in ${countyAnswer || 'your'} County — confirm the county, then file at that county's District Court (or Magistrate/Metropolitan Court for small claims and many evictions).`,
      links: [{ label: 'New Mexico Courts self-help', url: 'https://www.nmcourts.gov/self-help/' }],
    });
  } else {
    const st = (stateAnswer || '').trim();
    const fb = Object.values(STATE_FALLBACKS).find(
      (s) => s.name.toLowerCase() === st.toLowerCase()
    );
    steps.push({
      text: `File at the court named in your caption${countyAnswer ? ` for ${countyAnswer} County` : ''}${st ? `, ${st}` : ''}. Start at your state judiciary's self-help site to find that court's filing page, hours, and local forms — many courts require their own cover sheet or form on top of a general motion.`,
      links: fb
        ? [{ label: `${fb.name} courts / self-help`, url: fb.judiciaryUrl }]
        : [{ label: 'Find your state court (USA.gov state courts directory)', url: 'https://www.usa.gov/state-courts' }],
    });
  }

  steps.push({
    text: 'Pay the filing fee at the clerk\'s window if one applies (many motions in an already-open case are free or low-cost). If you cannot afford it, file the fee-waiver (in forma pauperis) request in this app at the same time — do not skip filing because of the fee.',
  });

  if (motion.companions.length) {
    steps.push({
      text: `File these companions with the motion: ${motion.companions.join('; ')}.`,
    });
  }

  steps.push({
    text: 'Serve a copy on the other party (or their lawyer) using the method your court allows — usually mail, email/e-service, or hand delivery for motions in an open case — then make sure the Certificate of Service in your packet is signed and filed. This is how you prove they got it.',
  });

  for (const g of motion.gotchas) {
    steps.push({ text: `FOR THIS MOTION: ${g}` });
  }

  steps.push({
    text: 'Keep your stamped copies and proof of service somewhere safe, and watch the mail/email for a hearing notice or the other side\'s response. Response deadlines commonly run about two to three weeks but vary by court — if you get a notice, act on its dates, not on general advice.',
  });

  const countyName = res.county ? res.county.county : countyAnswer || null;
  return {
    zip: res.zip,
    heading: res.county
      ? `How to file in ${res.county.county} County, New Mexico`
      : 'How to file your motion',
    countyName,
    approximate: res.approximate,
    steps,
  };
}
