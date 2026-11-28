import type { Metadata } from 'next';
import Link from 'next/link';
import BasicDash from '@/components/BasicDash';
import { listCases, listDocuments, DRAFT_STATUS } from '@/lib/cases';
import { activeMembership } from '@/lib/membership';
import { pageAccount } from '@/lib/membership-page';
import { getMotion } from '@/lib/motions/match';

export const dynamic = 'force-dynamic';

// Private, signed-in page: never indexed. This is the basic
// dashboard for accounts without a membership — drafts to resume
// and edit, and the documents they paid for, with re-download.
// The full member dashboard stays behind its own gate.
export const metadata: Metadata = {
  title: 'My documents & drafts | quikForm',
  description: 'Your in-progress interview drafts and the court documents you paid for.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function MyDocumentsPage() {
  const user = await pageAccount();
  if (!user) {
    return (
      <section className="homepage accountpage">
        <p className="eyebrow">My documents</p>
        <h1>Your drafts &amp; documents</h1>
        <div className="acctcard">
          <h3>Sign in to see your documents</h3>
          <p>
            Your interview drafts and the documents you paid for live behind your account,
            so only you can see them.
          </p>
          <div className="choices">
            <Link className="btn primary" href="/account">Sign in / Create account</Link>
            <Link className="btn" href="/interview">Start the free interview</Link>
          </div>
        </div>
      </section>
    );
  }
  const [cases, documents, membership] = await Promise.all([
    listCases(user.id).catch(() => null),
    listDocuments(user.id).catch(() => null),
    activeMembership(user.id).catch(() => null),
  ]);
  if (!cases || !documents) {
    return (
      <section className="homepage accountpage">
        <p className="eyebrow">My documents</p>
        <h1>Your drafts &amp; documents</h1>
        <div className="acctcard">
          <h3>Documents are being set up</h3>
          <p>
            Your drafts and documents are not available just yet. Nothing is lost — the
            interview works without an account, and your paid documents will show here
            once accounts are back.
          </p>
          <div className="choices">
            <Link className="btn primary" href="/interview">Start the free interview</Link>
          </div>
        </div>
      </section>
    );
  }
  const drafts = cases
    .filter((c) => c.status === DRAFT_STATUS)
    .map((c) => ({
      id: c.id,
      title: c.title,
      motionName: (c.draftMotionId ? getMotion(c.draftMotionId)?.name : null) || 'Court motion',
      updatedAt: c.updatedAt,
    }));
  return (
    <section className="homepage accountpage">
      <p className="eyebrow">My documents</p>
      <h1>Your drafts &amp; documents</h1>
      <p className="lede">
        Pick up an interview where you left off, or download a document you already paid for.
      </p>
      <BasicDash drafts={drafts} documents={documents} isMember={Boolean(membership)} />
    </section>
  );
}
