import type { Metadata } from 'next';
import FinderShell from '@/components/FinderShell';
import DefenseCheck from '@/components/DefenseCheck';

export const metadata: Metadata = {
  title: 'Check my case — ways to get criminal charges dropped',
  description: 'Answer simple yes / no questions about your stop, search, questioning, and evidence to see which defenses and dismissal paths may apply to your criminal case.',
  alternates: { canonical: '/defenses/check' },
  openGraph: { url: '/defenses/check', title: 'Check my case | quikForm' },
};

export default function DefenseCheckPage() {
  return (
    <FinderShell>
      <div className="library defpage">
        <h1>Check my case</h1>
        <DefenseCheck />
      </div>
    </FinderShell>
  );
}
