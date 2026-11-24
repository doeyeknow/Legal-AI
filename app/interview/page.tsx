import Interview from '@/components/Interview';
import type { Metadata } from 'next';
import { getMotion } from '@/lib/motions/match';

// A library deep link (?motion=<id>) gets that motion's own title
// and description, so each template has a searchable landing page.
export function generateMetadata({
  searchParams,
}: {
  searchParams: { [k: string]: string | string[] | undefined };
}): Metadata {
  const id = typeof searchParams.motion === 'string' ? searchParams.motion : '';
  const m = id ? getMotion(id) : null;
  // Drafts, case links, and inbox links are private — keep them out of search.
  const isPrivate = ['draft', 'case', 'fromInbox', 'session_id'].some((k) => k in searchParams);
  if (m) {
    const url = `/interview?motion=${encodeURIComponent(m.id)}`;
    return {
      title: `${m.name} — prepare it online and download for $5`,
      description: `${m.purpose} Answer plain-English questions, one at a time, and get a filing-ready ${m.name} PDF. ${m.category}. Document preparation, not legal advice.`.slice(0, 300),
      alternates: { canonical: url },
      openGraph: { url, title: `${m.name} | quikForm`, description: m.purpose },
      robots: isPrivate ? { index: false, follow: false } : undefined,
    };
  }
  return {
    title: 'Start your court document — free interview',
    description:
      'Prepare a court motion with a free interview. Download the PDF and filing instructions for $5, or get the download included with membership.',
    alternates: { canonical: '/interview' },
    robots: isPrivate ? { index: false, follow: false } : undefined,
  };
}

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
