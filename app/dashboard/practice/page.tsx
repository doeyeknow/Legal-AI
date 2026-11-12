import PracticeSim from '@/components/PracticeSim';
import { DISCLAIMER } from '@/lib/motions/types';

export default function PracticePage() {
  return (
    <div>
      <h1>Simulated hearing</h1>
      <p className="fineprint">
        Practice the questions a judge is likely to ask on your motion — with the coaching
        after each one. Turn on voice to hear the judge ask each question out loud. {DISCLAIMER}
      </p>
      <PracticeSim />
    </div>
  );
}
