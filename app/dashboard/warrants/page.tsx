import PortalsDirectory from '@/components/PortalsDirectory';
import {
  PORTALS,
  SHERIFF_EXAMPLES,
  WARRANT_NOTHING_PROVES,
  WARRANT_SAFE_STEPS,
  WARRANT_SHOWS_NOT_PROVE,
} from '@/lib/portals';
import { DISCLAIMER } from '@/lib/motions/types';

export default function WarrantsPage() {
  return (
    <div>
      <h1>Warrants &amp; court case lookup</h1>
      <p className="fineprint">
        The official way to check for a warrant or find a court case — state by state, with
        what each result actually proves. {DISCLAIMER}
      </p>
      <PortalsDirectory
        portals={PORTALS}
        sheriffExamples={SHERIFF_EXAMPLES}
        showsNotProve={WARRANT_SHOWS_NOT_PROVE}
        nothingProves={WARRANT_NOTHING_PROVES}
        safeSteps={WARRANT_SAFE_STEPS}
      />
    </div>
  );
}
