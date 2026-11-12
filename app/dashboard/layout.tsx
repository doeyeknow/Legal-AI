import FinderShell from '@/components/FinderShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinderShell>
      <div className="dashpage">{children}</div>
    </FinderShell>
  );
}
