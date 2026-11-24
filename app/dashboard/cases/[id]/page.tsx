import type { Metadata } from 'next';
import CaseDetail from '@/components/CaseDetail';

export const metadata: Metadata = { title: 'Case' };

export default function CasePage({ params }: { params: { id: string } }) {
  return <CaseDetail caseId={params.id} />;
}
