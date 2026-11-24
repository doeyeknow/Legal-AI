import HearingLive from '@/components/HearingLive';
import CallCompanion from '@/components/CallCompanion';
import { DISCLAIMER } from '@/lib/motions/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Hearing companion' };

const ID = /^[0-9a-f-]{36}$/i;

export default function HearingLivePage({
  searchParams,
}: {
  searchParams: { case?: string; call?: string; mode?: string };
}) {
  const caseId = searchParams.case && ID.test(searchParams.case) ? searchParams.case : null;
  const callId = searchParams.call && ID.test(searchParams.call) ? searchParams.call : null;
  if (caseId && (callId || searchParams.mode === 'call')) {
    return (
      <div>
        <h1>Hearing companion: phone call</h1>
        <p className="fineprint">
          Listens along while you’re on the phone about your case, suggests what to say, and adds
          the details it hears to the case. {DISCLAIMER}
        </p>
        <CallCompanion caseId={caseId} eventId={callId} />
      </div>
    );
  }
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
