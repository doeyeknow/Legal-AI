import AccountPanel from '@/components/AccountPanel';
import InstallHint from '@/components/InstallHint';
import { DISCLAIMER } from '@/lib/motions/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Sign in or create a free quikForm account so your information fills out every court document for you.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: true },
};

export default function AccountPage() {
  return (
    <div className="accountpage">
      <h1>Your account</h1>
      <p className="fineprint">
        The basic information on your account fills out the caption and signature block of every
        document you prepare — so you only type it once. You prepare documents for yourself, or
        for someone else; their information never replaces yours here.
      </p>
      <AccountPanel />
      <InstallHint />
      <p className="fineprint">{DISCLAIMER}</p>
    </div>
  );
}
