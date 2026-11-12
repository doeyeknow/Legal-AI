import Link from 'next/link';
import { DISCLAIMER } from '@/lib/motions/types';
import { Icon } from '@/components/icons';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashpage">
      <nav className="dashnav">
        <Link href="/dashboard"><Icon name="folder" size={15} /> My cases</Link>
        <Link href="/dashboard/charges"><Icon name="list" size={15} /> Charge library</Link>
        <Link href="/dashboard/warrants"><Icon name="search" size={15} /> Warrants &amp; case lookup</Link>
        <Link href="/dashboard/practice"><Icon name="target" size={15} /> Hearing practice</Link>
        <Link href="/dashboard/hearing-live"><Icon name="headphones" size={15} /> Hearing companion</Link>
      </nav>
      {children}
      <p className="fineprint">{DISCLAIMER}</p>
    </div>
  );
}
