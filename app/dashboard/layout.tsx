import type { Metadata } from 'next';
import FinderShell from '@/components/FinderShell';

// Private, signed-in pages: never indexed.
export const metadata: Metadata = {
  title: { default: 'My cases', template: '%s | quikForm' },
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinderShell>
      <div className="dashpage">{children}</div>
    </FinderShell>
  );
}
