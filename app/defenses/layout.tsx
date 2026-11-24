import { requireMemberPage } from '@/lib/membership-page';

export default async function DefenseLayout({ children }: { children: React.ReactNode }) {
  await requireMemberPage();
  return children;
}
