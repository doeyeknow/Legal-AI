import HearingLive from '@/components/HearingLive';
import { DISCLAIMER } from '@/lib/motions/types';

export default function HearingLivePage() {
  return (
    <div>
      <h1>Hearing companion</h1>
      <p className="fineprint">
        A live transcript with quiet suggestion cards while a hearing is underway — only where
        the court allows it. {DISCLAIMER}
      </p>
      <HearingLive />
    </div>
  );
}
