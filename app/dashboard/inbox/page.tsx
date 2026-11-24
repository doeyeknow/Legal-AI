import InboxPage from '@/components/InboxPage';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Court mail' };

export default function CourtMailPage() {
  return <InboxPage />;
}
