import EvidenceLocker from '@/components/EvidenceLocker';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Evidence locker' };

export default function EvidencePage() {
  return <EvidenceLocker />;
}
