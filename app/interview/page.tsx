import Interview from '@/components/Interview';

// The interview is a locked step-screen stage: its own slim header
// (home link, motion, progress, voice toggle) owns the screen and
// nothing scrolls. The disclaimer travels inside the flow — it is
// the second line of the opening screen and sits on the pay screen.
export default function InterviewPage() {
  return (
    <div className="interviewpage">
      <Interview />
    </div>
  );
}
