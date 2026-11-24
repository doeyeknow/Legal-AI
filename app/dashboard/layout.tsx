import type { Metadata } from 'next';
import FinderShell from '@/components/FinderShell';
import { requireMemberPage } from '@/lib/membership-page';

// Private, signed-in pages: never indexed.
export const metadata: Metadata = {
  title: { default: 'My cases', template: '%s | quikForm' },
  robots: { index: false, follow: false, nocache: true },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireMemberPage();
  return (
    <FinderShell>
      <div className="dashpage">{children}</div>
    </FinderShell>
  );
}
