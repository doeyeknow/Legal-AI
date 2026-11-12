import ChargesSearch from '@/components/ChargesSearch';
import { CHARGES, CHARGE_CATEGORIES, CHARGES_FRAMING } from '@/lib/charges';
import { DISCLAIMER } from '@/lib/motions/types';

export default function ChargesPage() {
  return (
    <div>
      <h1>Charge library</h1>
      <p className="fineprint">
        Forty common charges in plain English — what each one means, what the prosecution has
        to prove, and the typical range. {DISCLAIMER}
      </p>
      <ChargesSearch charges={CHARGES} categories={CHARGE_CATEGORIES} framing={CHARGES_FRAMING} />
    </div>
  );
}
